CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  district TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  boundary_geojson TEXT,
  opening_hours TEXT,
  banner_url TEXT,
  logo_url TEXT,
  image_urls TEXT,
  tags TEXT,
  platform_fee_rate_bps INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS markets_city_district_active_idx
  ON markets(city, district, is_active);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS restaurant_market_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  restaurant_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  stall_number TEXT,
  location_label TEXT,
  market_hours TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  joined_at_ms INTEGER NOT NULL,
  left_at_ms INTEGER,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_market_active_pair_idx
  ON restaurant_market_memberships(restaurant_id, market_id)
  WHERE left_at_ms IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurant_market_market_active_idx
  ON restaurant_market_memberships(market_id, left_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurant_market_restaurant_active_idx
  ON restaurant_market_memberships(restaurant_id, left_at_ms);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE dish_search_index ADD COLUMN primary_market_id TEXT;
--> statement-breakpoint
ALTER TABLE dish_search_index ADD COLUMN market_ids TEXT;
--> statement-breakpoint
ALTER TABLE dish_search_index ADD COLUMN latitude REAL;
--> statement-breakpoint
ALTER TABLE dish_search_index ADD COLUMN longitude REAL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dish_search_primary_market_available_idx
  ON dish_search_index(primary_market_id, is_available);
