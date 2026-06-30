-- Expand frequency options for recurring_income and recurring_expenses to include
-- bi_monthly and half_yearly. Also make anchor_kind nullable on recurring_income
-- (frequency-based items don't use it). SQLite doesn't support ALTER COLUMN so
-- we recreate both tables.

PRAGMA foreign_keys=OFF;

-- ── recurring_income ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_income_v2 (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id      TEXT NOT NULL REFERENCES households(id),
  user_id           TEXT NOT NULL REFERENCES users(id),
  name              TEXT NOT NULL,
  amount_paise      INTEGER NOT NULL,
  anchor_kind       TEXT DEFAULT 'end_of_month'
                      CHECK(anchor_kind IN ('end_of_month','start_of_month','day_of_month')),
  anchor_day        INTEGER,
  category_id       TEXT REFERENCES categories(id),
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT,
  frequency         TEXT DEFAULT 'monthly'
                      CHECK(frequency IN ('daily','weekly','bi_weekly','monthly','bi_monthly','quarterly','half_yearly','yearly')),
  start_date        TEXT,
  end_date          TEXT,
  occurrence_limit  INTEGER,
  last_posted_at    TEXT,
  next_due_at       TEXT DEFAULT '2099-12-31T00:00:00Z'
);

INSERT INTO recurring_income_v2 SELECT * FROM recurring_income;
DROP TABLE recurring_income;
ALTER TABLE recurring_income_v2 RENAME TO recurring_income;

CREATE INDEX IF NOT EXISTS idx_recurring_income_household
  ON recurring_income(household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_income_next_due
  ON recurring_income(household_id, next_due_at)
  WHERE deleted_at IS NULL AND is_active = 1;

-- ── recurring_expenses ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_expenses_v2 (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id      TEXT NOT NULL REFERENCES households(id),
  user_id           TEXT NOT NULL REFERENCES users(id),
  account_id        TEXT NOT NULL REFERENCES accounts(id),
  name              TEXT NOT NULL,
  amount_paise      INTEGER NOT NULL,
  category_id       TEXT NOT NULL REFERENCES categories(id),
  frequency         TEXT DEFAULT 'monthly'
                      CHECK(frequency IN ('daily','weekly','bi_weekly','monthly','bi_monthly','quarterly','half_yearly','yearly')),
  start_date        TEXT,
  end_date          TEXT,
  occurrence_limit  INTEGER,
  last_posted_at    TEXT,
  next_due_at       TEXT DEFAULT '2099-12-31T00:00:00Z',
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);

INSERT INTO recurring_expenses_v2 SELECT * FROM recurring_expenses;
DROP TABLE recurring_expenses;
ALTER TABLE recurring_expenses_v2 RENAME TO recurring_expenses;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_household
  ON recurring_expenses(household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due
  ON recurring_expenses(household_id, next_due_at)
  WHERE deleted_at IS NULL AND is_active = 1;

PRAGMA foreign_keys=ON;
