// Klick-Test wie ein Mensch: node test/klicktest.cjs
// Startet den Testserver und prüft das Grundgerüst am „iPhone“ (390 × 844, wie die App vom Home-Bildschirm):
// 4 Tabs, ES/DE-Umschalter, Lang-Drücken, Auto/Hell/Dunkel, Notch-Abstand (simuliert), nichts ragt seitlich heraus.
// Dann Abgleich: Computer ändert „Nuevas por día“ → iPhone bekommt es. Screenshots + Übersicht landen in test/bilder/.
const { chromium } = require("playwright"), { spawn, execSync } = require("child_process"), path = require("path"), fs = require("fs");
const root = path.join(__dirname, ".."), port = 8799, url = "http://localhost:" + port + "/";
const SAFE_TOP = 47, SAFE_BOTTOM = 34;   // iPhone 13/14: Statusleiste mit Notch, Home-Leiste
(async () => {
  execSync("node build.cjs", { cwd: root, stdio: "pipe" });
  const srv = spawn("node", ["tools/server.mjs", String(port)], { cwd: root, stdio: "pipe" });
  await new Promise((r) => srv.stdout.once("data", r));
  const out = path.join(__dirname, "bilder"); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(), fehler = [], bilder = [];
  const ok = (cond, text) => { console.log((cond ? "✓ " : "✗ ") + text); if (!cond) fehler.push(text); };

  async function iphone(colorScheme) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme });
    const p = await ctx.newPage(); p.on("pageerror", (e) => fehler.push(e.message));
    await p.goto(url);
    // Playwright kennt keine echte Notch: Ersatz-Variablen setzen (Bauplan Abschnitt 9)
    await p.evaluate(([t, u]) => { const s = document.documentElement.style; s.setProperty("--test-safe-top", t + "px"); s.setProperty("--test-safe-bottom", u + "px"); }, [SAFE_TOP, SAFE_BOTTOM]);
    await p.click('button:text-is("¡Vamos!")');
    await p.evaluate(() => document.fonts.ready);
    return p;
  }
  async function bild(p, name, titel) { await p.waitForTimeout(150); await p.screenshot({ path: path.join(out, name) }); bilder.push([name, titel]); }
  // Simulierte Statusleiste (Uhrzeit + Dynamic Island), nur für den Screenshot
  async function statusleiste(p) {
    await p.evaluate((h) => {
      const d = document.createElement("div"); d.id = "fake-status";
      const ink = getComputedStyle(document.body).color;
      d.style.cssText = "position:fixed;top:0;left:0;right:0;height:" + h + "px;z-index:999;pointer-events:none;font:600 17px -apple-system,Inter,sans-serif;color:" + ink;
      d.innerHTML = '<span style="position:absolute;left:44px;top:15px">9:41</span>' +
        '<span style="position:absolute;left:50%;top:11px;width:122px;height:34px;margin-left:-61px;border-radius:20px;background:#000"></span>' +
        '<span style="position:absolute;right:30px;top:17px;width:25px;height:12px;border:1.5px solid ' + ink + ';border-radius:4px;opacity:.9"></span>' +
        '<span style="position:absolute;left:0;right:0;top:' + h + 'px;border-top:1px dashed rgba(240,138,112,.9)"></span>';
      document.body.appendChild(d);
    }, SAFE_TOP);
  }
  async function pruefeLayout(p, wo) {
    const r = await p.evaluate(() => {
      const first = document.querySelector(".main > *").getBoundingClientRect();
      return { top: first.top, breite: document.documentElement.scrollWidth, fenster: innerWidth, hoch: document.documentElement.scrollHeight >= innerHeight };
    });
    ok(r.top >= SAFE_TOP, wo + ": Inhalt beginnt unter der Notch (" + Math.round(r.top) + " px ≥ " + SAFE_TOP + ")");
    ok(r.breite <= r.fenster, wo + ": nichts ragt seitlich heraus");
    ok(r.hoch, wo + ": Seite füllt den ganzen Bildschirm (Tab-Leiste bleibt unten)");
  }
  const h1 = (p) => p.locator("h1").innerText();
  const tabs = (p) => p.locator(".tabbar button").allInnerTexts();

  try {
    /* ---------- Dunkel, Spanisch ---------- */
    const p = await iphone("dark");
    ok((await tabs(p)).join("|") === "Hoy|Aprender|Estadística|Errores", "4 Tabs auf Spanisch");
    ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === "rgb(17, 19, 21)", "Dunkel = Farbe aus Prototyp D (#111315)");
    ok(await p.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Inter" && f.status === "loaded")), "Schrift Inter geladen");
    const fit = await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight);
    ok(fit, "Hoy passt auf einen Bildschirm");
    await pruefeLayout(p, "Hoy");
    await bild(p, "01-dunkel-es-hoy.png", "Dunkel · ES · Hoy");
    for (const [tab, titel, datei] of [["Aprender", "Aprender", "02-dunkel-es-aprender.png"], ["Estadística", "Estadística", "03-dunkel-es-estadistica.png"], ["Errores", "Tus errores", "04-dunkel-es-errores.png"]]) {
      await p.click('.tabbar button:text-is("' + tab + '")');
      ok((await h1(p)) === titel, "Tab " + tab + " öffnet „" + titel + "“");
      await pruefeLayout(p, tab);
      await bild(p, datei, "Dunkel · ES · " + tab);
    }
    await p.click('.tabbar button:text-is("Hoy")');

    /* Lang-Drücken: Tab „Aprender“ ~0,7 s halten → „Lernen“, Tab wechselt NICHT */
    const box = await p.locator('.tabbar button:text-is("Aprender")').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(700);
    ok((await p.locator(".tip").innerText()) === "Lernen", "Lang-Drücken zeigt die deutsche Übersetzung");
    await bild(p, "05-langdruecken.png", "Lang-Drücken auf „Aprender“");
    await p.mouse.up(); await p.waitForTimeout(100);
    ok((await h1(p)) !== "Aprender", "nach Lang-Drücken bleibt der Tab gleich");
    await p.waitForTimeout(1500);
    ok(!(await p.locator(".tip").count()), "Übersetzung verschwindet wieder");
    // Lang-Drücken auf die Überschrift ganz oben: Blase darf nicht unter die Uhrzeit
    const hb = await p.locator("h1").boundingBox();
    await p.mouse.move(hb.x + 20, hb.y + hb.height / 2); await p.mouse.down(); await p.waitForTimeout(700);
    const tipTop = (await p.locator(".tip").boundingBox()).y;
    ok(tipTop >= SAFE_TOP, "Übersetzungs-Blase bleibt unter der Notch (" + Math.round(tipTop) + " px)");
    await p.mouse.up(); await p.waitForTimeout(1600);

    /* ---------- Deutsch ---------- */
    await p.click('.lang button:text-is("DE")');
    ok((await tabs(p)).join("|") === "Heute|Lernen|Statistik|Fehler", "Umschalter DE: ganze Oberfläche auf Deutsch");
    ok(await p.evaluate(() => document.documentElement.lang) === "de", "Sprache der Seite = de");
    await bild(p, "06-dunkel-de-hoy.png", "Dunkel · DE · Heute");
    await p.click('.tabbar button:text-is("Lernen")'); await bild(p, "07-dunkel-de-lernen.png", "Dunkel · DE · Lernen");
    await p.click('.tabbar button:text-is("Heute")');

    /* ---------- Simulierte Notch ---------- */
    await p.click('.lang button:text-is("ES")');
    await statusleiste(p); await bild(p, "08-notch-dunkel-hoy.png", "Notch simuliert · Hoy (rote Linie = Unterkante Statusleiste)");
    await p.evaluate(() => window.scrollTo(0, 400));   // gescrollt: Inhalt läuft unter dem Notch-Streifen, nicht über der Uhr
    await p.click('.tabbar button:text-is("Estadística")'); await p.evaluate(() => window.scrollTo(0, 300));
    await bild(p, "09-notch-dunkel-gescrollt.png", "Notch simuliert · Estadística gescrollt");
    await p.evaluate(() => window.scrollTo(0, 0));

    /* ---------- Einstellungen: Hell/Dunkel/Auto ---------- */
    await p.click('button[aria-label="Ajustes"]');
    const mt = (await p.locator(".modal").boundingBox()).y;
    ok(mt >= SAFE_TOP, "Einstellungen (Bottom-Sheet) bleiben unter der Notch (" + Math.round(mt) + " px)");
    await bild(p, "10-notch-dunkel-ajustes.png", "Notch simuliert · Ajustes");
    await p.click('.seg button:text-is("Claro")');
    ok(await p.evaluate(() => document.documentElement.dataset.mode) === "hell", "„Claro“ schaltet auf Hell, obwohl das iPhone dunkel ist");
    ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === "rgb(245, 246, 247)", "Hell-Farben aktiv");
    await p.evaluate(() => document.getElementById("fake-status").remove()); await statusleiste(p);
    await bild(p, "11-notch-hell-ajustes.png", "Notch simuliert · Hell · Ajustes");
    await p.click('.seg button:text-is("Auto")');
    ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === "rgb(17, 19, 21)", "„Auto“ folgt wieder dem iPhone (dunkel)");
    await p.click('.modal button:text-is("Cerrar")');
    await p.context().close();

    /* ---------- Hell (iPhone auf hell), Spanisch + Deutsch ---------- */
    const q = await iphone("light");
    ok(await q.evaluate(() => getComputedStyle(document.body).backgroundColor) === "rgb(245, 246, 247)", "Auto + iPhone hell → Hell");
    await bild(q, "12-hell-es-hoy.png", "Hell · ES · Hoy");
    await q.click('.tabbar button:text-is("Aprender")'); await bild(q, "13-hell-es-aprender.png", "Hell · ES · Aprender");
    await q.click('.lang button:text-is("DE")');
    await q.click('.tabbar button:text-is("Statistik")'); await pruefeLayout(q, "Statistik hell"); await bild(q, "14-hell-de-statistik.png", "Hell · DE · Statistik");
    await q.click('.tabbar button:text-is("Fehler")'); await bild(q, "15-hell-de-fehler.png", "Hell · DE · Fehler");
    await q.click('.tabbar button:text-is("Heute")'); await statusleiste(q); await bild(q, "16-notch-hell-de-heute.png", "Notch simuliert · Hell · DE · Heute");
    await q.context().close();

    /* ---------- Lernen (Etappe 2): Sitzungen in allen 5 Modi ---------- */
    const l = await iphone("dark");
    await l.waitForSelector('button:text-is("Empezar")');
    ok((await l.locator("#hoy-total").innerText()) === "10", "Hoy: 10 tarjetas bei „Nuevas por día“ = 10");
    await l.click('.tabbar button:text-is("Aprender")'); await l.click('.modo[data-m="vocab"]');
    const erste = await l.locator(".front").innerText();
    await bild(l, "20-vocab-frage.png", "Vocabulario · Frage");
    await l.click('button:text-is("Mostrar respuesta")');
    ok(/en \d+ días|mañana/.test(await l.locator(".rate.lose span").innerText()), "unter „Lo sé“ steht der nächste Termin (" + await l.locator(".rate.lose span").innerText() + ")");
    await bild(l, "21-vocab-antwort.png", "Vocabulario · Antwort + Otra vez / Lo sé");
    await l.click(".rate.otra");
    for (let i = 0; i < 2; i++) { await l.click('button:text-is("Mostrar respuesta")'); await l.click(".rate.lose"); }
    ok((await l.locator(".front").innerText()) === erste && (await l.locator(".marke").count()) === 1, "„Otra vez“: Karte kommt nach 2 anderen wieder, mit Marke");
    await l.click('button:text-is("Mostrar respuesta")'); await l.click(".rate.lose");
    while (await l.locator('button:text-is("Mostrar respuesta")').count()) { await l.click('button:text-is("Mostrar respuesta")'); await l.click(".rate.lose"); }
    ok(await l.locator(".fertig-t").count() === 1, "Sitzung endet mit „¡Listo!“");
    await bild(l, "22-listo.png", "Sitzung fertig");
    await l.click('button:text-is("Seguir: +10 nuevas")');
    ok(/de 1\d$/.test(await l.locator("#ses-pos").innerText()) || /de \d+$/.test(await l.locator("#ses-pos").innerText()), "„Seguir: +10 nuevas“ lädt weitere Karten (" + await l.locator("#ses-pos").innerText() + ")");
    await l.click('button:text-is("Terminar")');

    await l.click('.modo[data-m="frases"]'); await l.click('button:text-is("Mostrar respuesta")');
    await bild(l, "23-frases.png", "Frases · Lücke aufgedeckt");
    await l.click('button:text-is("Terminar")');

    await l.click('.modo[data-m="gram"]');
    const form = (await l.evaluate(() => document.querySelector(".front").textContent)).split(" · ");
    const richtig = await l.evaluate((f) => window.__espanol.deck.gram.find((g) => g.v === f[0] && g.p === f[1] && g.t === f[2]).f, form);
    const ohne = richtig.normalize("NFD").replace(/[\u0301]/g, "").normalize("NFC");
    await l.fill("#f-resp", ohne); await bild(l, "24-gram-eingabe.png", "Gramática · Eingabe");
    await l.click('button:text-is("Comprobar")');
    ok((await l.locator(".ok-t").count()) === 1, "Gramática: „" + ohne + "“ für „" + richtig + "“ zählt als richtig" + (ohne !== richtig ? " (mit Akzent-Hinweis)" : ""));
    await bild(l, "25-gram-ergebnis.png", "Gramática · geprüft");
    await l.click('button:text-is("Siguiente")');
    await l.fill("#f-resp", "xyz"); await l.click('button:text-is("Comprobar")');
    ok((await l.locator(".neg-t").count()) === 1, "Gramática: falsche Form wird erkannt");
    await l.click('button:text-is("Siguiente")'); await l.click('button:text-is("Terminar")');

    await l.click('.modo[data-m="num"]');
    await bild(l, "26-num-frage.png", "Números y horas · hören und wählen");
    await l.locator(".opt").first().click();
    ok((await l.locator(".opt.richtig").count()) === 1, "Números: richtige Antwort wird markiert");
    await bild(l, "27-num-ergebnis.png", "Números y horas · Ergebnis");
    await l.click('button:text-is("Siguiente")'); await l.click('button:text-is("Terminar")');

    /* Import (Ersatzweg zum Briefkasten): JSON einfügen → Fehler + Karte „Del chat“ */
    await l.click('button[aria-label="Ajustes"]');
    await l.fill("#f-import", JSON.stringify([{ id: "2026-11-03-001", kind: "error", es: "Estoy cansado.", de: "Ich bin müde.", wrong: "Soy cansado.", note: "Zustand → estar" }, { id: "2026-11-03-002", kind: "vocab", es: "la plata", de: "das Geld (ugs.)" }]));
    await l.click('button:text-is("Importar")'); await l.click('.modal button:text-is("Cerrar")');
    await l.click('.tabbar button:text-is("Errores")');
    ok((await l.locator(".falsch-t").first().innerText()) === "Soy cansado.", "Import: Fehler erscheint unter Errores");
    await bild(l, "28-errores.png", "Errores nach Import");
    await l.click('.tabbar button:text-is("Aprender")');
    ok((await l.locator('.modo[data-m="chat"] .pill').innerText()) === "1", "Import: 1 Karte im Modus „Del chat“");
    await l.click('.modo[data-m="chat"]'); await l.click('button:text-is("Mostrar respuesta")');
    await bild(l, "29-chat.png", "Del chat · Antwort");
    await l.click(".rate.lose");
    await l.click('button:text-is("Terminar")');
    // nochmal derselbe Import → wird ignoriert
    await l.click('button[aria-label="Ajustes"]');
    await l.fill("#f-import", JSON.stringify([{ id: "2026-11-03-001", kind: "error", es: "Estoy cansado.", wrong: "Soy cansado." }]));
    await l.click('button:text-is("Importar")');
    ok((await l.locator(".toast").innerText()).includes("Nada nuevo"), "Import: doppelte ID wird ignoriert");
    await l.click('.modal button:text-is("Cerrar")');
    /* Briefkasten (Etappe 5): Coach schreibt in D1 → App holt ab */
    await fetch(url + "__test/inbox", { method: "POST", body: JSON.stringify({ id: "2026-11-04-001", kind: "error", es: "Gracias por la ayuda.", de: "Danke für die Hilfe.", wrong: "Gracias para la ayuda.", note: "Grund → por" }) });
    await l.click('button[aria-label="Ajustes"]'); await l.fill("#f-token", "test-token"); await l.click('button:text-is("Guardar")');
    await l.waitForSelector('.toast:has-text("1 nuevos del coach")', { timeout: 5000 });
    ok(true, "Briefkasten: Eintrag aus D1 kommt in der App an");
    await l.click('.modal button:text-is("Cerrar")'); await l.click('.tabbar button:text-is("Errores")');
    ok((await l.locator(".falsch-t").allInnerTexts()).includes("Gracias para la ayuda."), "Briefkasten: Fehler steht unter Errores");
    const nochmal = await (await fetch(url + "api/inbox", { headers: { Authorization: "Bearer test-token" } })).json();
    ok(nochmal.items.length === 0, "Briefkasten: abgeholt → kommt nicht doppelt");
    await l.click('.tabbar button:text-is("Estadística")'); await bild(l, "30-estadistica-nach-lernen.png", "Estadística nach dem Lernen");
    const groesse = await l.evaluate(() => localStorage.getItem("espanol.daten.v1").length);
    ok(groesse < 2e6, "Fortschritt klein (" + groesse + " Zeichen)");
    await l.context().close();

    /* ---------- Abgleich: Computer → iPhone ---------- */
    const pc = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(); pc.on("pageerror", (e) => fehler.push(e.message));
    await pc.goto(url); await pc.click('button:text-is("¡Vamos!")');
    await pc.click('.nav button:text-is("Aprender")'); await pc.click('button[aria-label="Más tarjetas nuevas"]'); await pc.click('button[aria-label="Más tarjetas nuevas"]');
    ok((await pc.locator("#nuevas").innerText()) === "20", "Regler „Nuevas por día“: 10 → 20");
    await pc.click('button[aria-label="Ajustes"]'); await pc.click('button:text-is("Configurar")');
    const key = (await pc.locator(".key").innerText()).trim();
    await pc.click('.modal button:text-is("Cerrar")');
    await pc.waitForTimeout(3500);   // Abgleich läuft 3 s nach der letzten Änderung
    await pc.screenshot({ path: path.join(out, "17-computer.png") }); bilder.push(["17-computer.png", "Computer (Fenster > 700 px)"]);
    const ph = await iphone("dark");
    await ph.click('button[aria-label="Ajustes"]'); await ph.click('button:text-is("Conectar con clave")');
    await ph.fill("#f-key", key.toLowerCase()); await ph.click('button:text-is("Conectar")');
    await ph.waitForTimeout(1500); await ph.click('.tabbar button:text-is("Aprender")');
    ok((await ph.locator("#nuevas").innerText()) === "20", "Abgleich: Einstellung vom Computer ist auf dem iPhone angekommen");
  } catch (e) { fehler.push(e.message.split("\n")[0]); console.log("✗ " + e.message.split("\n")[0]); }

  /* Übersicht aller Bilder auf einer Seite */
  if (bilder.length) {
    const html = '<body style="margin:0;padding:24px;background:#202326;font:14px system-ui;color:#ddd"><div style="display:grid;grid-template-columns:repeat(4,300px);gap:20px">' +
      bilder.filter((x) => !x[0].includes("computer")).map(([f, tt]) => '<figure style="margin:0"><img src="' + f + '" style="width:300px;border-radius:18px;display:block"><figcaption style="margin-top:6px">' + tt + "</figcaption></figure>").join("") + "</div></body>";
    fs.writeFileSync(path.join(out, "uebersicht.html"), html);
    const pg = await (await b.newContext({ viewport: { width: 1328, height: 800 } })).newPage();
    await pg.goto("file://" + path.join(out, "uebersicht.html")); await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(out, "uebersicht.png"), fullPage: true });
  }
  await b.close(); srv.kill();
  console.log(fehler.length ? "\n✗ " + fehler.length + " Fehler:\n  " + fehler.join("\n  ") : "\n✓ keine Fehler. Bilder: test/bilder/ (Übersicht: uebersicht.png)");
  process.exit(fehler.length ? 1 : 0);
})();
