INSERT INTO shop_subscriptions (
  id,
  restaurant_id,
  plan_tier,
  module_overrides,
  deployment_mode,
  is_active,
  billing_cycle_start_at_ms,
  billing_cycle_end_at_ms,
  created_at_ms,
  updated_at_ms
)
SELECT
  lower(hex(randomblob(16))),
  r.id,
  'enterprise',
  '{}',
  'managed',
  1,
  unixepoch('now') * 1000,
  (unixepoch('now') * 1000) + (30 * 24 * 60 * 60 * 1000),
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
FROM restaurants r
WHERE NOT EXISTS (
  SELECT 1
  FROM shop_subscriptions s
  WHERE s.restaurant_id = r.id
);
