/* Hero: poster kadrovi (renderi iste scene) odmah, 3D se uključuje tek kad je stranica učitana i uređaj to podnosi.
   Ako 3D ne može stabilno da radi, scena se ZAUSTAVLJA I OSLOBAĐA (dispose) i ostaje poster koji prati skrol. */
import { stages, posters as posterCfg } from '../config/site.js';
import { detect } from './scene/quality.js';

const $ = (s, r = document) => r.querySelector(s);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => v != null && e.setAttribute(k, v)); e.innerHTML = html; return e; };

export function initHero() {
  if (window.__heroInit) return;          // zaštita od dvostruke inicijalizacije
  window.__heroInit = true;
  const hero = $('#pocetak'), canvas = $('#canvas'), status = $('#status'), dimsHost = $('#dims');
  const det = detect();
  window.__heroMode = { tier: det.tier, reason: det.reason, mode: 'poster' };

  const caps = [...document.querySelectorAll('.cap')].map((c) => ({ node: c, st: stages.find((s) => s.id === +c.dataset.stage) }));
  const steps = [...document.querySelectorAll('#steps li')];
  const progress = () => { const r = hero.getBoundingClientRect(), len = hero.offsetHeight - innerHeight; return len > 0 ? clamp01(-r.top / len) : 1; };

  function paintCaptions(P) {
    let active = -1;
    for (const { node, st } of caps) {
      const fi = 0.018, fo = st.id === 6 ? 0 : 0.016;
      const out = fo ? sm(st.end - fo, st.end, P) : 0;
      const a = sm(st.start, st.start + fi, P) * (1 - out);
      const v = st.id === 1 ? 1 - out : a;
      node.style.opacity = v.toFixed(3);
      node.style.visibility = v > 0.01 ? 'visible' : 'hidden';
      node.style.transform = `translateY(${((1 - v) * 22).toFixed(1)}px)`;
      node.style.pointerEvents = v > 0.5 ? 'auto' : 'none';
      if (v > 0.5) active = st.id - 1;
    }
    steps.forEach((s, i) => s.classList.toggle('on', i === active));
  }

  /* ---- poster kadrovi: odmah vidljivi i lagan fallback bez 3D-a ---- */
  const F = posterCfg.frames;
  let imgs = [], posterSet = '';
  const portraitMQ = matchMedia('(max-aspect-ratio: 1/1)');
  const setName = () => (portraitMQ.matches ? 'p' : 'l');
  function ensurePosters() {
    const set = setName();
    const host = $('#posters');
    if (imgs.length === F.length && posterSet === set) return;
    posterSet = set;
    const first = host.querySelector('img');
    imgs = F.map((_, i) => {
      if (i === 0) { first.src = `${posterCfg.dir}${set}-0.jpg`; return first; }
      let im = host.querySelector(`img[data-i="${i}"]`);
      if (!im) { im = new Image(); im.alt = ''; im.className = 'poster'; im.dataset.i = i; im.decoding = 'async'; host.appendChild(im); }
      im.src = `${posterCfg.dir}${set}-${i}.jpg`;
      return im;
    });
  }
  function paintPoster(P) {
    if (!imgs.length) return;
    let i = 0;
    while (i < F.length - 2 && P >= F[i + 1]) i++;
    const t = sm(F[i], F[i + 1], P);
    imgs.forEach((im, k) => { im.style.opacity = k === i ? 1 : k === i + 1 ? t.toFixed(3) : 0; });
  }
  portraitMQ.addEventListener('change', () => { if (window.__heroMode.mode === 'poster') { ensurePosters(); paintPoster(progress()); } });

  /* ---- skrol → naslovi (+ poster kad nema 3D) ---- */
  let engine = null, ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const P = progress();
      if (engine && !engine.disposed) engine.setTarget(P);
      else { paintCaptions(P); paintPoster(P); }
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { if (engine && !engine.disposed) engine.jump(progress()); else onScroll(); });

  function posterMode(why) {
    const was = window.__heroMode.mode;
    if (engine) { try { engine.dispose(); } catch (e) { /* već oslobođeno */ } engine = null; }
    canvas?.remove();
    dimsHost.textContent = '';
    status.hidden = true;
    hero.classList.add('poster-mode');
    hero.classList.remove('scene-live');
    window.__heroMode = { ...window.__heroMode, mode: 'poster', why };
    ensurePosters();
    const P = progress();
    paintCaptions(P); paintPoster(P);
    if (was !== 'poster') console.info('3D isključen → poster:', why);
  }

  /* ---- odluka: statični poster ili 3D ---- */
  if (new URLSearchParams(location.search).get('motion') === 'reduce') {
    hero.classList.add('is-static');
    posterMode('motion=reduce');
    paintPoster(1);
    caps.forEach(({ node, st }) => { node.style.opacity = st.id === 6 ? 1 : 0; node.style.visibility = st.id === 6 ? 'visible' : 'hidden'; node.style.transform = 'none'; });
    return;
  }
  ensurePosters();
  const P0 = progress();
  paintCaptions(P0); paintPoster(P0);
  if (det.tier === 'poster') { posterMode(det.reason); return; }

  async function startScene() {
    status.hidden = false; status.textContent = '3D scena se učitava…';
    try {
      const eng = await import('./scene/engine.js');
      if (!eng.webglAvailable()) return posterMode('WebGL nije dostupan');
      let dimEls = [];
      const e = await eng.createEngine({
        canvas, tierName: det.tier,
        onProgress: (p) => { status.textContent = `3D scena se učitava… ${Math.round(p * 100)}%`; },
        onFrame: ({ project, mi, mo, P }) => {
          paintCaptions(P);
          dimEls.forEach((d, i) => {
            const k = engine ? engine.S.measure.labelState(i, mi, mo) : 0;
            if (k <= 0.01) { d.node.style.opacity = 0; return; }
            const s = project(d.pos);
            d.node.style.opacity = k; d.node.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`;
          });
        },
        onFail: (why) => posterMode(why),
        onTier: (t) => { window.__heroMode.degraded = t; console.info('3D kvalitet spušten:', t); },
      });
      if (!e) return;                                   // propalo ili oslobođeno tokom zagrevanja (onFail je već obradio)
      engine = e;
      window.__scene = e;
      dimEls = e.S.measure.labels.map((l) => { const node = el('span', { class: 'dim' }, l.text); dimsHost.appendChild(node); return { node, pos: l.pos }; });
      e.jump(progress());
      canvas.classList.add('live');
      hero.classList.add('scene-live');
      status.hidden = true;
      window.__heroMode = { ...window.__heroMode, mode: '3d', bench: +e.bench.toFixed(1) };
      new IntersectionObserver((es) => engine && !engine.disposed && engine.setActive(es[0].isIntersecting && !document.hidden), { rootMargin: '150px' }).observe(hero);
      document.addEventListener('visibilitychange', () => engine && !engine.disposed && engine.setActive(!document.hidden));
      addEventListener('pagehide', () => engine && !engine.disposed && engine.setActive(false));
      addEventListener('pageshow', () => {
        if (!engine || engine.disposed) return;
        if (engine.renderer.getContext().isContextLost()) return posterMode('kontekst izgubljen u pozadini');
        engine.setActive(true); engine.jump(progress());
      });
    } catch (err) { console.warn(err); posterMode(String(err.message || err)); }
  }
  // 3D se pokreće tek kad je stranica učitana i procesor miran
  const kick = () => {
    if (new URLSearchParams(location.search).get('now') === '1') { startScene(); return; }   // dev: bez čekanja na idle/vidljivost
    const go = () => { if (document.visibilityState === 'hidden') { document.addEventListener('visibilitychange', go, { once: true }); return; } startScene(); };
    (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(go, { timeout: 2500 });
  };
  if (document.readyState === 'complete') kick(); else addEventListener('load', kick, { once: true });
}
