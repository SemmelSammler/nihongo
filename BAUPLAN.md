# Bauplan: Nihongo (Japanisch-Lern-App)

Stand: 1. November 2026. Abgeleitet aus der Spanisch-App **Español** (Repo `SemmelSammler/espanol`, dort `BAUPLAN.md`).
Alles, was hier nicht anders steht, gilt wie bei Español: Gestaltung (Prototyp D), Hell/Dunkel, Notch-Regeln, Lang-Drücken,
Lernverfahren FSRS (90 %), 2 Knöpfe („Nochmal“ / „Gewusst“), Statistik-Definitionen, Abgleich, Briefkasten, Import.

## 1. Ziel
Japanisch für **Reise und Alltag**, ca. 15 Minuten pro Tag. Am Anfang vor allem Hiragana und Katakana, später Kanji.

## 2. Feste Entscheidungen
| Thema | Entscheidung |
|---|---|
| Oberfläche | **Standard Deutsch**, Umschalter **DE / JA**, Lang-Drücken zeigt die andere Sprache (auf DE also die japanische Beschriftung) |
| Schrift | Alles lernbar: Kana, Kanji, Lateinschrift nur als Hilfe. Anzeige der Vokabeln umschaltbar: **Kana** / **Kanji mit Furigana** / **Romaji-Hilfe an/aus** |
| Erklärungen | Deutsch |
| Vorlesen | Web Speech API, `ja-JP`, Tempo ≈ 0,9 |
| Eintippen | Nicht nötig: Japanisch-Tastatur am Handy ist mühsam → überall **antippen** (4 Antworten) oder **aufdecken** |

## 3. Lernmodi
| Modus | Abfrage | Prüfung |
|---|---|---|
| **Kana** | Zeichen → Laut wählen und Laut (gesprochen) → Zeichen wählen. Erst Hiragana, dann Katakana, dann Dakuten/Kombinationen | automatisch |
| **Vokabeln** | Japanisch → Deutsch aufdecken (Anzeige nach Einstellung) | selbst |
| **Sätze** | Lückensatz (Tatoeba), Lesung + Deutsch beim Aufdecken | selbst |
| **Kanji** | Wird freigeschaltet, wenn die Kana sitzen (z. B. 80 % dominadas). Kanji → Bedeutung + Lesung + Beispielwort | selbst |
| **Grammatik** | Verbform wählen (-masu, -masen, -mashita, te-Form, Wörterbuchform, -nai, -ta) aus 4 Antworten | automatisch |
| **Zahlen & Zeit** | Hören und wählen: Zahlen, Yen-Preise, Uhrzeiten, Daten, Zählwörter | automatisch |
| **Aus dem Chat** | Fehler/Wörter vom Coach (Briefkasten), wie bei Español | selbst |

## 3b. Kana-Trainer (eigener Bereich im Tab „Lernen“, je Hiragana und Katakana)
Nicht wie Karteikarten, sondern Lektionen Reihe für Reihe (あ, か, さ …, dann ゛/゜, dann Kombinationen):
1. **Ansehen**: Zeichen groß, Laut, Strichfolge animiert (KanjiVG), mit dem Finger nachzeichnen. Katakana zeigen das passende Hiragana daneben.
2. **Erkennen**: Zeichen → Laut, neue Reihe doppelt, alte Reihen eingemischt, Verwechsler (さ/ち, シ/ツ) als falsche Antworten.
3. **Hören**: Laut → Zeichen.
4. **Schreiben**: aus dem Kopf zeichnen, dann mit der richtigen Strichfolge vergleichen und selbst bewerten.
5. **Lesen**: echte Wörter, die nur aus schon gelernten Zeichen bestehen.
Fehler kommen zwei Fragen später wieder. „Sicher“ = mindestens 2× richtig in unter 3 Sekunden → dann übernimmt FSRS (Modus Kana) das Wiederholen.
**Tempo-Runde**: 60 Sekunden, alle gelernten Zeichen; Fehler oder > 3 s → Zeichen wieder „in Arbeit“. Tabelle zeigt grau / umrandet / grün.

## 4. Lerninhalte (offene Quellen, nichts erfinden)
| Quelle | Wofür | Lizenz |
|---|---|---|
| JMdict (EDRDG) | Wörter, Lesungen, Wortart, Verbklasse, **deutsche Bedeutungen** | CC BY-SA 4.0 |
| KANJIDIC2 (EDRDG) | Kanji, Lesungen, Häufigkeit, Schulstufe | CC BY-SA 4.0 |
| Tatoeba (jpn–deu) + Wort-Indizes | Sätze | CC BY 2.0 FR |
| FrequencyWords (OpenSubtitles) | Reihenfolge nach Häufigkeit | CC BY-SA 4.0 |
| WanaKana | Kana ↔ Romaji | MIT |
| KanjiVG | Strichfolgen der Kana (Trainer) | CC BY-SA 3.0 |
| Wiktionary (Deutsch) über kaikki.org | prüft, welche deutsche Bedeutung zuerst kommt | CC BY-SA 4.0 |
| kuromoji.js + IPADIC | Häufigkeit im Zusammenhang, Lesungen der Sätze, Prüfung der Verbformen | Apache 2.0 |

Stand Daten (1.11.2026): 4.000 Wörter, ~2.650 Sätze, 60 Verben × 6 Formen, 600 Kanji, 208 Kana. Skript: `node tools/daten/bauen.cjs <rohdaten>`.
Häufigkeit wird in allen japanischen Tatoeba-Sätzen gezählt (nicht aus Einzelwörtern), Verbklasse von kuromoji entscheidet zwischen gleich gelesenen Wörtern (いる = 居る, nicht 要る).

## 5. Offene Punkte
- JMdict/KANJIDIC: von `https://www.edrdg.org/pub/Nihongo/` (Allowed domains: `www.edrdg.org`).
- Farbe/Icon: eigenes Icon, damit man Español und Nihongo auf dem Home-Bildschirm unterscheidet (Varianten zeigen).
- Speicher-Schlüssel: `nihongo.daten.v1`, `nihongo.sync` – nach erstem echten Einsatz nie mehr ändern.

## 6. Cloudflare (angelegt 1.11.2026)
- Pages-Projekt `nihongo` → **https://nihongo-b12.pages.dev** (mit GitHub verbunden, Produktion = `main`; jeder Push auf `main` geht live)
- KV `nihongo-sync` (Bindung `SYNC_KV`), D1 `nihongo-inbox` (ID `434d7b64-d7a8-409e-8b1e-a6b44185e56f`, Bindung `INBOX_DB`, Tabelle aus `db/inbox.sql`), Secret `INBOX_TOKEN`
- Briefkasten-Format wie bei Español: Feld `es` = richtige **japanische** Form, `de` = Deutsch, `wrong` = was Jason gesagt hat, `note` = kurzer deutscher Grund.
