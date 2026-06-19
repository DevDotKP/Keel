-- 0006: Optional free-text note on a transaction, separate from the short
-- description. Description is the quick label ("Swiggy dinner"); the note holds
-- extra context ("team dinner, will be reimbursed"). Empty by default.

ALTER TABLE transactions ADD COLUMN note TEXT NOT NULL DEFAULT '';
