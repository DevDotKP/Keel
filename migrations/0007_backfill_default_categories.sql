-- 0007: Backfill default spending categories for users created before bootstrap
-- started seeding them (migration follows bootstrap's DEFAULT_SPENDING_CATEGORIES).
-- INSERT OR IGNORE + the partial unique index (user_id, name WHERE deleted_at IS NULL)
-- makes this a no-op for users who already have each category.

INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Food & Dining', '#C2683C', 0, 10, 'expense', 'flexible', 0 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Groceries', '#5FA85D', 0, 11, 'expense', 'committed', 0 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Transport', '#1B3A66', 0, 12, 'expense', 'committed', 0 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Bills & Utilities', '#7C756A', 0, 13, 'expense', 'committed', 0 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Shopping', '#8B6DBF', 0, 14, 'expense', 'flexible', 0 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Health', '#2F7E72', 0, 15, 'expense', 'flexible', 0 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Entertainment', '#E07B54', 0, 16, 'expense', 'flexible', 0 FROM users;
INSERT OR IGNORE INTO categories (user_id, name, color, is_system, sort_order, kind, bucket, daily_reserve_paise)
  SELECT id, 'Rent', '#374151', 0, 17, 'expense', 'committed', 0 FROM users;
