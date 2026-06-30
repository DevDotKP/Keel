-- Optional time-of-day for recurring items (HH:MM in IST, e.g. '09:00').
-- When set, the sync engine fires the transaction at that time on the due date
-- instead of the moment the dashboard loads.
ALTER TABLE recurring_income    ADD COLUMN due_time TEXT;
ALTER TABLE recurring_expenses  ADD COLUMN due_time TEXT;
