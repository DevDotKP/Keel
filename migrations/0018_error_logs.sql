-- Private, retained error log kept inside our own D1 (no third party, no Sentry).
-- Written by the handleError hook. Stores only the reference id, request route,
-- method, status, and our own server message. Never amounts, email, or
-- transcripts. Powers a "recent errors" view in the owner admin panel later.
CREATE TABLE IF NOT EXISTS error_logs (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  error_id   TEXT NOT NULL,
  method     TEXT,
  route      TEXT,
  status     INTEGER,
  message    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
