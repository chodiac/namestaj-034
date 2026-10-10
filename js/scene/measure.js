/* Ilustrativne merne linije u fazi 2 (dimenzije su stvarne dimenzije prostorije iz 3D modela). */
import * as THREE from 'three';

const fmt = (v) => v.toFixed(2).replace('.', ',') + ' m';

export function buildMeasure(R) {
  const g = new THREE.Group();
  g.name = 'measure';
  const mat = new THREE.MeshBasicMaterial({ color: 0xb48a50, transparent: true, depthTest: false, depthWrite: false });
  const t = 0.014;
  const unit = new THREE.BoxGeometry(1, t, t).translate(0.5, 0, 0);
  const tickG = new THREE.BoxGeometry(t, 0.2, t);
  const X = new THREE.Vector3(1, 0, 0);
  const lines = [], labels = [];
  const add = (a, b, text, off, delay, tickMode) => {
    a = new THREE.Vector3(...a); b = new THREE.Vector3(...b);
    const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
    const line = new THREE.Mesh(unit, mat);
    line.position.copy(a); line.quaternion.setFromUnitVectors(X, dir); line.renderOrder = 10;
    const ticks = [a, b].map((p) => {
      const tk = new THREE.Mesh(tickG, mat); tk.position.copy(p);
      if (tickMode === 'h') tk.rotation.z = Math.PI / 2; else if (tickMode === 'floor') tk.rotation.x = Math.PI / 2;
      tk.renderOrder = 10; return tk;
    });
    g.add(line, ...ticks);
    lines.push({ line, ticks, len, delay });
    labels.push({ pos: a.clone().lerp(b, 0.5).add(new THREE.Vector3(...off)), text, delay });
  };
  const z = R.zb + 0.02;
  add([R.x0, R.y1 - 0.25, z], [R.x1, R.y1 - 0.25, z], fmt(R.x1 - R.x0), [0, 0.2, 0], 0, 'v');
  add([R.x1 - 0.3, R.y0, z], [R.x1 - 0.3, R.y1, z], fmt(R.y1 - R.y0), [-0.0, 0, 0], 0.2, 'h');
  add([R.x0 + 0.35, R.y0 + 0.012, R.zb], [R.x0 + 0.35, R.y0 + 0.012, 0.95], fmt(0.95 - R.zb), [0.0, 0.18, 0], 0.4, 'floor');
  g.visible = false;
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  return {
    group: g, labels,
    set(pIn, pOut) {
      g.visible = pIn > 0.001 && pOut < 0.999;
      mat.opacity = 1 - pOut;
      for (const l of lines) {
        const k = Math.min(1, Math.max(0, (pIn - l.delay * 0.7) / 0.45));
        l.line.scale.x = Math.max(1e-4, l.len * ease(k));
        l.ticks.forEach((tk) => (tk.visible = k > 0.98));
      }
    },
    labelState(i, pIn, pOut) {
      const l = lines[i];
      return Math.min(1, Math.max(0, (pIn - l.delay * 0.7 - 0.25) / 0.3)) * (1 - pOut);
    },
  };
}
