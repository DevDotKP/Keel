-- Generic rate-limit buckets, one row per counted event. Keys look like
-- 'auth-send:1.2.3.4' or 'transcribe:user-id'. Counted over a sliding window
-- by the rateLimited() helper; old rows are swept by the hourly cron.
CREATE TABLE rate_limits (
  bucket     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rate_limits_bucket_time ON rate_limits(bucket, created_at);
