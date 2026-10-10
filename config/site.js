/* ==========================================================================
   Centralna konfiguracija — sve što se uređuje (tekstovi, kontakt, animacija).
   `null` = podatak nije potvrđen; sajt tada prikazuje jasnu oznaku, ne izmišlja.
   ========================================================================== */

export const business = {
  name: 'Nameštaj po meri 034',
  nameShort: 'NAMEŠTAJ PO MERI',
  code: '034',
  tagline: 'Nameštaj po meri tvog doma',
  // Potvrđeno sa Instagram profila (bio): kuhinje, plakari, TV elementi, toaletni stolovi.
  description:
    'Izrada nameštaja po meri od pločastih materijala za vaš dom: kuhinje, plakari, TV elementi, toaletni stolovi i drugi elementi prilagođeni prostoru.',
  instagram: 'https://www.instagram.com/namestajpomeri034/',
  instagramHandle: '@namestajpomeri034',
  // NEPOTVRĐENO — upisati kada vlasnik dostavi podatke.
  phone: null,       // npr. '+381 34 000 000'
  email: null,       // npr. 'info@primer.rs'
  address: null,     // npr. 'Ulica i broj, Kragujevac'
  hours: null,
};

/* Slanje upita. Dok `endpoint` nije podešen, forma NE prikazuje lažan uspeh. */
export const inquiry = {
  endpoint: null, // npr. 'https://formspree.io/f/xxxxxxxx' (JSON POST) — vidi README
  furnitureTypes: [
    'Kuhinja po meri',
    'Plakar / garderober',
    'TV element / komoda',
    'Toaletni sto',
    'Kupatilski nameštaj',
    'Nameštaj za poslovni prostor',
    'Nešto drugo',
  ],
};

export const nav = [
  { href: '#ponuda', label: 'Ponuda' },
  { href: '#radovi', label: 'Naši radovi' },
  { href: '#kako-radimo', label: 'Kako radimo' },
  { href: '#kontakt', label: 'Kontakt' },
];

/* Faze scroll scene. start/end su deo ukupnog progresa (0–1) u kojem je titl vidljiv. */
export const stages = [
  { id: 1, start: 0.0,  end: 0.085, kicker: '01 — Prazan prostor',
    title: ['Vaš prostor.', 'Vaša mera.'],
    text: 'Nameštaj osmišljen da se uklopi u vaš dom i način života.',
    cue: 'Skrolujte i pogledajte kako nastaje.' },
  { id: 2, start: 0.105, end: 0.215, kicker: '02 — Mere i temelj',
    caption: 'Svaki centimetar ima svoju svrhu.' },
  { id: 3, start: 0.235, end: 0.43,  kicker: '03 — Korpusi i frontovi',
    caption: 'Od prve mere do poslednjeg detalja.' },
  { id: 4, start: 0.45, end: 0.64, kicker: '04 — Materijali i gornji elementi',
    caption: 'Materijali koji daju karakter prostoru.' },
  { id: 5, start: 0.66, end: 0.835, kicker: '05 — Ostrvo i svetlo',
    caption: 'Funkcionalnost koja se vidi. Kvalitet koji se oseća.' },
  { id: 6, start: 0.865, end: 1.0, kicker: '06 — Završen prostor',
    title: ['Po vašoj meri.', 'Do detalja.'],
    cta: 'Pošaljite upit' },
];

/* Dužina scroll sekcije (u visinama ekrana) i vreme smirivanja. */
export const scroll = {
  desktopVh: 420,
  mobileVh: 360,
  damping: 0.18,     // 0–1, veće = brže prati scroll
};

/* Kamera: početni i završni kadar (desktop / mobilni). Koordinate modela kuhinje (m). */
export const camera = {
  desktop: {
    fov: 60,
    start: { pos: [-0.4, 1.7, 4.9], look: [-0.3, 1.2, -3.0] },
    end:   { pos: [-0.3, 1.6, 3.7], look: [-0.3, 1.2, -3.0] },
  },
  mobile: {
    // portret: cela kuhinja (≈6 m) mora da stane u širinu, pa je kamera daleko sa širim vertikalnim vidnim poljem
    fov: 62,
    start: { pos: [-0.2, 5.6, 11.0], look: [-0.2, 0.55, -1.3] },
    end:   { pos: [-0.2, 5.2, 10.4], look: [-0.2, 0.55, -1.3] },
  },
};

/* Prozori u progresu P (0–1) za pojedine faze montaže. */
export const stagesTiming = {
  finish: [0.10, 0.20], floor: [0.12, 0.23], skirt: [0.15, 0.22],
  measureIn: [0.095, 0.17], measureOut: [0.205, 0.235],
  base: [0.24, 0.40], tall: [0.30, 0.43],
  upper: [0.45, 0.56], counter: [0.54, 0.60], fixture: [0.58, 0.645], handle: [0.62, 0.665],
  island: [0.67, 0.77], stool: [0.77, 0.82], lights: [0.79, 0.84], acc: [0.81, 0.865],
  light: [0.76, 0.86],
};

/* Model kuhinje (GLB, optimizovan gltfpack-om). */
export const model = {
  desktop: 'assets/models/kitchen-hd.glb',
  mobile: 'assets/models/kitchen-sd.glb',
};

export const quality = {
  maxDpr: 2, maxDprMobile: 1.5,
  shadowMap: 2048, shadowMapMobile: 1024,
  texSize: 1024, texSizeMobile: 512,
};

/* ----------------------------- Sadržaj stranice ----------------------------- */

export const services = [
  { id: 'kuhinje', title: 'Kuhinje po meri',
    text: 'Radne površine, korpusi i frontovi usklađeni sa dimenzijama vašeg prostora — od prve mere do montaže.',
    confirmed: true, image: 'assets/img/ill-kuhinja.jpg', illustrative: true },
  { id: 'plakari', title: 'Plakari i garderoberi',
    text: 'Plakari po meri koji koriste svaki centimetar: do plafona, ispod kosine ili u niši.',
    confirmed: true, image: null },
  { id: 'tv', title: 'TV elementi i komode',
    text: 'TV zidovi, komode i police sa skrivenim kablovima i pažljivo biranim završnim obradama.',
    confirmed: true, image: null },
  { id: 'toaletni', title: 'Toaletni stolovi',
    text: 'Toaletni stolovi sa fiokama i osvetljenjem, prilagođeni sobi i vašim navikama.',
    confirmed: true, image: null },
  { id: 'ostalo', title: 'Ostali nameštaj po meri',
    text: 'Kupatilski nameštaj, predsoblja i elementi za poslovne prostore — dogovaramo po upitu. (Za potvrdu sa vlasnikom.)',
    confirmed: false, image: null },
];

/* Realizovani radovi — ISKLJUČIVO prave fotografije firme.
   Dodajte: { src:'assets/img/radovi/kuhinja-01.jpg', alt:'…', category:'Kuhinje', title:'…', size:'wide'|'tall'|'normal' } */
export const portfolio = [
  // Namerno prazno dok vlasnik ne dostavi fotografije.
];
export const portfolioPlaceholders = [
  { category: 'Kuhinje',    size: 'wide'   },
  { category: 'Plakari',    size: 'tall'   },
  { category: 'TV elementi', size: 'normal' },
  { category: 'Toaletni stolovi', size: 'normal' },
  { category: 'Kuhinje',    size: 'normal' },
];

export const materials = [
  { id: 'drvo', title: 'Furnir i dekor drveta', text: 'Pravac vlakana bira se za svaki element posebno, tako da fronta i bok čine jednu celinu.', img: 'assets/img/ill-drvo.jpg' },
  { id: 'kamen', title: 'Radna ploča', text: 'Radna ploča i zaštitni zid od istog materijala daju mirnu, neprekinutu površinu.', img: 'assets/img/ill-kamen.jpg' },
  { id: 'ivice', title: 'Ivice i spojevi', text: 'Blago zaobljene ivice i ujednačene fuge između frontova.', img: 'assets/img/ill-ivica.jpg' },
  { id: 'rucke', title: 'Ručke', text: 'Tanke ručke u mat bronzanoj završnoj obradi ili obrada bez ručki.', img: 'assets/img/ill-rucka.jpg' },
  { id: 'okov', title: 'Šarke i fioke', text: 'Okov biramo prema nameni; marku i garanciju potvrđuje majstor u ponudi.', img: 'assets/img/ill-fioka.jpg' },
];

export const process = [
  { n: '01', title: 'Upit i ideja', text: 'Pošaljete ideju, okvirne dimenzije ili fotografiju prostora.' },
  { n: '02', title: 'Dogovor i mere', text: 'Dogovaramo potrebe i uzimamo tačne mere na licu mesta.' },
  { n: '03', title: 'Predlog i materijali', text: 'Dobijate predlog rešenja i biramo materijale i okov.' },
  { n: '04', title: 'Izrada i montaža', text: 'Izrađujemo elemente i montiramo ih u vašem prostoru.' },
];
