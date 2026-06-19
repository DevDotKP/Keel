-- 0004: Income categories.
-- Categories gain a kind: expense (default) or income. This lets users keep
-- multiple income sources (Salary, Freelance, Interest) instead of one bucket.
-- The transaction sign is derived from the category kind, not the name.

ALTER TABLE categories ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense'
  CHECK(kind IN ('expense','income'));

-- The existing system 'Income' category becomes the income fallback.
UPDATE categories SET kind = 'income' WHERE name = 'Income' AND is_system = 1;
