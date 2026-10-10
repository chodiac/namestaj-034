/* Osvetljenje: sunce sa prednje strane (senke), hemisfera, topli akcenti koji se pale u fazi 5.
   Broj svetala je konstantan (bez rekompajliranja šejdera) — menja se samo intenzitet. */
import * as THREE from 'three';

export function createLightMaterials() { return {}; }

export function createLights(scene, LM, { shadowSize = 2048, room }) {
  const g = new THREE.Group();
  g.name = 'lights';

  const sun = new THREE.DirectionalLight(0xfff1de, 2.6);
  sun.position.set(5.2, 7.0, 8.5);
  sun.target.position.set(-0.3, 0.4, -1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const c = sun.shadow.camera;
  c.left = -7.5; c.right = 7.5; c.top = 7.5; c.bottom = -7.5; c.near = 1; c.far = 32;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  g.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xe8eef6, 0x9a8a78, 0.34);
  g.add(hemi);

  const spots = [-1.9, -0.7, 0.5, 1.7].map((x) => {
    const s = new THREE.SpotLight(0xffc88f, 0, 2.6, 1.0, 1, 2);
    s.position.set(x, 1.85, room.zb + 0.65);
    s.target.position.set(x, 1.1, room.zb + 0.4);
    g.add(s, s.target);
    return s;
  });
  const pend = [-0.7, 0.4].map((x) => {
    const p = new THREE.PointLight(0xffc690, 0, 4.2, 2);
    p.position.set(x, 2.3, -1.25);
    g.add(p);
    return p;
  });

  scene.add(g);
  return {
    group: g, sun, hemi,
    setWarm(k) {
      spots.forEach((s) => (s.intensity = 7 * k));
      pend.forEach((p) => (p.intensity = 3.2 * k));
    },
  };
}
