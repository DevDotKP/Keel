-- Soft archive for categories. Archived categories disappear from pickers but
-- keep their history: old entries still show the right name, Insights still
-- attribute past spend. Distinct from deleted_at, which hides everywhere.
ALTER TABLE categories ADD COLUMN archived_at TEXT;
