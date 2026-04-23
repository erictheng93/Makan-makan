CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  effect_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idempotency_keys_scope_expires_idx
  ON idempotency_keys(scope, expires_at);

CREATE INDEX IF NOT EXISTS idempotency_keys_effect_idx
  ON idempotency_keys(effect_id);
