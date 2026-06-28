-- Rate-limit the public, no-login demo. One row per demo session created, keyed
-- by client IP, so /api/demo can cap creations per IP per hour and stop scripted
-- bursts from flooding D1. Swept hourly by the cron.
CREATE TABLE demo_throttle (
  ip         TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_demo_throttle_ip_time ON demo_throttle(ip, created_at);
