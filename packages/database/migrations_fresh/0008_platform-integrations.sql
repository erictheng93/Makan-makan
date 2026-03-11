-- Migration: Platform Integrations for Uber Eats / Foodpanda
-- Add order_source to orders table and create platform integration tables

-- 1. Add order_source column to orders
ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'direct';

-- 2. Create index for order_source filtering
CREATE INDEX IF NOT EXISTS orders_order_source_idx ON orders (restaurant_id, order_source, created_at_ms);

-- 3. Create platform_integrations table
CREATE TABLE IF NOT EXISTS platform_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  credentials TEXT,
  config TEXT DEFAULT '{"autoAcceptOrders":false,"menuSyncEnabled":false}',
  last_menu_sync_at_ms INTEGER,
  menu_sync_status TEXT DEFAULT 'idle',
  menu_sync_error TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_integrations_restaurant_platform_idx
  ON platform_integrations (restaurant_id, platform);
CREATE INDEX IF NOT EXISTS platform_integrations_enabled_idx
  ON platform_integrations (enabled, platform);

-- 4. Create platform_orders table
CREATE TABLE IF NOT EXISTS platform_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_order_id TEXT NOT NULL,
  platform_store_id TEXT,
  restaurant_id TEXT NOT NULL,
  platform_status TEXT,
  last_synced_at_ms INTEGER,
  raw_payload TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_orders_platform_order_idx
  ON platform_orders (platform, platform_order_id);
CREATE INDEX IF NOT EXISTS platform_orders_order_idx
  ON platform_orders (order_id);
CREATE INDEX IF NOT EXISTS platform_orders_restaurant_platform_idx
  ON platform_orders (restaurant_id, platform, created_at_ms);

-- 5. Create platform_menu_mappings table
CREATE TABLE IF NOT EXISTS platform_menu_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_item_id TEXT,
  sync_status TEXT DEFAULT 'pending',
  last_synced_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_menu_mappings_item_platform_idx
  ON platform_menu_mappings (menu_item_id, platform);
CREATE INDEX IF NOT EXISTS platform_menu_mappings_restaurant_platform_idx
  ON platform_menu_mappings (restaurant_id, platform);

-- 6. Create platform_webhook_logs table
CREATE TABLE IF NOT EXISTS platform_webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,
  restaurant_id TEXT,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  processed_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS platform_webhook_logs_platform_event_idx
  ON platform_webhook_logs (platform, event_type, created_at_ms);
CREATE INDEX IF NOT EXISTS platform_webhook_logs_restaurant_idx
  ON platform_webhook_logs (restaurant_id, created_at_ms);
CREATE INDEX IF NOT EXISTS platform_webhook_logs_status_idx
  ON platform_webhook_logs (status, created_at_ms);
