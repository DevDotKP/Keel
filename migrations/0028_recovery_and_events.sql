-- Recovery codes: the only password-reset path while there is no email channel.
-- Hash only (SHA-256), shown to the user exactly once, rotated on every use.
ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;

-- Minimal product events for funnel questions existing tables cannot answer
-- (e.g. opened the settle UI but never settled). Name + user + time only;
-- never amounts, never text. Demo users are excluded at query time.
CREATE TABLE app_events (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_app_events_name_time ON app_events(name, created_at);
