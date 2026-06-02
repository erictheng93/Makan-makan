-- =============================================================
-- 夜市示範資料 seed
-- 包含：1 個夜市 + 4 個攤位（含 mapPosition）+ mapLayout
-- 使用現有餐廳 ID（019469a0-000x-7000-8000-000000000001~0003 & 0099）
-- =============================================================

-- 1. 市場本體
INSERT INTO markets (
  id,
  slug,
  name,
  type,
  description,
  city,
  district,
  address,
  latitude,
  longitude,
  opening_hours,
  map_layout,
  tags,
  platform_fee_rate_bps,
  is_active,
  created_at_ms,
  updated_at_ms
) VALUES (
  '019469b0-0001-7000-8000-000000000001',
  'demo-night-market',
  '示範夜市',
  'night_market',
  '這是一個示範夜市，包含四個攤位，可用來預覽攤位示意圖功能。',
  '台中市',
  '西屯區',
  '台中市西屯區示範路 1 號',
  24.1631,
  120.6468,
  json('{"mon":{"open":"17:00","close":"23:00"},"tue":{"open":"17:00","close":"23:00"},"wed":{"open":"17:00","close":"23:00"},"thu":{"open":"17:00","close":"23:00"},"fri":{"open":"17:00","close":"00:00"},"sat":{"open":"16:00","close":"00:00"},"sun":{"open":"16:00","close":"23:00"}}'),
  json('{"title":"示範夜市攤位圖","description":"共 4 個攤位，分 A、B 兩區。","width":800,"height":500}'),
  json('["夜市","台中","示範","熱門"]'),
  200,
  1,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
);

-- 2. 攤位關聯（含 mapPosition，座標為百分比 0–100）
--    版面示意：
--
--    ┌─────────────────────────────────────────┐
--    │  A1 阿嬤的味道 (20,30)   A2 櫻花亭 (55,30) │  ← A 排
--    │                                         │
--    │  B1 暹羅風味 (20,70)   B2 Demo (55,70)  │  ← B 排
--    └─────────────────────────────────────────┘

INSERT INTO restaurant_market_memberships (
  restaurant_id,
  market_id,
  stall_number,
  location_label,
  map_position,
  market_hours,
  is_primary,
  joined_at_ms
) VALUES
  (
    '019469a0-0001-7000-8000-000000000001',  -- 阿嬤的味道
    '019469b0-0001-7000-8000-000000000001',
    'A1',
    'A 排',
    json('{"x":20,"y":30}'),
    json('{"mon":{"open":"17:00","close":"22:30"},"tue":{"open":"17:00","close":"22:30"},"wed":{"open":"17:00","close":"22:30"},"thu":{"open":"17:00","close":"22:30"},"fri":{"open":"17:00","close":"23:00"},"sat":{"open":"16:30","close":"23:00"},"sun":{"open":"16:30","close":"22:30"}}'),
    1,
    unixepoch('now') * 1000
  ),
  (
    '019469a0-0002-7000-8000-000000000002',  -- 櫻花亭
    '019469b0-0001-7000-8000-000000000001',
    'A2',
    'A 排',
    json('{"x":55,"y":30}'),
    NULL,
    1,
    unixepoch('now') * 1000
  ),
  (
    '019469a0-0003-7000-8000-000000000003',  -- 暹羅風味
    '019469b0-0001-7000-8000-000000000001',
    'B1',
    'B 排',
    json('{"x":20,"y":70}'),
    NULL,
    1,
    unixepoch('now') * 1000
  ),
  (
    '019469a0-0099-7000-8000-000000000099',  -- MakanMakan Demo
    '019469b0-0001-7000-8000-000000000001',
    'B2',
    'B 排',
    json('{"x":55,"y":70}'),
    NULL,
    1,
    unixepoch('now') * 1000
  );
