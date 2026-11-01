// Test der Lern-Logik ohne Browser: node test/lernen.test.cjs
const path = require("path"); let fehler = 0;
const ok = (c, t) => { console.log((c ? "✓ " : "✗ ") + t); if (!c) fehler++; };
globalThis.FSRS = require("ts-fsrs"); require(path.join(__dirname, "../app/lernen.js")); const L = globalThis.LERNEN;
const W = { 1: "uno", 16: "dieciséis", 21: "veintiuno", 22: "veintidós", 47: "cuarenta y siete", 60: "sesenta", 70: "setenta", 100: "cien", 101: "ciento uno", 115: "ciento quince", 500: "quinientos", 700: "setecientos", 999: "novecientos noventa y nueve",
  1000: "mil", 1200: "mil doscientos", 2100: "dos mil cien", 21000: "veintiún mil", 15350: "quince mil trescientos cincuenta", 101000: "ciento un mil" };
for (const [n, w] of Object.entries(W)) ok(L.palabras(+n) === w, n + " = " + L.palabras(+n));
ok(L.palabras(21, true) === "veintiún" && L.palabras(31, true) === "treinta y un", "Kurzform vor Nomen: veintiún / treinta y un");
// FSRS: Lo sé wächst, Otra vez setzt zurück
let t = new Date("2026-11-01T08:00:00Z"), a = null, tage = [];
for (let i = 0; i < 4; i++) { a = L.answer(a, true, t); tage.push(a[3]); t = new Date(a[0]); }
ok(tage[0] >= 1 && tage[1] > tage[0] && tage[2] > tage[1], "Lo sé: Abstände wachsen (" + tage.join(" → ") + " Tage)");
ok(L.dominada(a) === (a[3] >= 21), "dominada ab 21 Tagen");
const b = L.answer(a, false, t); ok(b[6] === 3 && b[0] - +t <= 11 * 60000, "Otra vez: Lernschritt 10 Min");
const n = L.answer(null, false, t); ok(n[6] === 1, "neue Karte + Otra vez → aprendiendo");
ok(L.preview(null, t) >= 864e5, "Vorschau „Lo sé“ für neue Karte ≥ 1 Tag");
// Eintippen
ok(L.pruefe("hablé", "hablé").ok && !L.pruefe("hablé", "hablé").akzent, "exakt richtig");
ok(L.pruefe("hable", "hablé").ok && L.pruefe("hable", "hablé").akzent, "ohne Akzent: richtig + Hinweis");
ok(!L.pruefe("ano", "año").ok, "ñ ≠ n");
ok(!L.pruefe("tenemo", "tenemos").ok, "falsch bleibt falsch");
// Zahlen-Fragen: immer 4 verschiedene Antworten, richtige dabei
let schlecht = [];
for (const k of L.NUM) for (let s = 1; s < 400; s++) { const q = L.frageNum(k, s); if (q.options.length !== 4 || new Set(q.options).size !== 4 || !q.options.includes(q.ok) || /undefined|NaN/.test(q.say + q.back + q.options.join())) schlecht.push(k + "#" + s + " " + JSON.stringify(q)); }
ok(!schlecht.length, "Zahlen: 8 Kategorien × 400 Fragen, je 4 verschiedene Antworten" + (schlecht.length ? " – " + schlecht.length + " Fehler, z. B. " + schlecht[0] : ""));
for (const k of L.NUM) { const q = L.frageNum(k, 7); console.log("   " + k + ": „" + q.say + "“ → " + q.ok + "  [" + q.options.join(" | ") + "]"); }
// ---------- Statistik: 120 Tage Lernen simulieren und auf Stimmigkeit prüfen ----------
{
  const st = { k: {}, tage: {} }, start = new Date(2026, 0, 5, 8, 0), WISSEN = 0.9;
  let rnd = 12345; const zuf = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  let neuId = 0, luecke = 0;
  for (let tagNr = 0; tagNr < 120; tagNr++) {
    const now = new Date(start); now.setDate(start.getDate() + tagNr);
    if (tagNr === 100 || tagNr === 101) { luecke++; continue; }   // zwei Tage Pause → Racha beginnt neu
    const ende = new Date(now); ende.setHours(23, 59, 59, 999);
    const faellig = Object.keys(st.k).filter((id) => st.k[id][0] <= +ende);
    const neue = Array.from({ length: 10 }, () => "v:w" + neuId++);
    const q = faellig.map((id) => ({ id })).concat(neue.map((id) => ({ id, neu: true })));
    let t = +now;
    while (q.length) {
      const it = q.shift(); t += 15000; const ok = it.otra ? true : zuf() < WISSEN;
      L.buchen(st, { id: it.id, k: "vocab", ok, neu: !!it.neu && !it.otra, now: new Date(t), ms: 15000 });
      if (!ok) q.splice(Math.min(2, q.length), 0, { id: it.id, otra: true });
    }
  }
  const heute = new Date(start); heute.setDate(start.getDate() + 119); heute.setHours(20);
  const domJetzt = Object.values(st.k).filter((a) => L.dominada(a)).length;
  const netto = Object.values(st.tage).reduce((s, d) => s + (d.d || 0), 0);
  ok(netto === domJetzt, "Statistik: Summe „Gelernt pro Woche“ (alle Wochen) = aktuelle dominadas (" + netto + " = " + domJetzt + ")");
  const neuGezaehlt = Object.values(st.tage).reduce((s, d) => s + ((d.n || {}).vocab || 0), 0);
  ok(neuGezaehlt === Object.keys(st.k).length, "Statistik: jede neue Karte genau einmal als „neu“ gezählt (" + neuGezaehlt + ")");
  const r = L.retencion(st.tage, null, heute), quote = r.a / r.b;
  ok(r.b > 0 && Math.abs(quote - WISSEN) < 0.03, "Statistik: Retención misst die echte Trefferquote bei Wiederholungen (" + (quote * 100).toFixed(1) + " % bei simulierten 90 %)");
  const alle = Object.values(st.tage).filter((d, i) => true).reduce((s, d) => { const x = d.a.vocab || [0, 0]; return [s[0] + x[0], s[1] + x[1]]; }, [0, 0]);
  console.log("   (zum Vergleich: alle Abfragen inkl. „Otra vez“-Wiederholung und neue Karten: " + (alle[1] / alle[0] * 100).toFixed(1) + " %)");
  ok(L.racha(st.tage, heute) === 18, "Statistik: Racha zählt ab der Pause neu (" + L.racha(st.tage, heute) + " Tage)");
  const morgen = new Date(heute); morgen.setDate(morgen.getDate() + 1);
  ok(L.racha(st.tage, morgen) === 18, "Statistik: Racha bleibt stehen, solange heute noch nicht gelernt wurde");
  const z = {}; z[L.tag(heute)] = { r: { vocab: [1, 1] } }; const alt30 = new Date(heute); alt30.setDate(heute.getDate() - 29); z[L.tag(alt30)] = { r: { vocab: [1, 0] } }; const alt31 = new Date(heute); alt31.setDate(heute.getDate() - 30); z[L.tag(alt31)] = { r: { vocab: [5, 0] } };
  const r30 = L.retencion(z, null, heute); ok(r30.b === 2, "Statistik: Retención nimmt genau 30 Tage (heute + 29)");
  const w = L.wochen(st.tage, heute); ok(w.length === 8 && w[7].kw === L.kw(heute), "Statistik: 8 Wochen, letzte = aktuelle Kalenderwoche (KW " + w[7].kw + ")");
  ok(L.nivel(499) === "A1" && L.nivel(500) === "A2" && L.nivel(1500) === "B1", "Statistik: Niveau-Grenzen 500 → A2, 1.500 → B1");
  console.log("   Simulation: " + Object.keys(st.k).length + " Karten, " + domJetzt + " dominadas, Wochen: " + w.map((x) => x.n).join(" "));
}
console.log(fehler ? "\n" + fehler + " Fehler" : "\nLern-Logik in Ordnung."); process.exit(fehler ? 1 : 0);
