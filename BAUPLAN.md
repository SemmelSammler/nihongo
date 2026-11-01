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

## 4. Lerninhalte (offene Quellen, nichts erfinden)
| Quelle | Wofür | Lizenz |
|---|---|---|
| JMdict (EDRDG) | Wörter, Lesungen, Wortart, Verbklasse, **deutsche Bedeutungen** | CC BY-SA 4.0 |
| KANJIDIC2 (EDRDG) | Kanji, Lesungen, Häufigkeit, Schulstufe | CC BY-SA 4.0 |
| Tatoeba (jpn–deu) + Wort-Indizes | Sätze | CC BY 2.0 FR |
| FrequencyWords (OpenSubtitles) | Reihenfolge nach Häufigkeit | CC BY-SA 4.0 |
| WanaKana | Kana ↔ Romaji | MIT |

## 5. Offene Punkte
- JMdict/KANJIDIC liegen auf `ftp.edrdg.org` → muss unter *Allowed domains* stehen.
- Farbe/Icon: eigenes Icon, damit man Español und Nihongo auf dem Home-Bildschirm unterscheidet (Varianten zeigen).
- Speicher-Schlüssel: `nihongo.daten.v1`, `nihongo.sync` – nach erstem echten Einsatz nie mehr ändern.
