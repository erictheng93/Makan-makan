CREATE TABLE IF NOT EXISTS storage_counters (
  restaurant_id TEXT PRIMARY KEY NOT NULL,
  r2_bytes INTEGER NOT NULL DEFAULT 0,
  images_count INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);
