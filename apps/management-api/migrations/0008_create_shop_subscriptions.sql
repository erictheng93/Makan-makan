-- Migration: Create shop_subscriptions table for onboarding billing records
-- Description: Stores the initial subscription created with each tenant.

CREATE TABLE IF NOT EXISTS shop_subscriptions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL UNIQUE,
  plan_tier TEXT NOT NULL DEFAULT 'trial',
  module_overrides TEXT DEFAULT '{}',
  deployment_mode TEXT NOT NULL DEFAULT 'managed',
  is_active INTEGER NOT NULL DEFAULT 1,
  trial_ends_at_ms INTEGER,
  billing_cycle_start_at_ms INTEGER,
  billing_cycle_end_at_ms INTEGER,
  notes TEXT,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (restaurant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_restaurant_id
  ON shop_subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_plan_tier
  ON shop_subscriptions(plan_tier);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_is_active
  ON shop_subscriptions(is_active);
