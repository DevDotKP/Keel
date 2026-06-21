-- Add google_sub to users for Google OAuth identity linking.
-- Nullable so existing magic-link users are unaffected.
ALTER TABLE users ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
  ON users(google_sub)
  WHERE google_sub IS NOT NULL;
