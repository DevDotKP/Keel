-- 0008: Add Investments as a default spending category for all existing users.
-- INSERT OR IGNORE is safe to re-run; the partial unique index on (user_id, name)
-- where deleted_at IS NULL prevents duplicates.

INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Investments', '#1B5E8B', 0, 18, 'expense', 'committed', 0 FROM users;
