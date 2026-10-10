/* Scena: GLB model kuhinje → delovi (pieces) → jedna vremenska linija; stanje = funkcija progresa P (0–1). */
import * as THREE from 'three';
import { camera as camCfg, stagesTiming as TT } from '../../config/site.js';
import { loadGLB, bakeGeometry, components, subGeometry } from './model.js';
import { Piece, stagger, smooth } from './piece.js';
import { createLightMaterials, createLights } from './lights.js';
import { buildMeasure } from './measure.js';

/* unutrašnje mere prostorije u modelu (m) — iz geometrije zidova */
export const ROOM = { x0: -3.27, x1: 2.78, y0: 0.18, y1: 3.28, zb: -3.75, zf: 2.1 };

/* kategorija po čvoru modela (top-level ispod RootNode) */
const NODE_CAT = {
  Island: 'island', Stool: 'stool', Spotlights: 'lights', Sink: 'fixture', Vent: 'fixture', TRB_84300: 'fixture',
  DVN_74030_TTC_BK: 'hood', RLF_74925: 'tall', 'DSI+46750': 'tall', HLB_840: 'tall', MS_622_BIS: 'tall', CLC855_URBAN: 'appliance',
  Cabinets: 'cab', WoodCabinet: 'cab', GlassC: 'cab',
};
const SHELL = new Set(['Walls', 'Skirting_Board']);

const yieldMain = () => (globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

export async function buildScene({ url, aniso, tier, onProgress = () => {} }) {
  const shadowSize = tier.shadow, fadeOn = tier.fade;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9d3c8);

  /* ---------- učitavanje ---------- */
  const gltf = await loadGLB(url, (p) => onProgress(p * 0.8));
  onProgress(0.82);
  await yieldMain();
  gltf.scene.updateMatrixWorld(true);
  const rootNode = gltf.scene.getObjectByName('RootNode') || gltf.scene;

  const topOf = (m) => { let o = m; while (o.parent && o.parent !== rootNode) o = o.parent; return o.name; };
  const all = [];       // svi Piece
  const byCat = {};     // kategorija → Piece[]
  const root = new THREE.Group(); root.name = 'kitchen'; scene.add(root);
  const shell = new THREE.Group(); shell.name = 'shell'; scene.add(shell);
  const add = (cat, group, sort, opts = {}) => {
    root.add(group);
    const p = new Piece(group, { t0: 0, t1: 1, fade: fadeOn ? 0.2 : 0, ...opts });
    p.cat = cat; p.sort = sort;
    (byCat[cat] ||= []).push(p); all.push(p);
    return p;
  };
  const prep = (m) => {
    if (m.map) m.map.anisotropy = aniso;
    if (m.normalMap) m.normalMap.anisotropy = aniso;
    if (m.roughnessMap) m.roughnessMap.anisotropy = aniso;
    m.envMapIntensity = 0.9;
    if (!tier.normals && m.normalMap) { m.normalMap = null; m.needsUpdate = true; }   // slab uređaj: bez normal mapa (manje memorije i uzoraka)
    if (m.transparent || m.alphaTest > 0 || m.opacity < 1) m.userData.noFade = true;
  };

  /* ---------- prolaz po mrežama ---------- */
  const meshes = [];
  rootNode.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const shellMats = [];
  const nodeGroups = new Map();     // top ime → { group, meshes } za nepodeljene čvorove
  const cells = new Map();          // ključ ćelije → { cat, parts:[{geo,mat}], sort }
  let step = 0;
  for (const mesh of meshes) {
    if (++step % 4 === 0) { onProgress(0.82 + 0.16 * (step / meshes.length)); await yieldMain(); }
    const top = topOf(mesh);
    const mat = mesh.material;
    prep(mat);
    const geo = bakeGeometry(mesh);

    if (SHELL.has(top)) {
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = shadowSize > 0; m.castShadow = shadowSize > 0 && top === 'Walls';
      m.userData.shell = top;
      shell.add(m);
      if (top === 'Walls' && !/Floor/i.test(mat.name)) shellMats.push(mat);
      continue;
    }
    const cat = NODE_CAT[top] || 'acc';
    if (cat === 'cab' || cat === 'island') {
      // spojeni meshevi → komponente → ćelije po položaju (za montažu po grupama)
      const comps = components(geo);
      for (const c of comps) {
        const upper = c.cy >= 1.15;
        let sub = cat;
        if (cat === 'cab') {
          if (mat.name === 'Countertop') sub = 'counter';
          else if (mat.name === 'Chrome') sub = 'handle';
          else sub = upper ? 'upper' : (c.cy < 1.15 && c.cx < -2.3 ? 'tallside' : 'base');
        }
        const key = [top, mat.name, sub, Math.round(c.cx / (0.6 * (tier.cell || 1))), Math.round(c.cz / (0.8 * (tier.cell || 1)))].join('|');
        let cell = cells.get(key);
        if (!cell) { cell = { cat: sub, mat, tris: [], geo, cx: 0, cz: 0, n: 0 }; cells.set(key, cell); }
        cell.tris.push(...c.tris);
        cell.cx += c.cx; cell.cz += c.cz; cell.n++;
      }
      continue;
    }
    let ng = nodeGroups.get(top);
    if (!ng) { ng = { cat, parts: [], cx: 0, cz: 0, n: 0 }; nodeGroups.set(top, ng); }
    ng.parts.push({ geo, mat });
    geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    ng.cx += c.x; ng.cz += c.z; ng.n++;
  }

  const meshFor = (geo, mat, cat) => {
    const m = new THREE.Mesh(geo, mat);
    const glass = mat.transparent;
    m.castShadow = shadowSize > 0 && !glass && cat !== 'lights'; m.receiveShadow = shadowSize > 0 && !glass;
    return m;
  };
  // putanja U-oblika: leva strana (spreda→nazad), zadnji zid (levo→desno), desna strana (nazad→spreda)
  const pathKey = (x, z) => (x < -2.3 ? 0.9 - z : x > 2.0 ? 12 + (z + 3.75) : 5.6 + (x + 3.3));

  for (const cell of cells.values()) {
    const g = new THREE.Group();
    g.add(meshFor(subGeometry(cell.geo, cell.tris), cell.mat, cell.cat));
    const cx = cell.cx / cell.n, cz = cell.cz / cell.n;
    add(cell.cat, g, pathKey(cx, cz));
  }
  // delovi iste ćelije dele grupu sa istim položajem/vremenom → spoji po (cat, ćelija)
  for (const ng of nodeGroups.values()) {
    const g = new THREE.Group();
    for (const p of ng.parts) g.add(meshFor(p.geo, p.mat, ng.cat));
    add(ng.cat, g, pathKey(ng.cx / ng.n, ng.cz / ng.n));
  }

  /* ---------- plafon, pod (sirovi sloj), boje zidova ---------- */
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe9e5dd, roughness: 0.95 }));
  ceil.position.set(-0.26, ROOM.y1 + 0.002, 1.5);
  ceil.receiveShadow = true;
  scene.add(ceil);

  // prednji "podest" izvan modela: da kamera (posebno mobilna, udaljena) nikad ne vidi prazninu
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(16, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb9b5ae, roughness: 0.9 }));
  apron.position.set(-0.26, ROOM.y0 - 0.004, ROOM.zf + 6.9);
  apron.receiveShadow = true;
  scene.add(apron);

  const rawFloor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.zf - ROOM.zb).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x9d9a94, roughness: 0.92 }));
  rawFloor.position.set((ROOM.x0 + ROOM.x1) / 2, ROOM.y0 + 0.0015, (ROOM.zb + ROOM.zf) / 2);
  rawFloor.receiveShadow = true;
  const uProg = { value: 0 };
  rawFloor.material.onBeforeCompile = (sh) => {
    sh.uniforms.uProg = uProg;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(position,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform float uProg;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        { float t = (vWp.z - (${ROOM.zb.toFixed(3)})) / (${(ROOM.zf - ROOM.zb).toFixed(3)});
          float n = fract(sin(dot(floor(vWp.xz*70.0), vec2(12.9898,78.233))) * 43758.5453);
          if (t + n*0.035 <= uProg*1.04) discard; }`);
  };
  shell.add(rawFloor);

  // zidovi: boja se "nanosi" — iz sirovog sivila u pravu boju
  const wallTints = shellMats.map((m) => { const mm = m.clone(); mm.userData = { ...m.userData }; return mm; });
  shell.traverse((o) => { if (o.isMesh && o.userData.shell === 'Walls') { const i = shellMats.indexOf(o.material); if (i >= 0) o.material = wallTints[i]; } });
  const wallTarget = wallTints.map((m) => m.color.clone());
  const rawWall = new THREE.Color(0x8d8a84);

  // lajsne (skirting) se pojavljuju sa završnom obradom
  const skirt = [];
  shell.children.filter((m) => m.userData.shell === 'Skirting_Board').forEach((m) => { shell.remove(m); const g = new THREE.Group(); g.add(m); skirt.push(add('skirt', g, 0)); });

  /* ---------- svetlo i merenje ---------- */
  const LM = createLightMaterials();
  const lights = createLights(scene, LM, { shadowSize, room: ROOM, mode: tier.lights });
  // emisivni materijali iz modela (ugradni spotovi) prate paljenje
  const emissives = [];
  const seenEm = new Set();
  all.forEach((p) => p.obj.traverse((o) => { const m = o.isMesh && o.material; if (m && !seenEm.has(m) && m.emissiveIntensity > 0 && m.emissive && m.emissive.getHex() !== 0) { seenEm.add(m); emissives.push({ m, base: m.emissiveIntensity }); } }));
  const measure = buildMeasure(ROOM);
  scene.add(measure.group);

  /* ---------- vremenska linija ---------- */
  const sorted = (c) => (byCat[c] || []).sort((a, b) => a.sort - b.sort);
  const cfg = {
    base:      { w: TT.base,      dur: 0.075, from: [0, 0.0, 0.55], rot: [0.05, 0, 0] },
    tallside:  { w: TT.base,      dur: 0.075, from: [0, 0.0, 0.55], rot: [0.05, 0, 0] },
    tall:      { w: TT.tall,      dur: 0.07,  from: [0, 0.0, 0.5],  rot: [0.04, 0, 0] },
    upper:     { w: TT.upper,     dur: 0.065, from: [0, 0.1, 0.55], rot: [-0.05, 0, 0] },
    counter:   { w: TT.counter,   dur: 0.05,  from: [0, 0.45, 0],   rot: [0.012, 0, 0] },
    fixture:   { w: TT.fixture,   dur: 0.04,  from: [0, 0.28, 0],   rot: [0, 0, 0] },
    hood:      { w: TT.fixture,   dur: 0.05,  from: [0, 0.0, 0.4],  rot: [-0.05, 0, 0] },
    appliance: { w: TT.fixture,   dur: 0.04,  from: [0, 0.2, 0.3],  rot: [0, 0, 0] },
    handle:    { w: TT.handle,    dur: 0.03,  from: [0, 0, 0.1],    rot: [0, 0, 0], fade: 0.7 },
    island:    { w: TT.island,    dur: 0.06,  from: [0, 0.55, 0],   rot: [0, 0, 0.02] },
    stool:     { w: TT.stool,     dur: 0.045, from: [0, 0.7, 0],    rot: [0, 0.5, 0] },
    lights:    { w: TT.lights,    dur: 0.04,  from: [0, 0.3, 0],    rot: [0, 0, 0], fade: 0.7 },
    acc:       { w: TT.acc,       dur: 0.035, from: [0, 0.14, 0],   rot: [0, 0, 0], fade: 0.8 },
    skirt:     { w: TT.skirt,     dur: 0.05,  from: [0, 0, 0],      rot: [0, 0, 0], fade: 1 },
  };
  for (const [cat, c] of Object.entries(cfg)) {
    const list = sorted(cat);
    list.forEach((p) => { p.from = c.from; p.rot = c.rot; if (c.fade && fadeOn) p.fade = c.fade; });
    stagger(list, c.w[0], c.w[1], c.dur);
  }
  // "ostrvo" je i kamena ploča: isti prozor, ali slojevi po redu
  [...all].forEach((p) => p.update(0));

  let lastP = -1;
  function update(P) {
    P = Math.min(1, Math.max(0, P));
    const fin = smooth(TT.finish[0], TT.finish[1], P);
    uProg.value = smooth(TT.floor[0], TT.floor[1], P);
    rawFloor.visible = uProg.value < 0.999;
    wallTints.forEach((m, i) => m.color.lerpColors(rawWall, wallTarget[i], fin));
    const mi = smooth(TT.measureIn[0], TT.measureIn[1], P), mo = smooth(TT.measureOut[0], TT.measureOut[1], P);
    measure.set(mi, mo);
    for (const p of all) p.update(P);
    const k = smooth(TT.light[0], TT.light[1], P);
    lights.setWarm(k);
    for (const e of emissives) e.m.emissiveIntensity = e.base * k;
    lastP = P;
    return { mi, mo };
  }

  const v = (a) => new THREE.Vector3(...a);
  function cameraAt(P, mobile) {
    const c = mobile ? camCfg.mobile : camCfg.desktop;
    const t = 0.38 * P + 0.62 * smooth(0.8, 1, P);
    const e = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
    return { fov: c.fov, pos: v(c.start.pos).lerp(v(c.end.pos), e), look: v(c.start.look).lerp(v(c.end.look), e) };
  }

  // oslobodi originalne glTF geometrije (već su ispečene u nove) i dekodirane slike
  gltf.scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  gltf.scene.clear();
  onProgress(1);
  return { scene, update, cameraAt, measure, lights, all, T: TT, get lastP() { return lastP; }, byCat };
}
