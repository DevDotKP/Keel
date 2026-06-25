-- Web Push: store each device's push subscription, scoped per user (a user can
-- have several devices). Plus two per-user opt-in flags so notifications stay
-- something the user chooses, never a default nag.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id);

-- One Harbour reminder per cycle, and partner-activity pings. Both on once the
-- user enables notifications; each independently toggleable in Settings.
ALTER TABLE settings ADD COLUMN notify_harbour INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN notify_partner INTEGER NOT NULL DEFAULT 1;
