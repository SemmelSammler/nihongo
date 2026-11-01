# App-Vorlage

Startpunkt für eigene Apps: **eine Oberfläche** für Browser, iPhone (PWA), Windows und Mac, mit **verschlüsseltem Abgleich** zwischen den Geräten. Kostenlos, ohne App Store. Entstanden aus der Finanz-App Obol.

## Was schon fertig drin ist

| Baustein | Wo | Muss man anfassen? |
|---|---|---|
| Speichern auf dem Gerät, Backup | `app/app.js` | nein |
| Abgleich zwischen Geräten (Ende-zu-Ende verschlüsselt) | `app/sync.js`, `functions/api/sync/[id].js` | nein |
| iPhone-Ansicht mit Tab-Leiste, Notch-sicher | `app/app.css` | selten |
| Hell/Dunkel, Farben, Abstände, Schriften | `app/tokens.css` | Farben ggf. |
| Name, ID, Server-Adresse, Version | `app.config.json` | **ja, einmal** |
| Icon | `app/icon.svg` → `node tools/icons.cjs` | **ja, einmal** |
| Windows- und Mac-App | `src-tauri/`, `.github/workflows/apps-build.yml` | nein |
| Prüfung und Klick-Test | `test/check.cjs`, `test/klicktest.cjs` | nein |
| **Die eigentliche Idee** | `viewStart()` usw. in `app/app.js` | **ja – hier entsteht die App** |

Die Beispiel-Funktion „Einträge“ (Text, Betrag, Datum) ist nur Platzhalter und wird durch die eigene Idee ersetzt.

## Befehle

| Befehl | Wofür |
|---|---|
| `node build.cjs` | App nach `web/` bauen (ohne Beispieldaten) |
| `node build.cjs --demo` | lokal mit ausgedachten Beispieldaten |
| `node tools/server.mjs` | Testserver auf http://localhost:8788 inkl. Abgleich |
| `node test/check.cjs` | Prüfung: keine Beispiel-/Privatdaten im Build, keine Syntaxfehler, Abgleich-Server ok |
| `node test/klicktest.cjs` | Klick-Test: Computer trägt ein → iPhone bekommt es per Abgleich |
| `node tools/icons.cjs` | alle Icons aus `app/icon.svg` erzeugen |

Einrichtung bei Cloudflare und auf den Geräten: siehe [ANLEITUNG.md](ANLEITUNG.md).

## Regeln

- **Echte Daten nie ins Repo.** Nur auf den Geräten oder in `daten/` (wird ignoriert). Private Begriffe in `daten/verboten.txt` eintragen, `test/check.cjs` schlägt dann Alarm, falls sie im Build landen.
- **Gestaltung nur über `app/tokens.css`.** Keine festen Farben oder Pixelwerte in neuen Regeln, kein `!important`.
- Das Repo bleibt **privat**.
