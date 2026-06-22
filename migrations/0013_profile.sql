-- Profile: optional display name and avatar.
-- Avatar is a small base64 data URL (resized client-side, capped client and
-- server side), stored inline. Keeps the $0, no-new-infra stance (no R2/Images).
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN avatar TEXT;
