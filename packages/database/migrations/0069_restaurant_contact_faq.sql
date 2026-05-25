ALTER TABLE restaurants ADD COLUMN messaging_channels TEXT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS restaurant_faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  restaurant_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS restaurant_faqs_restaurant_active_idx
  ON restaurant_faqs(restaurant_id, is_active, display_order);
