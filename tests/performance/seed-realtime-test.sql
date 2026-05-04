-- ============================================================================
-- Realtime Services Performance Testing - Test Data Seed Script
-- ============================================================================
-- 此腳本為 Realtime WebSocket 性能測試準備測試數據
-- 創建日期: 2025-11-15
-- ============================================================================

-- 清理舊測試數據
-- ============================================================================
DELETE FROM tables WHERE id BETWEEN 1 AND 10;
DELETE FROM restaurants WHERE id = 1;

-- 創建測試餐廳
-- ============================================================================
INSERT INTO restaurants (
  id,
  name,
  type,
  category,
  description,
  address,
  district,
  city,
  phone,
  email,
  website,
  logo_url,
  is_active,
  created_at,
  updated_at
) VALUES (
  1,
  'Performance Test Restaurant',
  'restaurant',
  'asian',
  'Restaurant for Realtime Services performance testing',
  '123 Test Street',
  'Test District',
  'Test City',
  '+886-2-1234-5678',
  'test@makanmasak.com',
  'https://makanmasak.com',
  'https://example.com/logo.png',
  1,
  unixepoch('now'),
  unixepoch('now')
);

-- 創建測試桌號 (ID 1-10)
-- ============================================================================
-- 用於 Customer WebSocket 連線測試
-- artillery-processor.js 使用 TEST_TABLE_ID=1 作為預設值

INSERT INTO tables (
  id,
  restaurant_id,
  number,
  name,
  capacity,
  location,
  qr_code,
  created_at,
  updated_at
) VALUES
-- Area A - 一般座位
(1, '1', '1', 'Test Table 1', 4, 'Area A', 'PERF-TEST-QR-001', unixepoch('now'), unixepoch('now')),
(2, '1', '2', 'Test Table 2', 4, 'Area A', 'PERF-TEST-QR-002', unixepoch('now'), unixepoch('now')),

-- Area B - 中型桌
(3, '1', '3', 'Test Table 3', 6, 'Area B', 'PERF-TEST-QR-003', unixepoch('now'), unixepoch('now')),
(4, '1', '4', 'Test Table 4', 6, 'Area B', 'PERF-TEST-QR-004', unixepoch('now'), unixepoch('now')),

-- Area C - 小型桌
(5, '1', '5', 'Test Table 5', 2, 'Area C', 'PERF-TEST-QR-005', unixepoch('now'), unixepoch('now')),
(6, '1', '6', 'Test Table 6', 2, 'Area C', 'PERF-TEST-QR-006', unixepoch('now'), unixepoch('now')),

-- VIP 區域 - 大型桌
(7, '1', '7', 'Test Table 7', 8, 'VIP', 'PERF-TEST-QR-007', unixepoch('now'), unixepoch('now')),
(8, '1', '8', 'Test Table 8', 8, 'VIP', 'PERF-TEST-QR-008', unixepoch('now'), unixepoch('now')),

-- Patio - 露台座位
(9, '1', '9', 'Test Table 9', 4, 'Patio', 'PERF-TEST-QR-009', unixepoch('now'), unixepoch('now')),
(10, '1', '10', 'Test Table 10', 4, 'Patio', 'PERF-TEST-QR-010', unixepoch('now'), unixepoch('now'));

-- 驗證數據創建
-- ============================================================================
SELECT '✅ Restaurant created:' as status, COUNT(*) as count
FROM restaurants WHERE id = 1;

SELECT '✅ Tables created:' as status, COUNT(*) as count
FROM tables WHERE restaurant_id = '1';

SELECT '✅ Table IDs:' as status, GROUP_CONCAT(id) as table_ids
FROM tables WHERE restaurant_id = '1';

-- 顯示創建的測試數據詳情
-- ============================================================================
SELECT
  '📋 Test Data Summary' as info,
  '' as separator;

SELECT
  id as restaurant_id,
  name as restaurant_name,
  type,
  category,
  is_active
FROM restaurants WHERE id = 1;

SELECT
  id as table_id,
  number,
  name,
  capacity,
  location,
  qr_code
FROM tables
WHERE restaurant_id = '1'
ORDER BY id;

-- ============================================================================
-- 使用說明
-- ============================================================================
--
-- 執行此腳本:
--
-- Local D1 Database:
-- $ npx wrangler d1 execute makanmasak-staging --local \
--   --file=./tests/performance/seed-realtime-test.sql
--
-- Staging D1 Database:
-- $ npx wrangler d1 execute makanmasak-staging \
--   --file=./tests/performance/seed-realtime-test.sql
--
-- 驗證數據:
-- $ npx wrangler d1 execute makanmasak-staging --local \
--   --command="SELECT * FROM tables WHERE restaurant_id = 1"
--
-- 環境變數設定 (用於 Artillery 測試):
-- $ export TEST_TABLE_ID=1
-- $ export API_URL=http://localhost:8787
--
-- ============================================================================
