CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  meter_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  aggregated_at_ms INTEGER,
  occurred_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE INDEX IF NOT EXISTS usage_events_restaurant_meter_time_idx
  ON usage_events (restaurant_id, meter_key, occurred_at_ms);

CREATE INDEX IF NOT EXISTS usage_events_pending_idx
  ON usage_events (aggregated_at_ms)
  WHERE aggregated_at_ms IS NULL;

CREATE TABLE IF NOT EXISTS usage_meters (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  meter_key TEXT NOT NULL,
  cycle_start_at_ms INTEGER NOT NULL,
  cycle_end_at_ms INTEGER NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  last_aggregated_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE INDEX IF NOT EXISTS usage_meters_restaurant_meter_idx
  ON usage_meters (restaurant_id, meter_key);

CREATE UNIQUE INDEX IF NOT EXISTS usage_meters_restaurant_meter_cycle_idx
  ON usage_meters (restaurant_id, meter_key, cycle_start_at_ms);
