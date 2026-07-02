-- Email + password sign-in. No custom domain means no transactional email
-- (Resend needs a verified sender), so magic links can't deliver; passwords
-- are the integrated fallback. Nullable: Google-only users never set one.
-- Stored as pbkdf2:<iterations>:<salt-hex>:<hash-hex>, never plaintext.
ALTER TABLE users ADD COLUMN password_hash TEXT;
