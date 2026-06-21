-- Per-user home state, used to pick the right bank-holiday calendar when
-- scheduling recurring income and month-end obligations around holidays.
-- Null = not set; weekends and national holidays still apply.
ALTER TABLE settings ADD COLUMN home_state TEXT;
