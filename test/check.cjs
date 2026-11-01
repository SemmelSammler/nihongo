// Schnelle Prüfung vor jedem Push/Deploy: node test/check.cjs
// 1. Baut die App ohne Beispieldaten. 2. Prüft, dass keine Beispiel- oder privaten Daten drin sind.
// 3. Prüft, dass das Skript fehlerfrei geladen werden kann. 4. Prüft den Abgleich-Server.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process"), { pathToFileURL } = require("url");
const root = path.join(__dirname, ".."); let fehler = 0;
function ok(cond, text) { console.log((cond ? "✓ " : "✗ ") + text); if (!cond) fehler++; }

execSync("node build.cjs", { cwd: root, stdio: "pipe" });
const html = fs.readFileSync(path.join(root, "web/index.html"), "utf8");
ok(!html.includes("APP_DEMO ="), "keine Beispieldaten im veröffentlichten Build");
// Eigene Liste privater Begriffe (Namen, IBAN, …) in daten/verboten.txt – der Ordner daten/ ist nie im Repo
const vf = path.join(root, "daten/verboten.txt");
if (fs.existsSync(vf)) fs.readFileSync(vf, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  .forEach((w) => ok(!html.toLowerCase().includes(w.toLowerCase()), "kein privater Begriff „" + w.slice(0, 2) + "…“ im Build"));
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
scripts.forEach((s, i) => { try { new Function(s); ok(true, "Skript " + (i + 1) + " ohne Syntaxfehler"); } catch (e) { ok(false, "Skript " + (i + 1) + ": " + e.message); } });
["manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/apple-touch-icon.png", "fonts/inter-latin.woff2", "fonts/OFL-Inter.txt"].forEach((f) => ok(fs.existsSync(path.join(root, "web", f)), "web/" + f + " vorhanden"));

// Lerninhalte vorhanden und Lern-Logik getestet
const q = JSON.parse(fs.readFileSync(path.join(root, "deck/quellen.json"), "utf8"));
ok(q.vocab >= 3500 && q.frases >= 2500 && q.verben >= 50 && q.kanji >= 500 && q.kana >= 200, "Lerninhalte: " + q.vocab + " Wörter, " + q.frases + " Sätze, " + q.verben + " Verben, " + q.kanji + " Kanji, " + q.kana + " Kana");
["kana", "vocab", "frases", "kanji", "gram"].forEach((f) => ok(fs.existsSync(path.join(root, "web/deck", f + ".json")), "web/deck/" + f + ".json vorhanden"));
try { execSync("node test/lernen.test.cjs", { cwd: root, stdio: "pipe" }); ok(true, "Lern-Logik (test/lernen.test.cjs)"); } catch (e) { ok(false, "Lern-Logik: " + String(e.stdout).split("\n").filter((x) => x.startsWith("✗")).join(" / ")); }

// Texte: jeder Schlüssel in Spanisch UND Deutsch
const ctx = {}; require("vm").runInNewContext(fs.readFileSync(path.join(root, "app/i18n.js"), "utf8"), { window: ctx });
const es = Object.keys(ctx.I18N.TEXTE.de), de = Object.keys(ctx.I18N.TEXTE.ja);
const fehltDe = es.filter((k) => !de.includes(k)), fehltEs = de.filter((k) => !es.includes(k));
ok(!fehltDe.length && !fehltEs.length, "Texte: alle " + es.length + " Schlüssel auf DE und JA" + (fehltDe.length || fehltEs.length ? " – fehlt: " + fehltDe.concat(fehltEs).join(", ") : ""));
const appJs = fs.readFileSync(path.join(root, "app/app.js"), "utf8");
const benutzt = [...appJs.matchAll(/\b(?:tx|t|alt)\("(\w+)"/g)].map((m) => m[1]).filter((k) => !es.includes(k));
ok(!benutzt.length, "Texte: kein Schlüssel im Code, der in i18n.js fehlt" + (benutzt.length ? " – " + [...new Set(benutzt)].join(", ") : ""));

// Gestaltung und Notch (Bauplan Abschnitt 9)
const tokens = fs.readFileSync(path.join(root, "app/tokens.css"), "utf8"), appCss = fs.readFileSync(path.join(root, "app/app.css"), "utf8");
const ohneKommentar = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/!important/.test(ohneKommentar(tokens + appCss + appJs)), "kein !important");
ok(!/safe-area-inset/.test(appCss + appJs), "Safe-Area nur über --safe-top/--safe-bottom aus tokens.css");
ok(/\.is-phone \.main \{ padding: calc\(var\(--safe-top\)/.test(appCss), "Hauptbereich hält oben den Notch-Abstand ein");
ok(/\.is-phone \.overlay \{[^}]*var\(--safe-top\)/.test(appCss), "Fenster (Bottom-Sheet) hält oben den Notch-Abstand ein");
ok(!/padding-top\s*:/.test(appCss) && !/paddingTop/.test(appJs), "keine Regel überschreibt padding-top");
ok(/viewport-fit=cover/.test(html) && /black-translucent/.test(html), "viewport-fit=cover und black-translucent gesetzt");

(async () => {
  const fn = await import(pathToFileURL(path.join(root, "functions/api/sync/[id].js")).href);
  const store = new Map(), env = { SYNC_KV: { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } } };
  const id = "0123456789abcdef0123456789abcdef", tok = "t".repeat(40);
  const call = (method, body, token) => fn.onRequest({ env, params: { id }, request: new Request("http://x/api/sync/" + id, { method, headers: { "X-Sync-Token": token || tok }, body: body && JSON.stringify(body) }) });
  ok((await call("GET")).status === 404, "Abgleich: leer → 404");
  ok((await call("PUT", { v: 0, blob: { x: 1 } })).status === 200, "Abgleich: erstes Speichern");
  ok((await call("PUT", { v: 0, blob: { x: 2 } })).status === 409, "Abgleich: veralteter Stand → Konflikt");
  ok((await call("PUT", { v: 1, blob: { x: 3 } }, "f".repeat(40))).status === 403, "Abgleich: fremdes Token wird abgewiesen");
  // Briefkasten (D1 mit SQLite nachgespielt)
  const { DatabaseSync } = require("node:sqlite"), db = new DatabaseSync(":memory:"); db.exec(fs.readFileSync(path.join(root, "db/inbox.sql"), "utf8"));
  const D1 = { prepare(sql) { let a = []; const st = { bind(...x) { a = x; return st; }, async all() { return { results: db.prepare(sql).all(...a) }; }, async run() { return { meta: { changes: db.prepare(sql).run(...a).changes } }; } }; return st; }, async batch(l) { return Promise.all(l.map((x) => x.run())); } };
  const ib = await import(pathToFileURL(path.join(root, "functions/api/inbox/index.js")).href), ia = await import(pathToFileURL(path.join(root, "functions/api/inbox/ack.js")).href);
  const ienv = { INBOX_DB: D1, INBOX_TOKEN: "geheim-123" };
  const ireq = (fn, method, token, body) => fn.onRequest({ env: ienv, request: new Request("http://x/api/inbox", { method, headers: token ? { Authorization: "Bearer " + token } : {}, body: body && JSON.stringify(body) }) });
  db.prepare("INSERT INTO inbox (id, created_at, kind, es, wrong, note) VALUES (?, ?, ?, ?, ?, ?)").run("2026-11-03-001", "2026-11-03T08:00:00Z", "error", "Estoy cansado.", "Soy cansado.", "Zustand → estar");
  ok((await ireq(ib, "GET")).status === 401, "Briefkasten: ohne Token → 401");
  ok((await ireq(ib, "GET", "falsch")).status === 401, "Briefkasten: falsches Token → 401");
  ok((await (await ireq(ib, "GET", "geheim-123")).json()).items.length === 1, "Briefkasten: Eintrag wird geliefert");
  ok((await ireq(ia, "POST", "geheim-123", { ids: ["2026-11-03-001"] })).status === 200, "Briefkasten: abgeholt melden");
  ok((await (await ireq(ib, "GET", "geheim-123")).json()).items.length === 0, "Briefkasten: abgeholte Einträge kommen nicht doppelt");
  console.log(fehler ? "\n" + fehler + " Fehler" : "\nAlles in Ordnung.");
  process.exit(fehler ? 1 : 0);
})();
