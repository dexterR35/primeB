CE TREBUIE SĂ SCHIMBE MARKETING ÎNAINTE DE LANSARE
====================================================
Site-ul rulează acum pe placeholder-ul "adresasecreta.ro". Înainte să fie
publicat pe platforma/domeniul real, aceste puncte din <head> (și fișierele
conexe) trebuie actualizate.

1) DOMENIUL — înlocuiește "adresasecreta.ro" peste tot
------------------------------------------------------
În index.html:
  - canonical                         (linia 20)
  - hreflang alternate                (linia 21)
  - og:url                            (linia 30)
  - og:image / og:image:secure_url    (liniile 40, 44)
  - twitter:image                     (linia 66)
  - JSON-LD: @id și url pentru Organization, WebSite, WebPage,
    plus logo/image (liniile 112-162)

În afara index.html:
  - robots.txt: linia "Sitemap: https://adresasecreta.ro/sitemap.xml"
  - sitemap.xml: <loc>https://adresasecreta.ro/</loc>

2) ANALYTICS / TRACKING — lipsesc complet acum
-----------------------------------------------
Niciun tag de analiză nu e prezent în <head> (fără GA4, GTM, Meta Pixel,
TikTok Pixel etc.). Dacă platforma de marketing cere tracking, scripturile
trebuie adăugate manual.

Dacă se adaugă orice pixel/analytics, e nevoie și de un banner de
consimțământ cookie (GDPR) — nu există nimic momentan pe site.

3) VERIFICARE PROPRIETATE SITE
--------------------------------
Nu există etichete meta de verificare (google-site-verification,
facebook-domain-verification etc.). De adăugat dacă platforma le cere
pentru Search Console / Meta Business / alte instrumente.

4) TEXT MARKETING (title / description / OG / Twitter)
---------------------------------------------------------
Confirmă cu echipa de marketing textul final pentru:
  - <title>                           (linia 6)
  - meta description                  (liniile 7-10)
  - meta keywords                     (liniile 11-14)
  - og:title / og:description         (liniile 31-37)
  - twitter:title / twitter:description (liniile 57-63)

5) IMAGINE SOCIAL PREVIEW
---------------------------
Fișier: assets/generated/social-preview.jpg
Dimensiuni declarate în head: 1672x941 (og:image:width/height, liniile 48-49).
Confirmă că imaginea finală de brand se potrivește sau actualizeaz-o pe
ambele (fișier + dimensiuni declarate).

6) STRUCTURED DATA (JSON-LD)
------------------------------
Organization (liniile 116-135 din index.html) nu are:
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
