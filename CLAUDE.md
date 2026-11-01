# Hinweise für Claude

- Sprache: Deutsch. Antworten **kurz**, einfache Worte, genaue Klick-Anleitungen, am Ende Stichpunkte oder Tabelle. Der Nutzer ist Anfänger.
- Widerspruch ist erwünscht – begründet, nie still abweichen.
- **Zuerst `BAUPLAN.md` lesen.** Vorbild ist die Spanisch-App (Repo SemmelSammler/espanol) – Aufbau, Lernverfahren, Statistik und Briefkasten von dort übernehmen.
- Ablauf und Stolperfallen: Skill `app-von-idee-bis-geraet` (liegt in `.claude/skills/`).
- **Keine echten Daten** in Code, Commits oder Build. Beispieldaten nur in `app/beispiel.js` (nur mit `--demo`).
- Gestaltung nur über `app/tokens.css`. Kein `!important`. Alles muss auf einen Bildschirm passen, sauber ausgerichtet, auch am iPhone mit Notch.
- Vor jedem Push: `node test/check.cjs`, bei Oberflächen-Änderungen zusätzlich `node test/klicktest.cjs` und die Bilder in `test/bilder/` ansehen.
- Vor größeren Design-Schritten: 2–4 Varianten als Artefakt zeigen und wählen lassen.
- Speicher-Schlüssel (`<id>.daten.v1`, `<id>.sync`) und `id` in `app.config.json` nach dem ersten echten Einsatz **nie mehr ändern** – sonst sind Daten und Abgleich weg.
- **Cloudflare (gilt für alle Apps):** Das API-Token liegt als Netzwerk-Geheimnis für `api.cloudflare.com` in der Umgebung (der Proxy hängt es an), nicht als Variable. `wrangler` braucht `CLOUDFLARE_API_TOKEN` nur als Platzhalter: `CLOUDFLARE_API_TOKEN=platzhalter npx wrangler …`. `CLOUDFLARE_ACCOUNT_ID` steht als Variable bereit. Allowed domains: `api.cloudflare.com`, `*.pages.dev`. Details: `ANLEITUNG.md` Abschnitt 5.
