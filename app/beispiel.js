/* Ausgedachte Beispieldaten zum Ausprobieren. Kommen NUR mit `node build.cjs --demo` in die App, nie in die veröffentlichte Version.
   Echte Daten gehören nie in den Code, sondern nur auf die Geräte (und in Backups außerhalb des Repos). */
window.APP_DEMO = (function () {
  var tage = {}, k = {}, jetzt = Date.now(), T = 864e5;
  for (var i = 1; i <= 40; i++) { var d = new Date(jetzt - i * T), key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (i % 9 === 0) continue; tage[key] = { a: { vocab: [14, 12], frases: [8, 7], gram: [4, 3], num: [3, 3] }, r: { vocab: [9, 8], frases: [5, 4], gram: [2, 2], num: [2, 2] }, n: {}, x: {}, ms: 29 * 15000, c: 29, d: i % 3 }; }
  var demoW = ["de", "que", "no", "ser", "a", "estar", "y", "en", "lo", "tener", "por", "qué", "haber", "hacer", "se", "te", "con", "poder", "para", "mi"];
  demoW.forEach(function (w, i) { k["v:" + w] = [jetzt + (i < 8 ? -T : (i * 3) * T), 30 + i, 5, i < 12 ? 25 : 6, 5, 0, 2, jetzt - 5 * T, 0]; });
  return { version: 1, ajustes: { nuevas: 15 }, k: k, tage: tage, extra: [
    { id: "c:demo-001", src: "demo-001", es: "Estoy cansado.", de: "Ich bin müde.", wrong: "Soy cansado.", note: "Zustand → estar", fecha: "2026-10-31T19:00:00Z" },
    { id: "c:demo-002", src: "demo-002", es: "Me gusta el café.", de: "Ich mag Kaffee.", wrong: "Yo gusto el café.", note: "gustar: „es gefällt mir“", fecha: "2026-10-31T19:00:00Z" }
  ], errores: [
    { id: "demo-001", es: "Estoy cansado.", wrong: "Soy cansado.", note: "Zustand → estar", de: "Ich bin müde.", fecha: "2026-10-31T19:00:00Z" },
    { id: "demo-002", es: "Me gusta el café.", wrong: "Yo gusto el café.", note: "gustar: „es gefällt mir“", de: "Ich mag Kaffee.", fecha: "2026-10-31T19:00:00Z" }
  ] };
})();
