ALTER TABLE menu_items ADD COLUMN catalog_type TEXT NOT NULL DEFAULT 'menu_item';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS menu_items_restaurant_catalog_idx
  ON menu_items(restaurant_id, catalog_type, is_available);
--> statement-breakpoint
ALTER TABLE dish_search_index ADD COLUMN catalog_type TEXT NOT NULL DEFAULT 'menu_item';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS dish_search_catalog_available_idx
  ON dish_search_index(catalog_type, is_available);
