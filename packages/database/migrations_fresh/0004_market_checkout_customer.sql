ALTER TABLE market_checkout_sessions
  ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX market_checkout_sessions_customer_created_idx
  ON market_checkout_sessions (customer_id, created_at_ms);
