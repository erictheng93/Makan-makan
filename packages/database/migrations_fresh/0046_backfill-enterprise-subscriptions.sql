INSERT INTO shop_subscriptions (
  id,
  restaurant_id,
  plan_tier,
  module_overrides,
  is_active,
  billing_cycle_start_at_ms,
  billing_cycle_end_at_ms,
  created_at_ms,
  updated_at_ms
)
SELECT
  printf(
    '%08x-%04x-7%03x-%1x%03x-%012x',
    ((unixepoch('now') * 1000) >> 16) & 4294967295,
    (unixepoch('now') * 1000) & 65535,
    abs(random()) % 4096,
    8 + (abs(random()) % 4),
    abs(random()) % 4096,
    abs(random()) % 281474976710656
  ),
  r.id,
  'enterprise',
  '{}',
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
