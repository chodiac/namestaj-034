# Optimizacija 3D scene — nalazi, izmene, nivoi kvaliteta

Backup pre izmena: grana `backup/pre-optimizacija-20261010` (commit `d2b1a86`).

## Potvrđeni uzroci (merenje stare verzije, mobilni model, 375×812, DPR 2)
| Stavka | Pre |
|---|---|
| Canvas | 562×1218 (DPR 2 → ograničen na 1,5) + antialiasing = 685 hiljada piksela |
| Trouglova po kadru (sa senkama) | 639 hiljada; u meshevima 526 hiljada (pojedinačni sitni dodaci i do 30 hiljada) |
| Draw call-ova / mesheva / bacača senki | 303 / 297 / 265 |
| Materijala (kloniranje po delu zbog fade-a) | 267, 17 šejder programa |
| Svetla | 8 (sunce + hemisfera + 4 spota + 2 tačkasta); intenzitet 0 ih ne uklanja iz šejdera |
| Senke | shadow mapa 1024 osvežavana na SVAKOM kadru skrola |
| Teksture | ≈196 MB procenjeno (30 tekstura 1024², sa mipmapama), plus dekodirane slike zadržane u memoriji |
| Učitavanje | ceo model (10 MB) se parsira i obrađuje na glavnoj niti pre prvog prikaza; bez postera; skrol nije mogao da reaguje dok traje |
| Ostalo | `backdrop-filter` blur na zaglavlju iznad canvasa koji se menja (skup kompozit), canvas hvatao dodire; nije bilo reakcije na gubitak WebGL konteksta |
Skup render-petlji/konteksta: 1 petlja i 1 kontekst (nije curilo); petlja je stajala u mirovanju i van ekrana (već ispravno), ali resursi nisu oslobađani.

## Šta je izmenjeno
- **Poster prvo:** 7 renderovanih kadara iste scene (landscape + portret, ukupno ≈1,2 MB; prvi 17–52 KB) prikazuju se odmah i prate skrol (cross-fade). Stranica, navigacija i sadržaj su dostupni bez čekanja na 3D.
- **3D se učitava naknadno:** tek posle `load` + `requestIdleCallback`, nikad u skrivenom tabu, sa statusom „3D scena se učitava…". Parsiranje je podeljeno u male korake (`scheduler.yield`), bez blokiranja skrola i klikova; canvas ne prima dodire (`pointer-events:none`).
- **Nivoi** (`js/scene/quality.js`): vidi tabelu. Početni nivo je konzervativan; stvarno stanje određuju merenja (probni kadar + trajanje kadrova tokom skrola). Nivo se samo spušta (bez ping-ponga).
- **Tri modela** (gltfpack): high 654 k trouglova / 2048 tekstura / 13,6 MB · mid 267 k / 1024 / 8,2 MB · low 80 k / 512 / 2,4 MB.
- **Senke:** isključene na low; na mid 1024 i osvežavanje na svaki 2. kadar; na high 2048. Jeftiniji PCF filter.
- **Svetla:** high 8, mid 4, low 2. **Fade** (alphaHash, kloniranje materijala) samo na high; mid/low dele originalne materijale (267 → 82–96).
- **Rezolucija:** gornja granica DPR po nivou i ukupnog broja piksela (low 0,8 MP, mid 1,8 MP, high 4,2 MP); antialias samo na mid/high.
- **Low:** bez normal mapa, grublje grupisanje delova (manje draw call-ova), 30 FPS ograničenje tokom animacije.
- **Memorija:** originalne glTF geometrije se oslobađaju posle prečišćavanja, dekodirane slike (`ImageBitmap`) se zatvaraju posle otpremanja na GPU.
- **Pauza:** van ekrana, u pozadinskom tabu i na `pagehide`; po povratku se proverava kontekst.
- **Fallback:** poster-nivo (štednja podataka, spora mreža, ≤2 GB/≤2 jezgra na telefonu, softverski GL, prespor probni kadar, gubitak konteksta, uzastopno spuštanje kvaliteta) — scena se **zaustavlja i potpuno oslobađa** (`dispose()`: geometrije, materijali, teksture, render-target, shadow mapa, `forceContextLoss`, canvas uklonjen); three.js i GLB se ne učitavaju. Nema ponovnih pokušaja.
- Zaglavlje više nema blur (`backdrop-filter`); `contain` na hero kadru.

## Nivoi
| Nivo | Početak | Model | DPR / max px | Senke | Svetla | Ostalo |
|---|---|---|---|---|---|---|
| high | jak računar (≥8 GB, ≥8 jezgara) | 654 k tri | 2 / 4,2 MP | 2048, svaki kadar | 8 | fade, AA |
| mid | standardni računar | 267 k | 1,5 / 1,8 MP | 1024, svaki 2. | 4 | AA |
| low | svaki telefon i slabiji računari | 80 k | 1 / 0,8 MP | isključene | 2 | bez normal mapa, 30 FPS |
| poster | uslovi iznad | — | — | — | — | bez three.js i modela |
Spuštanje (po prosečnom trajanju 40 kadrova tokom skrola): rezolucija ×0,8 → senke isključene → rezolucija ×0,62 → poster. Probni kadar > 140 ms → odmah poster.

## Posle (merenje, low nivo, 375×812; isti uređaj kao „pre")
| Stavka | Pre | Posle |
|---|---|---|
| Canvas | 685 k px, AA | 304 k px (−56%), bez AA |
| Trouglova (najteži kadar) | 639 k | 103 k (−84%) |
| Draw call-ova | 303 | 259 (grupisanje po 2×) |
| Materijala / svetala | 267 / 8 | 82 / 2 |
| Senke | 1024 svaki kadar | isključene |
| Teksture | ≈196 MB (1024²) | ≤ ≈46 MB (≤512², 33 kom., bez normal mapa) |
| Trajanje kadra (desktop GPU, `gl.finish`) | 12,6 ms | 5,1 ms |
| Prvi prikaz | čeka model | poster ≈17–52 KB, odmah |
Poster-nivo: 0 B modela/biblioteke, ≈300 KB postera ukupno.

## Šta je STVARNO testirano, a šta nije
- Testirano: desktop browser (ugrađeni panel) sa emulacijom 375×812 i DPR 2; simulirani zadaci: gubitak WebGL konteksta (→ poster, canvas uklonjen, bez ponovnih pokušaja), simulirano preopterećenje (`?budget=1` → rezolucija ×0,8 pri startu), poster-nivo (`?tier=poster` → bez three.js/GLB u mreži), jednostruka inicijalizacija, višestruki skrol po posteru.
- NIJE testirano na pravom slabom telefonu, niti sa pravim CPU/GPU throttlingom. Merenja ms su sa jakog desktop GPU-a (dobra su za poređenje „pre/posle", ne za apsolutne FPS na telefonu).
- Panel je skriven, pa nisam mogao pouzdano da izmerim FPS tokom stvarnog skrola; nisam testirao promenu orijentacije na fizičkom uređaju.

## Šta da proveriš na svom telefonu
1. Otvori stranicu: poster treba da se vidi odmah, a meni/skrol da reaguju dok piše „3D scena se učitava…".
2. Skroluj hero gore-dole nekoliko puta; telefon treba da ostane odzivan. Ako zaglavi, otvori `?tier=poster` (bez 3D) radi poređenja.
3. U konzoli (ili preko remote debug) pročitaj `window.__heroMode` — pokazuje nivo, razlog, da li je kvalitet spušten (`degraded`) i da li je prešlo u poster (`why`).
4. Probaj: rotaciju ekrana, prebacivanje na drugu aplikaciju i povratak, odlazak sa stranice i nazad (back).
5. Dev parametri: `?tier=high|mid|low|poster`, `?now=1` (odmah pokreni 3D), `?budget=N` (simulira sporiji uređaj), `?motion=reduce` (statični završni poster).
