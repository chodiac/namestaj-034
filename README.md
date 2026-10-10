# Nameštaj po meri 034 — sajt sa 3D kuhinjom koja nastaje dok skrolujete

Statički sajt bez build koraka: ES moduli + Three.js r170 (lokalno u `vendor/`). Sav sadržaj za posetioce je na srpskom (latinica).

## Pokretanje lokalno

```bash
cd namestaj-034
python tools/serve.py 5200
```
Otvorite http://localhost:5200. Zahteva samo Python 3. (Ne otvarati `index.html` direktno iz fajl-sistema — ES moduli traže HTTP.)

Dev zastavice u URL-u: pokret je podrazumevano uključen (ne prati sistemsko „smanji pokret“); `?motion=reduce` daje završen prostor bez animacija, `?webgl=0` (statični fallback).

## Deploy
Ceo folder je statičan — otpremite ga na bilo koji statički hosting (GitHub Pages, Netlify, Cloudflare Pages, običan hosting). Sve putanje su relativne. `tools/` može da se izostavi (`tools/serve.py` ima dev-only `/__save`; ne pokretati na produkciji).

## Struktura
| Putanja | Namena |
|---|---|
| `config/site.js` | **Sav sadržaj**: firma, kontakt (`null` = nepotvrđeno), forma, faze skrola, tajming montaže (`stagesTiming`), kamera, putanje modela, usluge, radovi, materijali, proces |
| `assets/models/kitchen-hd.glb` / `kitchen-sd.glb` | 3D model kuhinje (desktop 13,6 MB / mobilni 10,4 MB), optimizovan iz `3D Model Kitchen/` |
| `js/scene/model.js` | učitavanje GLB-a, pečenje transformacija, razdvajanje spojenih mesheva na komponente |
| `js/scene/scene.js` | klasifikacija delova (baza, gornji, radna ploča, ostrvo…), **jedna vremenska linija** (stanje = funkcija progresa P), kamera |
| `js/scene/lights.js`, `measure.js`, `piece.js`, `engine.js` | svetlo, merne linije, jedan deo montaže, renderer/petlja |
| `js/main.js` | HTML sadržaj, naslovi sinhronizovani sa scenom, forma, galerija/lightbox |
| `assets/logo/` | predlog logotipa (SVG) |
| `3D Model Kitchen/` | originalni preuzeti fajlovi modela (veliki; ne objavljivati na hosting) |

### Ponovna optimizacija modela
`gltfpack -i "3D Model Kitchen/modern_kitchen (1).glb" -o assets/models/kitchen-hd.glb -cc -kn -km -tw -tl 2048 -tq 9 -si 0.8 -vp 16 -vtf` (mobilni: `-tl 1024 -si 0.6`). gltfpack: github.com/zeux/meshoptimizer/releases.

## Kako radi animacija
Delovi modela se u `scene.js` razvrstavaju po čvoru/materijalu/visini i grupišu po položaju (U-putanja leva strana → zid → desna strana). Scroll → `progress()` (pozicija sticky sekcije) → `engine.setTarget(P)`; renderer blago prati cilj. Svaka komponenta (`Piece`) ima prozor `[t0,t1]` i izračunava položaj/providnost iz P, pa su skrol napred/nazad, brzi skrol i refresh usred sekcije uvek tačni. Pinovanje je CSS `position: sticky` (sekcija se oslobađa prirodno; običan browser scroll ostaje). Dužina: `--hero-len` u `css/site.css` (420vh desktop / 360vh mobilni).

## Šta je privremeno / nepotvrđeno
- **Prilozi koje je naručilac pomenuo (screenshot firme i dva video-referenca) nisu stigli do mene** — scena je urađena po tekstualnom storyboard-u. Uporedite sa videima i javite razlike.
- **Potvrđeno sa Instagram profila**: naziv/handle, slogan „Nameštaj po meri tvog doma“, kuhinje, plakari, TV elementi, toaletni stolovi. Telefon, email, adresa, radno vreme **nisu javno dostupni** → `business.phone/email/address = null` u `config/site.js` (sajt prikazuje „Biće objavljeno uskoro“, ništa nije izmišljeno). Ime „Nameštaj po meri 034“ je radni naziv.
- **3D model kuhinje**: „Modern Kitchen“ autora **Visthétique** (https://sketchfab.com/visthetique), licenca **CC BY 4.0** — atribucija je u podnožju sajta; obavezno je zadržati. Model je tuđi dizajn (plavo-siva kuhinja sa hrastom), ne rad firme; prikaz je označen kao ilustracija. Raspored/boje nisu menjani. Svi delovi i dimenzije su iz modela.
- **Slike „Ilustracija“** u `assets/img/ill-*.jpg` i `fallback-kitchen.jpg` su kadrovi iz 3D modela (označeni kao ilustracija) — ne radovi firme.
- **Naši radovi**: prazno dok se ne dostave prave fotografije — dodati u `portfolio` u `config/site.js`.
- **Logo** je predlog identiteta. SVG tekst koristi fontove sistema ako Cormorant/Manrope nisu instalirani; za štampu/društvene mreže konvertovati tekst u krivine (outline) u Illustratoru/Inkscape-u.
- **Forma**: nema backend-a. Dok `inquiry.endpoint` nije podešen, forma jasno kaže da upit **nije poslat** i nudi kopiranje poruke + Instagram. Za rad: napravite Formspree/Getform/Web3Forms formu i upišite URL u `inquiry.endpoint` (JSON POST). Upload fotografija nije implementiran (traži backend sa validacijom).
- Proces „Kako radimo“ i kategorije „Ponuda“ (poslednja stavka) su predlog za potvrdu.

## Provereno
Prazno → gotovo (skrol napred/nazad, skok na proizvoljan progres, refresh usred), oslobađanje sticky sekcije, desktop i mobilni kadar, forma (validacija, bez lažnog uspeha), WebGL fallback i reduced-motion putanje (statična slika). Nije mereno na pravim telefonima — proverite performanse na ciljnim uređajima.


## Redizajn (stanzza.design reference) — šta je preneto
Backup stanja pre redizajna: `D:\CLAUDE-backups
amestaj-034_20261010-075047` (vidi `D:\CLAUDE-backups\README-VRATI.txt`). Vraćanje: `robocopy "D:\CLAUDE-backups
amestaj-034_20261010-075047" "D:\CLAUDE
amestaj-034" /E`.

Ideje sa reference prilagođene nameštaju: preloader sa vertikalnim stubovima; hero kadar koji se otvara iz manjeg pravougaonika; krupan serif (Instrument Serif) + kondenzovane verzalne oznake u zagradama (Barlow Condensed); tekst koji se puni reč po reč dok skroluješ; naslovi u maskama; meni preko celog ekrana; pune boje po sekcijama (škriljac iz modela, orah); fotografija koja se širi iz kadra u ceo ekran; pinovana horizontalna traka radova; asimetričan kolaž sa paralaksom i maskama; proces sa sticky naslovom i koracima koji se pale; dugmad sa popunom koja se podiže. Nisu preuzeti: njihove fotografije, projekti, brojke, nagrade ni tekstovi.
Efekti su u `js/ui/fx.js` (bez biblioteka, jedna scroll petlja); stilovi u `css/site.css`.

## Performanse (3D)
Poster kadrovi odmah, 3D se učitava naknadno i prilagođava uređaju (nivoi high/mid/low/poster, merenja, spuštanje kvaliteta, potpuno oslobađanje resursa). Detalji, merenja pre/posle i šta da proveriš na telefonu: `docs/PERF.md`. Dev parametri: `?tier=high|mid|low|poster`, `?now=1`, `?budget=N`.
