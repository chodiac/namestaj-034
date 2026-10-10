/* Skrol efekti i otkrivanja. Sve je vezano za jednu rAF petlju na scroll-u; bez biblioteka. */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = document.documentElement.classList.contains('reduce');

/* ---------- reči u maskama (naslovi) ---------- */
export function splitWords(el, cls = 'wi') {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  const label = el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', label);
  let n = 0;
  const out = document.createDocumentFragment();
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      node.textContent.split(/(\s+)/).forEach((t) => {
        if (!t) return;
        if (/^\s+$/.test(t)) { out.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
        const i = document.createElement('span'); i.className = cls; i.style.setProperty('--i', n++); i.textContent = t;
        w.appendChild(i); out.appendChild(w);
      });
    } else out.appendChild(node.cloneNode(true));
  });
  el.textContent = ''; el.appendChild(out);
}

/* ---------- tekst koji se "puni" dok skroluješ ---------- */
const scrubs = [];
function initScrub() {
  $$('.scrub').forEach((el) => {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', label);
    const words = label.split(' ');
    el.textContent = '';
    const spans = words.map((t) => { const s = document.createElement('span'); s.className = 'sw'; s.setAttribute('aria-hidden', 'true'); s.textContent = t; el.append(s, ' '); return s; });
    scrubs.push({ el, spans, last: -1 });
  });
}

/* ---------- IntersectionObserver otkrivanja ---------- */
function initReveals() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  $$('.split:not([data-manual]),.rv,.mat').forEach((el) => io.observe(el));
}

/* ---------- glavna petlja ---------- */
export function initFx({ hdr }) {
  $$('.split').forEach((el) => splitWords(el));
  initScrub();
  if (reduce) $$('.split,.rv,.mat').forEach((e) => e.classList.add('in'));
  else initReveals();

  const themed = $$('[data-theme]');
  const expand = document.getElementById('expand');
  const strip = document.getElementById('galerija');
  const track = document.getElementById('gallery');
  const view = strip && strip.querySelector('.strip__view');
  const procList = document.getElementById('process');
  const procBar = document.getElementById('procBar');
  const par = $$('.mat__m img');
  let vw = innerWidth, vh = innerHeight, stripDist = 0, ticking = false;

  function layoutStrip() {
    if (!strip) return;
    vw = innerWidth; vh = innerHeight;
    const desk = vw > 900;
    if (!desk) { strip.style.height = ''; track.style.transform = ''; stripDist = 0; return; }
    stripDist = Math.max(0, track.scrollWidth - view.clientWidth + 8);
    strip.style.height = stripDist > 0 ? (vh + stripDist * 1.1) + 'px' : '';
  }

  function frame() {
    ticking = false;
    vh = innerHeight;
    // tema zaglavlja prema sekciji ispod njega
    const probe = 34;
    let dark = false;
    for (const s of themed) { const r = s.getBoundingClientRect(); if (r.top <= probe && r.bottom > probe) { dark = s.dataset.theme === 'dark'; } }
    const heroEl = document.getElementById('pocetak');
    hdr.classList.toggle('hdr--bar', heroEl.getBoundingClientRect().bottom < innerHeight * 0.3);
    hdr.classList.toggle('hdr--light', dark && document.body.classList.contains('ready'));

    // reči koje se pune
    for (const s of scrubs) {
      const r = s.el.getBoundingClientRect();
      const p = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.42));
      const n = Math.round(p * s.spans.length);
      if (n !== s.last) { s.spans.forEach((sp, i) => sp.classList.toggle('on', i < n)); s.last = n; }
    }
    // fotografija koja se širi
    if (expand) {
      const r = expand.getBoundingClientRect();
      const p = clamp((vh * 1.0 - r.top) / (vh * 0.8));
      expand.style.setProperty('--e', (p * p * (3 - 2 * p)).toFixed(4));
    }
    // horizontalna traka
    if (strip && stripDist > 0 && vw > 900) {
      const r = strip.getBoundingClientRect();
      const p = clamp(-r.top / (strip.offsetHeight - vh));
      track.style.transform = `translate3d(${(-p * stripDist).toFixed(1)}px,0,0)`;
    }
    // paralaksa detalja materijala
    if (!reduce) for (const im of par) {
      const r = im.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const c = (r.top + r.height / 2 - vh / 2) / vh;
      im.style.setProperty('--py', (-c * 46).toFixed(1) + 'px');
    }
    // proces
    if (procList) {
      const items = [...procList.children];
      const mid = vh * 0.5;
      let act = -1;
      items.forEach((li, i) => { const r = li.getBoundingClientRect(); if (r.top < mid + 40) act = i; });
      items.forEach((li, i) => li.classList.toggle('act', i === act));
      const r = procList.getBoundingClientRect();
      procBar.parentElement.style.setProperty('--p', clamp((mid - r.top) / r.height).toFixed(3));
      procBar.style.setProperty('--p', clamp((mid - r.top) / r.height).toFixed(3));
    }
  }
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', () => { layoutStrip(); req(); });
  addEventListener('load', () => { layoutStrip(); req(); });
  layoutStrip(); frame();
  return { layoutStrip, refresh: () => { layoutStrip(); req(); } };
}

/* ---------- meni preko celog ekrana ---------- */
export function initMenu() {
  const btn = document.getElementById('menuBtn'), menu = document.getElementById('menu');
  const t = btn.querySelector('.menu-btn__t');
  const main = [document.getElementById('sadrzaj'), document.querySelector('.ftr')];
  const set = (open) => {
    menu.classList.toggle('open', open);
    menu.setAttribute('aria-hidden', !open);
    menu.inert = !open;
    btn.setAttribute('aria-expanded', open);
    t.textContent = open ? 'Zatvori' : 'Meni';
    document.body.classList.toggle('menu-open', open);
    main.forEach((m) => m && (m.inert = open));
    if (open) menu.querySelector('a')?.focus(); else btn.focus({ preventScroll: true });
  };
  menu.inert = true;
  btn.addEventListener('click', () => set(!menu.classList.contains('open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) set(false); });
}

/* ---------- ponuda: harmonika ---------- */
export function initAccordion(root) {
  const rows = [...root.querySelectorAll('.srv')];
  const open = (row, v) => { row.classList.toggle('open', v); row.querySelector('.srv__h').setAttribute('aria-expanded', v); };
  rows.forEach((row) => row.querySelector('.srv__h').addEventListener('click', () => {
    const was = row.classList.contains('open');
    rows.forEach((r) => open(r, false));
    open(row, !was);
  }));
  if (rows[0]) open(rows[0], true);
}
