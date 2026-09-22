# Formular primeB → Google Sheets

Backend-ul formularului scrie fiecare cerere în spreadsheet-ul existent
[PRIME_2026_B](https://docs.google.com/spreadsheets/d/11JX3Xl-RZUaT-3BuVnLrnpIiTLdIvHOQKOnHpZsF760/edit#gid=1957795726),
în tab-ul `prime_2026_B`, cu aceste coloane, în ordine:

`Data · Nume complet · Email · Signature`

Data este generată pe server la momentul trimiterii, în fusul
`Europe/Bucharest`, în formatul `dd.MM.yyyy HH:mm`.

## Publicarea actualizării în proiectul existent

1. Deschide spreadsheet-ul de mai sus și **Extensions → Apps Script**, apoi
   folosește proiectul care deservește deployment-ul formularului.
2. Înlocuiește conținutul din `Code.gs` cu fișierul local `Code.gs`.
3. Din **Project Settings** activează afișarea `appsscript.json`, apoi
   înlocuiește manifestul cu fișierul local `appsscript.json`.
4. Rulează `setup()` din editor și acceptă autorizarea Google Sheets dacă
   Google o solicită pentru scope-ul actualizat. Aceasta deschide destinația
   explicită, inițializează cheia de semnare și creează antetul doar dacă tab-ul
   este gol. Nu adaugă o cerere de test.
5. În **Deploy → Manage deployments → Edit**, selectează **New version** și
   publică actualizarea, păstrând:
   - **Execute as:** Me
   - **Who has access:** Anyone
6. Păstrează URL-ul `/exec` al deployment-ului existent în `ENDPOINT` din
   `form.js`. Salvarea codului fără publicarea unei versiuni noi nu actualizează
   web app-ul.

Destinația este fixată în constanta `SPREADSHEET_ID` din `Code.gs`:
`11JX3Xl-RZUaT-3BuVnLrnpIiTLdIvHOQKOnHpZsF760`.
Atât `setup()`, cât și cererile folosesc `openById()`; nu depind de un
spreadsheet activ sau de o proprietate de script pentru alegerea destinației.
Scope-ul `spreadsheets` din manifest este necesar pentru această metodă.

Dacă `SPREADSHEET_ID` este gol, cererile răspund cu eroarea `config` și nu
scriu date. `selfTest()` este opțional și adaugă un rând de test care trebuie
șters manual după verificare.

## Comportament și protecții

- validează din nou numele, emailul și semnătura pe server;
- semnătura este completată automat și trebuie să fie identică cu numele complet;
- timestamp-ul nu poate fi falsificat din browser;
- neutralizează valori care ar putea deveni formule în Google Sheets;
- folosește un token semnat, de unică folosință;
- limitează global numărul de trimiteri;
- ignoră boții care completează câmpul honeypot;
- nu scrie de două ori aceeași adresă de email;
- nu expune nicio rută pentru citirea rândurilor din spreadsheet.

Scriptul scrie doar coloanele A–D. Coloane administrative suplimentare pot fi
adăugate începând cu E, fără să fie suprascrise de formular.
