CREATE TABLE IF NOT EXISTS market_checkout_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  payment_id TEXT NOT NULL UNIQUE,
  checkout_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  split_mode TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  paid_amount_cents INTEGER NOT NULL DEFAULT 0,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT,
  country_code TEXT,
  child_payment_ids TEXT,
  provider_transaction_id TEXT,
  provider_payload TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  refunded_at_ms INTEGER,
  failed_at_ms INTEGER,
  FOREIGN KEY (checkout_id) REFERENCES market_checkout_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_checkout_payments_checkout_idx
  ON market_checkout_payments(checkout_id, created_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_checkout_payments_market_status_idx
  ON market_checkout_payments(market_id, status, created_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_checkout_payments_idempotency_idx
  ON market_checkout_payments(idempotency_key);
