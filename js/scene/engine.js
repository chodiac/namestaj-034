/* Renderer + petlja. Renderuje samo kada je potrebno (scroll, promena veličine), pauzira van ekrana,
   automatski smanjuje kvalitet ako kadar traje predugo. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { quality, scroll as scrollCfg, model as modelCfg } from '../../config/site.js';
import { buildScene } from './scene.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createEngine({ canvas, onProgress = () => {}, onFrame = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const parent = () => canvas.parentElement;
  let W = 1, H = 1, mobile = false, qScale = 1;
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 40);

  const measureMobile = () => {
    const w = parent().clientWidth, h = parent().clientHeight;
    return w < 760 || h > w * 1.15;
  };
  mobile = measureMobile();

  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), mobile ? 4 : 8);
  const shadowSize = mobile ? quality.shadowMapMobile : quality.shadowMap;

  /* --- učitavanje: preuzimanje modela (stvaran napredak) → sastavljanje scene --- */
  const url = new URL('../../' + (mobile ? modelCfg.mobile : modelCfg.desktop), import.meta.url).href;
  const labels = ['Učitavam model kuhinje', 'Sastavljam scenu'];
  const S = await buildScene({
    url, aniso, shadowSize, mobile,
    onProgress: (p) => onProgress(p * 0.9, p < 0.8 ? labels[0] : labels[1]),
  });
  const pm = new THREE.PMREMGenerator(renderer);
  S.scene.environment = pm.fromScene(new RoomEnvironment(), 0.035).texture;
  S.scene.environmentIntensity = 0.55;
  pm.dispose();

  let target = 0, shown = 0, dirty = true, active = true, raf = 0, last = 0;
  let frames = 0, acc = 0;

  function applyCamera(P) {
    const c = S.cameraAt(P, mobile);
    cam.fov = c.fov;
    cam.position.copy(c.pos);
    cam.lookAt(c.look);
    if (!mobile && W / H > 1.3) cam.setViewOffset(W, H, -W * 0.05, 0, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  function resize() {
    const p = parent();
    W = Math.max(2, p.clientWidth); H = Math.max(2, p.clientHeight);
    mobile = measureMobile();
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? quality.maxDprMobile : quality.maxDpr) * qScale;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    dirty = true;
  }
  const project = (v3) => {
    const v = v3.clone().project(cam);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z };
  };

  function render() {
    const st = S.update(shown);
    applyCamera(shown);
    renderer.render(S.scene, cam);
    onFrame({ project, mi: st.mi, mo: st.mo, P: shown });
    dirty = false;
  }

  function loop(now) {
    raf = 0;
    if (!active) return;
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (shown !== target) {
      const tau = -0.0167 / Math.log(1 - scrollCfg.damping);
      shown += (target - shown) * (1 - Math.exp(-dt / tau));
      if (Math.abs(target - shown) < 0.00025) shown = target;
      dirty = true;
    }
    if (dirty) {
      const t0 = performance.now();
      render();
      // adaptivni kvalitet: prosek trajanja kadra tokom animacije
      acc += dt; frames++;
      if (frames >= 50) {
        const avg = (acc / frames) * 1000;
        if (avg > 26 && qScale > 0.6) { qScale = Math.max(0.6, qScale - 0.15); resize(); }
        frames = 0; acc = 0;
      }
      void t0;
    } else { last = 0; frames = 0; acc = 0; }
    if (shown !== target || dirty) raf = requestAnimationFrame(loop);
  }
  const wake = () => { if (!raf && active) { last = 0; raf = requestAnimationFrame(loop); } };

  const ro = new ResizeObserver(() => { resize(); wake(); });
  ro.observe(parent());
  resize();

  /* zagrevanje: sve vidljivo, da se šejderi kompajliraju i teksture otpreme pre prvog skrola */
  onProgress(0.94, 'Pripremam svetlo');
  await tick();
  shown = 1; render();
  try { if (renderer.compileAsync) await renderer.compileAsync(S.scene, cam); } catch (e) { /* nije kritično */ }
  shown = 0; target = 0; dirty = true; render();
  onProgress(1, 'Spremno');

  return {
    renderer, scene: S.scene, camera: cam, S,
    get mobile() { return mobile; },
    setTarget(p) { target = Math.min(1, Math.max(0, p)); wake(); },
    /** trenutno, bez smirivanja (refresh usred sekcije, reduced-motion) */
    jump(p) { target = shown = Math.min(1, Math.max(0, p)); dirty = true; if (active) wake(); else render(); },
    setActive(a) { active = a; if (a) { dirty = true; wake(); } },
    get progress() { return shown; },
    /** za testove/ručni kadar: ručno iscrtavanje */
    renderNow() { render(); },
    project,
    resize,
    /** dev: kadar sa proizvoljnom kamerom (za ilustrativne slike); vraća JPEG dataURL */
    shot({ pos, look, fov = 40, P = 1, w = 1600, h = 1000 }) {
      const old = [renderer.getPixelRatio(), W, H];
      renderer.setPixelRatio(1); renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.fov = fov; cam.position.set(...pos); cam.lookAt(...look); cam.updateProjectionMatrix();
      S.update(P); renderer.render(S.scene, cam);
      const url = canvas.toDataURL('image/jpeg', 0.9);
      renderer.setPixelRatio(old[0]); renderer.setSize(old[1], old[2], false); cam.aspect = old[1] / old[2];
      dirty = true; render();
      return url;
    },
  };
}
