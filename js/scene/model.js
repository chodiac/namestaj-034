/* Učitavanje i priprema GLB modela kuhinje: pečenje svetskih transformacija u geometriju,
   razdvajanje spojenih mesheva na komponente i grupisanje u "delove" (pieces) za montažu. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export async function loadGLB(url, onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.loadAsync(url, (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); });
}

/** Kvantizovane atribute pretvara u Float32 i primenjuje svetsku matricu → geometrija u metrima, čvor u identitetu. */
export function bakeGeometry(mesh) {
  const g = mesh.geometry, out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'uv1', 'color']) {
    const a = g.attributes[name];
    if (!a) continue;
    const s = a.itemSize, arr = new Float32Array(a.count * s);
    for (let i = 0; i < a.count; i++) {
      arr[i * s] = a.getX(i);
      if (s > 1) arr[i * s + 1] = a.getY(i);
      if (s > 2) arr[i * s + 2] = a.getZ(i);
      if (s > 3) arr[i * s + 3] = a.getW(i);
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  if (g.index) out.setIndex(new THREE.BufferAttribute(Uint32Array.from(g.index.array), 1));
  out.applyMatrix4(mesh.matrixWorld);
  if (mesh.matrixWorld.determinant() < 0 && out.index) {
    const ix = out.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  }
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
}

/** Povezane komponente (po deljenim temenima). Vraća [{tris:Uint32Array, cx,cy,cz}] */
export function components(geo) {
  const n = geo.attributes.position.count, pos = geo.attributes.position;
  const idx = geo.index ? geo.index.array : null, tcount = idx ? idx.length / 3 : n / 3;
  const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
  const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const v = (t, k) => (idx ? idx[t * 3 + k] : t * 3 + k);
  for (let t = 0; t < tcount; t++) { const a = f(v(t, 0)), b = f(v(t, 1)), c = f(v(t, 2)); par[b] = a; par[f(c)] = f(a); }
  const map = new Map();
  for (let t = 0; t < tcount; t++) {
    const r = f(v(t, 0));
    let c = map.get(r);
    if (!c) { c = { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; map.set(r, c); }
    c.tris.push(t);
    for (let k = 0; k < 3; k++) {
      const i = v(t, k), p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      for (let a = 0; a < 3; a++) { if (p[a] < c.min[a]) c.min[a] = p[a]; if (p[a] > c.max[a]) c.max[a] = p[a]; }
    }
  }
  return [...map.values()].map((c) => ({ tris: c.tris, cx: (c.min[0] + c.max[0]) / 2, cy: (c.min[1] + c.max[1]) / 2, cz: (c.min[2] + c.max[2]) / 2, min: c.min, max: c.max }));
}

/** Nova geometrija samo sa zadatim trouglovima (preslikana temena). */
export function subGeometry(geo, tris) {
  const n = geo.attributes.position.count, idx = geo.index ? geo.index.array : null;
  const remap = new Int32Array(n).fill(-1);
  const keep = [];
  const outIdx = new Uint32Array(tris.length * 3);
  let w = 0;
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx[t * 3 + k] : t * 3 + k;
      if (remap[i] < 0) { remap[i] = keep.length; keep.push(i); }
      outIdx[w++] = remap[i];
    }
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name], s = a.itemSize, arr = new Float32Array(keep.length * s);
    for (let j = 0; j < keep.length; j++) for (let k = 0; k < s; k++) arr[j * s + k] = a.array[keep[j] * s + k];
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  out.setIndex(new THREE.BufferAttribute(outIdx, 1));
  return out;
}
