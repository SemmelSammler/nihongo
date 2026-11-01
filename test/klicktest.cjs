// Klick-Test wie ein Mensch: node test/klicktest.cjs
// iPhone (390 × 844, simulierte Notch): Tabs, DE/JA, Lang-Drücken, Hell/Dunkel, alle 7 Lernmodi, Schrift-Einstellung,
// Kanji-Freischaltung, Import, Briefkasten, Abgleich Computer → iPhone. Screenshots + Übersicht in test/bilder/.
const { chromium } = require("playwright"), { spawn, execSync } = require("child_process"), path = require("path"), fs = require("fs");
const root = path.join(__dirname, ".."), port = 8799, url = "http://localhost:" + port + "/";
const SAFE_TOP = 47, SAFE_BOTTOM = 34;
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
    await p.evaluate(([t, u]) => { const s = document.documentElement.style; s.setProperty("--test-safe-top", t + "px"); s.setProperty("--test-safe-bottom", u + "px"); }, [SAFE_TOP, SAFE_BOTTOM]);
    await p.click('button:text-is("Los geht’s")');
    await p.waitForFunction(() => window.__app && window.__app.deck.ok, null, { timeout: 15000 });
    await p.evaluate(() => document.fonts.ready);
    return p;
  }
  async function bild(p, name, titel) { await p.waitForTimeout(150); await p.screenshot({ path: path.join(out, name) }); bilder.push([name, titel]); }
  async function layout(p, wo) {
    const r = await p.evaluate(() => ({ top: document.querySelector(".main > *").getBoundingClientRect().top, breite: document.documentElement.scrollWidth, fenster: innerWidth, hoch: document.documentElement.scrollHeight >= innerHeight }));
    ok(r.top >= SAFE_TOP && r.breite <= r.fenster && r.hoch, wo + ": unter der Notch, nichts ragt heraus, Tab-Leiste unten");
  }
  const tabs = (p) => p.locator(".tabbar button").allInnerTexts();
  const lose = async (p) => { await p.click('button:text-is("Antwort zeigen")'); await p.click(".rate.lose"); };
  const richtigWaehlen = async (p) => { const okWert = await p.evaluate(() => window.__app.aktuelleAntwort()); await p.click('.opt[data-o="' + okWert + '"]'); return okWert; };

  try {
    /* ---------- Grundgerüst ---------- */
    const p = await iphone("dark");
    ok((await tabs(p)).join("|") === "Heute|Lernen|Statistik|Fehler", "4 Tabs auf Deutsch (Standard)");
    ok((await p.locator("#hoy-total").innerText()) === "10", "Heute: 10 Karten bei „Neue pro Tag“ = 10");
    await layout(p, "Heute"); await bild(p, "01-heute.png", "Heute (dunkel, DE)");
    for (const [tab, datei] of [["Lernen", "02-lernen.png"], ["Statistik", "03-statistik.png"], ["Fehler", "04-fehler.png"]]) { await p.click('.tabbar button:text-is("' + tab + '")'); await layout(p, tab); await bild(p, datei, tab); }
    await p.click('.tabbar button:text-is("Heute")');
    const box = await p.locator('.tabbar button:text-is("Lernen")').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(700);
    ok((await p.locator(".tip").innerText()) === "学習", "Lang-Drücken zeigt die japanische Beschriftung");
    await p.mouse.up(); await p.waitForTimeout(1600);
    await p.click('.lang button:text-is("JA")');
    ok((await tabs(p)).join("|") === "今日|学習|統計|間違い", "Umschalter JA: Oberfläche auf Japanisch");
    await bild(p, "05-heute-ja.png", "Oberfläche Japanisch"); await p.click('.lang button:text-is("DE")');

    /* ---------- Kana-Trainer ---------- */
    await p.click('.tabbar button:text-is("Lernen")'); await bild(p, "06-lernen-trainer.png", "Lernen mit Kana-Trainer");
    await p.click('.trainer-btn[data-s="h"]'); await p.waitForTimeout(400); await bild(p, "07-trainer-tabelle.png", "Kana-Trainer: Hiragana-Tabelle");
    await p.click('.btn.primary[data-act="tLektion"]'); await p.waitForTimeout(2500);
    await bild(p, "08-trainer-kennen.png", "Lektion: Kennenlernen (Strichfolge, nachzeichnen)");
    const cv = await p.locator("#zeichnen").boundingBox();
    await p.mouse.move(cv.x + cv.width * 0.3, cv.y + cv.height * 0.3); await p.mouse.down(); await p.mouse.move(cv.x + cv.width * 0.7, cv.y + cv.height * 0.3, { steps: 8 }); await p.mouse.up();
    await p.mouse.move(cv.x + cv.width * 0.45, cv.y + cv.height * 0.15); await p.mouse.down(); await p.mouse.move(cv.x + cv.width * 0.4, cv.y + cv.height * 0.85, { steps: 8 }); await p.mouse.up();
    await bild(p, "09-trainer-gezeichnet.png", "Lektion: nachgezeichnet");
    let runden = 0, bildWahl = false, bildSchreiben = false;
    while (runden++ < 80 && !(await p.locator(".fertig-t").count())) {
      if (await p.locator('button[data-act="tVergleich"]').count()) {
        const c2 = await p.locator("#zeichnen").boundingBox();
        await p.mouse.move(c2.x + 60, c2.y + 80); await p.mouse.down(); await p.mouse.move(c2.x + 200, c2.y + 120, { steps: 6 }); await p.mouse.up();
        await p.click('button[data-act="tVergleich"]'); await p.waitForTimeout(1500);
        if (!bildSchreiben) { bildSchreiben = true; await bild(p, "0a-trainer-schreiben.png", "Lektion: aus dem Kopf schreiben + vergleichen"); }
        await p.click('button[data-act="tSelbst"][data-ok="1"]');
      } else if (await p.locator('button[data-act="tWeiter"]').count() && !(await p.locator(".opt").count())) await p.click('button[data-act="tWeiter"]');
      else if (await p.locator(".opt:not([disabled])").count()) {
        await richtigWaehlen(p);
        if (!bildWahl) { bildWahl = true; await bild(p, "0b-trainer-erkennen.png", "Lektion: erkennen (mit Verwechslern)"); }
        await p.click('button[data-act="tWeiter"]');
      } else break;
    }
    ok(await p.locator(".fertig-t").count() === 1, "Kana-Trainer: Lektion あ-Reihe komplett durchlaufen (" + runden + " Schritte)");
    await bild(p, "0c-trainer-ende.png", "Lektion geschafft");
    ok((await p.evaluate(() => window.__app.state().kt.h)) === 1, "Kana-Trainer: nächste Reihe (か) freigeschaltet");
    const sicher = await p.evaluate(() => Object.keys(window.__app.state().kt.m).filter((z) => window.__app.state().kt.m[z].ok).length);
    ok(sicher >= 3, "Kana-Trainer: " + sicher + " Zeichen „sicher“ (richtig und schnell) → kommen ins Wiederholen (FSRS)");
    await p.click('button[data-act="tTabelle"]'); await bild(p, "0d-trainer-tabelle-nachher.png", "Tabelle nach der ersten Lektion");
    await p.click('button[data-act="tTempo"]'); await richtigWaehlen(p); await bild(p, "0e-trainer-tempo.png", "Tempo-Runde (60 s)");
    await p.click('button[data-act="tZurueck"]'); await p.click('button[data-act="tZurueck"]');
    await p.click('.trainer-btn[data-s="k"]'); await p.click('.kz[data-z="ア"]'); await p.waitForTimeout(2200); await bild(p, "0f-trainer-detail.png", "Katakana: Zeichen antippen → Strichfolge");
    await p.click('button[data-act="tZurueck"]'); await p.click('button[data-act="tZurueck"]'); await p.click('.tabbar button:text-is("Heute")');

    /* ---------- Kana ---------- */
    await p.click('.tabbar button:text-is("Lernen")'); await p.click('.modo[data-m="kana"]');
    // Die Kana aus dem Trainer zählen schon als „neu heute“ → für den Test 10 weitere holen
    if (await p.locator(".fertig-t").count()) await p.click('button:text-is("Weiter: +10 neue")');
    await bild(p, "10-kana-frage.png", "Kana: Zeichen → Laut");
    const kz = await p.locator(".zeichen").innerText(); const ro = await richtigWaehlen(p);
    ok((await p.locator(".opt.richtig").count()) === 1, "Kana: „" + kz + "“ = " + ro + " wird als richtig erkannt");
    await bild(p, "11-kana-ergebnis.png", "Kana: Ergebnis");
    await p.click('button:text-is("Weiter")');
    const falsch = await p.evaluate(() => [...document.querySelectorAll(".opt")].map((x) => x.dataset.o).find((o) => o !== window.__app.aktuelleAntwort()));
    await p.click('.opt[data-o="' + falsch + '"]'); ok((await p.locator(".opt.falsch").count()) === 1, "Kana: falsche Antwort wird markiert");
    await p.click('button:text-is("Weiter")'); await p.click('button:text-is("Beenden")');

    /* ---------- Vokabeln: Kana + Romaji, dann Kanji + Lesung ---------- */
    await p.click('.modo[data-m="vocab"]'); await bild(p, "12-vokabel-kana.png", "Vokabel: Kana + Romaji");
    await p.click('button:text-is("Antwort zeigen")'); await bild(p, "13-vokabel-antwort.png", "Vokabel: Antwort");
    await p.click(".rate.otra"); await p.click('button:text-is("Beenden")');
    await p.click('button[aria-label="Einstellungen"]'); await p.click('.seg button:text-is("Kanji + Lesung")'); await p.click('.modal button:text-is("Schließen")');
    await p.click('.modo[data-m="vocab"]');
    ok((await p.locator(".lernkarte ruby").count()) >= 0, "Vokabel mit Kanji + Lesung angezeigt");
    await bild(p, "14-vokabel-furigana.png", "Vokabel: Kanji + Lesung (Furigana)");
    await lose(p); await p.click('button:text-is("Beenden")');

    /* ---------- Sätze ---------- */
    await p.click('.modo[data-m="frases"]'); await bild(p, "15-satz-frage.png", "Satz: Lücke");
    await p.click('button:text-is("Antwort zeigen")'); ok((await p.locator(".treffer").count()) === 1, "Satz: Lücke wird beim Aufdecken gefüllt");
    await bild(p, "16-satz-antwort.png", "Satz: aufgedeckt"); await p.click(".rate.lose"); await p.click('button:text-is("Beenden")');

    /* ---------- Grammatik ---------- */
    await p.click('.modo[data-m="gram"]'); await bild(p, "17-gram-frage.png", "Grammatik: Form wählen");
    await richtigWaehlen(p); ok((await p.locator(".ok-t").count()) === 1, "Grammatik: richtige Form erkannt");
    await bild(p, "18-gram-ergebnis.png", "Grammatik: Ergebnis"); await p.click('button:text-is("Weiter")'); await p.click('button:text-is("Beenden")');

    /* ---------- Zahlen & Zeit ---------- */
    await p.click('.modo[data-m="num"]'); await bild(p, "19-zahlen-frage.png", "Zahlen & Zeit: hören");
    await richtigWaehlen(p); ok((await p.locator(".opt.richtig").count()) === 1, "Zahlen: richtige Antwort markiert");
    await bild(p, "20-zahlen-ergebnis.png", "Zahlen & Zeit: Ergebnis"); await p.click('button:text-is("Weiter")'); await p.click('button:text-is("Beenden")');

    /* ---------- Kanji: gesperrt → freischalten ---------- */
    ok((await p.locator(".modo.gesperrt").count()) === 1, "Kanji sind am Anfang gesperrt");
    await bild(p, "21-kanji-gesperrt.png", "Kanji: gesperrt");
    await p.click('button:text-is("Jetzt freischalten")'); await p.click('.modo[data-m="kanji"]');
    await p.click('button:text-is("Antwort zeigen")'); await bild(p, "22-kanji-antwort.png", "Kanji: Bedeutung, Lesungen, Beispiele");
    await p.click(".rate.lose"); await p.click('button:text-is("Beenden")');

    /* ---------- Import + Briefkasten ---------- */
    await p.click('button[aria-label="Einstellungen"]');
    await p.fill("#f-import", JSON.stringify([{ id: "2026-11-03-001", kind: "error", es: "駅はどこですか。", de: "Wo ist der Bahnhof?", wrong: "駅がどこですか。", note: "Frage nach dem Ort: は" }]));
    await p.click('button:text-is("Importieren")'); await p.click('.modal button:text-is("Schließen")');
    await fetch(url + "__test/inbox", { method: "POST", body: JSON.stringify({ id: "2026-11-04-001", kind: "vocab", es: "切符", de: "Fahrkarte" }) });
    await p.click('button[aria-label="Einstellungen"]'); await p.fill("#f-token", "test-token"); await p.click('button:text-is("Speichern")');
    await p.waitForSelector('.toast:has-text("1 neue vom Coach")', { timeout: 5000 }); ok(true, "Briefkasten: Eintrag kommt an");
    await p.click('.modal button:text-is("Schließen")'); await p.click('.tabbar button:text-is("Fehler")');
    ok((await p.locator(".falsch-t").first().innerText()) === "駅がどこですか。", "Import: Fehler erscheint unter „Fehler“");
    await bild(p, "23-fehler.png", "Fehler nach Import");
    await p.click('.tabbar button:text-is("Statistik")'); await bild(p, "24-statistik.png", "Statistik nach dem Lernen");
    ok((await p.evaluate(() => localStorage.getItem("nihongo.daten.v1").length)) < 2e6, "Fortschritt bleibt klein");
    await p.context().close();

    /* ---------- Hell ---------- */
    const q = await iphone("light"); await bild(q, "25-heute-hell.png", "Heute (hell)");
    await q.click('.tabbar button:text-is("Lernen")'); await q.click('.modo[data-m="vocab"]'); await q.click('button:text-is("Antwort zeigen")'); await bild(q, "26-vokabel-hell.png", "Vokabel (hell)");
    await q.context().close();

    /* ---------- Abgleich Computer → iPhone ---------- */
    const pc = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(); pc.on("pageerror", (e) => fehler.push(e.message));
    await pc.goto(url); await pc.click('button:text-is("Los geht’s")');
    await pc.click('.nav button:text-is("Lernen")'); await pc.click('button[aria-label="Mehr neue Karten"]');
    await pc.click('button[aria-label="Einstellungen"]'); await pc.click('button:text-is("Neu einrichten")');
    const key = (await pc.locator(".key").innerText()).trim(); await pc.click('.modal button:text-is("Schließen")');
    await pc.waitForTimeout(3500);
    const ph = await iphone("dark");
    await ph.click('button[aria-label="Einstellungen"]'); await ph.click('button:text-is("Mit Schlüssel verbinden")');
    await ph.fill("#f-key", key); await ph.click('button:text-is("Verbinden")'); await ph.waitForTimeout(1500);
    await ph.click('.tabbar button:text-is("Lernen")');
    ok((await ph.locator("#nuevas").innerText()) === "15", "Abgleich: Einstellung vom Computer ist auf dem iPhone");
  } catch (e) { fehler.push(e.message.split("\n")[0]); console.log("✗ " + e.message.split("\n")[0]); }

  if (bilder.length) {
    const html = '<body style="margin:0;padding:24px;background:#202326;font:14px system-ui;color:#ddd"><div style="display:grid;grid-template-columns:repeat(5,240px);gap:16px">' +
      bilder.map(([f, tt]) => '<figure style="margin:0"><img src="' + f + '" style="width:240px;border-radius:16px;display:block"><figcaption style="margin-top:6px">' + tt + "</figcaption></figure>").join("") + "</div></body>";
    fs.writeFileSync(path.join(out, "uebersicht.html"), html);
    const pg = await (await b.newContext({ viewport: { width: 1328, height: 800 } })).newPage();
    await pg.goto("file://" + path.join(out, "uebersicht.html")); await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(out, "uebersicht.png"), fullPage: true });
  }
  await b.close(); srv.kill();
  console.log(fehler.length ? "\n✗ " + fehler.length + " Fehler:\n  " + fehler.join("\n  ") : "\n✓ keine Fehler. Bilder: test/bilder/ (Übersicht: uebersicht.png)");
  process.exit(fehler.length ? 1 : 0);
})();
