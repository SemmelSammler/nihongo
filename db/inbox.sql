-- Briefkasten Coach → App (Cloudflare D1 „espanol-inbox“, Bindung INBOX_DB). Bauplan Abschnitt 8.
CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,          -- z. B. 2026-11-03-001
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,           -- 'error' | 'vocab' | 'frase'
  es TEXT NOT NULL,             -- richtige spanische Form
  de TEXT,                      -- deutsche Bedeutung / Satz
  wrong TEXT,                   -- bei 'error': was Jason gesagt hat
  note TEXT,                    -- kurzer Grund, z. B. „Zustand → estar“
  fetched_at TEXT
);
CREATE INDEX IF NOT EXISTS inbox_offen ON inbox (fetched_at);
