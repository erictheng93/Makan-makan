CREATE TABLE IF NOT EXISTS market_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  restaurant_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  requested_at_ms INTEGER NOT NULL,
  resolved_at_ms INTEGER,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS market_join_requests_pending_pair_idx
  ON market_join_requests(restaurant_id, market_id)
  WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_join_requests_restaurant_status_idx
  ON market_join_requests(restaurant_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS market_join_requests_market_status_idx
  ON market_join_requests(market_id, status);
