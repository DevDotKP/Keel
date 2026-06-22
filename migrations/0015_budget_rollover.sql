-- Budget rollover policy for the Insights cycle target.
-- Controls how an unspent surplus or an overspend carries into the next cycle's
-- *target* only. It never touches safe-to-spend, which stays purely balance-anchored.
--   fresh   : each cycle starts at the base target (default, on-brand clean slate)
--   surplus : unspent budget carries forward; overspend is forgiven
--   deficit : overspend reduces next cycle's target; a surplus is discarded
ALTER TABLE settings ADD COLUMN budget_rollover TEXT NOT NULL DEFAULT 'fresh';
