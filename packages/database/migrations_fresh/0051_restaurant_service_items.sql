CREATE TABLE IF NOT EXISTS restaurant_service_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  restaurant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL DEFAULT 'general',
  price_cents INTEGER,
  price_label TEXT,
  duration_minutes INTEGER,
  requires_booking INTEGER NOT NULL DEFAULT 0,
  booking_url TEXT,
  available_hours TEXT,
  tags TEXT,
  keywords TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurant_service_items_public_idx
  ON restaurant_service_items(restaurant_id, is_active, is_public, sort_order);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurant_service_items_type_idx
  ON restaurant_service_items(restaurant_id, service_type, is_active);
