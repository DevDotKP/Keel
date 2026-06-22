-- First-run setup flag. 0 until the user finishes (or skips) the /welcome setup,
-- where they set their starting balance and Harbour cadence. Drives the one-time
-- redirect to /welcome so the balance-anchored numbers are real from day one.
ALTER TABLE settings ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0;
