-- P3: Shared household (joint ledger)
-- Every user gets a personal household (id = user_id for the migration).
-- Shared households are created later via the invite flow.
-- All data that was user_id-scoped is now household_id-scoped.

-- ── Household tables ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS households (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT 'Personal',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_members (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id TEXT NOT NULL REFERENCES households(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  role         TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(household_id, user_id)
);

CREATE TABLE IF NOT EXISTS household_invites (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id TEXT NOT NULL REFERENCES households(id),
  email        TEXT NOT NULL,
  token        TEXT NOT NULL UNIQUE,
  invited_by   TEXT NOT NULL REFERENCES users(id),
  role         TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  expires_at   TEXT NOT NULL,
  accepted_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Create personal households for existing users ─────────────────────────────
-- Use user.id as household.id so a simple SET household_id = user_id works below.
INSERT OR IGNORE INTO households (id, name, created_by)
SELECT id, 'Personal', id FROM users;

INSERT OR IGNORE INTO household_members (household_id, user_id, role)
SELECT id, id, 'admin' FROM users;

-- ── Add household_id to data tables ──────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN household_id TEXT REFERENCES households(id);
UPDATE accounts SET household_id = user_id WHERE household_id IS NULL;

ALTER TABLE categories ADD COLUMN household_id TEXT REFERENCES households(id);
UPDATE categories SET household_id = user_id WHERE household_id IS NULL;

ALTER TABLE obligations ADD COLUMN household_id TEXT REFERENCES households(id);
UPDATE obligations SET household_id = user_id WHERE household_id IS NULL;

-- ── Add entered_by to transactions ───────────────────────────────────────────
ALTER TABLE transactions ADD COLUMN entered_by TEXT REFERENCES users(id);
UPDATE transactions
SET entered_by = (SELECT user_id FROM accounts WHERE id = transactions.account_id)
WHERE entered_by IS NULL;
