-- Add frequency tracking to recurring income. Supports daily, weekly, bi-weekly,
-- monthly, quarterly, yearly. Transactions are auto-created on load via syncRecurringTransactions.
-- Note: D1 doesn't support function defaults, so app code handles setting defaults.
ALTER TABLE recurring_income ADD COLUMN frequency TEXT DEFAULT 'monthly'
  CHECK(frequency IN ('daily','weekly','bi_weekly','monthly','quarterly','yearly'));

ALTER TABLE recurring_income ADD COLUMN start_date TEXT;

-- end_date or occurrence_limit: null = indefinite. User can set one or both.
ALTER TABLE recurring_income ADD COLUMN end_date TEXT;

ALTER TABLE recurring_income ADD COLUMN occurrence_limit INTEGER;

-- Track when this recurrence last created a transaction (ISO datetime).
ALTER TABLE recurring_income ADD COLUMN last_posted_at TEXT;

-- Next scheduled post datetime (ISO). Defaults to far future so existing items don't
-- auto-post on next sync; users must explicitly enable them.
ALTER TABLE recurring_income ADD COLUMN next_due_at TEXT DEFAULT '2099-12-31T00:00:00Z';

-- Recurring expenses: mirror schema for expense recurrences.
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id      TEXT NOT NULL REFERENCES households(id),
  user_id           TEXT NOT NULL REFERENCES users(id),  -- who added it
  account_id        TEXT NOT NULL REFERENCES accounts(id),
  name              TEXT NOT NULL,
  amount_paise      INTEGER NOT NULL,
  category_id       TEXT NOT NULL REFERENCES categories(id),
  frequency         TEXT DEFAULT 'monthly'
                      CHECK(frequency IN ('daily','weekly','bi_weekly','monthly','quarterly','yearly')),
  start_date        TEXT,
  end_date          TEXT,
  occurrence_limit  INTEGER,
  last_posted_at    TEXT,
  next_due_at       TEXT DEFAULT '2099-12-31T00:00:00Z',
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_household
  ON recurring_expenses(household_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_next_due
  ON recurring_expenses(household_id, next_due_at)
  WHERE deleted_at IS NULL AND is_active = 1;

CREATE INDEX IF NOT EXISTS idx_recurring_income_next_due
  ON recurring_income(household_id, next_due_at)
  WHERE deleted_at IS NULL AND is_active = 1;

-- Flag on transactions to mark auto-generated recurring entries.
ALTER TABLE transactions ADD COLUMN is_recurring_sync INTEGER NOT NULL DEFAULT 0
  CHECK(is_recurring_sync IN (0,1));

-- Link transactions to their recurring source (for tracking occurrence count).
-- Set to 'income:id' or 'expense:id' to track which recurrence created this transaction.
ALTER TABLE transactions ADD COLUMN recurring_source TEXT;
