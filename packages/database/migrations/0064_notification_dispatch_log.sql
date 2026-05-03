CREATE TABLE IF NOT EXISTS notification_dispatch_log (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT REFERENCES restaurants(id),
  kind TEXT NOT NULL,
  dedup_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  payload TEXT,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_dispatch_dedup_idx
  ON notification_dispatch_log (restaurant_id, kind, dedup_key, channel);

CREATE INDEX IF NOT EXISTS notification_dispatch_restaurant_time_idx
  ON notification_dispatch_log (restaurant_id, created_at_ms);
