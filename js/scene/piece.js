/* "Piece" = jedna komponenta koja se pozicionira u vremenskoj liniji.
   Stanje je čista funkcija progresa P (0–1) → ponovljivo pri brzom skrolu, vraćanju i refreshu. */
import * as THREE from 'three';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export class Piece {
  /**
   * @param obj Object3D (grupa) u mirnom položaju
   * @param o { t0, t1 } prozor u progresu; from:[x,y,z] pomak početka; rot:[x,y,z] početna rotacija (rad);
   *            fade: udeo prozora u kojem se komponenta pojavljuje (dither); ease
   */
  constructor(obj, { t0, t1, from = [0, 0, 0], rot = [0, 0, 0], fade = 0.2, ease = easeInOut, label = '' }) {
    this.obj = obj; this.t0 = t0; this.t1 = t1; this.from = from; this.rot = rot; this.fade = fade; this.ease = ease;
    this.label = label;
    this.rest = obj.position.clone();
    this.restRot = obj.rotation.clone();
    this.mats = [];      // klonirani materijali sa alphaHash
    this.extra = [];     // {mat, max} materijali koji prate pojavljivanje (kontaktne senke)
    this._lp = -1;
    if (this.fade > 0) this._prepare();   // bez kloniranja materijala kad nema fade-a (štedi memoriju i draw state)
  }

  _prepare() {
    const cache = new Map();
    this.obj.traverse((m) => {
      if (!m.isMesh) return;
      const orig = m.material;
      if (!orig || orig.userData?.noFade) return;
      let c = cache.get(orig);
      if (!c) {
        c = orig.clone();
        c.alphaHash = true;
        c.userData = { ...orig.userData, cloned: true };
        cache.set(orig, c);
        this.mats.push(c);
      }
      m.material = c;
    });
  }

  /** Kontaktna senka (nije dete grupe): pojavljuje se tek kad komponenta "sleti". */
  addContact(c) { this.extra.push(c); }

  update(P) {
    const span = this.t1 - this.t0;
    const lp = clamp01((P - this.t0) / (span > 0 ? span : 1e-6));
    if (lp === this._lp) return;
    this._lp = lp;
    const o = this.obj;
    if (lp <= 0) { o.visible = false; for (const x of this.extra) x.mesh.visible = false; return; }
    o.visible = true;
    const e = this.ease(lp), k = 1 - e;
    o.position.set(this.rest.x + this.from[0] * k, this.rest.y + this.from[1] * k, this.rest.z + this.from[2] * k);
    o.rotation.set(this.restRot.x + this.rot[0] * k, this.restRot.y + this.rot[1] * k, this.restRot.z + this.rot[2] * k);
    const a = this.fade > 0 ? smooth(0, this.fade, lp) : 1;
    for (const m of this.mats) m.opacity = a;
    const s = smooth(0.45, 1, lp);
    for (const x of this.extra) { x.mesh.visible = s > 0.001; x.mat.opacity = x.max * s; }
  }
}

/** Raspoređuje komponente po prozoru [start,end] sa pomerajem (stagger). */
export function stagger(pieces, start, end, dur) {
  const n = pieces.length;
  const gap = n > 1 ? (end - start - dur) / (n - 1) : 0;
  pieces.forEach((p, i) => { p.t0 = start + gap * i; p.t1 = p.t0 + dur; });
}

/** Meka senka kontakta ispod komponente (prati pojavljivanje komponente). */
export function contactShadow(M, w, d, y = 0.0, pad = 0.2, max = 0.38) {
  const mat = M.contact.clone();
  mat.userData = { noFade: true };
  const g = new THREE.PlaneGeometry(w + pad * 2, d + pad * 2);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y + 0.006;
  m.renderOrder = 2;
  m.receiveShadow = false; m.castShadow = false;
  return { mesh: m, mat, max };
}
