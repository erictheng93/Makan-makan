CREATE TABLE IF NOT EXISTS cycle_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  subscription_id TEXT REFERENCES shop_subscriptions(id),
  plan_tier TEXT NOT NULL,
  cycle_start_at_ms INTEGER NOT NULL,
  cycle_end_at_ms INTEGER NOT NULL,
  modules TEXT NOT NULL,
  usage TEXT NOT NULL,
  total_overage_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TWD',
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS cycle_snapshots_restaurant_cycle_idx
  ON cycle_snapshots (restaurant_id, cycle_start_at_ms);

CREATE INDEX IF NOT EXISTS cycle_snapshots_restaurant_time_idx
  ON cycle_snapshots (restaurant_id, cycle_end_at_ms);
