-- Keel initial schema
-- All money stored as integer paise (Rs 1 = 100 paise). No floats.
-- All rows are user-scoped. Soft deletes via deleted_at.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email      TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Entitlements ─────────────────────────────────────────────────────────────
-- status: trialing → expired | owned
-- owned is terminal: set once on purchase, never expires, never re-gates.
-- In MVP the BillingProvider is a no-op and everyone is treated as entitled.
CREATE TABLE IF NOT EXISTS entitlements (
  user_id      TEXT PRIMARY KEY REFERENCES users(id),
  status       TEXT NOT NULL CHECK(status IN ('trialing','expired','owned')) DEFAULT 'trialing',
  trial_ends_at TEXT,
  purchased_at  TEXT,
  provider      TEXT,   -- 'local' in MVP, 'razorpay' when payments land
  provider_ref  TEXT    -- order/payment ID from the provider
);

-- ── Settings ─────────────────────────────────────────────────────────────────
-- Created with defaults at onboarding; one row per user.
CREATE TABLE IF NOT EXISTS settings (
  user_id            TEXT PRIMARY KEY REFERENCES users(id),
  harbour_cadence    TEXT NOT NULL CHECK(harbour_cadence IN ('weekly','fortnightly','monthly')) DEFAULT 'weekly',
  harbour_day        TEXT NOT NULL DEFAULT 'sunday',  -- e.g. 'sunday', 'payday'
  harbour_notify_at  TEXT NOT NULL DEFAULT '20:00'    -- HH:MM local time
);

-- ── Accounts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id       TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'INR',
  balance_paise INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

-- ── Categories ───────────────────────────────────────────────────────────────
-- is_system = 1 rows (Uncategorized, Income) cannot be deleted.
-- name must be unique per user among non-deleted rows.
CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id    TEXT NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  is_system  INTEGER NOT NULL DEFAULT 0 CHECK(is_system IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE UNIQUE INDEX idx_categories_name_user
  ON categories(user_id, name)
  WHERE deleted_at IS NULL;

-- ── Reconciliation Periods ───────────────────────────────────────────────────
-- One row per billing period per account.
-- closing_balance_paise and harboured_at are NULL until the period is harboured.
-- fresh-start: multiple open periods can be sealed in one harbourPeriod call.
CREATE TABLE IF NOT EXISTS reconciliation_periods (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id             TEXT NOT NULL REFERENCES accounts(id),
  period_start           TEXT NOT NULL,  -- ISO date 'YYYY-MM-DD'
  period_end             TEXT NOT NULL,  -- ISO date 'YYYY-MM-DD'
  cadence                TEXT NOT NULL CHECK(cadence IN ('weekly','fortnightly','monthly')),
  opening_balance_paise  INTEGER NOT NULL,
  closing_balance_paise  INTEGER,        -- NULL until harboured
  harboured_at           TEXT,           -- NULL until harboured

  UNIQUE(account_id, period_start)
);

-- ── Transactions ─────────────────────────────────────────────────────────────
-- amount_paise: negative = expense, positive = income.
-- period_id NULL means unassigned (will be swept at harbour).
-- is_uncategorized_fallback = 1 means it was auto-assigned to Uncategorized
--   by the harbour sweep (user never explicitly chose Uncategorized).
CREATE TABLE IF NOT EXISTS transactions (
  id                        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  account_id                TEXT NOT NULL REFERENCES accounts(id),
  category_id               TEXT NOT NULL REFERENCES categories(id),
  period_id                 TEXT REFERENCES reconciliation_periods(id),
  amount_paise              INTEGER NOT NULL,
  description               TEXT NOT NULL DEFAULT '',
  occurred_at               TEXT NOT NULL,  -- ISO datetime, user-supplied
  entered_at                TEXT NOT NULL DEFAULT (datetime('now')),
  source                    TEXT NOT NULL CHECK(source IN ('tap','voice')) DEFAULT 'tap',
  is_uncategorized_fallback INTEGER NOT NULL DEFAULT 0 CHECK(is_uncategorized_fallback IN (0,1)),
  deleted_at                TEXT
);

CREATE INDEX idx_transactions_account_occurred
  ON transactions(account_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_transactions_period
  ON transactions(period_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_transactions_category
  ON transactions(category_id)
  WHERE deleted_at IS NULL;

-- ── Voice Samples ─────────────────────────────────────────────────────────────
-- Labeled training corpus; accumulated on every voice confirm/correction.
-- Privacy-minimal: no account balances stored here.
-- User can opt out or purge via settings.
CREATE TABLE IF NOT EXISTS voice_samples (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id        TEXT NOT NULL REFERENCES users(id),
  raw_transcript TEXT NOT NULL,   -- what the user said
  parsed_json    TEXT NOT NULL,   -- JSON: anchor engine's parse output
  final_json     TEXT NOT NULL,   -- JSON: what the user confirmed/corrected
  was_corrected  INTEGER NOT NULL DEFAULT 0 CHECK(was_corrected IN (0,1)),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
