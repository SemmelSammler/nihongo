/* Texte der Oberfläche: Spanisch (Standard) und Deutsch.
   Lerninhalte (Karten, Erklärungen) stehen NICHT hier und wechseln beim Umschalter nicht die Sprache.
   Platzhalter in geschweiften Klammern: {n}, {app} …  Jeder Schlüssel muss in beiden Sprachen da sein (prüft test/check.cjs). */
(function (root) {
  "use strict";
  var TEXTE = {
    es: {
      // Tabs
      tabHoy: "Hoy", tabAprender: "Aprender", tabStats: "Estadística", tabErrores: "Errores",
      // Hoy
      saludoManana: "Buenos días", saludoTarde: "Buenas tardes", saludoNoche: "Buenas noches",
      hoy: "Hoy", aprox: "aprox. {n} min", tarjetas: "tarjetas", split: "{r} repasos · {n} nuevas",
      empezar: "Empezar", racha: "Racha: {n} días", estaSemana: "esta semana", dias: "L M M J V S D",
      // Aprender
      nuevasPorDia: "Nuevas por día", hoyAprox: "hoy aprox. {n} min", menosNuevas: "Menos tarjetas nuevas", masNuevas: "Más tarjetas nuevas",
      nuevasHint: "Más nuevas hoy = más repasos en las próximas semanas.", queQuieres: "¿Qué quieres practicar?",
      pronto: "Llega en la próxima versión.",
      tudecides: "tú decides", solo: "se corrige solo",
      modoVocab: "Vocabulario", comoVocab: "palabra ↔ palabra, como Anki",
      modoFrases: "Frases", comoFrases: "completar huecos, aprender del contexto",
      modoGram: "Gramática", comoGram: "conjugar verbos",
      modoNum: "Números y horas", comoNum: "escuchar y elegir: precios, horas, fechas",
      modoChat: "Del chat", comoChat: "tus errores del coach",
      // Estadística
      kRacha: "días de racha", kRet: "retención (30 días)", kDom: "tarjetas dominadas", kNivel: "nivel estimado",
      porCategoria: "Por categoría", retencion: "{p} retención", sinDatos: "sin datos",
      catTxt: "{d} dominadas · {a} aprendiendo · {n} nuevas", numTxt: "{d} dominadas · {a} aprendiendo · ilimitadas (se generan solas)",
      dominadas: "dominadas", aprendiendo: "aprendiendo", nuevas: "nuevas", porSemana: "Dominadas por semana",
      // Errores
      tusErrores: "Tus errores", erroresSub: "Del coach · cada error se vuelve tarjeta",
      erroresVacio: "Aún no hay errores. Aparecen aquí cuando el coach los envía.",
      // Ajustes
      ajustes: "Ajustes", cerrar: "Cerrar", idioma: "Idioma", idiomaHint: "Mantén pulsado un botón o un título para ver la traducción.",
      apariencia: "Apariencia", auto: "Auto", claro: "Claro", oscuro: "Oscuro",
      sincro: "Sincronizar dispositivos", sincroIntro: "Sincroniza tu progreso cifrado entre el móvil y la computadora. Solo quien tiene la clave puede leerlo.",
      configurar: "Configurar", conectarClave: "Conectar con clave", ultimaSincro: "Última sincronización: {t}", nuncaSincro: "Aún no sincronizado.",
      error: "Error: {e}", sincroAhora: "Sincronizar ahora", mostrarClave: "Mostrar clave", ocultarClave: "Ocultar clave", desconectar: "Desconectar", servidor: "Servidor",
      copia: "Copia de seguridad", copiaHint: "Tus datos están en este dispositivo. Una copia es un archivo que guardas en un lugar seguro.",
      guardarCopia: "Guardar copia", cargarCopia: "Cargar copia", noGuardado: "No se pudo guardar: {e}",
      // Ventanas
      bienvenida: "Bienvenido a {app}", bienvenidaTxt: "¿Ya usas la app en otro dispositivo? Conéctate con tu clave.", vamos: "¡Vamos!",
      conectarTxt: "La clave está en el otro dispositivo, en Ajustes → Sincronizar.", clave: "Clave", conectar: "Conectar", cancelar: "Cancelar",
      conflicto: "Dos versiones distintas", conflictoTxt: "También hubo cambios en otro dispositivo. ¿Qué versión vale?",
      conflictoDort: "La del otro dispositivo", conflictoHier: "Mantener la mía",
      // Avisos
      tConfigurado: "Configurado. ¡Guarda bien la clave!", tConectadoDatos: "Conectado. Tus datos están aquí.", tConectado: "Conectado.",
      tAlDia: "Todo al día.", tNuevaVersion: "Nueva versión cargada.", tSincro: "Sincronización: {e}", tDesconectado: "Sincronización terminada en este dispositivo.",
      tServidor: "Escribe la dirección del servidor.", tClave: "La clave tiene 20 caracteres, p. ej. ABCD-EFGH-…", tOtraVersion: "Versión del otro dispositivo cargada.",
      tCopiaGuardada: "Copia guardada.", tCopiaDescarga: "Guardando copia (carpeta Descargas).", tCopiaCargada: "Copia cargada.",
      tNoCargada: "No se cargó: {e}", tNoEsCopia: "Esto no es una copia de esta app.", tNoGuardada: "No se guardó: {e}",
      // Sesión
      terminar: "Terminar", posDe: "{m} · {p} de {t}", mixto: "Hoy", mostrar: "Mostrar respuesta", comprobar: "Comprobar", siguiente: "Siguiente",
      otraVez: "Otra vez", vuelveHoy: "vuelve hoy", loSe: "Lo sé", enMin: "en {n} min", manana: "mañana", enDias: "en {n} días", enMeses: "en {n} meses",
      correcto: "✓ Correcto", casi: "✗ Casi – correcto es:", acento: "Ojo con el acento: {f}", tuRespuesta: "Tu respuesta", escuchar: "Escuchar",
      pQue: "¿Qué significa?", pCompleta: "Completa la frase", pEscribe: "Escribe la forma correcta", pEscucha: "Escucha y elige", pComo: "¿Cómo se dice?", pCorrige: "Corrige la frase",
      listo: "¡Listo!", listoTxt: "{m} terminado. {n} tarjetas volvieron con „Otra vez“.", seguir: "Seguir: +10 nuevas", otroModo: "Elegir otro modo", volver: "Volver",
      nadaHoy: "Nada pendiente por ahora. ¡Buen trabajo!", cargando: "Cargando tarjetas…", sinDeck: "No se pudieron cargar las tarjetas. Revisa la conexión.",
      // Estadística (cálculo)
      nivelTxt: "~{n}", estimacion: "estimación",
      // Ajustes: buzón, importar, licencias
      buzon: "Buzón del coach", buzonTxt: "Errores y palabras nuevas del proyecto „Español“ llegan aquí. Pega el token una vez.", token: "Token",
      guardar: "Guardar", buscarAhora: "Buscar ahora", importar: "Importar", importarTxt: "Si el coach te da un bloque JSON, pégalo aquí.",
      licencias: "Licencias y fuentes", tGuardado: "Guardado.", tNuevos: "{n} nuevos del coach.", tNadaNuevo: "Nada nuevo del coach.", tJsonMalo: "No es un JSON válido.",
      tBuzon: "Buzón: {e}"
    },
    de: {
      tabHoy: "Heute", tabAprender: "Lernen", tabStats: "Statistik", tabErrores: "Fehler",
      saludoManana: "Guten Morgen", saludoTarde: "Guten Tag", saludoNoche: "Guten Abend",
      hoy: "Heute", aprox: "ca. {n} Min.", tarjetas: "Karten", split: "{r} fällig · {n} neu",
      empezar: "Starten", racha: "Serie: {n} Tage", estaSemana: "diese Woche", dias: "M D M D F S S",
      nuevasPorDia: "Neue pro Tag", hoyAprox: "heute ca. {n} Min.", menosNuevas: "Weniger neue Karten", masNuevas: "Mehr neue Karten",
      nuevasHint: "Mehr neue heute = deutlich mehr Wiederholungen in den Folgewochen.", queQuieres: "Was möchtest du üben?",
      pronto: "Kommt in der nächsten Version.",
      tudecides: "du entscheidest", solo: "wird automatisch geprüft",
      modoVocab: "Vokabeln", comoVocab: "Wort ↔ Wort, wie Anki",
      modoFrases: "Sätze", comoFrases: "Lücken füllen, aus dem Zusammenhang lernen",
      modoGram: "Grammatik", comoGram: "Verben konjugieren",
      modoNum: "Zahlen & Uhrzeiten", comoNum: "hören und wählen: Preise, Uhrzeiten, Daten",
      modoChat: "Aus dem Chat", comoChat: "deine Fehler aus dem Coach",
      kRacha: "Tage Serie", kRet: "Behalten (30 Tage)", kDom: "gelernte Karten", kNivel: "geschätztes Niveau",
      porCategoria: "Nach Kategorie", retencion: "{p} behalten", sinDatos: "keine Daten",
      catTxt: "{d} gelernt · {a} am Lernen · {n} neu", numTxt: "{d} gelernt · {a} am Lernen · unbegrenzt (werden erzeugt)",
      dominadas: "gelernt", aprendiendo: "am Lernen", nuevas: "neu", porSemana: "Gelernt pro Woche",
      tusErrores: "Deine Fehler", erroresSub: "Aus dem Coach · jeder Fehler wird zur Karte",
      erroresVacio: "Noch keine Fehler. Sie erscheinen hier, sobald der Coach sie schickt.",
      ajustes: "Einstellungen", cerrar: "Schließen", idioma: "Sprache", idiomaHint: "Halte einen Knopf oder eine Überschrift gedrückt, um die Übersetzung zu sehen.",
      apariencia: "Darstellung", auto: "Auto", claro: "Hell", oscuro: "Dunkel",
      sincro: "Abgleich zwischen Geräten", sincroIntro: "Gleiche deinen Fortschritt verschlüsselt zwischen Handy und Computer ab. Nur wer den Schlüssel hat, kann ihn lesen.",
      configurar: "Neu einrichten", conectarClave: "Mit Schlüssel verbinden", ultimaSincro: "Zuletzt abgeglichen: {t}", nuncaSincro: "Noch nicht abgeglichen.",
      error: "Fehler: {e}", sincroAhora: "Jetzt abgleichen", mostrarClave: "Schlüssel zeigen", ocultarClave: "Schlüssel verbergen", desconectar: "Trennen", servidor: "Server",
      copia: "Backup", copiaHint: "Deine Daten liegen auf diesem Gerät. Ein Backup ist eine Datei, die du sicher ablegst.",
      guardarCopia: "Backup speichern", cargarCopia: "Backup laden", noGuardado: "Speichern hat nicht geklappt: {e}",
      bienvenida: "Willkommen bei {app}", bienvenidaTxt: "Schon auf einem anderen Gerät eingerichtet? Dann verbinde dich mit deinem Schlüssel.", vamos: "Los geht’s",
      conectarTxt: "Den Schlüssel findest du auf dem anderen Gerät unter Einstellungen → Abgleich.", clave: "Schlüssel", conectar: "Verbinden", cancelar: "Abbrechen",
      conflicto: "Zwei verschiedene Stände", conflictoTxt: "Auf einem anderen Gerät wurde auch etwas geändert. Welcher Stand soll gelten?",
      conflictoDort: "Stand vom anderen Gerät", conflictoHier: "Meine Version behalten",
      tConfigurado: "Eingerichtet. Schlüssel gut aufbewahren!", tConectadoDatos: "Verbunden. Deine Daten sind da.", tConectado: "Verbunden.",
      tAlDia: "Alles aktuell.", tNuevaVersion: "Neuer Stand geladen.", tSincro: "Abgleich: {e}", tDesconectado: "Abgleich auf diesem Gerät beendet.",
      tServidor: "Bitte die Server-Adresse eintragen.", tClave: "Der Schlüssel hat 20 Zeichen, z. B. ABCD-EFGH-…", tOtraVersion: "Stand vom anderen Gerät übernommen.",
      tCopiaGuardada: "Backup gespeichert.", tCopiaDescarga: "Backup wird gespeichert (Ordner Downloads).", tCopiaCargada: "Backup geladen.",
      tNoCargada: "Nicht geladen: {e}", tNoEsCopia: "Das ist kein Backup dieser App.", tNoGuardada: "Nicht gespeichert: {e}",
      terminar: "Beenden", posDe: "{m} · {p} von {t}", mixto: "Heute", mostrar: "Antwort zeigen", comprobar: "Prüfen", siguiente: "Weiter",
      otraVez: "Nochmal", vuelveHoy: "kommt heute wieder", loSe: "Gewusst", enMin: "in {n} Min.", manana: "morgen", enDias: "in {n} Tagen", enMeses: "in {n} Monaten",
      correcto: "✓ Richtig", casi: "✗ Fast – richtig ist:", acento: "Achte auf den Akzent: {f}", tuRespuesta: "Deine Antwort", escuchar: "Anhören",
      pQue: "Was bedeutet das?", pCompleta: "Ergänze den Satz", pEscribe: "Schreib die richtige Form", pEscucha: "Hör zu und wähle", pComo: "Wie sagt man das?", pCorrige: "Verbessere den Satz",
      listo: "Fertig!", listoTxt: "{m} erledigt. {n} Karten kamen mit „Nochmal“ zurück.", seguir: "Weiter: +10 neue", otroModo: "Anderen Modus wählen", volver: "Zurück",
      nadaHoy: "Gerade nichts fällig. Gut gemacht!", cargando: "Karten werden geladen …", sinDeck: "Die Karten konnten nicht geladen werden. Prüfe die Verbindung.",
      nivelTxt: "~{n}", estimacion: "Schätzung",
      buzon: "Briefkasten vom Coach", buzonTxt: "Fehler und neue Wörter aus dem Projekt „Español“ kommen hier an. Token einmal einfügen.", token: "Token",
      guardar: "Speichern", buscarAhora: "Jetzt abholen", importar: "Importieren", importarTxt: "Wenn der Coach dir einen JSON-Block gibt, hier einfügen.",
      licencias: "Lizenzen und Quellen", tGuardado: "Gespeichert.", tNuevos: "{n} neue vom Coach.", tNadaNuevo: "Nichts Neues vom Coach.", tJsonMalo: "Das ist kein gültiges JSON.",
      tBuzon: "Briefkasten: {e}"
    }
  };
  var SPRACHEN = ["es", "de"];
  var lang = "es";
  function fmt(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); }
  function text(l, key, v) { var d = TEXTE[l] || TEXTE.es; return fmt(d[key] != null ? d[key] : (TEXTE.es[key] != null ? TEXTE.es[key] : key), v); }
  root.I18N = {
    TEXTE: TEXTE, SPRACHEN: SPRACHEN,
    get lang() { return lang; },
    set: function (l) { lang = SPRACHEN.indexOf(l) !== -1 ? l : "es"; },
    other: function () { return lang === "es" ? "de" : "es"; },
    t: function (key, v) { return text(lang, key, v); },
    alt: function (key, v) { return text(lang === "es" ? "de" : "es", key, v); },   // Übersetzung für das Lang-Drücken
    locale: function () { return lang === "es" ? "es-MX" : "de-DE"; }
  };
})(typeof window !== "undefined" ? window : globalThis);
