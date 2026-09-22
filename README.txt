CE TREBUIE SĂ SCHIMBE MARKETING ÎNAINTE DE LANSARE
====================================================
Site-ul rulează acum pe placeholder-ul "adresasecreta.ro". Înainte să fie
publicat pe platforma/domeniul real, aceste puncte din <head> (și fișierele
conexe) trebuie actualizate.

1) DOMENIUL — înlocuiește "adresasecreta.ro" peste tot
------------------------------------------------------
În index.html:
  - canonical                         (linia 77)
  - hreflang alternate                (linia 78)
  - og:url                            (linia 87)
  - og:image / og:image:secure_url    (liniile 97-98, 101-102)
  - twitter:image                     (liniile 122-124)
  - JSON-LD: @id și url pentru Organization, WebSite, WebPage,
    plus logo/image (liniile 168-218)

În afara index.html:
  - robots.txt: linia "Sitemap: https://adresasecreta.ro/sitemap.xml"
  - sitemap.xml: <loc>https://adresasecreta.ro/</loc>

2) ANALYTICS / TRACKING — doar GTM, cu ID DUMMY, gated de consimțământ
-----------------------------------------------------------------------
Singurul tracker prezent e Google Tag Manager (nu GA4/Meta/TikTok
separat) — configurezi restul din interfața GTM, ca să nu numeri de
două ori aceleași evenimente.

  - GTM_ID = 'GTM-XXXXXXX' în cookie-consent.js (linia 8) — înlocuiește
    cu Container ID-ul real din Google Tag Manager.

GTM NU se încarcă la deschiderea paginii. Codul din cookie-consent.js
arată mai întâi un banner ("Accept" / "Refuz") și injectează scriptul
GTM abia după ce utilizatorul apasă „Accept" (sau dacă a acceptat deja
la o vizită anterioară, salvat în localStorage). Cât timp GTM_ID rămâne
placeholder-ul de mai sus, funcția refuză să încarce scriptul chiar
dacă utilizatorul acceptă — deci nu poți trimite date de test din
greșeală cu ID-ul dummy.

Bannerul (marcaj în index.html, aproape de </body>; stil în
cookie-consent.css) refolosește fonturile și culorile site-ului
(--gold, --cream, --muted, --serif/--body/--label).

3) VERIFICARE PROPRIETATE SITE
--------------------------------
Nu există etichete meta de verificare (google-site-verification,
facebook-domain-verification etc.). De adăugat dacă platforma le cere
pentru Search Console / Meta Business / alte instrumente.

4) TEXT MARKETING (title / description / OG / Twitter)
---------------------------------------------------------
Confirmă cu echipa de marketing textul final pentru:
  - <title>                           (linia 63)
  - meta description                  (liniile 64-67)
  - meta keywords                     (liniile 68-71)
  - og:title / og:description         (liniile 88-95)
  - twitter:title / twitter:description (liniile 114-121)

5) IMAGINE SOCIAL PREVIEW
---------------------------
Fișier: assets/generated/social-preview.jpg
Dimensiuni declarate în head: 1672x941 (og:image:width/height, liniile 105-106).
Confirmă că imaginea finală de brand se potrivește sau actualizeaz-o pe
ambele (fișier + dimensiuni declarate).

6) STRUCTURED DATA (JSON-LD)
------------------------------
Organization (liniile 173-191 din index.html) nu are:
  - telefon / email de contact în contactPoint
  - sameAs (linkuri către profilurile de social media)
De completat dacă marketing vrea rich results mai bune în Google.

7) MANIFEST / ICONIȚE (site.webmanifest)
-------------------------------------------
Confirmă că name, short_name, theme_color și setul de iconițe
(favicon.svg, favicon-32.png, apple-touch-icon.png) se potrivesc cu
brandingul final al platformei.

8) ROBOTS.TXT / SITEMAP.XML — indexare
------------------------------------------
robots.txt permite indexarea completă ("Allow: /"). Confirmă că site-ul
chiar trebuie indexat public (nu e o versiune de staging) înainte de go-live.
