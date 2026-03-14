-- Migration: Forecast Schema
-- Add forecast_cache, ingredient_definitions, and menu_item_ingredients tables

-- 1. Create forecast_cache table
CREATE TABLE IF NOT EXISTS forecast_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  forecast_date TEXT NOT NULL,
  forecast_type TEXT NOT NULL,
  data TEXT,
  metadata TEXT,
  generated_by TEXT NOT NULL,
  expires_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS forecast_cache_restaurant_date_type_idx
  ON forecast_cache (restaurant_id, forecast_date, forecast_type);
CREATE INDEX IF NOT EXISTS forecast_cache_expires_at_idx
  ON forecast_cache (expires_at_ms);

-- 2. Create ingredient_definitions table
CREATE TABLE IF NOT EXISTS ingredient_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  category TEXT,
  cost_per_unit REAL,
  supplier TEXT,
  min_stock_level REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS ingredient_defs_restaurant_active_idx
  ON ingredient_definitions (restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS ingredient_defs_restaurant_category_idx
  ON ingredient_definitions (restaurant_id, category);

-- 3. Create menu_item_ingredients table
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  quantity_per_serving REAL NOT NULL,
  unit TEXT NOT NULL,
  is_optional INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS menu_item_ingredients_menu_item_idx
  ON menu_item_ingredients (menu_item_id);
CREATE INDEX IF NOT EXISTS menu_item_ingredients_ingredient_idx
  ON menu_item_ingredients (ingredient_id);
