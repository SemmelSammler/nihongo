/* Nihongo – Japanisch lernen, ca. 15 Minuten am Tag. Bauplan: BAUPLAN.md (abgeleitet aus der Spanisch-App Español).
   Aus der Vorlage übernommen: Speichern, Backup, Abgleich, Handy-Ansicht, Desktop-Anbindung.
   Lern-Logik (FSRS, Prüfen, Zahlen) steht in app/lernen.js, Texte in app/i18n.js, Lerninhalte in deck/. */
(function () {
  "use strict";
  var CFG = window.APP_CONFIG || { name: "App", id: "app", server: "" };
  var STORE = CFG.id + ".daten.v1", SYNC_CFG = CFG.id + ".sync", UI_STORE = CFG.id + ".ui", INBOX_CFG = CFG.id + ".inbox";   // nie mehr ändern (Bauplan 7)
  var DEMO = window.APP_DEMO || null;   // nur im lokalen Build mit --demo vorhanden
  var I = window.I18N, t = I.t, L = window.LERNEN;

  /* ================= Hilfen ================= */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function alt(key, v) { return ' data-alt="' + esc(I.alt(key, v)) + '"'; }   // Lang-Drücken zeigt die andere Sprache
  function tx(key, v) { return esc(t(key, v)); }
  function tag(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function heute() { return tag(); }
  function tagesende() { var d = new Date(); d.setHours(23, 59, 59, 999); return +d; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function gross(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pct(a, b) { return b ? Math.round(a / b * 100) + " %" : "–"; }

  /* ================= Daten ================= */
  // Fortschritt (wird verschlüsselt abgeglichen). Bleibt klein: nur Kartenzustände + Tageszahlen (Bauplan 7).
  //   k:      { kartenId: [due, stability, difficulty, tage, reps, lapses, state, last, steps] }
  //   tage:   { "2026-11-01": { a: { modus: [abfragen, gewusst] }, n: { modus: neueHeute }, x: { modus: extraNeue }, ms, c, d } }
  //   errores, extra: aus dem Briefkasten / Import
  function leer() { return { version: 1, ajustes: { nuevas: 10, schrift: "kana", romaji: true }, k: {}, tage: {}, errores: [], extra: [], kt: { h: 0, k: 0, m: {} } }; }
  var state = (function () { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } })();
  var neu = !state;
  if (!state) state = DEMO ? clone(DEMO) : leer();
  function vervollstaendigen() { var l = leer(); Object.keys(l).forEach(function (k) { if (state[k] == null) state[k] = l[k]; }); }
  vervollstaendigen();
  // Gerät-eigene Einstellungen (nicht abgeglichen): Tab, Hell/Dunkel, Sprache
  var ui = (function () { try { return JSON.parse(localStorage.getItem(UI_STORE)) || {}; } catch (e) { return {}; } })();
  var TABS = [["hoy", "tabHoy"], ["aprender", "tabAprender"], ["stats", "tabStats"], ["errores", "tabErrores"]];
  if (!TABS.some(function (x) { return x[0] === ui.view; })) ui.view = "hoy";
  I.set(ui.lang || "de");
  ui.modal = neu ? { type: "willkommen" } : null; ui.toast = null; ui.ses = null;
  var saveErr = null;
  function saveUi() { try { localStorage.setItem(UI_STORE, JSON.stringify({ view: ui.view, mode: ui.mode, lang: I.lang })); } catch (e) {} }
  function save() {
    var json = JSON.stringify(state);
    try { localStorage.setItem(STORE, json); saveErr = null; } catch (e) { saveErr = e.message; }
    saveUi(); syncChanged(json);
  }
  function toast(msg) { ui.toast = msg; render(); clearTimeout(toast.t); toast.t = setTimeout(function () { ui.toast = null; render(); }, 2600); }

  /* ================= Handy oder Desktop, Hell/Dunkel ================= */
  var PHONE = window.matchMedia("(max-width: 700px)");
  function isPhone() { return PHONE.matches; }
  PHONE.addEventListener("change", function () { render(); });
  function setMode() {
    document.documentElement.dataset.mode = ui.mode === "hell" || ui.mode === "dunkel" ? ui.mode : "";
    var m = document.querySelector('meta[name="theme-color"]');   // Fensterfarbe passend zu Hell/Dunkel
    if (m) m.content = getComputedStyle(document.body).backgroundColor;
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { render(); });

  /* ================= Lerninhalte (deck/) ================= */
  var TEILE = ["kana", "vocab", "frases", "kanji", "gram"];
  var DECK = { ok: false, err: null, kana: [], vocab: [], frases: [], kanji: [], gram: [], quellen: null, byId: {} };
  function deckLaden() {
    return Promise.all(TEILE.map(function (f) { return fetch("deck/" + f + ".json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }))
      .then(function (arr) {
        TEILE.forEach(function (f, i) { DECK[f] = arr[i]; arr[i].forEach(function (x) { DECK.byId[x.id] = x; }); });
        DECK.ok = true; render();
      }, function (e) { DECK.err = e.message; render(); });
  }
  function quellenLaden() { fetch("deck/quellen.json").then(function (r) { return r.json(); }).then(function (q) { DECK.quellen = q; if (ui.modal && ui.modal.type === "licencias") render(); }, function () {}); }

  /* ================= Lernmodi (Anteile der neuen Karten) ================= */
  var MODOS = [
    { k: "kana", p: "a", name: "modoKana", how: "comoKana", check: "solo", share: 0.3, art: "choice" },
    { k: "vocab", p: "v", name: "modoVocab", how: "comoVocab", check: "tudecides", share: 0.3, art: "flip", prompt: "pQue" },
    { k: "frases", p: "f", name: "modoFrases", how: "comoFrases", check: "tudecides", share: 0.1, art: "flip", prompt: "pCompleta" },
    { k: "kanji", p: "k", name: "modoKanji", how: "comoKanji", check: "tudecides", share: 0.1, art: "flip", prompt: "pKanji" },
    { k: "gram", p: "g", name: "modoGram", how: "comoGram", check: "solo", share: 0.1, art: "choice", prompt: "pGram" },
    { k: "num", p: "n", name: "modoNum", how: "comoNum", check: "solo", share: 0.1, art: "choice", prompt: "pEscucha" },
    { k: "chat", p: "c", name: "modoChat", how: "comoChat", check: "tudecides", share: 0, art: "flip", prompt: "pComo" }
  ];
  var MODO = {}; MODOS.forEach(function (m) { MODO[m.k] = m; });
  function modoVon(id) { var p = id.charAt(0); return p === "x" ? "vocab" : MODOS.filter(function (m) { return m.p === p; })[0].k; }
  function tagHeute() { var d = heute(); if (!state.tage[d]) state.tage[d] = { a: {}, r: {}, n: {}, x: {}, ms: 0, c: 0, d: 0 }; return state.tage[d]; }
  function tagLesen() { return state.tage[heute()] || { a: {}, n: {}, x: {}, ms: 0, c: 0, d: 0 }; }

  /* Kanji kommen, wenn 80 % der 92 Grund-Kana sitzen (Zustand „Wiederholung“) – oder per Knopf */
  function kanaFortschritt() {
    var basis = DECK.kana.filter(function (x) { return x.gr === "basis"; }), n = basis.filter(function (x) { var a = state.k[x.id]; return a && a[6] === 2; }).length;
    return basis.length ? Math.round(n / basis.length * 100) : 0;
  }
  function kanjiFrei() { return !!state.ajustes.kanjiFrei || kanaFortschritt() >= 80; }
  // Alle Karten eines Modus in Lern-Reihenfolge (Briefkasten-Wörter zuerst)
  function quelle(k) {
    var extra = state.extra.filter(function (e) { return modoVon(e.id) === k; });
    if (k === "vocab") return extra.concat(DECK.vocab);
    if (k === "kanji") return kanjiFrei() ? DECK.kanji : [];
    if (k === "num") return L.NUM.map(function (id) { return { id: id }; });
    if (k === "chat") return extra;
    return DECK[k] || [];
  }
  // Tageslimit auf die Modi verteilen; Modi ohne neue Karten (z. B. Kanji noch gesperrt) geben ihren Anteil ab
  function anteil(k, n) {
    var aktiv = MODOS.filter(function (x) { return x.share > 0 && quelle(x.k).some(function (c) { return !state.k[c.id]; }); });
    var sum = aktiv.reduce(function (s, x) { return s + x.share; }, 0) || 1;
    var teil = aktiv.map(function (x) { var v = n * x.share / sum; return { k: x.k, f: Math.floor(v), r: v % 1 }; });
    var rest = n - teil.reduce(function (s, x) { return s + x.f; }, 0);
    teil.slice().sort(function (a, b) { return b.r - a.r; }).slice(0, rest).forEach(function (x) { x.f++; });
    var mein = teil.filter(function (x) { return x.k === k; })[0];
    return mein ? mein.f : 0;
  }
  function karte(id) { return DECK.byId[id] || state.extra.filter(function (e) { return e.id === id; })[0] || (id.charAt(0) === "n" ? { id: id } : null); }
  function ohneLimit(id) { return id.charAt(0) === "c" || id.charAt(0) === "x"; }   // Briefkasten: kommt sofort, ohne Tageslimit
  function faellig(k) {
    var bis = tagesende(), out = [];
    Object.keys(state.k).forEach(function (id) { if (modoVon(id) === k && state.k[id][0] <= bis && karte(id)) out.push(id); });
    return out.sort(function (a, b) { return state.k[a][0] - state.k[b][0]; });
  }
  function neueListe(k, extraN) {
    if (!DECK.ok && k !== "num" && k !== "chat") return [];
    var d = tagLesen(), frei = Math.max(0, anteil(k, state.ajustes.nuevas) + (d.x[k] || 0) + (extraN || 0) - (d.n[k] || 0)), out = [];
    quelle(k).some(function (x) {
      if (state.k[x.id]) return false;
      if (ohneLimit(x.id)) { out.push(x.id); return false; }
      if (frei > 0) { out.push(x.id); frei--; }
      return false;
    });
    return out;
  }
  function zahlen(k) { return { r: faellig(k).length, n: neueListe(k).length }; }
  function minutosFuer(neuN, repN) {
    // anfangs Schätzung, ab 50 Antworten aus der gemessenen Zeit pro Antwort
    var ms = 0, c = 0; Object.keys(state.tage).forEach(function (d) { ms += state.tage[d].ms || 0; c += state.tage[d].c || 0; });
    if (c >= 50) return Math.round((neuN * 2.4 + repN) * ms / c / 60000);
    return Math.round(neuN * 0.5 + repN * 0.2);
  }
  function hoyZahlen() {
    var r = 0, n = 0, pro = {};
    MODOS.forEach(function (m) { var z = zahlen(m.k); pro[m.k] = z; r += z.r; n += z.n; });
    return { r: r, n: n, pro: pro, min: minutosFuer(n, r) };
  }

  /* ================= Japanische Schrift: Kana / Kanji + Furigana / nur Kanji, Romaji-Hilfe ================= */
  function schrift() { return state.ajustes.schrift || "kana"; }
  function romajiAn() { return state.ajustes.romaji !== false; }
  // Ein Wort (w = Schreibweise, r = Lesung, ro = Romaji) nach Einstellung anzeigen
  function jWort(w, r, ro, gross) {
    var hatK = /[㐀-鿿々]/.test(w), html;
    if (!hatK || schrift() === "kanji") html = esc(w);
    else if (schrift() === "kana") html = esc(r);
    else html = "<ruby>" + esc(w) + "<rt>" + esc(r) + "</rt></ruby>";
    return '<span class="ja' + (gross ? " gross" : "") + '" lang="ja">' + html + "</span>" + (romajiAn() && ro ? '<span class="romaji">' + esc(ro) + "</span>" : "");
  }
  // Satz aus Segmenten [[Text, Lesung|null], …], Lücke an Stelle g
  function jSatz(seg, g, zeigeLuecke, ro) {
    var html = seg.map(function (x, i) {
      if (i === g && !zeigeLuecke) return '<span class="luecke">＿＿</span>';
      var t = x[1] && schrift() === "kana" ? esc(x[1]) : x[1] && schrift() === "furi" ? "<ruby>" + esc(x[0]) + "<rt>" + esc(x[1]) + "</rt></ruby>" : esc(x[0]);
      return i === g ? '<b class="treffer">' + t + "</b>" : t;
    }).join("");
    return '<span class="ja" lang="ja">' + html + "</span>" + (romajiAn() && ro ? '<span class="romaji">' + esc(ro) + "</span>" : "");
  }

  /* ================= Lernsitzung ================= */
  function sitzungStart(modi) {
    var q = [];
    modi.forEach(function (k) { faellig(k).forEach(function (id) { q.push({ id: id }); }); neueListe(k).forEach(function (id) { q.push({ id: id, neu: true }); }); });
    ui.ses = { modi: modi, q: q, done: 0, total: q.length, otra: 0, shown: false, res: null, t0: Date.now() };
    ui.view = "aprender"; window.scrollTo(0, 0); render(); autoSprechen();
  }
  function sitzungMehr() {
    var s = ui.ses, d = tagHeute();
    s.modi.forEach(function (k) {
      var plus = s.modi.length === 1 ? 10 : anteil(k, 10); d.x[k] = (d.x[k] || 0) + plus;
      var liste = neueListe(k), vorher = s.total;
      liste.forEach(function (id) { if (!s.q.some(function (x) { return x.id === id; })) { s.q.push({ id: id, neu: true }); s.total++; } });
      // Zahlen & Zeit ist unbegrenzt: sind alle Kategorien schon bekannt, 10 Extra-Fragen aus bekannten Kategorien
      if (k === "num" && s.total === vorher) { var bekannt = L.NUM.filter(function (id) { return state.k[id]; }); for (var i = 0; i < plus && bekannt.length; i++) { s.q.push({ id: bekannt[Math.floor(Math.random() * bekannt.length)] }); s.total++; } }
    });
    save(); s.shown = false; s.res = null; s.t0 = Date.now(); render(); autoSprechen();
  }
  function aktuell() { return ui.ses && ui.ses.q[0]; }
  function seed() { return (Date.now() ^ (Math.random() * 1e9)) >>> 0; }
  function mischen(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = arr[i]; arr[i] = arr[j]; arr[j] = x; } return arr; }
  // Kana, die leicht verwechselt werden – als falsche Antworten besonders lehrreich
  var AEHNLICH = [["さ", "ち", "き"], ["ぬ", "め", "ね"], ["わ", "れ", "ね"], ["る", "ろ"], ["は", "ほ", "け"], ["い", "り", "こ"], ["あ", "お", "め"], ["シ", "ツ", "ン", "ソ"], ["ク", "ケ", "タ"], ["ウ", "ワ", "フ"], ["コ", "ユ", "ロ"], ["ス", "ヌ", "ヲ"], ["チ", "テ", "ナ"]];
  function kanaFrage(item, c) {
    if (!item.f) {
      var gleich = DECK.kana.filter(function (x) { return x.s === c.s && x.id !== c.id && x.ro !== c.ro; });
      var aehnlich = (AEHNLICH.filter(function (g) { return g.indexOf(c.z) >= 0; })[0] || []).filter(function (z) { return z !== c.z; })
        .map(function (z) { return gleich.filter(function (x) { return x.z === z; })[0]; }).filter(Boolean);
      var falsch = aehnlich.concat(mischen(gleich.filter(function (x) { return x.gr === c.gr; }))).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 3);
      var hoeren = state.k[c.id] && Math.random() < 0.5;   // bekannte Kana: mal Zeichen → Laut, mal Laut → Zeichen
      item.f = { hoeren: hoeren, options: mischen([c].concat(falsch)).map(function (x) { return hoeren ? x.z : x.ro; }), ok: hoeren ? c.z : c.ro };
    }
    return { k: "kana", front: item.f.hoeren ? "" : c.z, prompt: item.f.hoeren ? "pKanaHoer" : "pKana", options: item.f.options, ok: item.f.ok, back: c.z + " · " + c.ro, say: c.z, opt: item.f.hoeren ? "ja" : "ro" };
  }
  function gramFrage(item, c) {
    if (!item.f) {
      var andere = DECK.gram.filter(function (x) { return x.v === c.v && x.f !== c.f; }).map(function (x) { return x.a; });
      // typischer Fehler: る-Verb falsch konjugiert (Godan ↔ Ichidan)
      var stamm = c.v.slice(0, -1), falscheKlasse = /^v5r/.test(c.kl) && c.f === "masu" ? stamm + "ます" : c.kl === "v1" && c.f === "masu" ? stamm + "ります" : null;
      var falsch = mischen(andere).filter(function (x) { return x !== c.a; });
      if (falscheKlasse && falscheKlasse !== c.a) falsch.unshift(falscheKlasse);
      item.f = { options: mischen([c.a].concat(falsch.filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 3))), ok: c.a };
    }
    return { k: "gram", front: c.v, r: c.vr, sub: c.de, form: "f_" + c.f, options: item.f.options, ok: c.a, back: c.a + (c.ar !== c.a ? " (" + c.ar + ")" : ""), say: c.ar, opt: "ja" };
  }
  function frage(item) {   // Inhalt der Karte für die Anzeige
    var id = item.id, k = modoVon(id), c = karte(id) || {};
    if (k === "num") { if (!item.f) item.f = L.frageNum(id, seed()); return { k: k, front: "", back: item.f.back, note: item.f.note, say: item.f.say, options: item.f.options, ok: item.f.ok, opt: "num" }; }
    if (k === "kana") return kanaFrage(item, c);
    if (k === "gram") return gramFrage(item, c);
    if (k === "vocab") return { k: k, w: c.w, r: c.r || c.w, ro: c.ro, back: c.de, note: c.n || (c.k && c.k !== c.w ? c.k : ""), say: c.r || c.w };
    if (k === "frases") return { k: k, seg: c.s, g: c.g, ro: c.ro, back: c.s[c.g][0], note: c.de, say: c.s.map(function (x) { return x[0]; }).join("") };
    if (k === "kanji") return { k: k, kanji: c.k, back: c.de, on: c.on, kun: c.kun, bsp: c.bsp || [], say: (c.bsp && c.bsp[0] && c.bsp[0].r) || "" };
    return { k: k, front: c.de || c.wrong || "", korr: !c.de, back: c.es, note: c.note || "", say: c.es };   // chat: es = richtige japanische Form
  }
  function antworten(ok) {
    var s = ui.ses, item = s.q[0]; if (!item) return;
    var id = item.id;
    L.buchen(state, { id: id, k: modoVon(id), ok: ok, neu: !!item.neu && !item.gezaehlt, now: new Date(), ms: Date.now() - s.t0 });
    s.q.shift(); s.done++;
    if (!ok) { s.q.splice(Math.min(2, s.q.length), 0, { id: id, otra: true, gezaehlt: true }); s.total++; s.otra++; }   // kommt nach 2 anderen Karten wieder
    s.shown = false; s.res = null; s.t0 = Date.now();
    save(); render(); autoSprechen();
  }
  function intervall(ms) {
    var min = Math.round(ms / 60000), tg = Math.round(ms / 864e5);
    if (min < 60 * 20) return t("enMin", { n: Math.max(1, min) });
    if (tg <= 1) return t("manana");
    if (tg < 60) return t("enDias", { n: tg });
    return t("enMeses", { n: Math.round(tg / 30) });
  }

  /* ================= Sprechen (Web Speech API, ja-JP) ================= */
  var STIMME = null;
  function stimme() {
    if (STIMME || !window.speechSynthesis) return STIMME;
    var v = speechSynthesis.getVoices();
    STIMME = v.filter(function (x) { return x.lang.replace("_", "-") === "ja-JP"; })[0] || v.filter(function (x) { return /^ja/.test(x.lang); })[0] || null;
    return STIMME;
  }
  if (window.speechSynthesis) speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", function () { STIMME = null; stimme(); });
  function sprechen(text) {
    try {
      if (!window.speechSynthesis || !text) return;
      var u = new SpeechSynthesisUtterance(text); u.lang = (stimme() && stimme().lang) || "ja-JP"; if (stimme()) u.voice = stimme(); u.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }
  function autoSprechen() { var it = aktuell(); if (!it) return; var f = frage(it); if (f.k === "num" || (f.k === "kana" && !f.front)) sprechen(f.say); }

  /* ================= Kana-Trainer: eigener Bereich zum schnellen Lernen aller Hiragana und Katakana =================
     Lernwissenschaftlich aufgebaut:
     · kleine Gruppen (eine Reihe = 3–5 Zeichen) statt aller 46 auf einmal (Arbeitsgedächtnis)
     · jedes Zeichen sehen + hören + Strichfolge (doppelte Kodierung), Nachzeichnen mit dem Finger
     · Abrufen statt Wiederlesen: erkennen, hören → Zeichen wählen, aus dem Kopf schreiben (Testeffekt)
     · alte Reihen werden eingemischt, Verwechsler (さ/ち, シ/ツ) als falsche Antworten (Interleaving, Unterscheiden)
     · Fehler kommen zwei Fragen später wieder (Abstand innerhalb der Lektion)
     · echte Wörter nur aus schon gelernten Zeichen lesen (Übertragung, Motivation)
     · „sicher“ erst bei richtig UND schnell (Flüssigkeit statt nur Wiedererkennen); dann übernimmt FSRS das Wiederholen */
  var STRICHE = null;
  function stricheLaden() { if (STRICHE) return; STRICHE = {}; fetch("deck/striche.json").then(function (r) { return r.json(); }).then(function (j) { STRICHE = j; if (ui.tr) render(); }, function () {}); }
  var VOKAL = { a: 0, i: 1, u: 2, e: 3, o: 4 };
  var GRUPPEN = [[0, 5, "a"], [5, 10, "k"], [10, 15, "s"], [15, 20, "t"], [20, 25, "n"], [25, 30, "h"], [30, 35, "m"], [35, 38, "y"], [38, 43, "r"], [43, 46, "w"],
    [46, 51, "g"], [51, 56, "z"], [56, 61, "d"], [61, 66, "b"], [66, 71, "p"], [71, 83, "ky"], [83, 95, "ny"], [95, 104, "gy"]];
  function kanaListe(sch) { var b = DECK.kana.filter(function (x) { return x.s === "h"; }), r = []; b.forEach(function (x, i) { var k = DECK.kana.filter(function (y) { return y.s === sch && y.id.slice(4) === x.id.slice(4); })[0]; if (k) r.push(k); }); return r; }
  function gruppe(sch, gi) { var l = kanaListe(sch), g = GRUPPEN[gi]; return l.slice(g[0], g[1]); }
  function kt() { if (!state.kt) state.kt = { h: 0, k: 0, m: {} }; return state.kt; }
  function km(z) { var m = kt().m; if (!m[z]) m[z] = { r: 0, f: 0, s: 0, ok: false }; return m[z]; }   // r = richtig, f = falsch, s = schnell richtig, ok = sicher
  function sicherN(sch) { return kanaListe(sch).filter(function (x) { return kt().m[x.z] && kt().m[x.z].ok; }).length; }
  function gelernt(sch) { var g = kt()[sch] || 0, out = []; for (var i = 0; i < g; i++) out = out.concat(gruppe(sch, i)); return out; }
  function zufallAus(arr, n) { return mischen(arr.slice()).slice(0, n); }
  function zeigeHira(k) { return DECK.kana.filter(function (x) { return x.s === "h" && x.id.slice(4) === k.id.slice(4); })[0]; }
  // Wörter, die nur aus schon gelernten Zeichen bestehen (Hiragana-Wörter bzw. Fremdwörter in Katakana)
  function woerter(sch, zeichen) {
    var set = {}; zeichen.forEach(function (x) { [...x.z].forEach(function (c) { set[c] = 1; }); });
    return DECK.vocab.filter(function (v) { var r = v.r || ""; return r.length >= 2 && r.length <= 5 && [...r].every(function (c) { return set[c]; }) && (sch === "k" ? /[ァ-ヶ]/.test(r) : /^[ぁ-ゖ]+$/.test(r)); }).slice(0, 40);
  }
  function lektionStart(sch, gi) {
    var neu = gruppe(sch, gi), alt = gelernt(sch).filter(function (x) { return neu.indexOf(x) < 0; }), q = [];
    neu.forEach(function (x) { q.push({ typ: "kennen", k: x }); });
    mischen(neu.concat(neu).concat(zufallAus(alt, Math.min(4, alt.length)))).forEach(function (x) { q.push({ typ: "wahl", k: x }); });
    mischen(neu.concat(zufallAus(alt, Math.min(2, alt.length)))).forEach(function (x) { q.push({ typ: "hoeren", k: x }); });
    neu.forEach(function (x) { q.push({ typ: "schreiben", k: x }); });
    var w = woerter(sch, alt.concat(neu)).filter(function (v) { return neu.some(function (x) { return v.r.indexOf(x.z) >= 0; }); });
    zufallAus(w, 4).forEach(function (v) { q.push({ typ: "wort", v: v, pool: w }); });
    ui.tr = { s: sch, ph: "lektion", gi: gi, q: q, n: 0, r: 0, ms: 0, res: null, t0: Date.now(), striche: [], neuSicher: [] };
    window.scrollTo(0, 0); render(); trainerSprechen();
  }
  function tempoStart(sch) {
    var pool = gelernt(sch); if (!pool.length) return;
    ui.tr = { s: sch, ph: "tempo", pool: pool, q: [{ typ: "wahl", k: pool[Math.floor(Math.random() * pool.length)] }], n: 0, r: 0, ende: Date.now() + 60000, res: null, t0: Date.now(), langsam: [] };
    clearInterval(ui.trTick); ui.trTick = setInterval(function () { if (!ui.tr || ui.tr.ph !== "tempo") { clearInterval(ui.trTick); return; } if (Date.now() >= ui.tr.ende) { clearInterval(ui.trTick); ui.tr.ph = "tempoEnde"; } var el = document.getElementById("tempo-sek"); if (el && ui.tr.ph === "tempo") el.textContent = t("sekunden", { n: Math.max(0, Math.ceil((ui.tr.ende - Date.now()) / 1000)) }); else render(); }, 250);
    render();
  }
  function frageAuf(it) {   // Antwortmöglichkeiten einmal festlegen
    if (it.opts) return it;
    if (it.typ === "wort") { it.ok = it.v.ro; it.opts = mischen([it.v.ro].concat(zufallAus(it.pool.filter(function (x) { return x.ro !== it.v.ro; }), 3).map(function (x) { return x.ro; }))); return it; }
    var gleich = kanaListe(ui.tr.s).filter(function (x) { return x !== it.k; });
    var aehn = (AEHNLICH.filter(function (g) { return g.indexOf(it.k.z) >= 0; })[0] || []).map(function (z) { return gleich.filter(function (x) { return x.z === z; })[0]; }).filter(Boolean);
    var bekannt = gelernt(ui.tr.s).concat(ui.tr.gi != null ? gruppe(ui.tr.s, ui.tr.gi) : []).filter(function (x) { return x !== it.k; });
    var falsch = aehn.concat(zufallAus(bekannt.length >= 3 ? bekannt : gleich, 6)).filter(function (x, i, a) { return a.indexOf(x) === i && x.ro !== it.k.ro; }).slice(0, 3);
    var hoeren = it.typ === "hoeren";
    it.ok = hoeren ? it.k.z : it.k.ro; it.opts = mischen([it.k].concat(falsch)).map(function (x) { return hoeren ? x.z : x.ro; });
    return it;
  }
  function trainerSprechen() { var it = ui.tr && ui.tr.q[0]; if (!it) return; if (it.typ === "kennen" || it.typ === "hoeren" || it.typ === "schreiben") sprechen(it.k.z); }
  function trainerAntwort(o) {
    var tr = ui.tr, it = tr.q[0]; if (!it || tr.res) return;
    var ok = o === it.ok, ms = Date.now() - tr.t0; tr.res = { ok: ok, pick: o }; tr.n++; if (ok) tr.r++; tr.ms += Math.min(ms, 10000);
    if (it.k) {
      var m = km(it.k.z);
      if (ok) { m.r++; if (it.typ === "wahl" && ms < 3000) m.s++; } else { m.f++; m.s = Math.max(0, m.s - 1); }
      if (tr.ph === "tempo" && (!ok || ms > 3000)) { m.ok = false; if (tr.langsam.indexOf(it.k.z) < 0) tr.langsam.push(it.k.z); }
      if (!m.ok && ok && m.s >= 2 && tr.ph === "lektion") { m.ok = true; tr.neuSicher.push(it.k.z); if (!state.k[it.k.id]) L.buchen(state, { id: it.k.id, k: "kana", ok: true, neu: true, now: new Date(), ms: ms }); }
      sprechen(it.k.z);
    }
    if (!ok && tr.ph === "lektion") tr.q.splice(Math.min(3, tr.q.length), 0, { typ: it.typ, k: it.k, v: it.v, pool: it.pool });
    save(); render();
  }
  function trainerWeiter() {
    var tr = ui.tr; tr.q.shift(); tr.res = null; tr.striche = []; tr.zeige = false; tr.t0 = Date.now();
    if (tr.ph === "tempo") { if (Date.now() >= tr.ende) { tr.ph = "tempoEnde"; } else tr.q.push({ typ: "wahl", k: tr.pool[Math.floor(Math.random() * tr.pool.length)] }); }
    if (tr.ph === "lektion" && !tr.q.length) { tr.ph = "ende"; kt()[tr.s] = Math.max(kt()[tr.s] || 0, tr.gi + 1); save(); }
    render(); trainerSprechen();
  }
  function strichSvg(z, cls, animiert) {
    var p = STRICHE && STRICHE[z]; if (!p) return '<div class="' + cls + ' ersatz" lang="ja">' + esc(z) + "</div>";
    return '<svg class="' + cls + (animiert ? " anim" : "") + '" viewBox="0 0 109 109" aria-hidden="true">' + p.map(function (d, i) { return '<path pathLength="1" style="animation-delay:' + (i * 0.7) + 's" d="' + d + '"/>'; }).join("") + "</svg>";
  }
  function viewTrainerStart() {   // Kachel im Tab „Lernen“
    if (!DECK.ok) return "";
    return '<section class="card klein trainer-kachel"><div class="ttl"' + alt("trainer") + ">" + tx("trainer") + '</div><p class="xs muted">' + tx("trainerSub") + '</p><div class="trainer-wahl">' +
      [["h", "hiragana", "あ"], ["k", "katakana", "ア"]].map(function (x) { var t2 = kanaListe(x[0]).length, n = sicherN(x[0]);
        return '<button class="trainer-btn" data-act="trainer" data-s="' + x[0] + '"' + alt(x[1]) + '><span class="tz" lang="ja">' + x[2] + '</span><span><b>' + tx(x[1]) + '</b><span class="xs muted num">' + tx("sicherVon", { n: n, t: t2 }) + '</span><span class="minibar"><i style="width:' + Math.round(n / Math.max(t2, 1) * 100) + '%"></i></span></span></button>'; }).join("") + "</div></section>";
  }
  function viewTrainer() {
    var tr = ui.tr, sch = tr.s, name = sch === "h" ? "hiragana" : "katakana";
    var kopf = '<div class="ses-kopf"><button class="btn klein ghost" data-act="tZurueck"' + alt("volver") + ">" + tx("volver") + '</button><span class="small muted">' + tx("trainer") + " · " + tx(name) + "</span></div>";
    if (tr.ph === "tabelle") {
      var g = kt()[sch] || 0, liste = kanaListe(sch);
      var zelle = function (k) { var m = kt().m[k.z], cls = m && m.ok ? "kz sicher" : m && (m.r || m.f) ? "kz arbeit" : "kz"; return '<button class="' + cls + '" data-act="tKana" data-z="' + esc(k.z) + '"><span lang="ja">' + esc(k.z) + "</span><small>" + esc(k.ro) + "</small></button>"; };
      var leer = '<span class="kz leer"></span>';
      var rkopf = function (gi, zs) { return '<button class="rkopf' + (gi < g ? " fertig" : gi === g ? " jetzt" : "") + '" data-act="tLektion" data-g="' + gi + '" lang="ja">' + esc(zs[0].z) + "</button>"; };
      // Tabelle wie in Japan: Spalten a / i / u / e / o; ん bekommt eine eigene Zeile; Kombinationen: ya / yu / yo
      var reihe = function (gi, spalten) {
        var zs = gruppe(sch, gi), felder = new Array(spalten).fill(leer), extra = "";
        zs.forEach(function (k, i) {
          if (spalten === 3) { felder[i % 3] = zelle(k); return; }
          if (k.ro === "n") { extra = '<div class="kreihe"><span class="rkopf leer"></span><div class="kgrid k5">' + zelle(k) + leer + leer + leer + leer + "</div></div>"; return; }
          felder[VOKAL[k.ro.slice(-1)]] = zelle(k);
        });
        if (spalten === 3) { var html3 = ""; for (var j = 0; j < zs.length; j += 3) html3 += '<div class="kreihe">' + (j ? '<span class="rkopf leer"></span>' : rkopf(gi, zs)) + '<div class="kgrid k3">' + zs.slice(j, j + 3).map(zelle).join("") + "</div></div>"; return html3; }
        return '<div class="kreihe">' + rkopf(gi, zs) + '<div class="kgrid k5">' + felder.join("") + "</div></div>" + extra;
      };
      var html = kopf + '<section class="card klein"><div class="row mitte"><div class="ttl">' + tx(name) + '</div><span class="small muted num">' + tx("sicherVon", { n: sicherN(sch), t: liste.length }) + "</span></div>" +
        (g < GRUPPEN.length ? '<button class="btn primary" data-act="tLektion" data-g="' + g + '"' + alt("naechsteLektion", { g: gruppe(sch, g)[0].z }) + ">" + tx("naechsteLektion", { g: gruppe(sch, g).map(function (k) { return k.z; }).join(" ") }) + "</button>" : '<p class="small muted">' + tx("allesGelernt") + "</p>") +
        (g > 0 ? '<button class="btn" data-act="tTempo"' + alt("tempo") + ">" + tx("tempo") + "</button>" : "") + '<p class="xs muted">' + tx("tippZeichen") + (sch === "k" && (kt().h || 0) < 10 ? " " + tx("hFirst") : "") + "</p></section>";
      html += '<section class="card klein ktabelle"><div class="small muted">' + tx("grund") + "</div>"; for (var i = 0; i < 10; i++) html += reihe(i, 5);
      html += '<div class="small muted">' + tx("daku") + "</div>"; for (i = 10; i < 15; i++) html += reihe(i, 5);
      html += '<div class="small muted">' + tx("yoon") + "</div>"; for (i = 15; i < GRUPPEN.length; i++) html += reihe(i, 3);
      return html + "</section>";
    }
    if (tr.ph === "detail") {
      var k = tr.k, h = sch === "k" ? zeigeHira(k) : null, ae = (AEHNLICH.filter(function (gg) { return gg.indexOf(k.z) >= 0; })[0] || []).filter(function (z) { return z !== k.z; });
      return kopf + '<section class="card lernkarte"><div class="row mitte"><span class="small muted">' + esc(k.ro) + (STRICHE && STRICHE[k.z] ? " · " + tx("striche", { n: STRICHE[k.z].length }) : "") + '</span><button class="iconbtn rund" data-act="tHoer" aria-label="' + tx("escuchar") + '">' + ICON.laut + '</button></div><div class="inhalt mitte-x">' + strichSvg(k.z, "strich gross", true) +
        (h ? '<div class="small muted" lang="ja">' + tx("wieHiragana", { z: h.z }) + "</div>" : "") + (ae.length ? '<div class="small neg" lang="ja">' + tx("aehnlich", { z: ae.join(" ") }) + "</div>" : "") + "</div></section>" +
        '<button class="btn" data-act="tAnim">' + tx("ansehen") + '</button><button class="btn" data-act="tTabelle">' + tx("volver") + "</button>";
    }
    if (tr.ph === "ende" || tr.ph === "tempoEnde") {
      var schnitt = tr.n ? (tr.ms / tr.n / 1000).toFixed(1) : "–";
      return kopf + '<section class="card fertig"><div class="fertig-t">' + tx(tr.ph === "ende" ? "ergebnis" : "tempo") + '</div><p class="muted">' + (tr.ph === "ende" ? tx("ergebnisTxt", { r: tr.r, n: tr.n, s: schnitt }) : tx("tempoTxt", { n: tr.r })) + "</p>" +
        (tr.neuSicher && tr.neuSicher.length ? '<p class="ok-t" lang="ja">' + tx("neuSicher", { z: tr.neuSicher.join(" ") }) + "</p>" : "") + (tr.langsam && tr.langsam.length ? '<p class="neg" lang="ja">' + tx("langsam", { z: tr.langsam.join(" ") }) + "</p>" : "") + "</section>" +
        ((kt()[sch] || 0) < GRUPPEN.length ? '<button class="btn primary" data-act="tLektion" data-g="' + (kt()[sch] || 0) + '">' + tx("naechsteLektion", { g: gruppe(sch, kt()[sch] || 0).map(function (x) { return x.z; }).join(" ") }) + "</button>" : "") +
        '<button class="btn" data-act="tTempo">' + tx("tempo") + '</button><button class="btn" data-act="tTabelle">' + tx("volver") + "</button>";
    }
    // Lektion oder Tempo-Runde: aktuelle Aufgabe
    var it = tr.q[0]; if (!it) { tr.ph = "ende"; return viewTrainer(); }
    frageAuf(it);
    var schritte = ["kennen", "wahl", "hoeren", "schreiben", "wort"], namen = ["schrittKennen", "schrittErkennen", "schrittHoeren", "schrittSchreiben", "schrittLesen"], si = schritte.indexOf(it.typ);
    var leiste = tr.ph === "tempo" ? '<div class="row mitte"><span class="ttl">' + tx("tempo") + '</span><span class="tempo-sek num" id="tempo-sek">' + tx("sekunden", { n: Math.max(0, Math.ceil((tr.ende - Date.now()) / 1000)) }) + '</span></div><div class="small muted num">' + tr.r + " ✓</div>"
      : '<div class="schritte">' + namen.map(function (n, i) { return '<span class="' + (i < si ? "fertig" : i === si ? "jetzt" : "") + '"' + alt(n) + ">" + tx(n) + "</span>"; }).join("") + "</div>";
    var body = "", aktion = "";
    if (it.typ === "kennen") {
      var hh = sch === "k" ? zeigeHira(it.k) : null;
      body = '<div class="row mitte"><span class="ttl num">' + esc(it.k.ro) + '</span><button class="iconbtn rund" data-act="tHoer" aria-label="' + tx("escuchar") + '">' + ICON.laut + "</button></div>" +
        '<div class="zeichenfeld">' + strichSvg(it.k.z, "strich vorlage", true) + '<canvas id="zeichnen" width="600" height="600"></canvas></div><p class="xs muted">' + tx("nachzeichnen") + (hh ? " · " + tx("wieHiragana", { z: hh.z }) : "") + "</p>";
      aktion = '<div class="btn-row zwei"><button class="btn" data-act="tLoeschen">' + tx("loeschen") + '</button><button class="btn primary" data-act="tWeiter">' + tx("siguiente") + "</button></div>";
    } else if (it.typ === "schreiben") {
      body = '<div class="row mitte"><span class="ttl num">' + esc(it.k.ro) + '</span><button class="iconbtn rund" data-act="tHoer" aria-label="' + tx("escuchar") + '">' + ICON.laut + "</button></div>" +
        '<div class="zeichenfeld">' + (tr.zeige ? strichSvg(it.k.z, "strich loesung", true) : "") + '<canvas id="zeichnen" width="600" height="600"></canvas></div><p class="xs muted">' + tx("ausDemKopf") + "</p>";
      aktion = tr.zeige ? '<div class="btn-row zwei"><button class="btn" data-act="tSelbst" data-ok="0">' + tx("nochmalZ") + '</button><button class="btn primary" data-act="tSelbst" data-ok="1">' + tx("passt") + "</button></div>"
        : '<div class="btn-row zwei"><button class="btn" data-act="tLoeschen">' + tx("loeschen") + '</button><button class="btn primary" data-act="tVergleich">' + tx("vergleichen") + "</button></div>";
    } else {
      var frageTxt = it.typ === "wort" ? '<div class="small muted">' + tx("wortLesen") + '</div><div class="zeichen wort" lang="ja">' + esc(it.v.r) + "</div>" + (tr.res ? '<div class="small">' + esc(it.v.de) + "</div>" : "")
        : it.typ === "hoeren" ? '<button class="hoeren" data-act="tHoer">' + ICON.lautGross + "<span>" + tx("escuchar") + "</span></button>" : '<div class="zeichen" lang="ja">' + esc(it.k.z) + "</div>";
      body = frageTxt + '<div class="optionen' + (it.typ === "hoeren" ? " ja" : "") + '">' + it.opts.map(function (o) {
        var cls = tr.res ? (o === it.ok ? "opt richtig" : tr.res.pick === o ? "opt falsch" : "opt") : "opt";
        return '<button class="' + cls + '" lang="' + (it.typ === "hoeren" ? "ja" : "de") + '" data-act="tPick" data-o="' + esc(o) + '"' + (tr.res ? " disabled" : "") + ">" + esc(o) + "</button>";
      }).join("") + "</div>";
      if (tr.res) aktion = '<button class="btn" data-act="tWeiter">' + tx("siguiente") + "</button>";
    }
    return kopf + '<section class="card lernkarte trainer">' + leiste + '<div class="inhalt">' + body + "</div></section>" + aktion;
  }
  // Zeichnen mit Finger oder Maus; Striche bleiben beim Neuzeichnen erhalten
  function leinwand() {
    var c = document.getElementById("zeichnen"); if (!c || !ui.tr) return;
    var ctx = c.getContext("2d"), farbe = getComputedStyle(document.body).color;
    var male = function () { ctx.clearRect(0, 0, c.width, c.height); ctx.lineWidth = 26; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = farbe;
      (ui.tr.striche || []).forEach(function (s) { ctx.beginPath(); s.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); if (s.length === 1) ctx.lineTo(s[0][0] + 0.1, s[0][1]); ctx.stroke(); }); };
    male();
    var pos = function (e) { var r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * c.width, (e.clientY - r.top) / r.height * c.height]; }, aktiv = null;
    c.onpointerdown = function (e) { e.preventDefault(); c.setPointerCapture(e.pointerId); aktiv = [pos(e)]; ui.tr.striche.push(aktiv); male(); };
    c.onpointermove = function (e) { if (!aktiv) return; aktiv.push(pos(e)); male(); };
    c.onpointerup = c.onpointercancel = function () { aktiv = null; };
  }

  /* ================= Statistik (Bauplan 5) ================= */
  function racha() { return L.racha(state.tage, new Date()); }
  function retencion(k) { return L.retencion(state.tage, k, new Date()); }
  function kategorie(k) {
    var dom = 0, apr = 0;
    Object.keys(state.k).forEach(function (id) {
      if (modoVon(id) !== k || (DECK.ok && !karte(id))) return;   // Karten, die es im Deck nicht mehr gibt, nicht zählen
      if (L.dominada(state.k[id])) dom++; else apr++;
    });
    var gesamt = k === "num" ? 0 : quelle(k).length;
    return { dom: dom, apr: apr, neu: Math.max(0, gesamt - dom - apr) };
  }
  function nivel() { return L.nivel(kategorie("vocab").dom); }
  function wochen() { return L.wochen(state.tage, new Date()); }

  /* ================= Seiten ================= */
  function tools() {
    return '<div class="tools"><div class="lang" role="group" aria-label="' + tx("idioma") + '">' +
      I.SPRACHEN.map(function (l) { return '<button class="' + (I.lang === l ? "on" : "") + '" data-act="lang" data-l="' + l + '" aria-pressed="' + (I.lang === l) + '">' + l.toUpperCase() + "</button>"; }).join("") +
      '</div><button class="iconbtn" data-act="ajustes" aria-label="' + tx("ajustes") + '"' + alt("ajustes") + ">" + ICON.gear + "</button></div>";
  }
  function head(key, sub, v) {
    return '<div class="head"><div class="titel">' + (sub ? '<div class="sub">' + sub + "</div>" : "") + "<h1" + alt(key, v) + ">" + tx(key, v) + "</h1></div>" + tools() + "</div>";
  }
  function viewHoy() {
    var d = new Date(), h = d.getHours(), z = hoyZahlen(), r = racha();
    var gruss = h < 12 ? "saludoManana" : h < 19 ? "saludoTarde" : "saludoNoche";
    var datum = gross(d.toLocaleDateString(I.locale(), { weekday: "long", day: "numeric", month: "long" }));
    var tage = t("dias").split(" "), wt = (d.getDay() + 6) % 7, mo = new Date(d); mo.setDate(d.getDate() - wt);
    var woche = tage.map(function (l, i) {
      var x = new Date(mo); x.setDate(mo.getDate() + i); var tg = state.tage[tag(x)];
      var cls = tg && tg.c ? "dot on" : i === wt ? "dot heute" : "dot";
      return '<div><i class="' + cls + '"></i>' + esc(l) + "</div>";
    }).join("");
    return head(gruss, esc(datum)) +
      '<section class="card"><div class="row"><span class="lab"' + alt("hoy") + ">" + tx("hoy") + '</span><span class="small muted num">' + tx("aprox", { n: z.min }) + "</span></div>" +
      '<div class="big"><b class="num" id="hoy-total">' + (z.r + z.n) + '</b><span class="muted">' + tx("tarjetas") + "</span></div>" +
      '<div class="split">' + MODOS.map(function (m) { var x = z.pro[m.k]; return '<div class="row"><span' + alt(m.name) + ">" + tx(m.name) + '</span><span class="muted num">' + tx("split", { r: x.r, n: x.n }) + "</span></div>"; }).join("") + "</div>" +
      (z.r + z.n ? '<button class="btn primary" data-act="empezar"' + alt("empezar") + ">" + tx("empezar") + "</button>" : '<p class="small muted">' + tx(DECK.ok ? "nadaHoy" : DECK.err ? "sinDeck" : "cargando") + "</p>") + "</section>" +
      '<section class="card"><div class="row"><span class="ttl"' + alt("racha", { n: r }) + ">" + tx("racha", { n: r }) + '</span><span class="small muted">' + tx("estaSemana") + "</span></div>" +
      '<div class="week">' + woche + "</div></section>";
  }
  function viewAprender() {
    if (ui.tr) return viewTrainer();
    if (ui.ses) return viewSesion();
    var z = hoyZahlen();
    return head("tabAprender") +
      '<section class="card klein"><div class="row mitte"><div class="stack" style="gap:var(--s1)"><span class="ttl"' + alt("nuevasPorDia") + ">" + tx("nuevasPorDia") + '</span><span class="small muted num">' + tx("hoyAprox", { n: z.min }) + "</span></div>" +
      '<div class="stepper"><button data-act="nuevas" data-d="-5" aria-label="' + tx("menosNuevas") + '">−</button><b class="num" id="nuevas">' + state.ajustes.nuevas + '</b><button data-act="nuevas" data-d="5" aria-label="' + tx("masNuevas") + '">+</button></div></div>' +
      '<p class="xs muted">' + tx("nuevasHint") + "</p></section>" +
      viewTrainerStart() +
      '<div class="small muted"' + alt("queQuieres") + ">" + tx("queQuieres") + "</div>" +
      MODOS.map(function (m) {
        var x = z.pro[m.k];
        if (m.k === "kanji" && !kanjiFrei()) return '<div class="modo gesperrt"><span><span class="n">' + tx(m.name) + '</span><span class="how">' + tx("kanjiGesperrt", { n: DECK.ok ? kanaFortschritt() : 0 }) + '</span></span><button class="btn klein" data-act="kanjiFrei"' + alt("freischalten") + ">" + tx("freischalten") + "</button></div>";
        return '<button class="modo" data-act="modo" data-m="' + m.k + '"' + alt(m.name) + '><span><span class="n">' + tx(m.name) + '</span><span class="how">' + tx(m.how) + '</span><span class="meta">' + tx("split", { r: x.r, n: x.n }) + " · " + tx(m.check) + '</span></span><span class="pill num">' + (x.r + x.n) + "</span></button>";
      }).join("");
  }
  function viewSesion() {
    var s = ui.ses, item = s.q[0], pos = Math.min(s.done + 1, s.total), breite = s.total ? Math.round(Math.min(s.done, s.total) / s.total * 100) : 100;
    var titel = s.modi.length === 1 ? t(MODO[s.modi[0]].name) : t("mixto");
    var kopf = '<div class="ses-kopf"><button class="btn klein ghost" data-act="terminar"' + alt("terminar") + ">" + tx("terminar") + '</button><span class="small muted num" id="ses-pos">' + tx("posDe", { m: titel, p: pos, t: s.total }) + "</span></div>" +
      '<div class="progress"><i style="width:' + breite + '%"></i></div>';
    if (!item) {
      var nochNeue = s.modi.some(function (k) { return quelle(k).some(function (x) { return !state.k[x.id]; }) || k === "num"; });
      return kopf + '<section class="card fertig"><div class="fertig-t">' + tx("listo") + '</div><p class="muted">' + tx("listoTxt", { m: titel, n: s.otra }) + "</p></section>" +
        (nochNeue && DECK.ok ? '<button class="btn primary" data-act="seguir"' + alt("seguir") + ">" + tx("seguir") + "</button>" : "") +
        '<button class="btn" data-act="terminar"' + alt("otroModo") + ">" + tx("otroModo") + "</button>";
    }
    var f = frage(item), m = MODO[f.k], body = "", aktion = "";
    var prompt = f.prompt || (f.k === "chat" && f.korr ? "pCorrige" : m.prompt);
    var kartenKopf = '<div class="row mitte"><div class="row mitte" style="gap:var(--s2)"><span class="small muted"' + alt(prompt) + ">" + tx(prompt) + "</span>" + (item.otra ? '<span class="marke">' + tx("otraVez") + "</span>" : "") + "</div>" +
      '<button class="iconbtn rund" data-act="hablar" aria-label="' + tx("escuchar") + '">' + ICON.laut + "</button></div>";
    // Vorderseite
    if (f.k === "kana") body = f.front ? '<div class="zeichen" lang="ja">' + esc(f.front) + "</div>" : '<button class="hoeren" data-act="hablar">' + ICON.lautGross + "<span>" + tx("escuchar") + "</span></button>";
    else if (f.k === "num") body = '<button class="hoeren" data-act="hablar">' + ICON.lautGross + "<span>" + tx("escuchar") + "</span></button>";
    else if (f.k === "gram") body = '<div class="front">' + jWort(f.front, f.r, "", true) + '</div><div class="small muted">' + esc(f.sub) + '</div><div class="formname"' + alt(f.form) + ">→ " + tx(f.form) + "</div>";
    else if (f.k === "vocab") body = '<div class="front">' + jWort(f.w, f.r, f.ro, true) + "</div>";
    else if (f.k === "frases") body = '<div class="front satz">' + jSatz(f.seg, f.g, s.shown, s.shown ? f.ro : "") + "</div>";
    else if (f.k === "kanji") body = '<div class="zeichen" lang="ja">' + esc(f.kanji) + "</div>";
    else body = '<div class="front" lang="' + (f.korr ? "ja" : "de") + '">' + esc(f.front) + "</div>";
    // Antwortmöglichkeiten (antippen)
    if (m.art === "choice") body += '<div class="optionen' + (f.opt === "ja" ? " ja" : "") + '">' + f.options.map(function (o) {
      var cls = s.res ? (o === f.ok ? "opt richtig" : s.res.pick === o ? "opt falsch" : "opt") : "opt";
      return '<button class="' + cls + ' num" lang="' + (f.opt === "ja" ? "ja" : "de") + '" data-act="pick" data-o="' + esc(o) + '"' + (s.res ? " disabled" : "") + ">" + esc(o) + "</button>";
    }).join("") + "</div>";
    // Rückseite
    if (s.shown || s.res) {
      body += '<hr class="trenn">' + (s.res ? '<div class="' + (s.res.ok ? "ok-t" : "neg-t") + '">' + tx(s.res.ok ? "correcto" : "casi") + "</div>" : "");
      if (f.k === "kanji") body += '<div class="back">' + esc(f.back || "") + '</div><div class="small"><span class="muted">' + tx("onLesung") + ":</span> " + esc(f.on || "–") + ' · <span class="muted">' + tx("kunLesung") + ":</span> " + esc(f.kun || "–") + "</div>" +
        (f.bsp.length ? '<div class="small"><span class="muted">' + tx("beispiele") + ":</span> " + f.bsp.map(function (b) { return '<span lang="ja">' + esc(b.w) + "</span>（" + esc(b.r) + "）= " + esc(b.de); }).join(" · ") + "</div>" : "");
      else if (f.k === "frases") body += '<div class="small">' + esc(f.note) + "</div>";
      else body += '<div class="back" lang="' + (f.k === "vocab" ? "de" : "ja") + '">' + esc(f.back) + "</div>" + (f.note ? '<div class="small muted">' + esc(f.note) + "</div>" : "");
    }
    if (m.art === "flip" && !s.shown) aktion = '<button class="btn" data-act="mostrar"' + alt("mostrar") + ">" + tx("mostrar") + "</button>";
    if (m.art === "flip" && s.shown) aktion = '<div class="bewerten"><button class="rate otra" data-act="otra"' + alt("otraVez") + "><b>" + tx("otraVez") + "</b><span>" + tx("vuelveHoy") + '</span></button><button class="rate lose" data-act="lose"' + alt("loSe") + "><b>" + tx("loSe") + "</b><span>" + esc(intervall(L.preview(state.k[item.id], new Date()))) + "</span></button></div>";
    if (m.art === "choice" && s.res) aktion = '<button class="btn" data-act="weiter"' + alt("siguiente") + ">" + tx("siguiente") + "</button>";
    return kopf + '<section class="card lernkarte">' + kartenKopf + '<div class="inhalt">' + body + "</div></section>" + aktion;
  }
  function viewStats() {
    var ret = retencion(), dom = MODOS.reduce(function (s, m) { return s + kategorie(m.k).dom; }, 0), w = wochen(), max = Math.max.apply(null, w.map(function (x) { return x.n; }).concat([1]));
    var tiles = [[String(racha()), "kRacha"], [pct(ret.a, ret.b), "kRet"], [String(dom), "kDom"], [/^</.test(nivel()) ? nivel() : t("nivelTxt", { n: nivel() }), "kNivel"]];
    return head("tabStats") +
      '<div class="tiles">' + tiles.map(function (s) { return '<div class="tile"><b class="num">' + esc(s[0]) + "</b><span" + alt(s[1]) + ">" + tx(s[1]) + (s[1] === "kNivel" ? " (" + tx("estimacion") + ")" : "") + "</span></div>"; }).join("") + "</div>" +
      '<section class="card klein"><div class="ttl"' + alt("porCategoria") + ">" + tx("porCategoria") + "</div>" +
      MODOS.map(function (m) {
        var c = kategorie(m.k), r = retencion(m.k), sum = Math.max(c.dom + c.apr + c.neu, 1);
        var seg = function (n, cls) { return n ? '<i class="' + cls + '" style="flex:' + Math.max(n / sum, 0.02) + ' 1 0"></i>' : ""; };
        return '<div class="cat"><div class="row small"><span>' + tx(m.name) + '</span><span class="muted">' + tx("retencion", { p: pct(r.a, r.b) }) + '</span></div><div class="stackbar">' + seg(c.dom, "c-dom") + seg(c.apr, "c-apr") + seg(c.neu, "c-new") + '</div><div class="xs muted num">' +
          tx(m.k === "num" ? "numTxt" : "catTxt", { d: c.dom, a: c.apr, n: c.neu }) + "</div></div>";
      }).join("") +
      '<div class="legend"><span><i class="c-dom"></i>' + tx("dominadas") + '</span><span><i class="c-apr"></i>' + tx("aprendiendo") + '</span><span><i class="c-new"></i>' + tx("nuevas") + "</span></div></section>" +
      '<section class="card klein"><div class="ttl"' + alt("porSemana") + ">" + tx("porSemana") + '</div><div class="weeks">' +
      w.map(function (x, j) { return '<div><span class="xs num">' + (x.n ? (x.n < 0 ? "−" + -x.n : x.n) : "") + '</span><i' + (j === 7 ? ' class="jetzt"' : "") + ' style="height:' + Math.round(Math.max(x.n, 0) / max * 80) + 'px"></i>' + tx("semana") + x.kw + "</div>"; }).join("") + "</div></section>" +
      // Erklärungen bleiben Deutsch (Bauplan 2)
      '<div class="info">Gelernt = nächste Wiederholung erst in 21+ Tagen. „Nochmal“ setzt eine Karte auf „am Lernen“ zurück. Behalten = Anteil der fälligen Wiederholungen der letzten 30 Tage, die du gewusst hast (ohne neue Karten und ohne das Wiederholen nach „Nochmal“ – Ziel ist ca. 90 %). Gelernt pro Woche = Zuwachs minus vergessene Karten. Niveau = grobe Schätzung aus den gelernten Vokabeln (JLPT: N5 ≈ 800, N4 ≈ 1.500, N3 ≈ 3.700 Wörter).</div>';
  }
  function viewErrores() {
    var liste = state.errores.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    return head("tusErrores", null) + '<p class="small muted unter-h1"' + alt("erroresSub") + ">" + tx("erroresSub") + "</p>" +
      (liste.length ? liste.map(function (e) {
        var d = e.fecha ? new Date(e.fecha) : null;
        return '<section class="card klein fehler"><div class="neg falsch-t" lang="ja">' + esc(e.wrong || "") + '</div><div class="richtig-t" lang="ja">' + esc(e.es) + '</div><div class="small muted">' + esc(e.note || "") + (d && !isNaN(d) ? " · " + esc(d.toLocaleDateString(I.locale(), { weekday: "short", day: "numeric", month: "numeric" })) : "") + "</div></section>";
      }).join("") : '<section class="card"><p class="leer">' + tx("erroresVacio") + "</p></section>");
  }

  /* ================= Briefkasten vom Coach + Import (Bauplan 8, Checkliste) ================= */
  var inboxCfg = (function () { try { return JSON.parse(localStorage.getItem(INBOX_CFG)) || {}; } catch (e) { return {}; } })();
  function inboxSave() { try { localStorage.setItem(INBOX_CFG, JSON.stringify(inboxCfg)); } catch (e) {} }
  // Einträge {id, kind: error|vocab|frase, es, de, wrong, note, created_at} → Karten. Doppelte IDs werden ignoriert.
  function eintraegeVerarbeiten(liste) {
    var neue = 0, bekannt = {};
    state.extra.forEach(function (e) { bekannt[e.src] = 1; }); state.errores.forEach(function (e) { bekannt[e.id] = 1; });
    (liste || []).forEach(function (e) {
      if (!e || !e.id || !e.es || bekannt[e.id]) return; bekannt[e.id] = 1;
      var kind = e.kind === "vocab" ? "vocab" : e.kind === "frase" ? "frase" : "error", fecha = e.created_at || new Date().toISOString();
      if (kind === "error") state.errores.push({ id: String(e.id), es: String(e.es), wrong: String(e.wrong || ""), note: String(e.note || ""), de: e.de ? String(e.de) : "", fecha: fecha });
      state.extra.push({ id: (kind === "vocab" ? "x:" : "c:") + e.id, src: String(e.id), es: String(e.es), de: e.de ? String(e.de) : "", wrong: e.wrong ? String(e.wrong) : "", note: e.note ? String(e.note) : "", n: e.note ? String(e.note) : "", fecha: fecha });
      neue++;
    });
    if (neue) save();
    return neue;
  }
  function inboxBase() { return sameOrigin ? "" : (syncCfg.server || CFG.server || "").replace(/\/+$/, ""); }
  function inboxHolen(manuell) {
    if (!inboxCfg.token || (!sameOrigin && !inboxBase())) return;
    fetch(inboxBase() + "/api/inbox", { headers: { Authorization: "Bearer " + inboxCfg.token } }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 401 ? "Token?" : "HTTP " + r.status); return r.json();
    }).then(function (j) {
      var items = j.items || [], n = eintraegeVerarbeiten(items);
      if (items.length) fetch(inboxBase() + "/api/inbox/ack", { method: "POST", headers: { Authorization: "Bearer " + inboxCfg.token, "Content-Type": "application/json" }, body: JSON.stringify({ ids: items.map(function (x) { return x.id; }) }) }).catch(function () {});
      if (n || manuell) toast(n ? t("tNuevos", { n: n }) : t("tNadaNuevo"));
      render();
    }).catch(function (e) { if (manuell) toast(t("tBuzon", { e: e.message })); });
  }
  function importieren(text) {
    var j; try { j = JSON.parse(text.trim().replace(/^```(json)?|```$/g, "")); } catch (e) { toast(t("tJsonMalo")); return; }
    var n = eintraegeVerarbeiten(Array.isArray(j) ? j : j.items || [j]);
    toast(n ? t("tNuevos", { n: n }) : t("tNadaNuevo")); render();
  }

  /* ================= Einstellungen ================= */
  function viewAjustes() {
    var mode = ui.mode === "hell" || ui.mode === "dunkel" ? ui.mode : "system";
    return '<div class="kopf"><h2' + alt("ajustes") + ">" + tx("ajustes") + '</h2><button class="btn klein ghost" data-act="zu">' + tx("cerrar") + "</button></div>" +
      '<div class="feld"><span class="lab"' + alt("idioma") + ">" + tx("idioma") + '</span><div class="seg">' +
      [["de", "Deutsch"], ["ja", "日本語"]].map(function (l) { return '<button class="' + (I.lang === l[0] ? "on" : "") + '" data-act="lang" data-l="' + l[0] + '">' + l[1] + "</button>"; }).join("") +
      '</div><p class="xs muted">' + tx("idiomaHint") + "</p></div>" +
      '<div class="feld"><span class="lab"' + alt("apariencia") + ">" + tx("apariencia") + '</span><div class="seg">' +
      [["system", "auto"], ["hell", "claro"], ["dunkel", "oscuro"]].map(function (m) { return '<button class="' + (mode === m[0] ? "on" : "") + '" data-act="mode" data-m="' + m[0] + '"' + alt(m[1]) + ">" + tx(m[1]) + "</button>"; }).join("") + "</div></div>" +
      '<div class="feld"><span class="lab"' + alt("schrift") + ">" + tx("schrift") + '</span><div class="seg">' +
      [["kana", "schriftKana"], ["furi", "schriftFuri"], ["kanji", "schriftKanji"]].map(function (x) { return '<button class="' + (schrift() === x[0] ? "on" : "") + '" data-act="schrift" data-s="' + x[0] + '"' + alt(x[1]) + ">" + tx(x[1]) + "</button>"; }).join("") +
      '</div><div class="row mitte"><span class="small"' + alt("romajiHilfe") + ">" + tx("romajiHilfe") + '</span><div class="seg" style="min-width:140px">' +
      [[true, "an"], [false, "aus"]].map(function (x) { return '<button class="' + (romajiAn() === x[0] ? "on" : "") + '" data-act="romaji" data-r="' + x[0] + '">' + tx(x[1]) + "</button>"; }).join("") + '</div></div><p class="xs muted">' + tx("schriftHint") + "</p></div>" +
      '<hr class="trenn">' + syncFeld() + '<hr class="trenn">' +
      '<div class="feld"><span class="lab"' + alt("buzon") + ">" + tx("buzon") + '</span><p class="small muted">' + tx("buzonTxt") + "</p>" +
      '<label class="field">' + tx("token") + '<input id="f-token" type="password" autocomplete="off" spellcheck="false" value="' + esc(inboxCfg.token || "") + '"></label>' +
      '<div class="btn-row"><button class="btn klein primary" data-act="tokenSpeichern">' + tx("guardar") + '</button><button class="btn klein" data-act="inboxJetzt">' + tx("buscarAhora") + "</button></div>" +
      '<p class="small muted">' + tx("importarTxt") + '</p><textarea id="f-import" rows="3" spellcheck="false" placeholder="[{&quot;id&quot;: &quot;2026-11-03-001&quot;, &quot;kind&quot;: &quot;error&quot;, …}]"></textarea>' +
      '<div class="btn-row"><button class="btn klein" data-act="importieren"' + alt("importar") + ">" + tx("importar") + "</button></div></div>" +
      '<hr class="trenn">' +
      '<div class="feld"><span class="lab"' + alt("copia") + ">" + tx("copia") + '</span><p class="small muted">' + tx("copiaHint") + "</p>" +
      '<div class="btn-row"><button class="btn klein" data-act="backupSpeichern">' + tx("guardarCopia") + '</button><button class="btn klein" data-act="backupLaden">' + tx("cargarCopia") + "</button></div>" +
      (saveErr ? '<p class="small neg">' + tx("noGuardado", { e: saveErr }) + "</p>" : "") + "</div>" +
      '<hr class="trenn"><button class="btn klein ghost" data-act="licencias"' + alt("licencias") + ">" + tx("licencias") + "</button>";
  }
  function viewLicencias() {
    var q = DECK.quellen;
    return '<div class="kopf"><h2>' + tx("licencias") + '</h2><button class="btn klein ghost" data-act="ajustes">' + tx("volver") + "</button></div>" +
      (q ? '<p class="small muted num">' + q.vocab + " · " + q.frases + " · " + q.gram + " · " + esc(q.stand) + "</p>" + q.quellen.map(function (x) {
        return '<div class="small"><b>' + esc(x.name) + "</b> – " + esc(x.was) + "<br><span class=\"muted\">" + esc(x.lizenz) + ' · <a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.url.replace(/^https:\/\//, "")) + "</a></span></div>";
      }).join("") : '<p class="small muted">' + tx("cargando") + "</p>");
  }
  var TAURI = window.__TAURI__ && window.__TAURI__.core ? window.__TAURI__ : null;
  function backupSpeichern() {
    var name = CFG.id + "-backup-" + heute() + ".json", text = JSON.stringify(state, null, 1);
    if (TAURI) { TAURI.core.invoke("save_file_dialog", { contents: text, defaultName: name }).then(function (p) { if (p) toast(t("tCopiaGuardada")); }, function (e) { toast(t("tNoGuardada", { e: e })); }); return; }
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(t("tCopiaDescarga"));
  }
  var backupIn = document.createElement("input"); backupIn.type = "file"; backupIn.accept = ".json,application/json"; backupIn.hidden = true; document.body.appendChild(backupIn);
  backupIn.addEventListener("change", function () {
    var f = backupIn.files[0]; backupIn.value = ""; if (!f) return;
    f.text().then(function (s) { var d = JSON.parse(s); if (!d || d.version !== 1 || !d.ajustes) throw new Error(t("tNoEsCopia")); state = d; vervollstaendigen(); ui.modal = null; save(); toast(t("tCopiaCargada")); })
      .catch(function (e) { toast(t("tNoCargada", { e: e.message })); });
  });

  /* ================= Abgleich zwischen Geräten (verschlüsselt, aus der Vorlage) ================= */
  var SY = window.AppSync;
  var syncCfg = (function () { try { return JSON.parse(localStorage.getItem(SYNC_CFG)) || {}; } catch (e) { return {}; } })();
  var syncRun = { busy: false, err: null, timer: null, pending: null };
  // Läuft die App auf dem Server selbst (Web/iPhone), geht der Abgleich an dieselbe Adresse; Desktop-App an CFG.server
  var sameOrigin = /^https?:$/.test(location.protocol) && location.hostname !== "tauri.localhost";
  function server() { return syncCfg.server || (sameOrigin ? "" : CFG.server || ""); }
  function syncSaveCfg() { try { localStorage.setItem(SYNC_CFG, JSON.stringify(syncCfg)); } catch (e) {} }
  function syncReady() { return !!(SY && syncCfg.key && (sameOrigin || server())); }
  function ajustesOffen() { return ui.modal && ui.modal.type === "ajustes"; }
  function syncChanged(json) {
    var h = SY && SY.hash(json);
    if (!syncReady() || h === syncCfg.hash || h === syncRun.pending) return;   // Neuzeichnen ohne Änderung verschiebt nichts
    syncRun.pending = h; clearTimeout(syncRun.timer); syncRun.timer = setTimeout(function () { syncRun.pending = null; syncPush(); }, 3000);
  }
  function syncPush() {
    if (!syncReady() || syncRun.busy) return;
    var json = JSON.stringify(state); if (SY.hash(json) === syncCfg.hash) return;
    syncRun.busy = true;
    SY.push(server(), syncCfg.key, syncCfg.v || 0, JSON.parse(json)).then(function (r) {
      syncRun.busy = false; syncRun.err = null;
      if (r.ok) { syncCfg.v = r.v; syncCfg.at = r.at; syncCfg.hash = SY.hash(json); syncSaveCfg(); if (ajustesOffen()) render(); return; }
      if (r.conflict) { ui.modal = { type: "konflikt", remote: r.remote }; render(); }
    }, function (e) { syncRun.busy = false; syncRun.err = e.message; if (ajustesOffen()) render(); });
  }
  function syncPull(manuell) {
    if (!syncReady() || syncRun.busy) return;
    syncRun.busy = true;
    SY.pull(server(), syncCfg.key).then(function (r) {
      syncRun.busy = false; syncRun.err = null;
      var lokalGeaendert = SY.hash(JSON.stringify(state)) !== syncCfg.hash;
      if (!r) { syncPush(); return; }
      if (r.v === syncCfg.v) { if (lokalGeaendert) syncPush(); else if (manuell) toast(t("tAlDia")); return; }
      if (!lokalGeaendert) { syncApply(r); if (manuell) toast(t("tNuevaVersion")); return; }
      ui.modal = { type: "konflikt", remote: r }; render();
    }, function (e) { syncRun.busy = false; syncRun.err = e.message; if (manuell) toast(t("tSincro", { e: e.message })); });
  }
  function syncApply(r) { state = r.data; vervollstaendigen(); syncCfg.v = r.v; syncCfg.at = r.at; syncCfg.hash = SY.hash(JSON.stringify(state)); syncSaveCfg(); try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} if (!ui.ses) render(); }
  function syncFeld() {
    var inner;
    if (!syncCfg.key) inner = '<p class="small muted">' + tx("sincroIntro") + "</p>" +
      '<div class="btn-row"><button class="btn klein primary" data-act="syncNeu">' + tx("configurar") + '</button><button class="btn klein" data-act="syncVerbinden">' + tx("conectarClave") + "</button></div>";
    else inner = '<p class="small muted">' + (syncRun.err ? '<span class="neg">' + tx("error", { e: syncRun.err }) + "</span>" : syncCfg.at ? tx("ultimaSincro", { t: new Date(syncCfg.at).toLocaleString(I.locale(), { dateStyle: "short", timeStyle: "short" }) }) : tx("nuncaSincro")) + "</p>" +
      (ui.zeigeKey ? '<div class="key">' + esc(syncCfg.key) + "</div>" : "") +
      '<div class="btn-row"><button class="btn klein primary" data-act="syncJetzt">' + tx("sincroAhora") + '</button><button class="btn klein" data-act="syncKey">' + tx(ui.zeigeKey ? "ocultarClave" : "mostrarClave") + '</button><button class="btn klein ghost" data-act="syncAus">' + tx("desconectar") + "</button></div>";
    var srv = sameOrigin ? "" : '<label class="field">' + tx("servidor") + '<input id="f-server" value="' + esc(syncCfg.server || "") + '" placeholder="' + esc(CFG.server || "https://espanol.pages.dev") + '" autocomplete="off" spellcheck="false"></label>';
    return '<div class="feld"><span class="lab"' + alt("sincro") + ">" + tx("sincro") + "</span>" + inner + srv + "</div>";
  }

  /* ================= Fenster ================= */
  function modal() {
    var m = ui.modal; if (!m) return "";
    var body = "";
    if (m.type === "ajustes") body = viewAjustes();
    if (m.type === "licencias") body = viewLicencias();
    if (m.type === "willkommen") body = "<h2>" + tx("bienvenida", { app: CFG.name }) + "</h2><p>" + tx("bienvenidaTxt") + "</p>" +
      '<div class="btn-row"><button class="btn klein primary" data-act="los">' + tx("vamos") + '</button><button class="btn klein" data-act="syncVerbinden">' + tx("conectarClave") + '</button><button class="btn klein ghost" data-act="backupLaden">' + tx("cargarCopia") + "</button></div>";
    if (m.type === "syncVerbinden") body = "<h2>" + tx("conectarClave") + "</h2><p>" + tx("conectarTxt") + "</p>" +
      '<label class="field">' + tx("clave") + '<input id="f-key" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' +
      (sameOrigin ? "" : '<label class="field">' + tx("servidor") + '<input id="f-server2" value="' + esc(server()) + '" autocomplete="off" spellcheck="false"></label>') +
      '<div class="btn-row"><button class="btn klein primary" data-act="syncVerbindenOk">' + tx("conectar") + '</button><button class="btn klein" data-act="zu">' + tx("cancelar") + "</button></div>";
    if (m.type === "konflikt") body = "<h2>" + tx("conflicto") + "</h2><p>" + tx("conflictoTxt") + "</p>" +
      '<div class="btn-row"><button class="btn klein primary" data-act="konfliktDort">' + tx("conflictoDort") + '</button><button class="btn klein" data-act="konfliktHier">' + tx("conflictoHier") + "</button></div>";
    return '<div class="overlay" data-act="' + (m.type === "konflikt" ? "" : "zuHintergrund") + '"><div class="modal" role="dialog" aria-modal="true">' + body + "</div></div>";
  }

  /* ================= Zeichnen ================= */
  function render() {
    setMode();
    document.documentElement.lang = I.lang;
    document.documentElement.classList.toggle("is-phone", isPhone());
    var main = ui.view === "aprender" ? viewAprender() : ui.view === "stats" ? viewStats() : ui.view === "errores" ? viewErrores() : viewHoy();
    var tabs = TABS.map(function (x) { return '<button class="' + (ui.view === x[0] ? "on" : "") + '" data-act="view" data-v="' + x[0] + '"' + alt(x[1]) + (ui.view === x[0] ? ' aria-current="page"' : "") + ">" + tx(x[1]) + "</button>"; }).join("");
    var html = isPhone()
      ? '<div class="notch"></div><main class="main">' + main + '</main><nav class="tabbar">' + tabs + "</nav>"
      : '<header class="top"><div class="brand"><img src="icons/icon-192.png" alt="">' + esc(CFG.name) + '</div><nav class="nav">' + tabs + "</nav></header>" +
        '<main class="main">' + main + "</main>";
    var focus = document.activeElement && document.activeElement.id, vals = {};
    document.querySelectorAll("input[id], textarea[id]").forEach(function (i) { vals[i.id] = i.value; });
    document.getElementById("app").innerHTML = html + modal() + (ui.toast ? '<div class="toast" role="status">' + esc(ui.toast) + "</div>" : "");
    Object.keys(vals).forEach(function (id) { var i = document.getElementById(id); if (i && i.type !== "file" && !i.disabled) i.value = vals[id]; });   // Eingaben überleben das Neuzeichnen
    if (focus && document.getElementById(focus)) document.getElementById(focus).focus();
    leinwand();
  }
  var SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICON = {
    gear: SVG + ' width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    laut: SVG + ' width="20" height="20"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    lautGross: SVG + ' width="36" height="36"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>'
  };

  /* ================= Lang-Drücken (≈ 500 ms): kurze Übersetzung zeigen ================= */
  var lp = { timer: null, x: 0, y: 0, fired: false, hide: null };
  function tipZeigen(el) {
    var txt = el.dataset.alt; if (!txt) return;
    tipWeg();
    var tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role", "status"); tip.textContent = txt; document.body.appendChild(tip);
    var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 8, rand = 16;
    var n = document.querySelector(".notch"), oben = (n ? n.getBoundingClientRect().height : 0) + gap;   // nie unter die Uhrzeit
    var top = r.top - h - gap; if (top < oben) top = r.bottom + gap;
    var left = Math.min(Math.max(r.left + r.width / 2 - w / 2, rand), window.innerWidth - w - rand);
    tip.style.top = Math.round(top) + "px"; tip.style.left = Math.round(left) + "px";
    if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
  }
  function tipWeg() { clearTimeout(lp.hide); var old = document.querySelector(".tip"); if (old) old.remove(); }
  document.addEventListener("pointerdown", function (ev) {
    var el = ev.target.closest("[data-alt]"); clearTimeout(lp.timer); lp.fired = false; if (!el) return;
    lp.x = ev.clientX; lp.y = ev.clientY;
    lp.timer = setTimeout(function () { lp.fired = true; tipZeigen(el); }, 500);
  });
  document.addEventListener("pointermove", function (ev) { if (Math.abs(ev.clientX - lp.x) + Math.abs(ev.clientY - lp.y) > 10) clearTimeout(lp.timer); });
  ["pointerup", "pointercancel"].forEach(function (n) { document.addEventListener(n, function () { clearTimeout(lp.timer); if (lp.fired) { clearTimeout(lp.hide); lp.hide = setTimeout(tipWeg, 1400); } }); });
  document.addEventListener("contextmenu", function (ev) { if (ev.target.closest("[data-alt]")) ev.preventDefault(); });
  // Nach dem Lang-Drücken keinen Klick auslösen (sonst wechselt z. B. der Tab)
  document.addEventListener("click", function (ev) { if (lp.fired) { lp.fired = false; ev.preventDefault(); ev.stopPropagation(); } }, true);

  /* ================= Klicks ================= */
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-act]"); if (!el) return;
    var a = el.dataset.act, d = el.dataset, s = ui.ses;
    if (a === "zuHintergrund") { if (ev.target === el) { ui.modal = null; render(); } return; }
    if (a === "view") { ui.view = d.v; ui.modal = null; if (d.v !== "aprender") { ui.ses = null; ui.tr = null; } window.scrollTo(0, 0); saveUi(); render(); if (d.v === "hoy") inboxHolen(); return; }
    if (a === "zu" || a === "los") { ui.modal = null; if (a === "los") save(); render(); return; }
    if (a === "ajustes") { ui.modal = { type: "ajustes" }; render(); return; }
    if (a === "licencias") { ui.modal = { type: "licencias" }; quellenLaden(); render(); return; }
    if (a === "lang") { I.set(d.l); saveUi(); render(); return; }
    if (a === "mode") { ui.mode = d.m; saveUi(); render(); return; }
    if (a === "nuevas") { state.ajustes.nuevas = Math.min(50, Math.max(0, state.ajustes.nuevas + Number(d.d))); save(); render(); return; }
    // Kana-Trainer
    if (a === "trainer") { stricheLaden(); ui.tr = { s: d.s, ph: "tabelle" }; window.scrollTo(0, 0); render(); return; }
    if (a === "tZurueck") { if (ui.tr && ui.tr.ph !== "tabelle") { ui.tr = { s: ui.tr.s, ph: "tabelle" }; } else ui.tr = null; clearInterval(ui.trTick); render(); return; }
    if (a === "tTabelle") { ui.tr = { s: ui.tr.s, ph: "tabelle" }; clearInterval(ui.trTick); render(); return; }
    if (a === "tLektion") { stricheLaden(); lektionStart(ui.tr.s, Number(d.g)); return; }
    if (a === "tTempo") { tempoStart(ui.tr.s); return; }
    if (a === "tKana") { var kk = kanaListe(ui.tr.s).filter(function (x) { return x.z === d.z; })[0]; ui.tr = { s: ui.tr.s, ph: "detail", k: kk }; render(); sprechen(kk.z); return; }
    if (a === "tHoer") { var ti = ui.tr.ph === "detail" ? ui.tr.k : ui.tr.q[0] && ui.tr.q[0].k; if (ti) sprechen(ti.z); return; }
    if (a === "tAnim") { render(); return; }
    if (a === "tPick") { trainerAntwort(d.o); return; }
    if (a === "tWeiter") { trainerWeiter(); return; }
    if (a === "tLoeschen") { ui.tr.striche = []; render(); return; }
    if (a === "tVergleich") { ui.tr.zeige = true; render(); return; }
    if (a === "tSelbst") { var it2 = ui.tr.q[0], mm = km(it2.k.z); if (d.ok === "1") mm.r++; else { mm.f++; ui.tr.q.splice(Math.min(3, ui.tr.q.length), 0, { typ: "schreiben", k: it2.k }); } save(); trainerWeiter(); return; }
    // Lernen
    if (a === "empezar") { sitzungStart(MODOS.map(function (m) { return m.k; })); return; }
    if (a === "modo") { sitzungStart([d.m]); return; }
    if (a === "terminar") { ui.ses = null; if (window.speechSynthesis) speechSynthesis.cancel(); render(); return; }
    if (a === "seguir") { sitzungMehr(); return; }
    if (a === "hablar") { var it = aktuell(); if (it) sprechen(frage(it).say); return; }
    if (a === "mostrar") { s.shown = true; render(); sprechen(frage(s.q[0]).say); return; }
    if (a === "otra") { antworten(false); return; }
    if (a === "lose") { antworten(true); return; }
    if (a === "schrift") { state.ajustes.schrift = d.s; save(); render(); return; }
    if (a === "romaji") { state.ajustes.romaji = d.r === "true"; save(); render(); return; }
    if (a === "kanjiFrei") { state.ajustes.kanjiFrei = true; save(); render(); return; }
    if (a === "pick") { if (s.res) return; var f = frage(s.q[0]); s.res = { ok: d.o === f.ok, pick: d.o }; s.shown = true; render(); if (f.k === "kana" || f.k === "gram") sprechen(f.say); return; }
    if (a === "weiter") { antworten(s.res.ok); return; }
    // Briefkasten, Import
    if (a === "tokenSpeichern") { inboxCfg.token = document.getElementById("f-token").value.trim(); inboxSave(); toast(t("tGuardado")); inboxHolen(); return; }
    if (a === "inboxJetzt") { inboxHolen(true); return; }
    if (a === "importieren") { var ta = document.getElementById("f-import"); importieren(ta.value); ta.value = ""; return; }
    // Backup, Abgleich
    if (a === "backupSpeichern") { backupSpeichern(); return; }
    if (a === "backupLaden") { backupIn.click(); return; }
    if (a === "syncNeu") {
      var s1 = document.getElementById("f-server"); if (s1) syncCfg.server = s1.value.trim().replace(/\/+$/, "");
      if (!sameOrigin && !server()) { toast(t("tServidor")); return; }
      syncCfg = { key: SY.newKey(), server: syncCfg.server, v: 0 }; syncSaveCfg(); ui.zeigeKey = true; save(); syncPush(); render(); toast(t("tConfigurado")); return;
    }
    if (a === "syncVerbinden") { ui.modal = { type: "syncVerbinden" }; render(); return; }
    if (a === "syncVerbindenOk") {
      var key = document.getElementById("f-key").value, s2 = document.getElementById("f-server2");
      if (s2) syncCfg.server = s2.value.trim().replace(/\/+$/, "");
      if (!SY.valid(key)) { toast(t("tClave")); return; }
      if (!sameOrigin && !server()) { toast(t("tServidor")); return; }
      SY.pull(server(), key).then(function (r) {
        syncCfg = { key: SY.pretty(key), server: syncCfg.server, v: 0 }; ui.modal = null;
        if (r) { syncApply(r); toast(t("tConectadoDatos")); } else { syncSaveCfg(); save(); syncPush(); toast(t("tConectado")); }
      }, function (e) { toast(e.message); });
      return;
    }
    if (a === "syncJetzt") { syncPull(true); return; }
    if (a === "syncKey") { ui.zeigeKey = !ui.zeigeKey; render(); return; }
    if (a === "syncAus") { syncCfg = { server: syncCfg.server }; syncSaveCfg(); ui.zeigeKey = false; render(); toast(t("tDesconectado")); return; }
    if (a === "konfliktDort") { var r = ui.modal.remote; ui.modal = null; syncApply(r); toast(t("tOtraVersion")); return; }
    if (a === "konfliktHier") { syncCfg.v = ui.modal.remote.v; syncCfg.hash = null; ui.modal = null; syncSaveCfg(); syncPush(); render(); return; }
  });
  document.addEventListener("change", function (ev) {
    if (ev.target.id === "f-server") { syncCfg.server = ev.target.value.trim().replace(/\/+$/, ""); syncSaveCfg(); }
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && ui.modal && ui.modal.type !== "konflikt") { ui.modal = null; render(); }
  });

  render();
  deckLaden();
  setTimeout(function () { syncPull(); inboxHolen(); }, 400);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { syncPull(); if (!ui.ses) render(); } });
  setInterval(function () { if (!document.hidden) syncPull(); }, 120000);
  window.__app = { state: function () { return state; }, deck: DECK, aktuelleAntwort: function () { if (ui.tr && ui.tr.q && ui.tr.q[0]) return frageAuf(ui.tr.q[0]).ok; var it = aktuell(); return it ? frage(it).ok : null; } };   // nur für den Klick-Test (lesend)
})();
