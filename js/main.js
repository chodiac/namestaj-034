import { business, inquiry, nav, stages, services, portfolio, portfolioPlaceholders, materials, process } from '../config/site.js';
import { initFx, initMenu, initAccordion, splitWords } from './ui/fx.js';

const $ = (s, r = document) => r.querySelector(s);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => v != null && e.setAttribute(k, v)); e.innerHTML = html; return e; };

/* ---------------------------- sadržaj iz konfiguracije ---------------------------- */
function buildContent() {
  $('#nav').innerHTML = nav.map((n, i) => `<a href="${n.href}" style="--i:${i}"><small>0${i + 1}</small><span>${esc(n.label)}</span></a>`).join('');
  $('#ftrNav').innerHTML = nav.map((n) => `<a class="ul" href="${n.href}">${esc(n.label)}</a>`).join('');
  $('#ftrDesc').textContent = business.description;
  $('#introText').textContent = business.description;
  $('#yr').textContent = new Date().getFullYear();

  const ph = (label) => `<div class="ph">${esc(label)}</div>`;
  $('#services').innerHTML = services.map((s, i) => `
    <li class="srv">
      <button class="srv__h" type="button" aria-expanded="false" aria-controls="srv-${i}">
        <span class="srv__n">${String(i + 1).padStart(2, '0')}</span><span class="srv__t">${esc(s.title)}</span><span class="srv__ic" aria-hidden="true"></span>
      </button>
      <div class="srv__b" id="srv-${i}" role="region"><div class="srv__bi"><div class="srv__cols">
        <p>${esc(s.text)}</p>${s.confirmed ? '' : '<small>Za potvrdu sa vlasnikom</small>'}
        <div class="srv__img">${s.image ? `<img src="${s.image}" alt="${esc(s.title)} — ilustracija iz 3D modela" loading="lazy" data-fallback>` : ph('Fotografija — dodati')}${s.illustrative ? '<span class="badge">Ilustracija · 3D</span>' : ''}</div>
      </div></div></div>
    </li>`).join('');
  initAccordion($('#services'));

  $('#mats').innerHTML = materials.map((m, i) => `
    <article class="mat"><div class="mat__m"><img src="${m.img}" alt="${esc(m.title)} — ilustracija iz 3D modela" loading="lazy" data-fallback></div>
    <div class="mat__t"><span class="lab">0${i + 1}</span><div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></div></div></article>`).join('');

  $('#process').innerHTML = process.map((p) => `<li><span class="n">${p.n}</span><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></li>`).join('');

  const row = (label, val, href) => `<li><b>${label}</b>${val ? (href ? `<a class="ul" href="${href}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(val)}</a>` : esc(val)) : '<span class="todo">Biće objavljeno uskoro</span>'}</li>`;
  const contact = [
    row('Instagram', business.instagramHandle, business.instagram),
    row('Telefon', business.phone, business.phone && 'tel:' + business.phone.replace(/[^\d+]/g, '')),
    row('Email', business.email, business.email && 'mailto:' + business.email),
    row('Adresa', business.address),
  ].join('');
  $('#clist').innerHTML = contact; $('#ftrContact').innerHTML = contact;
  $('#f-vrsta').innerHTML = '<option value="">Izaberite…</option>' + inquiry.furnitureTypes.map((t) => `<option>${esc(t)}</option>`).join('');

  document.querySelectorAll('img[data-fallback]').forEach((img) => img.addEventListener('error', () => {
    const p = img.parentElement; img.remove(); p.insertAdjacentHTML('afterbegin', ph('Slika nije dostupna'));
  }));
  buildGallery();
}

/* ------------------------------------ galerija ------------------------------------ */
function buildGallery() {
  const g = $('#gallery'), f = $('#filters'), lead = $('#radoviLead');
  const real = portfolio.length > 0;
  lead.textContent = real
    ? 'Fotografije realizovanih projekata.'
    : 'Ovde će biti prikazane fotografije realizovanih projekata. Do tada su prikazana prazna mesta — nijedna slika ovde nije stock fotografija niti prikaz završenog posla.';
  const items = real ? portfolio : portfolioPlaceholders;
  const cats = [...new Set(items.map((i) => i.category).filter(Boolean))];
  if (real && cats.length > 1) {
    f.innerHTML = ['Sve', ...cats].map((c, i) => `<button type="button" aria-pressed="${i === 0}" data-c="${c}">${esc(c)}</button>`).join('');
    f.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      f.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      g.querySelectorAll('.g').forEach((n) => (n.hidden = b.dataset.c !== 'Sve' && n.dataset.c !== b.dataset.c));
      window.__fx?.refresh();
    });
  } else f.hidden = true;
  g.innerHTML = items.map((i, n) => {
    const size = i.size === 'wide' ? 'g--wide' : i.size === 'tall' ? 'g--tall' : '';
    if (!real) return `<figure class="g ${size} g--ph"><div class="g__box"><div class="ph">Fotografija projekta — dodati</div></div><figcaption>${esc(i.category)}</figcaption></figure>`;
    return `<figure class="g ${size}" data-c="${esc(i.category || '')}"><button class="g__box" type="button" data-i="${n}" aria-label="Uvećaj: ${esc(i.title || i.alt || '')}"><img src="${i.src}" alt="${esc(i.alt || i.title || '')}" loading="lazy"></button><figcaption>${esc(i.title || i.category || '')}</figcaption></figure>`;
  }).join('');
  const lb = $('#lb'), lbimg = $('#lbimg'), cap = $('#lbcap');
  let opener = null;
  const show = (src, alt, title, from) => { opener = from; lbimg.src = src; lbimg.alt = alt || ''; cap.textContent = title || ''; lb.showModal(); };
  g.addEventListener('click', (e) => {
    const b = e.target.closest('.g__box[data-i]'); if (!b) return;
    const it = portfolio[+b.dataset.i]; show(it.src, it.alt || it.title, it.title, b);
  });
  $('#expandBtn').addEventListener('click', (e) => show('assets/img/fallback-kitchen.jpg', 'Ilustracija: kuhinja u obliku slova U sa ostrvom, 3D prikaz', 'Ilustracija · 3D prikaz — nije naš realizovan projekat', e.currentTarget));
  const close = () => { lb.close(); opener && opener.focus(); };
  $('#lbx').addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
}

/* -------------------------------------- forma -------------------------------------- */
function initForm() {
  const form = $('#form'), notice = $('#notice');
  const rules = {
    ime: (v) => (v.trim().length < 2 ? 'Unesite ime.' : ''),
    telefon: (v) => (v.replace(/\D/g, '').length < 6 ? 'Unesite ispravan broj telefona.' : ''),
    email: (v) => (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? 'Email nije ispravan.' : ''),
    vrsta: (v) => (!v ? 'Izaberite vrstu nameštaja.' : ''),
    poruka: (v) => (v.trim().length < 5 ? 'Napišite kratku poruku.' : ''),
  };
  const check = () => {
    let first = null, ok = true;
    for (const [k, fn] of Object.entries(rules)) {
      const inp = form.elements[k], msg = fn(inp.value), f = inp.closest('.field');
      f.classList.toggle('bad', !!msg); form.querySelector(`.err[data-for="${k}"]`).textContent = msg;
      inp.setAttribute('aria-invalid', !!msg);
      if (msg) { ok = false; first = first || inp; }
    }
    first && first.focus();
    return ok;
  };
  const show = (cls, html) => { notice.hidden = false; notice.className = 'notice ' + cls; notice.innerHTML = html; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!check()) return;
    const data = Object.fromEntries(new FormData(form));
    const text = `Upit sa sajta\nIme: ${data.ime}\nTelefon: ${data.telefon}\nEmail: ${data.email || '—'}\nVrsta: ${data.vrsta}\nPoruka: ${data.poruka}`;
    if (!inquiry.endpoint) {
      show('fail', `<p><strong>Slanje preko sajta još nije podešeno, pa upit NIJE poslat.</strong> Pošaljite ga direktno na Instagramu — kopirajte poruku i nalepite je u direktnu poruku.</p>
        <div class="row"><button class="btn btn--dark" type="button" id="copyMsg"><span>Kopiraj poruku</span></button><a class="btn" href="${business.instagram}" target="_blank" rel="noopener"><span>Otvori Instagram</span></a></div>`);
      $('#copyMsg').addEventListener('click', async (ev) => { const b = ev.currentTarget.querySelector('span'); try { await navigator.clipboard.writeText(text); b.textContent = 'Kopirano ✓'; } catch { b.textContent = 'Kopirajte ručno iz forme'; } });
      return;
    }
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const r = await fetch(inquiry.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error(r.status);
      show('ok', '<p><strong>Hvala! Upit je poslat.</strong> Javićemo vam se uskoro.</p>'); form.reset();
    } catch (err) {
      show('fail', `<p><strong>Upit nije poslat.</strong> Pokušajte ponovo ili nam pišite na Instagramu.</p><div class="row"><a class="btn" href="${business.instagram}" target="_blank" rel="noopener"><span>Otvori Instagram</span></a></div>`);
    } finally { btn.disabled = false; }
  });
}

/* ------------------------------------- 3D hero ------------------------------------- */
const loader = $('#loader'), bar = $('#loaderBar'), txt = $('#loaderTxt');
function revealPage() {
  document.body.classList.add('ready');
  window.__fx?.refresh();
  loader.classList.add('done');
  setTimeout(() => $('.cap[data-stage="1"] .cap__h')?.classList.add('in'), 900);
}

async function initHero() {
  const hero = $('#pocetak');
  const params = new URLSearchParams(location.search);
  const forceStatic = params.get('motion') === 'reduce';
  const showStatic = (why) => {
    hero.classList.add('is-static');
    $('#fallback').hidden = false; $('#canvas').hidden = true;
    revealPage(); console.info('hero static:', why);
  };
  const eng = await import('./scene/engine.js');
  if (params.get('webgl') === '0' || !eng.webglAvailable()) return showStatic('no webgl');

  const caps = [...document.querySelectorAll('.cap')].map((c) => ({ node: c, st: stages.find((s) => s.id === +c.dataset.stage) }));
  const steps = [...document.querySelectorAll('#steps li')];
  const dimsHost = $('#dims');
  let dimEls = [];

  let engine;
  try {
    engine = await eng.createEngine({
      canvas: $('#canvas'),
      onProgress: (p, label) => { bar.style.width = Math.round(p * 100) + '%'; txt.textContent = label + '…'; },
      onFrame: ({ project, mi, mo, P }) => {
        paintCaptions(P);
        dimEls.forEach((d, i) => {
          const k = engine.S.measure.labelState(i, mi, mo);
          if (k <= 0.01) { d.node.style.opacity = 0; return; }
          const s = project(d.pos);
          d.node.style.opacity = k; d.node.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`;
        });
      },
    });
  } catch (e) { console.error(e); return showStatic('engine failed'); }
  window.__scene = engine;

  dimEls = engine.S.measure.labels.map((l) => {
    const node = el('span', { class: 'dim' }, l.text); dimsHost.appendChild(node); return { node, pos: l.pos };
  });

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

  const progress = () => {
    const r = hero.getBoundingClientRect(), len = hero.offsetHeight - innerHeight;
    return len > 0 ? clamp01(-r.top / len) : 1;
  };
  if (forceStatic) {
    engine.jump(1); hero.classList.add('is-static'); revealPage();
    caps.forEach(({ node, st }) => { node.style.opacity = st.id === 6 ? 1 : 0; node.style.visibility = st.id === 6 ? 'visible' : 'hidden'; node.style.transform = 'none'; });
    return;
  }
  engine.jump(progress());
  addEventListener('load', () => engine.jump(progress()));
  addEventListener('pageshow', () => engine.jump(progress()));
  let ticking = false;
  const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; engine.setTarget(progress()); }); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { engine.jump(progress()); });
  new IntersectionObserver((es) => engine.setActive(es[0].isIntersecting), { rootMargin: '200px' }).observe(hero);
  document.addEventListener('visibilitychange', () => engine.setActive(!document.hidden));
  revealPage();
}

buildContent();
initMenu();
initForm();
$('.cap[data-stage="1"] .cap__h').dataset.manual = '1';
window.__fx = initFx({ hdr: $('#hdr') });
initHero();
