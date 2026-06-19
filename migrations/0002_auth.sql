-- Auth tables: magic-link tokens and sessions.
-- Tokens are stored hashed (SHA-256); the raw token is never persisted.

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,  -- 'YYYY-MM-DD HH:MM:SS' UTC
  used_at     TEXT,           -- NULL until verified
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_hash
  ON magic_link_tokens(token_hash)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,  -- 'YYYY-MM-DD HH:MM:SS' UTC
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
