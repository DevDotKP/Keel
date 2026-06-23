-- Release / app-change annotations for the owner admin panel, so metric shifts
-- can be mapped to what changed. Owner-entered only (via /admin).
CREATE TABLE IF NOT EXISTS releases (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  note       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_releases_created_at ON releases(created_at DESC);
