-- Track the last cycle we sent a Harbour reminder for, keyed by the period's
-- end date. This makes the reminder strictly once-per-cycle and idempotent, so
-- an hourly scheduler can never turn it into a daily nag.
ALTER TABLE settings ADD COLUMN last_harbour_notify TEXT;
