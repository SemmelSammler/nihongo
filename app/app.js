/* Español – Spanisch lernen, ca. 15 Minuten am Tag. Bauplan: BAUPLAN.md, Prototyp: docs/prototyp/D.dc.html.
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
  function leer() { return { version: 1, ajustes: { nuevas: 10 }, k: {}, tage: {}, errores: [], extra: [] }; }
  var state = (function () { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } })();
  var neu = !state;
  if (!state) state = DEMO ? clone(DEMO) : leer();
  function vervollstaendigen() { var l = leer(); Object.keys(l).forEach(function (k) { if (state[k] == null) state[k] = l[k]; }); }
  vervollstaendigen();
  // Gerät-eigene Einstellungen (nicht abgeglichen): Tab, Hell/Dunkel, Sprache
  var ui = (function () { try { return JSON.parse(localStorage.getItem(UI_STORE)) || {}; } catch (e) { return {}; } })();
  var TABS = [["hoy", "tabHoy"], ["aprender", "tabAprender"], ["stats", "tabStats"], ["errores", "tabErrores"]];
  if (!TABS.some(function (x) { return x[0] === ui.view; })) ui.view = "hoy";
  I.set(ui.lang || "es");
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
  var DECK = { ok: false, err: null, vocab: [], frases: [], gram: [], quellen: null, byId: {} };
  function deckLaden() {
    var teile = ["vocab", "frases", "gram"];
    return Promise.all(teile.map(function (f) { return fetch("deck/" + f + ".json").then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }))
      .then(function (arr) {
        teile.forEach(function (f, i) { DECK[f] = arr[i]; arr[i].forEach(function (x) { DECK.byId[x.id] = x; }); });
        var gIdx = {}; DECK.gram.forEach(function (g) { gIdx[g.v] = g.de; });
        DECK.ok = true; render();
      }, function (e) { DECK.err = e.message; render(); });
  }
  function quellenLaden() { fetch("deck/quellen.json").then(function (r) { return r.json(); }).then(function (q) { DECK.quellen = q; if (ui.modal && ui.modal.type === "licencias") render(); }, function () {}); }

  /* ================= Lernmodi (Anteile der neuen Karten: Bauplan 5) ================= */
  var MODOS = [
    { k: "vocab", p: "v", name: "modoVocab", how: "comoVocab", check: "tudecides", share: 0.4, art: "flip", prompt: "pQue" },
    { k: "frases", p: "f", name: "modoFrases", how: "comoFrases", check: "tudecides", share: 0.3, art: "flip", prompt: "pCompleta" },
    { k: "gram", p: "g", name: "modoGram", how: "comoGram", check: "solo", share: 0.15, art: "typed", prompt: "pEscribe" },
    { k: "num", p: "n", name: "modoNum", how: "comoNum", check: "solo", share: 0.15, art: "choice", prompt: "pEscucha" },
    { k: "chat", p: "c", name: "modoChat", how: "comoChat", check: "tudecides", share: 0, art: "flip", prompt: "pComo" }
  ];
  var MODO = {}; MODOS.forEach(function (m) { MODO[m.k] = m; });
  function modoVon(id) { var p = id.charAt(0); return p === "x" ? "vocab" : MODOS.filter(function (m) { return m.p === p; })[0].k; }
  function tagHeute() { var d = heute(); if (!state.tage[d]) state.tage[d] = { a: {}, r: {}, n: {}, x: {}, ms: 0, c: 0, d: 0 }; return state.tage[d]; }
  function tagLesen() { return state.tage[heute()] || { a: {}, n: {}, x: {}, ms: 0, c: 0, d: 0 }; }
  // Tageslimit auf die Modi verteilen, Summe bleibt genau gleich (größte Reste zuerst)
  function anteil(k, n) {
    var teil = MODOS.map(function (x) { return { k: x.k, f: Math.floor(n * x.share), r: n * x.share % 1 }; });
    var rest = n - teil.reduce(function (s, x) { return s + x.f; }, 0);
    teil.slice().sort(function (a, b) { return b.r - a.r; }).slice(0, rest).forEach(function (x) { x.f++; });
    return teil.filter(function (x) { return x.k === k; })[0].f;
  }
  // Alle Karten eines Modus in Lern-Reihenfolge (Briefkasten-Wörter zuerst)
  function quelle(k) {
    var extra = state.extra.filter(function (e) { return modoVon(e.id) === k; });
    if (k === "vocab") return extra.concat(DECK.vocab);
    if (k === "frases") return DECK.frases;
    if (k === "gram") return DECK.gram;
    if (k === "num") return L.NUM.map(function (id) { return { id: id }; });
    return extra;   // chat
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
    // anfangs Schätzung (Bauplan 5), ab 50 Antworten aus der gemessenen Zeit pro Antwort
    var ms = 0, c = 0; Object.keys(state.tage).forEach(function (d) { ms += state.tage[d].ms || 0; c += state.tage[d].c || 0; });
    if (c >= 50) return Math.round((neuN * 2.4 + repN) * ms / c / 60000);
    return Math.round(neuN * 0.6 + repN * 0.25);
  }
  function hoyZahlen() {
    var r = 0, n = 0, pro = {};
    MODOS.forEach(function (m) { var z = zahlen(m.k); pro[m.k] = z; r += z.r; n += z.n; });
    return { r: r, n: n, pro: pro, min: minutosFuer(n, r) };
  }

  /* ================= Lernsitzung ================= */
  function sitzungStart(modi, titel) {
    var q = [];
    modi.forEach(function (k) { faellig(k).forEach(function (id) { q.push({ id: id }); }); neueListe(k).forEach(function (id) { q.push({ id: id, neu: true }); }); });
    ui.ses = { modi: modi, titel: titel, q: q, done: 0, total: q.length, otra: 0, shown: false, res: null, typed: "", t0: Date.now() };
    ui.view = "aprender"; window.scrollTo(0, 0); render(); autoSprechen();
  }
  function sitzungMehr() {
    var s = ui.ses, d = tagHeute();
    s.modi.forEach(function (k) {
      var plus = s.modi.length === 1 ? 10 : anteil(k, 10); d.x[k] = (d.x[k] || 0) + plus;
      var liste = neueListe(k), vorher = s.total;
      liste.forEach(function (id) { if (!s.q.some(function (x) { return x.id === id; })) { s.q.push({ id: id, neu: true }); s.total++; } });
      // Números y horas ist unbegrenzt: sind alle Kategorien schon bekannt, 10 Extra-Fragen aus bekannten Kategorien
      if (k === "num" && s.total === vorher) { var bekannt = L.NUM.filter(function (id) { return state.k[id]; }); for (var i = 0; i < plus && bekannt.length; i++) { s.q.push({ id: bekannt[Math.floor(Math.random() * bekannt.length)] }); s.total++; } }
    });
    save(); s.shown = false; s.res = null; s.typed = ""; s.t0 = Date.now(); render(); autoSprechen();
  }
  function aktuell() { return ui.ses && ui.ses.q[0]; }
  function frage(item) {   // Inhalt der Karte für die Anzeige
    var id = item.id, k = modoVon(id), c = karte(id) || {};
    if (k === "num") { if (!item.f) item.f = L.frageNum(id, (Date.now() ^ (Math.random() * 1e9)) >>> 0); return { k: k, front: "", back: item.f.back, note: item.f.note, say: item.f.say, options: item.f.options, ok: item.f.ok }; }
    if (k === "vocab") return { k: k, front: c.es, back: c.de, note: c.n || "", say: c.es };
    if (k === "frases") return { k: k, front: c.es + (c.lm ? " (" + c.lm + ")" : ""), back: c.gap, note: c.de, say: c.es.replace("____", c.gap), voll: c.es.replace("____", c.gap) };
    if (k === "gram") return { k: k, front: c.v + " · " + c.p + " · " + c.t, sub: c.de, back: c.f, note: c.all, say: c.f };
    return { k: k, front: c.de || c.wrong || "", korr: !c.de, back: c.es, note: c.note || "", say: c.es };   // chat
  }
  function antworten(ok) {
    var s = ui.ses, item = s.q[0]; if (!item) return;
    var id = item.id;
    L.buchen(state, { id: id, k: modoVon(id), ok: ok, neu: !!item.neu && !item.gezaehlt, now: new Date(), ms: Date.now() - s.t0 });
    s.q.shift(); s.done++;
    if (!ok) { s.q.splice(Math.min(2, s.q.length), 0, { id: id, otra: true, gezaehlt: true }); s.total++; s.otra++; }   // kommt nach 2 anderen Karten wieder
    s.shown = false; s.res = null; s.typed = ""; s.t0 = Date.now();
    save(); render(); autoSprechen();
  }
  function intervall(ms) {
    var min = Math.round(ms / 60000), tg = Math.round(ms / 864e5);
    if (min < 60 * 20) return t("enMin", { n: Math.max(1, min) });
    if (tg <= 1) return t("manana");
    if (tg < 60) return t("enDias", { n: tg });
    return t("enMeses", { n: Math.round(tg / 30) });
  }

  /* ================= Sprechen (Web Speech API, es-MX) ================= */
  var STIMME = null;
  function stimme() {
    if (STIMME || !window.speechSynthesis) return STIMME;
    var v = speechSynthesis.getVoices();
    STIMME = ["es-MX", "es-US", "es-419"].map(function (l) { return v.filter(function (x) { return x.lang.replace("_", "-") === l; })[0]; }).filter(Boolean)[0] || v.filter(function (x) { return /^es/.test(x.lang); })[0] || null;
    return STIMME;
  }
  if (window.speechSynthesis) speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", function () { STIMME = null; stimme(); });
  function sprechen(text) {
    try {
      if (!window.speechSynthesis || !text) return;
      var u = new SpeechSynthesisUtterance(text.replace("____", "…")); u.lang = (stimme() && stimme().lang) || "es-MX"; if (stimme()) u.voice = stimme(); u.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }
  function autoSprechen() { var it = aktuell(); if (it && modoVon(it.id) === "num") sprechen(frage(it).say); }

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
    var prompt = f.k === "chat" && f.korr ? "pCorrige" : m.prompt;
    var kartenKopf = '<div class="row mitte"><div class="row mitte" style="gap:var(--s2)"><span class="small muted"' + alt(prompt) + ">" + tx(prompt) + "</span>" + (item.otra ? '<span class="marke">otra vez</span>' : "") + "</div>" +
      '<button class="iconbtn rund" data-act="hablar" aria-label="' + tx("escuchar") + '">' + ICON.laut + "</button></div>";
    if (m.art === "choice") {
      body = '<button class="hoeren" data-act="hablar">' + ICON.lautGross + "<span>" + tx("escuchar") + "</span></button>" +
        '<div class="optionen">' + f.options.map(function (o) {
          var cls = s.res ? (o === f.ok ? "opt richtig" : s.res.pick === o ? "opt falsch" : "opt") : "opt";
          return '<button class="' + cls + ' num" data-act="pick" data-o="' + esc(o) + '"' + (s.res ? " disabled" : "") + ">" + esc(o) + "</button>";
        }).join("") + "</div>";
    } else {
      body = '<div class="front" lang="' + (f.k === "chat" && !f.korr ? "de" : "es") + '">' + esc(f.front) + "</div>" + (f.sub ? '<div class="small muted">' + esc(f.sub) + "</div>" : "");
      if (m.art === "typed") body += '<label class="field">' + tx("tuRespuesta") + '<input id="f-resp" lang="es" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"' + (s.res ? " disabled" : "") + ' value="' + esc(s.typed) + '"></label>';
    }
    if (s.shown || s.res) {
      body += '<hr class="trenn">' + (s.res ? '<div class="' + (s.res.ok ? "ok-t" : "neg-t") + '">' + tx(s.res.ok ? "correcto" : "casi") + "</div>" : "") +
        '<div class="back" lang="' + (f.k === "vocab" ? "de" : "es") + '">' + esc(f.back) + "</div>" +
        (f.voll ? '<div class="small">' + esc(f.voll) + "</div>" : "") +
        (s.res && s.res.akzent ? '<div class="small neg">' + tx("acento", { f: f.back }) + "</div>" : "") +
        (f.note ? '<div class="small muted">' + esc(f.note) + "</div>" : "");
    }
    if (m.art === "flip" && !s.shown) aktion = '<button class="btn" data-act="mostrar"' + alt("mostrar") + ">" + tx("mostrar") + "</button>";
    if (m.art === "flip" && s.shown) aktion = '<div class="bewerten"><button class="rate otra" data-act="otra"' + alt("otraVez") + "><b>" + tx("otraVez") + "</b><span>" + tx("vuelveHoy") + '</span></button><button class="rate lose" data-act="lose"' + alt("loSe") + "><b>" + tx("loSe") + "</b><span>" + esc(intervall(L.preview(state.k[item.id], new Date()))) + "</span></button></div>";
    if (m.art === "typed" && !s.res) aktion = '<button class="btn primary" data-act="comprobar"' + alt("comprobar") + ">" + tx("comprobar") + "</button>";
    if (m.art !== "flip" && s.res) aktion = '<button class="btn" data-act="weiter"' + alt("siguiente") + ">" + tx("siguiente") + "</button>";
    return kopf + '<section class="card lernkarte">' + kartenKopf + '<div class="inhalt">' + body + "</div></section>" + aktion;
  }
  function viewStats() {
    var ret = retencion(), dom = MODOS.reduce(function (s, m) { return s + kategorie(m.k).dom; }, 0), w = wochen(), max = Math.max.apply(null, w.map(function (x) { return x.n; }).concat([1]));
    var tiles = [[String(racha()), "kRacha"], [pct(ret.a, ret.b), "kRet"], [String(dom), "kDom"], [t("nivelTxt", { n: nivel() }), "kNivel"]];
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
      w.map(function (x, j) { return '<div><span class="xs num">' + (x.n ? (x.n < 0 ? "−" + -x.n : x.n) : "") + '</span><i' + (j === 7 ? ' class="jetzt"' : "") + ' style="height:' + Math.round(Math.max(x.n, 0) / max * 80) + 'px"></i>' + (I.lang === "es" ? "S" : "KW") + x.kw + "</div>"; }).join("") + "</div></section>" +
      // Erklärungen bleiben Deutsch (Bauplan 2)
      '<div class="info">Gelernt (dominada) = nächste Wiederholung erst in 21+ Tagen. „Otra vez“ setzt eine Karte auf aprendiendo zurück. Retención = Anteil der fälligen Wiederholungen der letzten 30 Tage, die du gewusst hast (ohne neue Karten und ohne das Wiederholen nach „Otra vez“ – Ziel ist ca. 90 %). Gelernt pro Woche = Zuwachs minus vergessene Karten. Niveau = grobe Schätzung aus den gelernten Vokabeln (500 → A2, 1.500 → B1).</div>';
  }
  function viewErrores() {
    var liste = state.errores.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    return head("tusErrores", null) + '<p class="small muted unter-h1"' + alt("erroresSub") + ">" + tx("erroresSub") + "</p>" +
      (liste.length ? liste.map(function (e) {
        var d = e.fecha ? new Date(e.fecha) : null;
        return '<section class="card klein fehler"><div class="neg falsch-t" lang="es">' + esc(e.wrong || "") + '</div><div class="richtig-t" lang="es">' + esc(e.es) + '</div><div class="small muted">' + esc(e.note || "") + (d && !isNaN(d) ? " · " + esc(d.toLocaleDateString(I.locale(), { weekday: "short", day: "numeric", month: "numeric" })) : "") + "</div></section>";
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
      [["es", "Español"], ["de", "Deutsch"]].map(function (l) { return '<button class="' + (I.lang === l[0] ? "on" : "") + '" data-act="lang" data-l="' + l[0] + '">' + l[1] + "</button>"; }).join("") +
      '</div><p class="xs muted">' + tx("idiomaHint") + "</p></div>" +
      '<div class="feld"><span class="lab"' + alt("apariencia") + ">" + tx("apariencia") + '</span><div class="seg">' +
      [["system", "auto"], ["hell", "claro"], ["dunkel", "oscuro"]].map(function (m) { return '<button class="' + (mode === m[0] ? "on" : "") + '" data-act="mode" data-m="' + m[0] + '"' + alt(m[1]) + ">" + tx(m[1]) + "</button>"; }).join("") + "</div></div>" +
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
  function pruefen() {
    var s = ui.ses, inp = document.getElementById("f-resp"), f = frage(s.q[0]);
    s.typed = inp ? inp.value : s.typed;
    var r = L.pruefe(s.typed, f.back); s.res = { ok: r.ok, akzent: r.akzent }; s.shown = true; render();
  }
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
    if (a === "mostrar") { s.shown = true; render(); if (modoVon(s.q[0].id) !== "vocab") sprechen(frage(s.q[0]).say); return; }
    if (a === "otra") { antworten(false); return; }
    if (a === "lose") { antworten(true); return; }
    if (a === "comprobar") { pruefen(); return; }
    if (a === "pick") { if (s.res) return; var f = frage(s.q[0]); s.res = { ok: d.o === f.ok, pick: d.o }; s.shown = true; render(); return; }
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
  document.addEventListener("input", function (ev) { if (ev.target.id === "f-resp" && ui.ses) ui.ses.typed = ev.target.value; });
  document.addEventListener("change", function (ev) {
    if (ev.target.id === "f-server") { syncCfg.server = ev.target.value.trim().replace(/\/+$/, ""); syncSaveCfg(); }
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && ui.modal && ui.modal.type !== "konflikt") { ui.modal = null; render(); }
    if (ev.key === "Enter" && ev.target.id === "f-resp" && ui.ses && !ui.ses.res) { ev.preventDefault(); pruefen(); }
  });

  render();
  deckLaden();
  setTimeout(function () { syncPull(); inboxHolen(); }, 400);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { syncPull(); if (!ui.ses) render(); } });
  setInterval(function () { if (!document.hidden) syncPull(); }, 120000);
  window.__espanol = { state: function () { return state; }, deck: DECK };   // nur für den Klick-Test (lesend)
})();
