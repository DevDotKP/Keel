-- 0005: Optional budgets (soft caps). Opt-in, never blocking, never guilt.
-- 0 means no budget set, so the feature stays invisible until the user wants it.

-- Per-category budget for the cycle (paise). Spending categories only in the UI.
ALTER TABLE categories ADD COLUMN budget_paise INTEGER NOT NULL DEFAULT 0;

-- Overall spending target for the cycle (paise). 0 = no target set.
ALTER TABLE settings ADD COLUMN cycle_budget_paise INTEGER NOT NULL DEFAULT 0;
