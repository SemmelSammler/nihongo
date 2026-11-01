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

  /* ---------- Japanische Zahlen, Uhrzeiten, Daten, Zählwörter (Lesungen in Hiragana) ---------- */
  var E = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
  var HY = ["", "ひゃく", "にひゃく", "さんびゃく", "よんひゃく", "ごひゃく", "ろっぴゃく", "ななひゃく", "はっぴゃく", "きゅうひゃく"];
  var SE = ["", "せん", "にせん", "さんぜん", "よんせん", "ごせん", "ろくせん", "ななせん", "はっせん", "きゅうせん"];
  function bis9999(n) {
    var s = Math.floor(n / 1000), h = Math.floor(n / 100) % 10, z = Math.floor(n / 10) % 10, e = n % 10;
    return SE[s] + HY[h] + (z ? (z > 1 ? E[z] : "") + "じゅう" : "") + E[e];
  }
  // Lesung einer Zahl 0 … 99.999.999 (いちまん, さんびゃく, はっせん …)
  function yomi(n) {
    if (n === 0) return "ゼロ";
    var man = Math.floor(n / 10000), r = n % 10000;
    return (man ? bis9999(man) + "まん" : "") + (r ? bis9999(r) : "");
  }
  var JI = ["", "いちじ", "にじ", "さんじ", "よじ", "ごじ", "ろくじ", "しちじ", "はちじ", "くじ", "じゅうじ", "じゅういちじ", "じゅうにじ"];
  var FUN = { 0: "", 5: "ごふん", 10: "じゅっぷん", 15: "じゅうごふん", 20: "にじゅっぷん", 30: "はん", 40: "よんじゅっぷん", 45: "よんじゅうごふん", 50: "ごじゅっぷん" };
  var GATSU = ["", "いちがつ", "にがつ", "さんがつ", "しがつ", "ごがつ", "ろくがつ", "しちがつ", "はちがつ", "くがつ", "じゅうがつ", "じゅういちがつ", "じゅうにがつ"];
  var HI = { 1: "ついたち", 2: "ふつか", 3: "みっか", 4: "よっか", 5: "いつか", 6: "むいか", 7: "なのか", 8: "ようか", 9: "ここのか", 10: "とおか", 14: "じゅうよっか", 20: "はつか", 24: "にじゅうよっか", 17: "じゅうしちにち", 19: "じゅうくにち" };
  function hiYomi(d) { return HI[d] || yomi(d) + "にち"; }
  var TSU = ["", "ひとつ", "ふたつ", "みっつ", "よっつ", "いつつ", "むっつ", "ななつ", "やっつ", "ここのつ", "とお"];
  var NIN = ["", "ひとり", "ふたり", "さんにん", "よにん", "ごにん", "ろくにん", "ななにん", "はちにん", "きゅうにん", "じゅうにん"];

  /* ---------- Zahlen & Zeit: Fragen werden erzeugt, nicht gespeichert ----------
     Jede Kategorie ist eine FSRS-Karte „n:<kategorie>“. say = Text für die Sprachausgabe (ja-JP). */
  function zufall(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
  function rint(rnd, a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function mischen(rnd, arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function vier(rnd, ok, falsche) { var set = [ok]; falsche.forEach(function (x) { if (set.indexOf(x) === -1 && set.length < 4) set.push(x); }); return mischen(rnd, set); }
  function fmt(n) { return n.toLocaleString("en-US"); }
  function tausch47(n) { return Number(String(n).replace(/[47]/g, function (c) { return c === "4" ? "7" : "4"; })); }   // よん ↔ なな
  function hm(h, m) { return h + ":" + String(m).padStart(2, "0"); }
  var NUM = [
    { k: "n:zahlen", gen: function (r) { var n = rint(r, 11, 99); return { say: String(n), ok: String(n), f: [tausch47(n), n + 10, n - 10, Number(String(n).split("").reverse().join("")), n + 1].filter(function (x) { return x > 9 && x < 100 && x !== n; }).map(String), back: n + " · " + yomi(n), note: "4 = よん (auch し), 7 = なな (auch しち), 9 = きゅう (auch く)." }; } },
    { k: "n:hyaku", gen: function (r) { var n = rint(r, 1, 9) * 100 + rint(r, 0, 9) * 10; return { say: String(n), ok: fmt(n), f: [n + 100, n - 100, tausch47(n), n * 10, Math.floor(n / 10)].filter(function (x) { return x >= 10 && x !== n; }).map(fmt), back: fmt(n) + " · " + yomi(n), note: "300 さんびゃく, 600 ろっぴゃく, 800 はっぴゃく – Lautwechsel." }; } },
    { k: "n:man", gen: function (r) { var a = rint(r, 1, 9), b = rint(r, 1, 9), n = a * 10000 + b * 1000; return { say: String(n), ok: fmt(n), f: [a * 1000 + b * 100, a * 100000 + b * 10000, b * 10000 + a * 1000, (a + 1) * 10000 + b * 1000].filter(function (x) { return x !== n; }).map(fmt), back: fmt(n) + " · " + yomi(n), note: "Japanisch zählt in Zehntausendern: 万 (まん) = 10.000. 12.000 = いちまんにせん." }; } },
    { k: "n:yen", gen: function (r) { var n = rint(r, 1, 99) * 100 + [0, 50][rint(r, 0, 1)]; return { say: n + "円です。", ok: "¥" + fmt(n), f: [n * 10, Math.round(n / 10), n + 1000, tausch47(n), n + 100].filter(function (x) { return x !== n && x >= 10; }).map(function (x) { return "¥" + fmt(x); }), back: "¥" + fmt(n) + " · " + yomi(n) + "えん", note: "So hörst du Preise an der Kasse: …えんです。" }; } },
    { k: "n:jikan", gen: function (r) {
      var h12 = rint(r, 1, 11), pm = rint(r, 0, 1), mi = [0, 30, 15, 45, 10, 20][rint(r, 0, 5)], h24 = pm ? (h12 % 12) + 12 : h12 % 12;
      var sayM = mi === 0 ? "" : mi === 30 ? "半" : mi + "分", say = (pm ? "午後" : "午前") + h12 + "時" + sayM + "です。";
      var ok = hm(h24, mi), alt = [4, 7, 9].indexOf(h12) >= 0 ? (h12 === 4 ? 7 : h12 === 7 ? 4 : 5) : h12 % 12 + 1;
      return { say: say, ok: ok, f: [hm(pm ? h24 - 12 : h24 + 12, mi), hm(pm ? alt % 12 + 12 : alt % 12, mi), hm(h24, mi === 30 ? 0 : 30), hm(h24, mi === 15 ? 45 : 15)], back: ok + " · " + (pm ? "ごご" : "ごぜん") + JI[h12] + FUN[mi], note: "4 Uhr = よじ, 7 Uhr = しちじ, 9 Uhr = くじ. 午前 = vormittags, 午後 = nachmittags, 半 = halb." };
    } },
    { k: "n:hiduke", gen: function (r) { var m = rint(r, 1, 12), d = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 20, 24, rint(r, 11, 28)][rint(r, 0, 13)]; var dd = function (a, b) { return a + "." + b + "."; };
      var conf = { 4: 8, 8: 4, 3: 6, 6: 3, 1: 7, 7: 1, 20: 2, 2: 20, 14: 24, 24: 14 };
      return { say: m + "月" + d + "日です。", ok: dd(d, m), f: [dd(conf[d] || (d > 1 ? d - 1 : d + 1), m), dd(d, m % 12 + 1), dd(d, m === 4 ? 7 : m === 7 ? 4 : m === 9 ? 5 : (m + 10) % 12 + 1), dd(d > 10 ? d - 10 : d + 10, m)], back: dd(d, m) + " · " + GATSU[m] + hiYomi(d), note: "Tage 1–10, 14, 20, 24 haben eigene Lesungen: ついたち, ふつか, みっか, よっか (4.) ↔ ようか (8.), はつか (20.)." }; } },
    { k: "n:tsu", gen: function (r) { var n = rint(r, 1, 10), conf = { 3: 6, 6: 3, 4: 8, 8: 4, 1: 2, 2: 1, 5: 9, 9: 5, 7: 10, 10: 7 }; return { say: TSU[n] + "ください。", ok: String(n), f: [conf[n], n % 10 + 1, n > 1 ? n - 1 : 3].map(String), back: n + " · " + TSU[n], note: "Allgemeines Zählen von Dingen: ひとつ, ふたつ, みっつ … – praktisch beim Bestellen." }; } },
    { k: "n:nin", gen: function (r) { var n = rint(r, 1, 10), conf = { 4: 7, 7: 4, 1: 2, 2: 1, 3: 4, 9: 5, 5: 9 }; return { say: n + "人です。", ok: n + " P.", f: [conf[n] || n + 1, n % 10 + 1, n > 2 ? n - 2 : n + 2].map(function (x) { return x + " P."; }), back: n + " Personen · " + NIN[n], note: "1 Person ひとり, 2 ふたり, ab 3 …にん, aber 4 = よにん. Im Restaurant: 何名様ですか？ = Wie viele Personen?" }; } }
  ];
  function frageNum(kat, seed) {
    var g = NUM.filter(function (x) { return x.k === kat; })[0] || NUM[0], rnd = zufall(seed), q = g.gen(rnd);
    var falsche = q.f.filter(function (x, i, a) { return x !== q.ok && a.indexOf(x) === i; });
    for (var i = 1; falsche.length < 3 && i < 30; i++) { var x = g.gen(zufall(seed * 31 + i)).ok; if (x !== q.ok && falsche.indexOf(x) === -1) falsche.push(x); }
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
  // Grobe Schätzung nach Wortschatz für die JLPT-Stufen (N5 ≈ 800, N4 ≈ 1.500, N3 ≈ 3.700 Wörter)
  function nivel(domVocab) { return domVocab < 800 ? "< N5" : domVocab < 1500 ? "N5" : domVocab < 3700 ? "N4" : "N3"; }
  root.LERNEN = { answer: answer, preview: preview, dominada: dominada, pruefe: pruefe, yomi: yomi, hiYomi: hiYomi, NUM: NUM.map(function (x) { return x.k; }), frageNum: frageNum, DIA: DIA, DOMINADA: DOMINADA,
    tag: tag, kw: kw, buchen: buchen, racha: racha, retencion: retencion, wochen: wochen, nivel: nivel };
})(typeof window !== "undefined" ? window : globalThis);
