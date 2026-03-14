-- Add discovery columns to restaurants
ALTER TABLE restaurants ADD COLUMN latitude REAL;
ALTER TABLE restaurants ADD COLUMN longitude REAL;
ALTER TABLE restaurants ADD COLUMN cuisine_tags TEXT;
ALTER TABLE restaurants ADD COLUMN price_range INTEGER;
ALTER TABLE restaurants ADD COLUMN supports_takeaway INTEGER NOT NULL DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN supports_delivery INTEGER NOT NULL DEFAULT 0;

-- Create dish_search_index table
CREATE TABLE IF NOT EXISTS dish_search_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  restaurant_id TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  dish_name_normalized TEXT NOT NULL,
  category_name TEXT,
  price REAL,
  is_available INTEGER NOT NULL DEFAULT 1,
  tags TEXT,
  district TEXT,
  restaurant_type TEXT,
  supports_takeaway INTEGER NOT NULL DEFAULT 0,
  supports_delivery INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL
);

-- Indexes for dish_search_index
CREATE INDEX IF NOT EXISTS dish_search_name_available_idx ON dish_search_index (dish_name_normalized, is_available);
CREATE INDEX IF NOT EXISTS dish_search_restaurant_available_idx ON dish_search_index (restaurant_id, is_available);
CREATE INDEX IF NOT EXISTS dish_search_price_available_idx ON dish_search_index (price, is_available);
CREATE INDEX IF NOT EXISTS dish_search_district_available_idx ON dish_search_index (district, is_available);
