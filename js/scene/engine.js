/* Renderer + petlja. Renderuje samo kad je potrebno (scroll/promena veličine), pauzira van ekrana i u pozadini,
   prati stvarno trajanje kadrova i samo SPUŠTA kvalitet (pa poster) ako uređaj ne stiže. Potpuno oslobađa resurse u dispose(). */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { scroll as scrollCfg } from '../../config/site.js';
import { buildScene } from './scene.js';
import { TIERS, isSoftwareGL } from './quality.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

export async function createEngine({ canvas, tierName = 'low', onProgress = () => {}, onFrame = () => {}, onFail = () => {}, onTier = () => {} }) {
  const tier = { ...TIERS[tierName] };
  const bud = +new URLSearchParams(location.search).get('budget');   // dev: simulira slabiji uređaj (ms/kadar)
  if (bud) tier.budget = bud;
  const coarse = matchMedia('(pointer: coarse)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: tier.aa, alpha: false, stencil: false,
      powerPreference: coarse ? 'default' : 'high-performance',
      failIfMajorPerformanceCaveat: true,       // softverski GL → izuzetak → poster
    });
  } catch (e) { throw new Error('WebGL nije dostupan ili je softverski'); }
  const sw = isSoftwareGL(renderer.getContext());
  if (sw) { renderer.dispose(); throw new Error('Softverski renderer: ' + sw); }

  renderer.shadowMap.enabled = tier.shadow > 0;
  renderer.shadowMap.type = THREE.PCFShadowMap;      // jeftinije od PCFSoft
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const parent = () => canvas.parentElement;
  let W = 1, H = 1, mobile = false, qScale = 1, disposed = false;
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 40);
  const measureMobile = () => { const w = parent().clientWidth, h = parent().clientHeight; return w < 760 || h > w * 1.15; };
  mobile = measureMobile();

  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), tierName === 'high' ? 8 : tierName === 'mid' ? 4 : 2);

  /* gubitak konteksta: bez pokušaja obnove (štedi telefon), prelazak na poster */
  const onLost = (e) => { e.preventDefault(); fail('gubitak WebGL konteksta'); };
  canvas.addEventListener('webglcontextlost', onLost);

  let S, envRT;
  const ro = new ResizeObserver(() => { resize(); wake(); });
  let target = 0, shown = 0, dirty = true, active = true, raf = 0, last = 0, lastRender = 0, frameNo = 0;
  const samples = []; let lastStep = 0, step = 0;

  function cleanup() {
    canvas.removeEventListener('webglcontextlost', onLost);
    try { ro.disconnect(); } catch (e) { /* nije bilo posmatrano */ }
    cancelAnimationFrame(raf); raf = 0;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cleanup();
    const seen = new Set();
    S?.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      [].concat(o.material || []).forEach((m) => {
        if (seen.has(m)) return;
        seen.add(m);
        for (const k in m) { const t = m[k]; if (t && t.isTexture) t.dispose(); }
        m.dispose();
      });
    });
    envRT?.dispose();
    S?.lights?.sun?.shadow?.map?.dispose();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* kontekst je već izgubljen */ }
    canvas.width = canvas.height = 1;          // oslobađa backing store
  }
  function fail(why) { if (disposed) return; dispose(); onFail(why); }

  try {
    S = await buildScene({
      url: new URL('../../' + tier.model, import.meta.url).href, aniso, tier,
      onProgress: (p) => onProgress(p * 0.9, p < 0.8 ? 'Učitavam 3D model' : 'Sastavljam scenu'),
    });
  } catch (e) { dispose(); throw e; }
  if (disposed) return null;

  const pm = new THREE.PMREMGenerator(renderer);
  envRT = pm.fromScene(new RoomEnvironment(), 0.035);
  S.scene.environment = envRT.texture;
  S.scene.environmentIntensity = 0.55;
  pm.dispose();

  function applyCamera(P) {
    const c = S.cameraAt(P, mobile);
    cam.fov = c.fov; cam.position.copy(c.pos); cam.lookAt(c.look);
    if (!mobile && W / H > 1.3) cam.setViewOffset(W, H, -W * 0.05, 0, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  function resize() {
    if (disposed) return;
    const p = parent();
    W = Math.max(2, p.clientWidth); H = Math.max(2, p.clientHeight);
    mobile = measureMobile();
    let dpr = Math.min(window.devicePixelRatio || 1, tier.dpr) * qScale;
    dpr = Math.min(dpr, Math.sqrt(tier.px / (W * H)));          // gornja granica ukupnog broja piksela
    renderer.setPixelRatio(Math.max(0.5, dpr));
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    dirty = true;
  }
  const project = (v3) => { const v = v3.clone().project(cam); return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z }; };

  function render() {
    const st = S.update(shown);
    applyCamera(shown);
    if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = shown === target || (frameNo % Math.max(1, tier.shadowEvery) === 0);
    renderer.render(S.scene, cam);
    frameNo++;
    onFrame({ project, mi: st.mi, mo: st.mo, P: shown });
    dirty = false;
  }

  /* spuštanje kvaliteta po izmerenom trajanju kadrova: rezolucija → senke → rezolucija → poster */
  function degrade(why) {
    step++;
    const note = (action) => onTier({ step, action, why, qScale });
    if (step === 1) { qScale = 0.8; resize(); note('rezolucija ×0,8'); }
    else if (step === 2 && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false; S.lights.sun.castShadow = false;
      S.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); } });
      note('senke isključene');
    } else if (step <= 3) { qScale = 0.62; resize(); note('rezolucija ×0,62'); }
    else fail('performanse: ' + why);
  }
  function monitor(delta) {
    samples.push(delta);
    if (samples.length < 40) return;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    samples.length = 0;
    const now = performance.now();
    if (avg > tier.budget && now - lastStep > 2500) { lastStep = now; degrade(avg.toFixed(0) + ' ms/kadar'); }
  }

  function loop(now) {
    raf = 0;
    if (disposed || !active) return;
    if (tier.fps && now - lastRender < 1000 / tier.fps - 3 && (shown !== target || dirty)) { raf = requestAnimationFrame(loop); return; }
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    const animating = shown !== target;
    if (animating) {
      const tau = -0.0167 / Math.log(1 - scrollCfg.damping);
      shown += (target - shown) * (1 - Math.exp(-dt / tau));
      if (Math.abs(target - shown) < 0.00025) shown = target;
      dirty = true;
    }
    if (dirty) {
      const gap = lastRender ? now - lastRender : 0;
      render();
      if (animating && gap > 0 && gap < 400) monitor(gap);     // samo kadrovi u neprekidnoj animaciji
      lastRender = now;
    } else { last = 0; lastRender = 0; samples.length = 0; }
    if (shown !== target || dirty) raf = requestAnimationFrame(loop);
  }
  function wake() { if (!raf && active && !disposed) { last = 0; raf = requestAnimationFrame(loop); } }

  ro.observe(parent());
  resize();

  function freeBitmaps() {
    S.scene.traverse((o) => {
      if (!o.isMesh) return;
      [].concat(o.material).forEach((m) => {
        for (const k in m) { const t = m[k]; if (t && t.isTexture && t.image && typeof t.image.close === 'function') { try { t.image.close(); } catch (e) { /* već zatvoreno */ } } }
      });
    });
  }

  /* zagrevanje (kompajl šejdera + otpremanje tekstura) pa probno merenje na najtežem kadru */
  onProgress(0.92, 'Pripremam svetlo');
  await new Promise((r) => setTimeout(r, 0));
  shown = 1; render();
  try { if (renderer.compileAsync) await renderer.compileAsync(S.scene, cam); } catch (e) { /* nije kritično */ }
  if (disposed) return null;
  const gl = renderer.getContext(), ts = [];
  for (let i = 0; i < 6; i++) { const a = performance.now(); dirty = true; render(); gl.finish(); ts.push(performance.now() - a); }
  ts.splice(0, 2); ts.sort((a, b) => a - b);
  const bench = ts[Math.floor(ts.length / 2)];
  freeBitmaps();
  if (bench > 140) { fail('probni kadar prespor (' + bench.toFixed(0) + ' ms)'); return null; }
  if (bench > tier.budget * 0.8) degrade('probni kadar ' + bench.toFixed(0) + ' ms');
  shown = 0; target = 0; dirty = true; render();
  onProgress(1, 'Spremno');

  return {
    renderer, scene: S.scene, camera: cam, S, tierName, bench,
    get mobile() { return mobile; },
    get disposed() { return disposed; },
    setTarget(p) { target = Math.min(1, Math.max(0, p)); wake(); },
    jump(p) { target = shown = Math.min(1, Math.max(0, p)); dirty = true; if (active) wake(); else render(); },
    setActive(a) { if (disposed) return; active = a; if (a) { dirty = true; wake(); } else { cancelAnimationFrame(raf); raf = 0; } },
    get progress() { return shown; },
    renderNow() { if (!disposed) render(); },
    project, resize, dispose,
    stats() {
      const i = renderer.info;
      return { calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length, pr: renderer.getPixelRatio(), canvas: [canvas.width, canvas.height], step, qScale, bench };
    },
    /** dev: kadar sa proizvoljnom kamerom (za poster kadrove); vraća JPEG dataURL */
    shot({ pos, look, fov = 40, P = 1, w = 1600, h = 1000, q = 0.82 }) {
      const old = [renderer.getPixelRatio(), W, H];
      renderer.setPixelRatio(1); renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.fov = fov; cam.position.set(...pos); cam.lookAt(...look); cam.clearViewOffset(); cam.updateProjectionMatrix();
      S.update(P); renderer.shadowMap.needsUpdate = true; renderer.render(S.scene, cam);
      const url = canvas.toDataURL('image/jpeg', q);
      renderer.setPixelRatio(old[0]); renderer.setSize(old[1], old[2], false); cam.aspect = old[1] / old[2];
      dirty = true; render();
      return url;
    },
  };
}
