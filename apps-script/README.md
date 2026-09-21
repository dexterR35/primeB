# Formular primeB → Google Sheets

Backend-ul formularului scrie fiecare cerere în spreadsheet-ul
`prime_2026_B`, în tab-ul `prime_2026_B`, cu aceste coloane, în ordine:

`Data · Nume complet · Email · Signature`

Data este generată pe server la momentul trimiterii, în fusul
`Europe/Bucharest`, în formatul `dd.MM.yyyy HH:mm`.

## Configurare

1. Creează în Google Drive un spreadsheet numit `prime_2026_B`.
2. Din spreadsheet deschide **Extensions → Apps Script**. Scriptul trebuie să
   fie legat de acest spreadsheet, nu creat ca proiect standalone.
3. Înlocuiește conținutul din `Code.gs` cu fișierul local `Code.gs`.
4. Din **Project Settings** activează afișarea `appsscript.json`, apoi
   înlocuiește manifestul cu fișierul local `appsscript.json`.
5. Rulează o dată funcția `setup()`. Aceasta creează tab-ul
   `prime_2026_B`, antetul și cheia de semnare.
6. Folosește **Deploy → New deployment → Web app** cu:
   - **Execute as:** Me
   - **Who has access:** Anyone
7. Copiază URL-ul care se termină în `/exec` în constanta `ENDPOINT` din
   `form.js`.
8. Rulează opțional `selfTest()`, verifică rândul de test, apoi șterge-l.

După modificări ulterioare în Apps Script, publică o versiune nouă din
**Deploy → Manage deployments**. URL-ul `/exec` rămâne același.

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
