/* Lern-Logik ohne Oberfläche (auch in Node testbar): FSRS-Planung, Antwort prüfen, Zahlen erzeugen.
   FSRS = ts-fsrs (MIT), Zielbehalten 90 %. Bauplan Abschnitte 4 und 5. */
(function (root) {
  "use strict";
  var F = root.FSRS;
  var DIA = 864e5, DOMINADA = 21;   // dominada = nächster Termin ≥ 21 Tage
  var S = F.fsrs(F.generatorParameters({ request_retention: 0.9, enable_fuzz: true, learning_steps: ["10m"], relearning_steps: ["10m"], maximum_interval: 3650 }));

  /* ---------- Kartenzustand, kompakt gespeichert (Fortschritt bleibt klein) ----------
     [due, stability, difficulty, scheduled_days, reps, lapses, state, last_review, learning_steps] */
  function r4(x) { return Math.round(x * 1e4) / 1e4; }
  function unpack(a) {
    return { due: new Date(a[0]), stability: a[1], difficulty: a[2], elapsed_days: 0, scheduled_days: a[3], reps: a[4], lapses: a[5], state: a[6],
      last_review: a[7] ? new Date(a[7]) : undefined, learning_steps: a[8] || 0 };
  }
  function pack(c) { return [+c.due, r4(c.stability), r4(c.difficulty), c.scheduled_days, c.reps, c.lapses, c.state, c.last_review ? +c.last_review : 0, c.learning_steps || 0]; }
  function card(a, now) { return a ? unpack(a) : F.createEmptyCard(now); }
  // ok = „Lo sé“ / richtig, sonst „Otra vez“ / falsch
  function answer(a, ok, now) { return pack(S.next(card(a, now), now, ok ? F.Rating.Good : F.Rating.Again).card); }
  // Wann käme die Karte bei „Lo sé“ wieder? (für die Beschriftung unter dem Knopf)
  function preview(a, now) { var c = S.next(card(a, now), now, F.Rating.Good).card; return +c.due - +now; }
  function dominada(a) { return !!a && a[6] === 2 && a[3] >= DOMINADA; }

  /* ---------- Antwort beim Eintippen prüfen ---------- */
  function norm(s) { return String(s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[¿?¡!.,;]/g, ""); }
  function ohneAkzent(s) { return s.normalize("NFD").replace(/[́̈]/g, "").normalize("NFC"); }   // ñ (Tilde) bleibt
  function pruefe(eingabe, richtig) {
    var e = norm(eingabe), r = norm(richtig);
    if (!e) return { ok: false };
    if (e === r) return { ok: true };
    if (ohneAkzent(e) === ohneAkzent(r)) return { ok: true, akzent: true };   // Bauplan: richtig, aber Hinweis
    return { ok: false };
  }

  /* ---------- Zahlen in Worten (Lateinamerika) ---------- */
  var U = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
    "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
  var Z = { 3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa" };
  var H = { 1: "ciento", 2: "doscientos", 3: "trescientos", 4: "cuatrocientos", 5: "quinientos", 6: "seiscientos", 7: "setecientos", 8: "ochocientos", 9: "novecientos" };
  function bis99(n) { return n < 30 ? U[n] : Z[Math.floor(n / 10)] + (n % 10 ? " y " + U[n % 10] : ""); }
  function bis999(n) { if (n === 100) return "cien"; var h = Math.floor(n / 100), r = n % 100; return (h ? H[h] + (r ? " " : "") : "") + (r || !h ? bis99(r) : ""); }
  function apokope(s) { return s.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un"); }
  // un = Kurzform vor Hauptwort/„mil“ (un peso, veintiún pesos)
  function palabras(n, vorNomen) {
    var k = Math.floor(n / 1000), r = n % 1000, s;
    if (!k) s = bis999(n);
    else s = (k === 1 ? "mil" : apokope(bis999(k)) + " mil") + (r ? " " + bis999(r) : "");
    return vorNomen ? apokope(s) : s;
  }

  /* ---------- Números y horas: Fragen werden erzeugt, nicht gespeichert ----------
     Jede Kategorie ist eine FSRS-Karte „n:<kategorie>“ – schwache Kategorien kommen öfter. */
  function zufall(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
  function rint(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function mischen(rnd, arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function vier(rnd, ok, falsche) {   // richtige + 3 verschiedene falsche, gemischt
    var set = [ok]; falsche.forEach(function (x) { if (set.indexOf(x) === -1 && set.length < 4) set.push(x); });
    return mischen(rnd, set);
  }
  function mx(n) { return n.toLocaleString("en-US"); }   // Mexiko: 1,200 (Komma als Tausender)
  function tausch(n) { var s = String(n); return Number(s.split("").reverse().join("")); }
  function zehnerFalle(n) { var z = Math.floor(n / 10) % 10, e = n % 10, out = []; if (z === 6) out.push(n + 10); if (z === 7) out.push(n - 10); return out; }
  var HORA_TXT = { 1: "la una", 2: "las dos", 3: "las tres", 4: "las cuatro", 5: "las cinco", 6: "las seis", 7: "las siete", 8: "las ocho", 9: "las nueve", 10: "las diez", 11: "las once", 12: "las doce" };
  function tageszeit(h24) { return h24 < 12 ? "de la mañana" : h24 < 20 ? "de la tarde" : "de la noche"; }
  function hm(h, m) { return h + ":" + String(m).padStart(2, "0"); }
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  var NUM = [
    { k: "n:0-30", gen: function (r) { var n = rint(r, 11, 29); return { say: palabras(n), ok: String(n), f: [n - 10, n + 10, n < 20 ? n + 4 : n - 4, n + 1].filter(function (x) { return x > 0; }).map(String), back: n + " · " + palabras(n), note: "11–15 sind eigene Wörter (once … quince), ab 16: dieci-, ab 21: veinti-." }; } },
    { k: "n:decenas", gen: function (r) { var n = rint(r, 31, 99); if (n % 10 === 0) n++; return { say: palabras(n), ok: String(n), f: zehnerFalle(n).concat([tausch(n), n + 10, n - 10, n + 1]).filter(function (x) { return x > 9 && x < 100; }).map(String), back: n + " · " + palabras(n), note: "Typische Falle: sesenta (60) vs. setenta (70)." }; } },
    { k: "n:cientos", gen: function (r) { var n = rint(r, 1, 9) * 100 + rint(r, 0, 99); return { say: palabras(n), ok: String(n), f: [n % 100 + (Math.floor(n / 100) === 5 ? 50 : 0) || n + 100, (Math.floor(n / 100) === 7 ? n + 200 : Math.floor(n / 100) === 9 ? n - 200 : n + 100), Number(String(Math.floor(n / 100)) + String(n % 100).padStart(2, "0").split("").reverse().join("")), n - 100].filter(function (x) { return x > 0 && x !== n; }).map(String), back: n + " · " + palabras(n), note: "quinientos (500), setecientos (700), novecientos (900) sind unregelmäßig." }; } },
    { k: "n:miles", gen: function (r) { var a = rint(r, 1, 9), b = rint(r, 1, 9), n = a * 1000 + b * 100; return { say: palabras(n), ok: mx(n), f: [b * 1000 + a * 100, a * 1000 + b, a * 10000 + b * 1000, (a + 1) * 1000 + b * 100].filter(function (x) { return x !== n; }).map(mx), back: mx(n) + " · " + palabras(n), note: "mil = 1.000, ohne „un“. In Mexiko schreibt man 1,200 (Komma)." }; } },
    { k: "n:precios", gen: function (r) { var n = rint(r, 2, 99) * 10 + [0, 5][rint(r, 0, 1)]; if (n % 100 === 1) n++; var p = n > 999 ? n : n; return { say: "Son " + palabras(p, true) + " pesos.", ok: "$" + mx(p), f: [tausch(p), p + 100, p - 100 > 0 ? p - 100 : p + 200, zehnerFalle(Math.floor(p / 10) * 10 + 0)[0] ? p + (Math.floor(p / 10) % 10 === 6 ? 100 : -100) : p + 10].filter(function (x) { return x > 0 && x !== p; }).map(function (x) { return "$" + mx(x); }), back: "$" + mx(p) + " · " + palabras(p, true) + " pesos", note: "So hörst du Preise an der Kasse." }; } },
    { k: "n:horas", gen: function (r) {
      var h24 = rint(r, 7, 22), mi = [0, 15, 30, 45, 10, 20, 50][rint(r, 0, 6)], h12 = h24 % 12 || 12, say;
      if (mi === 45 || mi === 50) { var nx = (h24 + 1) % 24, n12 = nx % 12 || 12; say = (n12 === 1 ? "Es " : "Son ") + HORA_TXT[n12] + " menos " + (mi === 45 ? "cuarto" : "diez") + " " + tageszeit(nx); }
      else say = (h12 === 1 ? "Es " : "Son ") + HORA_TXT[h12] + ({ 0: " en punto", 15: " y cuarto", 30: " y media", 10: " y diez", 20: " y veinte" })[mi] + " " + tageszeit(h24);
      var ok = hm(h24, mi);
      var f = [hm(h24 >= 12 ? h24 - 12 : h24 + 12, mi), hm(h24, mi === 45 ? 15 : mi === 15 ? 45 : mi === 30 ? 15 : (mi + 30) % 60), hm((h24 + 1) % 24, mi === 45 ? 15 : mi === 50 ? 10 : mi), hm(h24 - 1, mi)];
      return { say: say + ".", ok: ok, f: f, back: ok + " · " + say.replace(/^(Es|Son) /, ""), note: "menos cuarto = Viertel vor (zur nächsten Stunde). Im Alltag zählt man bis 12: de la mañana / tarde / noche." };
    } },
    { k: "n:fechas", gen: function (r) { var d = rint(r, 2, 28), m = rint(r, 0, 11); var dd = function (a, b) { return a + "." + (b + 1) + "."; }; return { say: "Es el " + palabras(d) + " de " + MESES[m] + ".", ok: dd(d, m), f: [dd(d, (m + 1) % 12), dd(d < 10 ? d + 10 : d - 10, m), dd(d, (m + 11) % 12), dd(d + 1 > 28 ? d - 1 : d + 1, m)], back: dd(d, m) + " · el " + palabras(d) + " de " + MESES[m], note: "Datum: el + Zahl + de + Monat (der 1. heißt auch „el primero“)." }; } },
    { k: "n:telefono", gen: function (r) {
      var p = [rint(r, 10, 99), rint(r, 10, 99), rint(r, 10, 99), rint(r, 10, 99)], txt = function (a) { return a.join(" "); };
      var swap = p.slice(); swap[1] = Math.floor(swap[1] / 10) === 6 ? swap[1] + 10 : Math.floor(swap[1] / 10) === 7 ? swap[1] - 10 : tausch(swap[1]) >= 10 ? tausch(swap[1]) : swap[1] + 10;
      var b = p.slice(); b[3] = b[3] < 90 ? b[3] + 10 : b[3] - 10; var c = p.slice(); c[0] = tausch(c[0]) >= 10 && tausch(c[0]) !== c[0] ? tausch(c[0]) : c[0] + 1; var d = p.slice(); d[2] = d[2] > 10 ? d[2] - 1 : d[2] + 1;
      return { say: "Mi número es " + p.map(function (x) { return palabras(x); }).join(", ") + ".", ok: txt(p), f: [txt(swap), txt(b), txt(c), txt(d)], back: txt(p), note: "Telefonnummern liest man in Zweiergruppen." };
    } }
  ];
  function frageNum(kat, seed) {
    var g = NUM.filter(function (x) { return x.k === kat; })[0] || NUM[0], rnd = zufall(seed), q = g.gen(rnd);
    var falsche = q.f.filter(function (x, i, a) { return x !== q.ok && a.indexOf(x) === i; });
    for (var i = 1; falsche.length < 3 && i < 30; i++) { var x = g.gen(zufall(seed * 31 + i)).ok; if (x !== q.ok && falsche.indexOf(x) === -1) falsche.push(x); }   // Ersatz, falls zu wenig
    q.options = vier(rnd, q.ok, falsche); delete q.f; return q;
  }


  /* ---------- Statistik (Bauplan 5) – hier, damit sie ohne Browser getestet werden kann ----------
     Pro Tag: a = alle Abfragen [n, gewusst] je Modus, r = nur fällige Wiederholungen [n, gewusst] je Modus,
     n = neue Karten heute, x = „Seguir“-Extra, ms/c = Zeit und Anzahl Antworten, d = Netto-Änderung der dominadas. */
  function tag(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function kw(d) { var x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - n); return Math.ceil(((x - Date.UTC(x.getUTCFullYear(), 0, 1)) / DIA + 1) / 7); }
  function tagFuer(state, now) { var key = tag(now); if (!state.tage[key]) state.tage[key] = { a: {}, r: {}, n: {}, x: {}, ms: 0, c: 0, d: 0 }; var t = state.tage[key]; if (!t.r) t.r = {}; return t; }
  // Eine Antwort verbuchen: Kartenzustand + Tageszahlen. Gibt den neuen Kartenzustand zurück.
  function buchen(state, o) {   // o = { id, k (Modus), ok, neu (erste Abfrage einer neuen Karte), now, ms }
    var d = tagFuer(state, o.now), vorher = state.k[o.id];
    if (o.neu && !vorher) d.n[o.k] = (d.n[o.k] || 0) + 1;
    // Retención zählt nur fällige Wiederholungen (Karte war schon „gelernt“, Zustand Review):
    // neue Karten und das Wiederholen nach „Otra vez“ in derselben Sitzung würden das Ergebnis verfälschen.
    if (vorher && vorher[6] === 2) { d.r[o.k] = d.r[o.k] || [0, 0]; d.r[o.k][0]++; if (o.ok) d.r[o.k][1]++; }
    var warDom = dominada(vorher), neuK = answer(vorher, o.ok, o.now), istDom = dominada(neuK);
    if (!warDom && istDom) d.d = (d.d || 0) + 1;
    if (warDom && !istDom) d.d = (d.d || 0) - 1;   // vergessen → zählt wieder ab (Summe = aktuelle dominadas)
    d.a[o.k] = d.a[o.k] || [0, 0]; d.a[o.k][0]++; if (o.ok) d.a[o.k][1]++;
    d.ms = (d.ms || 0) + Math.min(Math.max(o.ms || 0, 0), 60000); d.c = (d.c || 0) + 1;
    state.k[o.id] = neuK; return neuK;
  }
  // Racha: Tage mit mindestens einer Antwort in Folge, bis heute (oder bis gestern, wenn heute noch nichts)
  function racha(tage, now) {
    var n = 0, d = new Date(now); if (!(tage[tag(d)] && tage[tag(d)].c)) d.setDate(d.getDate() - 1);
    while (tage[tag(d)] && tage[tag(d)].c) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  // Retención der letzten 30 Tage (heute + 29 davor), je Modus oder gesamt
  function retencion(tage, k, now) {
    var a = 0, b = 0, g = new Date(now); g.setDate(g.getDate() - 29); var grenze = tag(g);
    Object.keys(tage).forEach(function (d) { if (d < grenze) return; var x = tage[d].r || {}; Object.keys(x).forEach(function (m) { if (!k || m === k) { a += x[m][1]; b += x[m][0]; } }); });
    return { a: a, b: b };
  }
  // Dominadas pro Woche (Mo–So), die letzten 8 Wochen: Netto-Zuwachs
  function wochen(tage, now) {
    var out = [], jetzt = new Date(now), mo = new Date(jetzt); mo.setDate(jetzt.getDate() - (jetzt.getDay() + 6) % 7);
    for (var i = 7; i >= 0; i--) {
      var start = new Date(mo); start.setDate(mo.getDate() - 7 * i); var sum = 0;
      for (var j = 0; j < 7; j++) { var x = new Date(start); x.setDate(start.getDate() + j); var tg = tage[tag(x)]; if (tg) sum += tg.d || 0; }
      out.push({ kw: kw(start), n: sum });
    }
    return out;
  }
  function nivel(domVocab) { return domVocab < 500 ? "A1" : domVocab < 1500 ? "A2" : domVocab < 3000 ? "B1" : "B2"; }
  root.LERNEN = { answer: answer, preview: preview, dominada: dominada, pruefe: pruefe, palabras: palabras, NUM: NUM.map(function (x) { return x.k; }), frageNum: frageNum, DIA: DIA, DOMINADA: DOMINADA,
    tag: tag, kw: kw, buchen: buchen, racha: racha, retencion: retencion, wochen: wochen, nivel: nivel };
})(typeof window !== "undefined" ? window : globalThis);
