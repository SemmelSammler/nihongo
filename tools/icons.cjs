// Icons erzeugen: node tools/icons.cjs
// Aus app/icon.svg (1024×1024, vollflächig) werden alle Größen für iPhone, Browser und Desktop.
// Braucht Playwright (in Claudes Cloud-Umgebung vorhanden) und danach `npx tauri icon` für Windows/Mac.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."), cfg = JSON.parse(fs.readFileSync(path.join(root, "app.config.json"), "utf8"));
const svg = "data:image/svg+xml;base64," + fs.readFileSync(path.join(root, "app/icon.svg")).toString("base64");
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  async function shot(size, file, opts = {}) {
    await p.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * (opts.scale || 1)), off = (size - inner) / 2;
    const box = opts.rounded ? `border-radius:${Math.round(inner * 0.225)}px;overflow:hidden;box-shadow:0 ${size / 100}px ${size / 40}px rgba(0,0,0,.35);` : "";
    await p.setContent(`<body style="margin:0;background:${opts.transparent ? "transparent" : cfg.hintergrund}"><div style="position:absolute;left:${off}px;top:${off}px;width:${inner}px;height:${inner}px;${box}"><img src="${svg}" style="width:100%;height:100%;display:block"></div></body>`);
    await p.waitForTimeout(100);
    await p.screenshot({ path: file, omitBackground: !!opts.transparent });
  }
  fs.mkdirSync(path.join(root, "icons"), { recursive: true });
  await shot(180, path.join(root, "icons/apple-touch-icon.png"));
  await shot(192, path.join(root, "icons/icon-192.png"));
  await shot(512, path.join(root, "icons/icon-512.png"));
  await shot(512, path.join(root, "icons/icon-maskable-512.png"), { scale: 0.8 });
  const desk = path.join(root, "src-tauri/icon-quelle.png");
  await shot(1024, desk, { scale: 0.805, rounded: true, transparent: true });   // Mac-typisch: abgerundet mit Rand
  await b.close();
  execSync(`npx --no-install tauri icon "${desk}"`, { cwd: root, stdio: "inherit" });
  fs.rmSync(desk);
  console.log("Icons fertig.");
})();
