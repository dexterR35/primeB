ADRESA SECRETĂ — PAGINA "INVITAȚIA" (layout 02)
===============================================

Pagină autonomă, extrasă din pachetul cu cinci variante, cu ecran de încărcare,
motion la intrare și la scroll, și un head SEO complet.
Deschide index.html direct în browser. Nu necesită instalare sau internet.


FIȘIERE
  index.html        pagina Invitația + head SEO + markup-ul ecranului de încărcare
  styles.css        sistemul vizual comun + layoutul .v2 (invitația).
                    Regulile variantelor 01, 03, 04, 05 și bara de comparație
                    au fost eliminate. Singura adăugare e blocul de la final:
                    ordinea hero-ului pe mobil (vezi mai jos).
  motion.css        ecranul de încărcare, reveal-urile la scroll, reduced-motion
  motion.js         preloader, secvența de intrare, reveal-urile, drift-ul hero
  interactions.js   meniul mobil (se închide la alegerea unei secțiuni sau Escape)
  site.webmanifest  nume, culori, iconițe (PWA / add-to-home-screen)
  robots.txt        + sitemap.xml
  assets/           doar imaginile, textura, grain-ul și fonturile folosite,
                    plus favicon.svg, favicon-32.png, apple-touch-icon.png,
                    og-image.jpg (1200×630, generat din hero + ștampilă)


ECRANUL DE ÎNCĂRCARE
  Acoperă pagina din primul frame: clasa .js-motion + .is-loading e pusă pe <html>
  de un script inline din <head>, înainte de primul paint.
  Afișează: DOSAR NR. 0216, numele ADRESA SECRETĂ, bara de progres cu procent,
  mesajele SE VERIFICĂ AUTORIZAȚIA → SE DESCHIDE DOSARUL 0216 →
  SE ÎNCARCĂ MATERIALELE → ACCES APROBAT, apoi ștampila CONFIDENȚIAL.

  Ordinea: DOM gata + fonturile gata + imaginile care contează
           (toate <img> non-lazy + hero-image.png, grain.svg, archival-paper.png)
           → bara urcă la 100% (~0,4 s) → ștampila CONFIDENȚIAL
           → pauză de 2 secunde (cerută, ca ecranul să poată fi citit)
           → loader-ul se stinge în 0,9 s și intră hero-ul.

  Progresul e real (fracțiunea de assets încărcate), dar avansează și în timp
  ca să nu pară blocat; 100% apare doar când totul s-a raportat.
  Loaderul stă până DOM-ul, imaginile critice și fonturile sunt gata, apoi
  încă 2 s. Fără timeout de rezervă: dacă motion.js nu rulează, overlay-ul rămâne.

  Reglaj: HOLD_AFTER_READY (2000 ms), în capul motion.js.


MOTION
  La intrare: hero-ul urcă în cascadă (supratitlu → titlu → lede → buton → notă),
  ștampila și textul scris de mână intră ultimele.
  La scroll: fiecare secțiune își aduce pe rând supratitlul, titlul, textul,
  linia roșie, fotografia (push-in lent de la 1.07) și pașii 01-02-03,
  decalați câte 120 ms. Fișa de acces urcă, ștampila CONFIDENȚIAL se „trântește".
  Textul din hero se depărtează și se stinge ușor cât scrollezi peste el
  (doar peste 700 px — pe mobil e oprit, vezi secțiunea MOBIL).

  Decalajele se numără ÎN INTERIORUL secțiunii (GROUPS din motion.js: `at` =
  de când începe grupul, `step` = pasul dintre elementele lui). Înainte
  indexul se număra pe toată pagina, așa că titlul secțiunii 3 pornea cu
  180 ms întârziere față de al secțiunii 1; acum toate secțiunile intră la fel.

  O SINGURĂ ANIMAȚIE PE ELEMENT: blocurile de text (.section-head, .items,
  .apply-content, .hero-copy) aveau și un zoom de intrare de 2,4 s (scale
  0.965 → 1, pornit de .in-view) PESTE reveal-ul fiecărui copil — două
  animații pe același text în același timp. Zoomul a fost scos din styles.css;
  a rămas: intrarea = reveal, mișcarea la scroll = translate-ul de parallax.
  Hero-ul a fost scos și din parallaxul de text: acolo mișcarea la scroll o
  face driftul din motion.js, deci nu mai e dus de două mișcări deodată.
  Fotografiile de fundal își păstrează push-in-ul (e singura lor animație).

  Reveal-urile pornesc cu IntersectionObserver (linia de pornire la 93% din
  ecran, ca înainte); nu se mai măsoară nimic la fiecare scroll.
  Nimic nu poate rămâne invizibil: ce a fost sărit (salt la o ancoră) se vede
  ca ieșit pe sus și intră imediat, ce e ascuns de un media query (cutie 0×0)
  e scos din așteptare, iar la capătul paginii intră tot ce a mai rămas —
  ultimii 7% nu mai pot trece linia de pornire (footer-ul).
  Verificat în browser real: după parcurgerea paginii, la revenirea sus și
  după un salt la o ancoră, niciun element nu rămâne la opacity 0.
  După ce un element a ajuns, atributul data-rev și clasa is-in sunt ȘTERSE,
  deci pagina în repaus e exact markup-ul original, iar textul revine la
  randarea subpixel a browserului.

  prefers-reduced-motion: reduce → fără deplasări și fără zoom pe fotografii,
  doar un fade scurt; ecranul de încărcare rămâne (inclusiv pauza de 2 s).
  Fără JavaScript: nu apare loader-ul, nimic nu e ascuns, pagina e cea originală.


MOBIL — FOTOGRAFIA PRIMA, TEXTUL AL DOILEA
  Sub 700 px hero-ul se inversează: fotografia dosarului intră în flux imediat
  sub meniu (înălțime clamp(230px, 54vw, 330px)), cu ștampila CONFIDENȚIAL și
  nota scrisă de mână suprapuse pe marginea ei de jos, iar supratitlul, titlul,
  lede-ul, butonul și nota de subsol vin dedesubt, pe fundal închis.
  Degradeul hero-ului e limitat la înălțimea fotografiei, ca să se stingă în
  fundal exact sub ea. Peste 700 px nu se schimbă nimic: textul rămâne peste
  fotografie, ca în designul original.
  Regulile sunt grupate la finalul styles.css, marcate cu un comentariu.
  Tot pe mobil e oprit drift-ul hero-ului (textul nu se mai estompează la
  scroll), pentru că acolo textul e conținutul principal, nu un overlay.
  Secțiunile 1-3 păstrează ordinea originală: supratitlu, titlu, text, fotografie.


LAZY LOAD
  Fotografiile din secțiunile 1–3 și fundalul fișei de acces rămân loading="lazy"
  + decoding="async" (nu blochează ecranul de încărcare). Imaginea hero e
  eager, cu fetchpriority="high" și <link rel="preload">.
  După intrare, motion.js încarcă în idle access-paper-card.png și
  private-night.png, ca să nu apară gol nimic la scroll.


SEO — DE ÎNLOCUIT ÎNAINTE DE PUBLICARE
  Domeniul folosit ca exemplu este https://adresasecreta.ro/ și apare în:
  canonical, hreflang, og:url, og:image, twitter:image, JSON-LD (Organization,
  WebSite, WebPage), robots.txt și sitemap.xml. Înlocuiește-l cu domeniul real
  (caută-l cu: grep -rn adresasecreta.ro .) și actualizează <lastmod> în sitemap.
  Head-ul include: title, description, keywords, robots, canonical, hreflang,
  theme-color, color-scheme, Open Graph complet (cu dimensiuni și alt),
  Twitter summary_large_image, iconițe, manifest și date structurate JSON-LD.
  Nu am marcat secțiunea 3 ca FAQPage: nu conține întrebări și răspunsuri reale.


OBSERVAȚII
  Păstrează fișierele împreună; căile către assets/ sunt relative.
  Elementul rădăcină <div class="site v2"> trebuie să păstreze clasa "v2" —
  layoutul invitației e construit pe ea în styles.css.
  Filtrul SVG #worn-ink (ștampilele) e inline la începutul <body>, ca să poată
  fi folosit și de ecranul de încărcare.
  history.scrollRestoration = 'manual': la reîncărcare pagina pornește de sus,
  ca intro-ul să se vadă întotdeauna.
  Formularul este demo: nu trimite și nu salvează cereri.
  Etichetele din footer păstrează mockup-ul; nu au fost furnizate documente legale.
  Fonturi locale: Bodoni Moda, Barlow Condensed, Nimbus Mono PS, Z003 (+ licențe).

CULORI ȘI TEMĂ — :root
  Toate culorile paginii stau într-un singur bloc :root, la începutul
  styles.css, grupate pe familii: cerneală (--ink-*), roșu (--red-*),
  hârtie (--paper-*, --white, --cream), gri-verzui pentru texte secundare
  (--sage-*), linii (--line-*), umbre (--shadow-*) și, la final, suprafețele
  compuse: fundalurile și vălurile de gradient (--bg-*, --scrim-*).
  În reguli nu mai există niciun cod de culoare literal — totul trece prin
  var(). Schimbi tema dintr-un singur loc; ca să schimbi, de exemplu,
  atmosfera unei secțiuni, modifici --bg-section sau --scrim-hero.
  motion.css (ecran de încărcare, reveal-uri) folosește aceleași variabile.
  --cols controlează câte casete stau pe un rând pe ecran mare (acum 3).
  Valorile sunt exact cele din design: randarea e identică pixel cu pixel
  cu varianta dinaintea mutării în :root, verificat la 9 lățimi.

  Notă despre duplicarea din CSS: perechile de selectori „X, .v2 X" din
  media queries NU sunt redundante — fiecare bate o regulă .v2 definită mai
  devreme. Am verificat automat toate cele 52: eliminarea oricăreia (sau a
  prefixului .v2 în bloc) schimbă randarea, așa că au rămas pe loc.


SIGLA "AS"
  A fost scoasă din header și de pe ecranul de încărcare; a rămas doar numele.
  Regulile .sigil din styles.css și .loader-sigil din motion.css au fost șterse,
  fiind cod mort. Monograma AS apare în continuare acolo unde e element grafic,
  nu siglă de antet: sigiliul rotund din secțiunea 2, rândul "AS 0216" din
  marginea secțiunii 1, referința "AS · 0216 · MMXXVI" din josul ecranului de
  încărcare, fotografiile (sigiliul de ceară) și iconițele de browser
  (favicon.svg, favicon-32.png, apple-touch-icon.png). Spune dacă vrei scoase
  și acestea.


VERIFICĂRI
  Pagina în repaus (după ce animațiile se termină) este identică pixel cu pixel
  cu varianta originală la 701, 820, 1000, 1200, 1440 și 1800 px, cu excepția
  zonei numelui din antet (înaltă de ~50 px), de unde a fost scoasă sigla.
  Sub 700 px diferă și prin ordinea hero-ului, cerută explicit.
  Înainte de acea schimbare, era identică și la 320, 360, 390 și 700 px,
  inclusiv cu JavaScript dezactivat.
  Reveal-urile au fost verificate în browser real (prin DevTools Protocol):
  după salt la finalul paginii, la revenirea sus și după click pe o ancoră,
  nu rămâne niciun element invizibil pe ecran.
  Zero erori și zero avertismente în consolă, atât deschisă de pe disc, cât și
  servită prin HTTP.
