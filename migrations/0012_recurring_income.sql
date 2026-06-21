-- Recurring income (salary and other expected income), household-scoped.
-- Forecast only: Keel anticipates these within a cycle but never auto-posts a
-- transaction. The user confirms real income at Harbour. The pay date is the
-- anchor adjusted for weekends and bank holidays by the working-day engine.
CREATE TABLE IF NOT EXISTS recurring_income (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id  TEXT NOT NULL REFERENCES households(id),
  user_id       TEXT NOT NULL REFERENCES users(id),  -- who added it
  name          TEXT NOT NULL,
  amount_paise  INTEGER NOT NULL,
  anchor_kind   TEXT NOT NULL DEFAULT 'end_of_month'
                  CHECK(anchor_kind IN ('end_of_month','start_of_month','day_of_month')),
  anchor_day    INTEGER,  -- 1..28 when anchor_kind = 'day_of_month', else NULL
  category_id   TEXT REFERENCES categories(id),  -- optional income category
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_recurring_income_household
  ON recurring_income(household_id)
  WHERE deleted_at IS NULL;
