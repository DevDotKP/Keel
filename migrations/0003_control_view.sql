-- 0003: The control view.
-- Subcategories (one level), committed/flexible buckets, per-category daily
-- reserves, and obligations (recurring lumpy commitments like rent/bills).
-- These power "Safe to spend" = remaining - unpaid obligations - reserved essentials.

-- Subcategory: parent_id NULL = top-level. App enforces a single level of nesting.
ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id);

-- Bucket: committed (essential/obligation) vs flexible (discretionary).
ALTER TABLE categories ADD COLUMN bucket TEXT NOT NULL DEFAULT 'flexible'
  CHECK(bucket IN ('committed','flexible'));

-- Daily reserve in paise: money locked per remaining day for this category.
-- e.g. Food 12000 = Rs 120/day. 0 = no reserve.
ALTER TABLE categories ADD COLUMN daily_reserve_paise INTEGER NOT NULL DEFAULT 0;

-- Obligations: recurring commitments due once per period (rent, electricity, EMI).
CREATE TABLE IF NOT EXISTS obligations (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id       TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  amount_paise  INTEGER NOT NULL,
  category_id   TEXT REFERENCES categories(id),   -- where the payment lands
  cadence       TEXT NOT NULL CHECK(cadence IN ('weekly','fortnightly','monthly')) DEFAULT 'monthly',
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_obligations_user
  ON obligations(user_id) WHERE deleted_at IS NULL;

-- Settlement: marks an obligation paid for a given period, linked to the
-- transaction it created. UNIQUE keeps it idempotent per period.
CREATE TABLE IF NOT EXISTS obligation_settlements (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  obligation_id   TEXT NOT NULL REFERENCES obligations(id),
  period_id       TEXT NOT NULL REFERENCES reconciliation_periods(id),
  transaction_id  TEXT REFERENCES transactions(id),
  settled_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(obligation_id, period_id)
);
