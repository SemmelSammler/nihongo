// App bauen: node build.cjs [--demo]
// Schreibt die fertige App nach web/ (index.html, Manifest, Service Worker, Icons).
// web/ wird von Cloudflare Pages veröffentlicht (iPhone/Browser) und ist die Oberfläche der Desktop-App (Tauri).
// Ohne --demo: keine Beispieldaten. Mit --demo: Beispieldaten aus app/beispiel.js (nur lokal ausprobieren).
// Außerdem: Name, Version und ID aus app.config.json in die Desktop-App übernehmen (eine Stelle für alles).
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = __dirname, demo = process.argv.includes("--demo");
const out = path.join(root, "web");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const cfg = JSON.parse(read("app.config.json"));

const js = ["window.APP_CONFIG = " + JSON.stringify(cfg) + ";", demo ? read("app/beispiel.js") : "", read("app/i18n.js"), read("node_modules/ts-fsrs/dist/index.umd.js"), read("app/lernen.js"), read("app/sync.js"), read("app/app.js")].join("\n");
const css = read("app/tokens.css") + "\n" + read("app/app.css");
const deckHash = fs.readdirSync(path.join(root, "deck")).map((f) => read("deck/" + f)).join("");
const version = crypto.createHash("sha256").update(js + css + deckHash).digest("hex").slice(0, 10);
const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${e(cfg.name)}</title><meta name="description" content="${e(cfg.beschreibung || "")}">
<meta name="theme-color" content="${e(cfg.hintergrund)}">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="${e(cfg.name)}">
<link rel="preload" href="fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icons/apple-touch-icon.png"><link rel="icon" href="icons/icon-192.png">
<style>${css}</style></head><body><div id="app"></div>
<script>${js.replace(/<\/script>/gi, "<\\/script>")}</script>
<script>if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");</script>
</body></html>`;

const manifest = { name: cfg.name, short_name: cfg.name, lang: "es", start_url: "./", scope: "./", display: "standalone",
  background_color: cfg.hintergrund, theme_color: cfg.hintergrund,
  icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
// Offline: immer zuerst frisch aus dem Netz (Updates kommen sofort an), sonst aus dem Speicher. /api/ nie aus dem Speicher.
const sw = `const CACHE = "${cfg.id}-${version}";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "fonts/inter-latin.woff2", "deck/vocab.json", "deck/frases.json", "deck/gram.json"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.includes("/api/")) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
`;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "icons"), { recursive: true });
fs.mkdirSync(path.join(out, "fonts"), { recursive: true });
fs.mkdirSync(path.join(out, "deck"), { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), html);
fs.writeFileSync(path.join(out, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(out, "sw.js"), sw);
for (const f of fs.readdirSync(path.join(root, "icons"))) fs.copyFileSync(path.join(root, "icons", f), path.join(out, "icons", f));
// Schrift Inter (SIL OFL 1.1) mit Lizenz, damit die App auch offline gleich aussieht
for (const f of fs.readdirSync(path.join(root, "app/fonts"))) fs.copyFileSync(path.join(root, "app/fonts", f), path.join(out, "fonts", f));

// Lerninhalte (aus tools/daten/bauen.mjs) – Version im Service Worker hängt auch davon ab
for (const f of fs.readdirSync(path.join(root, "deck"))) fs.copyFileSync(path.join(root, "deck", f), path.join(out, "deck", f));

// Desktop-App: Name/Version/ID aus app.config.json übernehmen
const tp = path.join(root, "src-tauri/tauri.conf.json");
if (fs.existsSync(tp)) {
  const t = JSON.parse(fs.readFileSync(tp, "utf8")), before = JSON.stringify(t);
  t.productName = cfg.name; t.version = cfg.version; t.identifier = cfg.bundleId; t.app.windows[0].title = cfg.name;
  if (JSON.stringify(t) !== before) fs.writeFileSync(tp, JSON.stringify(t, null, 2) + "\n");
}
console.log("web/index.html", (html.length / 1024).toFixed(0) + " KB", demo ? "(mit Beispieldaten)" : "(ohne Daten)", "Version " + version);
