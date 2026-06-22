-- Portfolio: opt-in, privacy-first, manual values only. Hidden unless enabled.
-- Standalone: never feeds safe-to-spend or runway.
ALTER TABLE settings ADD COLUMN show_portfolio INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS holdings (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  household_id  TEXT NOT NULL REFERENCES households(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'other'
                  CHECK(kind IN ('mutual_fund','stock','fd_rd','ppf_epf','gold','crypto','real_estate','cash','other')),
  value_paise   INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_holdings_household
  ON holdings(household_id)
  WHERE deleted_at IS NULL;

-- One total snapshot per day, for the value-over-time trend.
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  household_id  TEXT NOT NULL REFERENCES households(id),
  snapshot_date TEXT NOT NULL, -- 'YYYY-MM-DD' (IST)
  total_paise   INTEGER NOT NULL,
  PRIMARY KEY (household_id, snapshot_date)
);
