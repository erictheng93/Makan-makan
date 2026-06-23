CREATE TABLE IF NOT EXISTS market_checkout_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  market_id TEXT NOT NULL,
  market_slug TEXT NOT NULL,
  market_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL,
  child_order_count INTEGER NOT NULL DEFAULT 0,
  payment_summary TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_checkout_sessions_market_created_idx
  ON market_checkout_sessions(market_id, created_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_checkout_sessions_payment_status_idx
  ON market_checkout_sessions(payment_status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS market_checkout_child_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  checkout_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  total_amount REAL NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  token_expires_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (checkout_id) REFERENCES market_checkout_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_checkout_child_orders_checkout_idx
  ON market_checkout_child_orders(checkout_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_checkout_child_orders_restaurant_idx
  ON market_checkout_child_orders(restaurant_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS market_checkout_child_orders_checkout_order_idx
  ON market_checkout_child_orders(checkout_id, order_id);
