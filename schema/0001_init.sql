-- 字字千金 v2 schema (D1 / SQLite)
-- 用法:
--   wrangler d1 execute zzqj-db --remote --file schema/0001_init.sql
--   wrangler d1 execute zzqj-db --local  --file schema/0001_init.sql

-- 題庫
CREATE TABLE IF NOT EXISTS questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL CHECK(type IN ('jiangcuo','zizhu')),
  difficulty  TEXT NOT NULL CHECK(difficulty IN ('elementary','middle')),
  payload     TEXT NOT NULL,                  -- JSON, 結構依 type
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_q_filter ON questions(type, difficulty, active);

-- 分數
CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname    TEXT NOT NULL,
  type        TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  score       INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  played_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_leaderboard ON scores(type, difficulty, score DESC, played_at);

-- 題目回報
CREATE TABLE IF NOT EXISTS question_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id  INTEGER NOT NULL REFERENCES questions(id),
  reason       TEXT,
  nickname     TEXT,
  ip_hash      TEXT,
  reported_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  status       TEXT NOT NULL DEFAULT 'pending'  -- pending | resolved | dismissed
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON question_reports(status, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_qid    ON question_reports(question_id);
