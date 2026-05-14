-- Local-only seed data for Artillery API/load gates.
-- Idempotent by design: only inserts fixed fixture rows when they are absent.

INSERT OR IGNORE INTO restaurants (
  id, name, type, category, description, address, district, city, phone, email,
  business_hours, is_available, is_active, enable_shop_mode, settings, rating,
  review_count, total_orders, created_at_ms, updated_at_ms
) VALUES (
  '019469a0-0001-7000-8000-000000000001',
  'Performance Test Restaurant',
  'restaurant',
  'performance',
  'Fixture restaurant for local performance gates',
  '100 Performance Test Road',
  'Test District',
  'Taipei',
  '+886-2-0000-0001',
  'performance@makanmakan.test',
  '{}',
  1,
  1,
  1,
  '{"currency":"TWD","allowOnlineOrdering":true,"allowGuestOrders":true}',
  4.8,
  1,
  1,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
);

INSERT OR IGNORE INTO users (
  id, username, email, phone, full_name, password_hash, role, restaurant_id,
  is_active, is_verified, created_at_ms, updated_at_ms
) VALUES
  (
    9001,
    'perf_owner',
    'perf-owner@makanmakan.test',
    '0900000001',
    'Performance Owner',
    '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
    1,
    '019469a0-0001-7000-8000-000000000001',
    1,
    1,
    unixepoch('now') * 1000,
    unixepoch('now') * 1000
  ),
  (
    9002,
    'perf_chef',
    'perf-chef@makanmakan.test',
    '0900000002',
    'Performance Chef',
    '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
    2,
    '019469a0-0001-7000-8000-000000000001',
    1,
    1,
    unixepoch('now') * 1000,
    unixepoch('now') * 1000
  );

WITH RECURSIVE perf_user_ids(n) AS (
  SELECT 0
  UNION ALL
  SELECT n + 1 FROM perf_user_ids WHERE n < 49
)
INSERT OR IGNORE INTO users (
  id, username, email, phone, full_name, password_hash, role, restaurant_id,
  is_active, is_verified, created_at_ms, updated_at_ms
)
SELECT
  9100 + n,
  'perf_owner_' || n,
  'perf-owner-' || n || '@makanmakan.test',
  '0910' || printf('%06d', n),
  'Performance Owner ' || n,
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  1,
  '019469a0-0001-7000-8000-000000000001',
  1,
  1,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
FROM perf_user_ids;

WITH RECURSIVE perf_chef_ids(n) AS (
  SELECT 0
  UNION ALL
  SELECT n + 1 FROM perf_chef_ids WHERE n < 49
)
INSERT OR IGNORE INTO users (
  id, username, email, phone, full_name, password_hash, role, restaurant_id,
  is_active, is_verified, created_at_ms, updated_at_ms
)
SELECT
  9200 + n,
  'perf_chef_' || n,
  'perf-chef-' || n || '@makanmakan.test',
  '0920' || printf('%06d', n),
  'Performance Chef ' || n,
  '$2a$10$8ili9ArBs0badNWhKDhFmON5K1KQxi0SfClvbPs9LRt1x03UpRtCi',
  2,
  '019469a0-0001-7000-8000-000000000001',
  1,
  1,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
FROM perf_chef_ids;

INSERT OR IGNORE INTO shop_subscriptions (
  id, restaurant_id, plan_tier, module_overrides, is_active, trial_ends_at_ms,
  billing_cycle_start_at_ms, billing_cycle_end_at_ms, notes, created_at_ms,
  updated_at_ms
) VALUES (
  'perf-sub-019469a0-0001',
  '019469a0-0001-7000-8000-000000000001',
  'trial',
  '{}',
  1,
  (unixepoch('now', '+30 days') * 1000),
  (unixepoch('now') * 1000),
  (unixepoch('now', '+30 days') * 1000),
  'Local performance gate fixture',
  (unixepoch('now') * 1000),
  (unixepoch('now') * 1000)
);

UPDATE shop_subscriptions
SET
  module_overrides = '{"online_ordering":true,"menu_management":true,"analytics":true,"staff_management":true,"table_management":true,"kitchen_display":true}',
  is_active = 1,
  updated_at_ms = unixepoch('now') * 1000
WHERE restaurant_id = '019469a0-0001-7000-8000-000000000001';

INSERT OR IGNORE INTO categories (
  id, restaurant_id, name, description, sort_order, is_active, is_visible,
  item_count, created_at_ms, updated_at_ms
) VALUES
  (
    9101,
    '019469a0-0001-7000-8000-000000000001',
    'Performance Mains',
    'Main dishes for performance tests',
    1,
    1,
    1,
    2,
    unixepoch('now') * 1000,
    unixepoch('now') * 1000
  ),
  (
    9102,
    '019469a0-0001-7000-8000-000000000001',
    'Performance Drinks',
    'Drinks for performance tests',
    2,
    1,
    1,
    1,
    unixepoch('now') * 1000,
    unixepoch('now') * 1000
  );

INSERT OR IGNORE INTO menu_items (
  id, restaurant_id, category_id, name, description, ingredients, price,
  original_price, is_available, is_featured, is_popular, sort_order, spice_level,
  preparation_time, calories, dietary_info, options, order_count, rating,
  review_count, view_count, created_at_ms, updated_at_ms
) VALUES
  (
    9101,
    '019469a0-0001-7000-8000-000000000001',
    9101,
    'Performance Beef Noodles',
    'Deterministic menu item for load tests',
    'beef,noodles,broth',
    150,
    NULL,
    1,
    1,
    1,
    1,
    1,
    10,
    650,
    '{}',
    '{}',
    10,
    4.8,
    3,
    0,
    unixepoch('now') * 1000,
    unixepoch('now') * 1000
  ),
  (
    9102,
    '019469a0-0001-7000-8000-000000000001',
    9102,
    'Performance Tea',
    'Deterministic drink for load tests',
    'tea',
    40,
    NULL,
    1,
    0,
    1,
    2,
    0,
    2,
    80,
    '{}',
    '{}',
    10,
    4.6,
    2,
    0,
    unixepoch('now') * 1000,
    unixepoch('now') * 1000
  );

UPDATE menu_items
SET
  price = 150,
  is_available = 1,
  updated_at_ms = unixepoch('now') * 1000
WHERE id = 9101;

UPDATE menu_items
SET
  price = 40,
  is_available = 1,
  updated_at_ms = unixepoch('now') * 1000
WHERE id = 9102;

INSERT OR IGNORE INTO tables (
  id, restaurant_id, number, name, capacity, location, qr_code, is_occupied,
  is_active, is_reservable, total_usage, created_at_ms, updated_at_ms
) VALUES (
  9101,
  '019469a0-0001-7000-8000-000000000001',
  'P1',
  'Performance Table 1',
  4,
  'Performance',
  'PERF-TABLE-9101',
  0,
  1,
  1,
  0,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
);

INSERT OR IGNORE INTO orders (
  id, restaurant_id, table_id, order_number, status, order_type, subtotal,
  tax_amount, service_charge, discount_amount, total_amount, customer_info,
  payment_status, notes, created_at_ms, updated_at_ms, order_source
) VALUES (
  9101,
  '019469a0-0001-7000-8000-000000000001',
  9101,
  'PERF-ORDER-9101',
  'confirmed',
  'table',
  190,
  0,
  0,
  0,
  190,
  '{"name":"Performance Guest","phone":"0900000000"}',
  'pending',
  'Seeded order for performance gates',
  unixepoch('now') * 1000,
  unixepoch('now') * 1000,
  'direct'
);

INSERT OR IGNORE INTO order_items (
  id, order_id, menu_item_id, quantity, unit_price, total_price, item_snapshot,
  status, created_at_ms, updated_at_ms
) VALUES (
  9101,
  9101,
  9101,
  1,
  150,
  150,
  '{"name":"Performance Beef Noodles","price":150}',
  'pending',
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
);
