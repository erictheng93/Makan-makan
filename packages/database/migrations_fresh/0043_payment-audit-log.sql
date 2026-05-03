CREATE TABLE IF NOT EXISTS payment_audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT REFERENCES restaurants(id),
  payment_transaction_id TEXT,
  subscription_id TEXT,
  event_type TEXT NOT NULL,
  provider TEXT,
  provider_event_id TEXT,
  provider_event_type TEXT,
  amount INTEGER,
  currency TEXT,
  raw_payload TEXT,
  error_code TEXT,
  error_message TEXT,
  occurred_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_audit_provider_event_idx
  ON payment_audit_log (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_audit_restaurant_time_idx
  ON payment_audit_log (restaurant_id, occurred_at_ms);
