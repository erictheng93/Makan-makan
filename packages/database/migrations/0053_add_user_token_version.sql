-- Add token version for immediate JWT invalidation.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS users_token_version_idx ON users(id, token_version);
