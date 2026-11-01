# Anleitung: neue App aus der Vorlage

## 1. Neue App anlegen (ca. 2 Minuten)
1. GitHub → dieses Repo → grüner Knopf **Use this template → Create a new repository**.
2. Name eintragen (z. B. `trainings-app`), **Private** wählen, **Create repository**.
3. In Claude Code eine Sitzung mit dem neuen Repo starten und die Idee beschreiben.

Claude passt dann an: `app.config.json` (Name, ID, Farbe), `app/icon.svg` + `node tools/icons.cjs`, und baut die Idee in `app/app.js`.

## 2. Ins Netz bringen: Cloudflare Pages (gratis)
1. dash.cloudflare.com → **Workers & Pages** → **Create application**.
2. Ganz unten: **„Looking to deploy Pages? Get started“** (nicht „Continue with GitHub“ – das ist Workers).
3. **Import an existing Git repository** → Repo wählen → **Begin setup**.
4. Eintragen: Production branch `main`, Framework **None**, Build command `node build.cjs`, Build output `web` → **Save and Deploy**.
5. **Storage & Databases → KV → Create** (Name egal, z. B. `app-sync`).
6. Pages-Projekt → **Settings → Bindings → Add → KV namespace**: Variable name **`SYNC_KV`**, den KV von eben wählen → speichern.
7. **Deployments → ⋯ → Retry deployment**.
8. Oben im Projekt steht die echte Adresse (`<name>-xyz.pages.dev` – Namen sind weltweit einmalig, oft kommt ein Kürzel dazu).
9. Prüfen: `https://<adresse>/api/sync/00000000000000000000000000000000` → `{"error":"Noch nichts gespeichert"}` = alles gut.
10. Die Adresse in `app.config.json` bei `"server"` eintragen (für die Desktop-App), bauen, pushen.

**Vorschau-Links:** Jeder andere Branch als `main` bekommt automatisch eine eigene Test-Adresse (steht unter Deployments). Neues erst dort ausprobieren, dann in `main` übernehmen – erst dann sieht es das iPhone.

## 3. Auf die Geräte
| Gerät | So geht's |
|---|---|
| iPhone | Safari → Adresse öffnen → Teilen → **Zum Home-Bildschirm** |
| Windows | GitHub → Actions → letzter Lauf „Apps bauen“ → unten **App-Windows** laden → entpacken → `.exe` starten. Warnung: **Weitere Informationen → Trotzdem ausführen** |
| Mac | dort **App-Mac** laden → `.dmg` öffnen → App in **Programme** ziehen. Beim ersten Start: **Systemeinstellungen → Datenschutz & Sicherheit → Dennoch öffnen** |

Auf dem ersten Gerät: **Mehr → Abgleich → Neu einrichten**, Schlüssel sicher aufbewahren (Passwort-Manager). Auf allen anderen: **Mit Schlüssel verbinden**.

## 4. Updates
- **iPhone/Browser:** automatisch nach jedem Push auf `main` (App einmal schließen und öffnen).
- **Windows/Mac:** Version in `app.config.json` hochzählen → `node build.cjs` → pushen → neue Dateien wie oben laden. (Automatische Updates per Tauri-Updater sind möglich, brauchen aber Signier-Schlüssel – erst einbauen, wenn es nervt.)

## 5. Damit Claude alles selbst erledigen kann (optional, einmalig)
So hat es bei der Spanisch-App funktioniert (geprüft am 1.11.2026):

| Was | Wo | Hinweis |
|---|---|---|
| API-Token | Cloudflare → **My Profile → API Tokens → Create Token → Custom token**, Konto-Ebene: *Cloudflare Pages: Edit*, *Workers KV Storage: Edit*, *D1: Edit* | Einmal für alle Apps |
| Token als **Netzwerk-Geheimnis** | Claude-Umgebung → **Edit** → Geheimnis für den Host `api.cloudflare.com` | Der Proxy hängt das Token an jede Anfrage an `api.cloudflare.com` an. Es steht **nicht** als Variable in der Umgebung und nie im Repo. |
| `CLOUDFLARE_ACCOUNT_ID` | Claude-Umgebung → Umgebungsvariablen | Konto-ID aus dem Cloudflare-Dashboard (rechte Spalte) |
| Allowed domains | Claude-Umgebung → **Edit → Allowed domains**: `api.cloudflare.com`, `*.pages.dev` (+ Datenquellen der App) | Ohne `*.pages.dev` kann Claude die fertige Seite nicht prüfen |

- **wrangler** startet nur mit gesetztem `CLOUDFLARE_API_TOKEN`, braucht dort aber nur einen **Platzhalter** – der Proxy ersetzt ihn:
  `CLOUDFLARE_API_TOKEN=platzhalter npx wrangler whoami`
- Prüfen, ob alles klappt: `curl https://api.cloudflare.com/client/v4/user/tokens/verify` → `"status": "active"`.
- **Veröffentlichen geht nur über GitHub, nicht per Direkt-Upload.** `wrangler pages deploy` scheitert hier mit „Authorization failed [8000013]“: Der Upload nutzt einen eigenen Schlüssel, den der Proxy durch das API-Token ersetzt. Darum:
  1. Einmalig (Nutzer): GitHub → https://github.com/settings/installations → **Cloudflare Workers and Pages → Configure → Repository access** → neues Repo auswählen → **Save**. Sonst meldet die API „linked to a repository that no longer exists“.
  2. Claude legt das Pages-Projekt per API an mit `source: github` (Owner, Repo, Branch), Build `node build.cjs`, Ausgabe `web`, Bindungen (`SYNC_KV`, ggf. D1) und Secrets in `deployment_configs`. Als Produktions-Branch geht auch der Claude-Branch – dann ist jeder Push sofort live.
  3. Danach baut Cloudflare bei jedem Push selbst. Status: `GET …/pages/projects/<name>/deployments`.
- KV und D1 legt Claude per API an (`/storage/kv/namespaces`, `/d1/database`, Tabelle per `/d1/database/<id>/query`).
- **Geheimnisse (z. B. Briefkasten-Token):** Claude darf sie aus Dateien nicht anzeigen (Sicherheitsprüfung). Besser: Claude denkt sich ein merkbares Passwort aus, nennt es im Chat und trägt es per API ein. **Nie** den Abgleich-Schlüssel der App als Token benutzen – der verschlüsselt die Daten.
- **Freigabe:** Im Auto-Modus blockiert Claude Code Produktions-Deploys, bis der Nutzer es ausdrücklich erlaubt. Das ist gewollt.

## Kosten
Alles 0 €: Cloudflare Pages + KV (Gratis-Stufe), GitHub privat (2.000 Action-Minuten/Monat; ein Mac-Build ≈ 50–250 davon).
Nur nötig, wenn gewünscht: Apple-Entwicklerkonto (99 €/Jahr) für Push-Mitteilungen/Widgets oder signierte Mac-Apps.
