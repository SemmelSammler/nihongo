// Lokaler Testserver: node tools/server.mjs [port]
// Liefert web/ aus und spielt den Abgleich-Server (functions/api/sync) mit einem Speicher im Arbeitsspeicher nach.
// So lässt sich alles (auch der Abgleich zwischen zwei „Geräten“) ohne Cloudflare testen.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fn = await import(pathToFileURL(path.join(root, "functions/api/sync/[id].js")).href);
const store = new Map();
// Briefkasten: D1 lokal mit SQLite im Arbeitsspeicher nachspielen (gleiche Tabelle wie db/inbox.sql)
const { DatabaseSync } = await import("node:sqlite");
const db = new DatabaseSync(":memory:"); db.exec(fs.readFileSync(path.join(root, "db/inbox.sql"), "utf8"));
const D1 = { prepare(sql) { let args = []; const st = { bind(...a) { args = a; return st; }, async all() { return { results: db.prepare(sql).all(...args) }; }, async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; } }; return st; },
  async batch(list) { return Promise.all(list.map((x) => x.run())); } };
const inboxIndex = await import(pathToFileURL(path.join(root, "functions/api/inbox/index.js")).href);
const inboxAck = await import(pathToFileURL(path.join(root, "functions/api/inbox/ack.js")).href);
const env = { INBOX_DB: D1, INBOX_TOKEN: process.env.INBOX_TOKEN || "test-token", SYNC_KV: { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } } };
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
const port = +process.argv[2] || 8788;
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  const chunks0 = [];
  // Nur lokal: Eintrag einwerfen wie der Coach (INSERT) – gibt es auf Cloudflare nicht
  if (u.pathname === "/__test/inbox" && req.method === "POST") {
    for await (const c of req) chunks0.push(c); const e = JSON.parse(Buffer.concat(chunks0).toString());
    db.prepare("INSERT INTO inbox (id, created_at, kind, es, de, wrong, note) VALUES (?, ?, ?, ?, ?, ?, ?)").run(e.id, e.created_at || new Date().toISOString(), e.kind, e.es, e.de || null, e.wrong || null, e.note || null);
    res.writeHead(200); res.end("ok"); return;
  }
  if (u.pathname === "/api/inbox" || u.pathname === "/api/inbox/ack") {
    for await (const c of req) chunks0.push(c);
    const request = new Request("http://localhost" + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks0) });
    const r = await (u.pathname.endsWith("/ack") ? inboxAck : inboxIndex).onRequest({ request, env });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  const m = u.pathname.match(/^\/api\/sync\/([^/]+)$/);
  if (m) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request("http://localhost" + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const r = await fn.onRequest({ request, env, params: { id: m[1] } });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  const p = path.join(root, "web", u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname));
  if (!p.startsWith(path.join(root, "web")) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log("Testserver: http://localhost:" + port));
