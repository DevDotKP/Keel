-- Keel demo seed (LOCAL D1 only). Deterministic dataset for marketing capture.
-- Targets the dev preview user so `vite dev` serves it auto-logged-in.
-- Money is integer paise. Run against a freshly migrated local DB.
--
-- Money model (kept internally consistent so derived metrics look real):
--   June opening balance = May closing = account balance = Rs 92,000
--   Monthly income (recurring)        = Rs 95,000 (Akhil 85k + Priya 10k)
--   June spend so far                 ~ Rs 62,477  -> savings rate ~34%
--   Remaining this period             = 92,000 - 62,477 = Rs 29,523
--   Runway (balance / burn)           ~ 38-44 days (clean, not capped)

-- ── Users (a couple: Akhil shares a household with Priya) ──────────────────────
INSERT INTO users (id, email, display_name) VALUES
  ('dev-preview-user', 'akhil@keel.app', 'Akhil'),
  ('seed-priya',     'priya@keel.app', 'Priya');

-- ── Household (personal household id = primary user id, per convention) ────────
INSERT INTO households (id, name, created_by) VALUES
  ('dev-preview-user', 'Home', 'dev-preview-user');
INSERT INTO household_members (household_id, user_id, role) VALUES
  ('dev-preview-user', 'dev-preview-user', 'admin'),
  ('dev-preview-user', 'seed-priya',     'member');

-- ── Settings: monthly cadence, onboarded, portfolio on, realistic budget ──────
INSERT INTO settings
  (user_id, harbour_cadence, harbour_day, harbour_notify_at, cycle_budget_paise,
   show_portfolio, budget_rollover, onboarded, notify_harbour, notify_partner)
VALUES
  ('dev-preview-user', 'monthly', 'sunday', '20:00', 7000000,
   1, 'fresh', 1, 1, 1);

INSERT INTO entitlements (user_id, status, provider) VALUES
  ('dev-preview-user', 'trialing', 'local');

-- ── Account (balance = start-of-June opening, post-salary: Rs 92,000) ─────────
INSERT INTO accounts (id, user_id, household_id, name, currency, balance_paise) VALUES
  ('demo-acct', 'dev-preview-user', 'dev-preview-user', 'Spending', 'INR', 9200000);

-- ── Categories (fixed ids so transactions can reference them) ─────────────────
-- System (undeletable)
INSERT INTO categories (id, user_id, household_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise, budget_paise) VALUES
  ('cat-uncat',  'dev-preview-user', 'dev-preview-user', 'Uncategorized',     '#E0A82E', 1, 0,  'expense', 'flexible', 0,     0),
  ('cat-income', 'dev-preview-user', 'dev-preview-user', 'Income',            '#2F7E72', 1, 1,  'income',  'flexible', 0,     0),
  ('cat-salary', 'dev-preview-user', 'dev-preview-user', 'Salary',            '#2F7E72', 0, 2,  'income',  'flexible', 0,     0),
-- Spending
  ('cat-food',   'dev-preview-user', 'dev-preview-user', 'Food & Dining',     '#C2683C', 0, 10, 'expense', 'flexible', 15000, 800000),
  ('cat-groc',   'dev-preview-user', 'dev-preview-user', 'Groceries',         '#5FA85D', 0, 11, 'expense', 'committed', 0,    800000),
  ('cat-trans',  'dev-preview-user', 'dev-preview-user', 'Transport',         '#1B3A66', 0, 12, 'expense', 'committed', 5000, 0),
  ('cat-bills',  'dev-preview-user', 'dev-preview-user', 'Bills & Utilities', '#7C756A', 0, 13, 'expense', 'committed', 0,    0),
  ('cat-shop',   'dev-preview-user', 'dev-preview-user', 'Shopping',          '#8B6DBF', 0, 14, 'expense', 'flexible', 0,     0),
  ('cat-home',   'dev-preview-user', 'dev-preview-user', 'Home',              '#9C6B4A', 0, 15, 'expense', 'flexible', 0,     0),
  ('cat-garden', 'dev-preview-user', 'dev-preview-user', 'Plants & Garden',   '#4E8B5A', 0, 16, 'expense', 'flexible', 0,     0),
  ('cat-health', 'dev-preview-user', 'dev-preview-user', 'Health',            '#2F7E72', 0, 17, 'expense', 'flexible', 0,     0),
  ('cat-ent',    'dev-preview-user', 'dev-preview-user', 'Entertainment',     '#E07B54', 0, 18, 'expense', 'flexible', 0,     0),
  ('cat-rent',   'dev-preview-user', 'dev-preview-user', 'Rent',              '#374151', 0, 19, 'expense', 'committed', 0,    0),
  ('cat-inv',    'dev-preview-user', 'dev-preview-user', 'Investments',       '#1B5E8B', 0, 20, 'expense', 'committed', 0,    0);

-- ── Prior harboured periods (April, May). Drift shrinks: clearer over time. ────
INSERT INTO reconciliation_periods
  (id, account_id, period_start, period_end, cadence, opening_balance_paise, closing_balance_paise, harboured_at) VALUES
  ('per-apr', 'demo-acct', '2026-04-01', '2026-04-30', 'monthly', 7000000, 8800000, '2026-05-01T09:00:00+05:30'),
  ('per-may', 'demo-acct', '2026-05-01', '2026-05-31', 'monthly', 8800000, 9200000, '2026-06-01T09:00:00+05:30');

-- ── April transactions (assigned to per-apr). Includes a Harbour adjustment. ──
INSERT INTO transactions (account_id, category_id, period_id, amount_paise, description, occurred_at, source, is_uncategorized_fallback) VALUES
  ('demo-acct', 'cat-salary', 'per-apr',  8500000, 'Salary',             '2026-04-01T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-rent',   'per-apr', -1800000, 'Rent',               '2026-04-03T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-inv',    'per-apr', -1000000, 'SIP - Nifty index',  '2026-04-05T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-groc',   'per-apr', -620000,  'Monthly groceries',  '2026-04-08T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-food',   'per-apr', -480000,  'Dining out',         '2026-04-12T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-bills',  'per-apr', -340000,  'Electricity',        '2026-04-18T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-shop',   'per-apr', -410000,  'Clothes',            '2026-04-22T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-trans',  'per-apr', -450000,  'Fuel + cabs',        '2026-04-25T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-uncat',  'per-apr', -300000,  'Cash spends',        '2026-04-28T12:00:00+05:30', 'tap',   1),
  ('demo-acct', 'cat-uncat',  'per-apr', -350000,  'Harbour adjustment', '2026-04-30T23:59:59+05:30', 'tap',   1);

-- ── May transactions (assigned to per-may). Smaller drift = clearer picture. ──
INSERT INTO transactions (account_id, category_id, period_id, amount_paise, description, occurred_at, source, is_uncategorized_fallback) VALUES
  ('demo-acct', 'cat-salary', 'per-may',  8500000, 'Salary',             '2026-05-01T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-rent',   'per-may', -1800000, 'Rent',               '2026-05-03T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-inv',    'per-may', -1000000, 'SIP - Nifty index',  '2026-05-05T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-groc',   'per-may', -640000,  'Monthly groceries',  '2026-05-06T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-health', 'per-may', -300000,  'Doctor visit',       '2026-05-10T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-food',   'per-may', -520000,  'Restaurants',        '2026-05-15T12:00:00+05:30', 'voice', 0),
  ('demo-acct', 'cat-bills',  'per-may', -360000,  'Electricity + water','2026-05-19T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-ent',    'per-may', -180000,  'Movies + OTT',       '2026-05-21T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-trans',  'per-may', -420000,  'Fuel + cabs',        '2026-05-24T12:00:00+05:30', 'tap',   0),
  ('demo-acct', 'cat-uncat',  'per-may', -150000,  'Cash spends',        '2026-05-27T12:00:00+05:30', 'tap',   1),
  ('demo-acct', 'cat-uncat',  'per-may', -150000,  'Harbour adjustment', '2026-05-31T23:59:59+05:30', 'tap',   1);

-- ── Older trend-only transactions (Jan to Mar, unassigned) ────────────────────
INSERT INTO transactions (account_id, category_id, period_id, amount_paise, description, occurred_at, source, is_uncategorized_fallback) VALUES
  ('demo-acct', 'cat-rent',  NULL, -1800000, 'Rent',              '2026-01-03T12:00:00+05:30', 'tap', 0),
  ('demo-acct', 'cat-groc',  NULL, -580000,  'Monthly groceries', '2026-01-08T12:00:00+05:30', 'tap', 0),
  ('demo-acct', 'cat-food',  NULL, -520000,  'Dining out',        '2026-01-15T12:00:00+05:30', 'tap', 0),
  ('demo-acct', 'cat-rent',  NULL, -1800000, 'Rent',              '2026-02-03T12:00:00+05:30', 'tap', 0),
  ('demo-acct', 'cat-groc',  NULL, -610000,  'Monthly groceries', '2026-02-07T12:00:00+05:30', 'tap', 0),
  ('demo-acct', 'cat-shop',  NULL, -350000,  'Clothes',           '2026-02-14T12:00:00+05:30', 'tap', 0),
  ('demo-acct', 'cat-rent',  NULL, -1800000, 'Rent',              '2026-03-03T12:00:00+05:30', 'tap', 0),
  ('demo-acct', 'cat-groc',  NULL, -640000,  'Monthly groceries', '2026-03-09T12:00:00+05:30', 'tap', 0),
  ('demo-acct', 'cat-food',  NULL, -430000,  'Restaurants',       '2026-03-16T12:00:00+05:30', 'tap', 0);

-- ── Current cycle (June, unassigned = forgiving). Mix of voice + tap. ─────────
-- Weighted so the last 7 days carry a fair share (keeps runway honest).
INSERT INTO transactions (account_id, category_id, period_id, amount_paise, description, occurred_at, source, is_uncategorized_fallback, entered_by) VALUES
  ('demo-acct', 'cat-rent',   NULL, -1800000, 'Rent',             '2026-06-03T10:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-inv',    NULL, -1000000, 'SIP - Nifty index','2026-06-05T10:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-food',   NULL, -180000,  'Restaurant dinner','2026-06-06T20:30:00+05:30', 'tap',   0, 'seed-priya'),
  ('demo-acct', 'cat-health', NULL, -500000,  'Health insurance', '2026-06-07T12:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-ent',    NULL, -90000,   'BookMyShow',       '2026-06-09T19:00:00+05:30', 'voice', 0, 'dev-preview-user'),
  ('demo-acct', 'cat-food',   NULL, -78000,   'Dominos',          '2026-06-10T20:15:00+05:30', 'tap',   0, 'seed-priya'),
  ('demo-acct', 'cat-garden', NULL, -60000,   'Nursery plants',   '2026-06-11T12:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-trans',  NULL, -250000,  'Fuel',             '2026-06-12T09:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-uncat',  NULL, -350000,  'Cash spends',      '2026-06-12T18:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-home',   NULL, -120000,  'Cleaning supplies','2026-06-14T12:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-health', NULL, -65000,   'Pharmacy',         '2026-06-15T12:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-ent',    NULL, -64900,   'Netflix',          '2026-06-18T12:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-bills',  NULL, -280000,  'Electricity',      '2026-06-22T12:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-bills',  NULL, -89900,   'Jio recharge',     '2026-06-22T13:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-shop',   NULL, -349900,  'Myntra order',     '2026-06-23T12:00:00+05:30', 'tap',   0, 'seed-priya'),
  ('demo-acct', 'cat-groc',   NULL, -550000,  'BigBasket weekly', '2026-06-24T12:00:00+05:30', 'tap',   0, 'dev-preview-user'),
  ('demo-acct', 'cat-trans',  NULL, -220000,  'Fuel',             '2026-06-25T18:00:00+05:30', 'voice', 0, 'dev-preview-user'),
  ('demo-acct', 'cat-food',   NULL, -26000,   'Chai and snacks',  '2026-06-26T17:00:00+05:30', 'voice', 0, 'dev-preview-user'),
  ('demo-acct', 'cat-trans',  NULL, -12000,   'Auto to office',   '2026-06-27T09:45:00+05:30', 'voice', 0, 'dev-preview-user'),
  ('demo-acct', 'cat-food',   NULL, -52000,   'Swiggy dinner',    '2026-06-27T21:10:00+05:30', 'voice', 0, 'dev-preview-user'),
  ('demo-acct', 'cat-groc',   NULL, -110000,  'Vegetables',       '2026-06-28T10:30:00+05:30', 'voice', 0, 'dev-preview-user');

-- ── Obligations (small, genuinely upcoming this month; rent is logged above) ──
INSERT INTO obligations (user_id, household_id, name, amount_paise, category_id, cadence, is_active) VALUES
  ('dev-preview-user', 'dev-preview-user', 'Internet (ACT)', 119900, 'cat-bills',  'monthly', 1),
  ('dev-preview-user', 'dev-preview-user', 'Mobile postpaid',  99900, 'cat-bills',  'monthly', 1),
  ('dev-preview-user', 'dev-preview-user', 'Gym membership', 200000, 'cat-health', 'monthly', 1);

-- ── Recurring income (expected monthly inflows: Rs 95,000 total) ──────────────
INSERT INTO recurring_income (household_id, user_id, name, amount_paise, anchor_kind, anchor_day, category_id, is_active) VALUES
  ('dev-preview-user', 'dev-preview-user', 'Salary',    8500000, 'day_of_month', 1, 'cat-salary', 1),
  ('dev-preview-user', 'seed-priya',     'Freelance', 1000000, 'end_of_month', NULL, 'cat-salary', 1);

-- ── Portfolio holdings + monthly snapshots (the investments view) ─────────────
INSERT INTO holdings (household_id, user_id, name, kind, value_paise, sort_order) VALUES
  ('dev-preview-user', 'dev-preview-user', 'Nifty 50 Index Fund',    'mutual_fund', 45000000, 0),
  ('dev-preview-user', 'dev-preview-user', 'Parag Parikh Flexi Cap', 'mutual_fund', 28000000, 1),
  ('dev-preview-user', 'dev-preview-user', 'Reliance + HDFC',        'stock',       12000000, 2),
  ('dev-preview-user', 'dev-preview-user', 'PPF',                    'ppf_epf',     32000000, 3),
  ('dev-preview-user', 'dev-preview-user', 'SBI Fixed Deposit',      'fd_rd',       20000000, 4),
  ('dev-preview-user', 'dev-preview-user', 'Digital Gold',           'gold',         8500000, 5),
  ('dev-preview-user', 'dev-preview-user', 'Emergency Fund',         'cash',        15000000, 6);

-- Clear upward slope so the over-time chart reads as growth, not a flat line.
INSERT INTO portfolio_snapshots (household_id, snapshot_date, total_paise) VALUES
  ('dev-preview-user', '2026-01-31', 120000000),
  ('dev-preview-user', '2026-02-28', 128000000),
  ('dev-preview-user', '2026-03-31', 134000000),
  ('dev-preview-user', '2026-04-30', 142000000),
  ('dev-preview-user', '2026-05-31', 151000000),
  ('dev-preview-user', '2026-06-28', 160500000);

-- ── Voice samples (the correction flywheel; not user-facing) ──────────────────
INSERT INTO voice_samples (user_id, raw_transcript, parsed_json, final_json, was_corrected) VALUES
  ('dev-preview-user', 'auto to office twelve rupees',
   '{"amount_paise":-1200,"category":"Transport","description":"Auto to office"}',
   '{"amount_paise":-1200,"category":"Transport","description":"Auto to office"}', 0),
  ('dev-preview-user', 'swiggy se dinner five twenty',
   '{"amount_paise":-52000,"category":"Food & Dining","description":"Swiggy"}',
   '{"amount_paise":-52000,"category":"Food & Dining","description":"Swiggy dinner"}', 1);
