CREATE TABLE IF NOT EXISTS customer_recent_markets (
  customer_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  visited_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS customer_recent_markets_customer_unique
  ON customer_recent_markets (customer_id, market_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customer_recent_markets_customer_visited_idx
  ON customer_recent_markets (customer_id, visited_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customer_recent_markets_market_idx
  ON customer_recent_markets (market_id);
