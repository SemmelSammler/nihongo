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
  function leer() { return { version: 1, ajustes: { nuevas: 10, schrift: "kana", romaji: true }, k: {}, tage: {}, errores: [], extra: [] }; }
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
    if (ui.ses) return viewSesion();
    var z = hoyZahlen();
    return head("tabAprender") +
      '<section class="card klein"><div class="row mitte"><div class="stack" style="gap:var(--s1)"><span class="ttl"' + alt("nuevasPorDia") + ">" + tx("nuevasPorDia") + '</span><span class="small muted num">' + tx("hoyAprox", { n: z.min }) + "</span></div>" +
      '<div class="stepper"><button data-act="nuevas" data-d="-5" aria-label="' + tx("menosNuevas") + '">−</button><b class="num" id="nuevas">' + state.ajustes.nuevas + '</b><button data-act="nuevas" data-d="5" aria-label="' + tx("masNuevas") + '">+</button></div></div>' +
      '<p class="xs muted">' + tx("nuevasHint") + "</p></section>" +
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
    if (a === "view") { ui.view = d.v; ui.modal = null; if (d.v !== "aprender") ui.ses = null; window.scrollTo(0, 0); saveUi(); render(); if (d.v === "hoy") inboxHolen(); return; }
    if (a === "zu" || a === "los") { ui.modal = null; if (a === "los") save(); render(); return; }
    if (a === "ajustes") { ui.modal = { type: "ajustes" }; render(); return; }
    if (a === "licencias") { ui.modal = { type: "licencias" }; quellenLaden(); render(); return; }
    if (a === "lang") { I.set(d.l); saveUi(); render(); return; }
    if (a === "mode") { ui.mode = d.m; saveUi(); render(); return; }
    if (a === "nuevas") { state.ajustes.nuevas = Math.min(50, Math.max(0, state.ajustes.nuevas + Number(d.d))); save(); render(); return; }
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
  window.__app = { state: function () { return state; }, deck: DECK, aktuelleAntwort: function () { var it = aktuell(); return it ? frage(it).ok : null; } };   // nur für den Klick-Test (lesend)
})();
