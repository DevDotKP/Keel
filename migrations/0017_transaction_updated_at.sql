-- updateTransaction stamps updated_at on every edit, but the column was never
-- created, so each edit's UPDATE threw "no such column: updated_at" (a 500 that
-- surfaced in the UI as "Could not save. Try again."). Add and delete were
-- unaffected because they don't touch this column.
-- Nullable, because SQLite cannot ADD a column with a non-constant default like
-- datetime('now'). Existing rows stay NULL (treated as never-edited); future
-- edits set it, and the All entries "edited" marker reads NULL as not-edited.
ALTER TABLE transactions ADD COLUMN updated_at TEXT;
