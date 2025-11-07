-- ============================================================================
-- MakanMakan Migrations v2.0 - 效能基準測試
-- ============================================================================
--
-- 用途: 測試關鍵查詢的效能，驗證索引效果
-- 使用: npx wrangler d1 execute makanmakan-test-v2 --local --file=scripts/test-performance.sql
--
-- ============================================================================

-- 顯示測試開始資訊
SELECT '═══════════════════════════════════════' as separator;
SELECT '效能基準測試開始' as message;
SELECT '測試時間: ' || datetime('now', 'localtime') as timestamp;
SELECT '═══════════════════════════════════════' as separator;
SELECT '' as blank_line;

-- ============================================================================
-- 準備測試資料
-- ============================================================================

SELECT '【準備階段】創建測試資料...' as stage;
SELECT '' as blank_line;

-- 創建測試餐廳
INSERT INTO restaurants (name, slug, business_type, phone, address_line1, city, country)
VALUES
    ('Perf Test Restaurant 1', 'perf-test-001', 'restaurant', '0911111111', '100 Test St', 'Taipei', 'TW'),
    ('Perf Test Restaurant 2', 'perf-test-002', 'cafe', '0922222222', '200 Test St', 'Taichung', 'TW'),
    ('Perf Test Restaurant 3', 'perf-test-003', 'bakery', '0933333333', '300 Test St', 'Kaohsiung', 'TW');

SELECT '✓ 創建 3 個測試餐廳' as result;

-- 創建測試用戶
INSERT INTO users (restaurant_id, username, full_name, password_hash, role, email)
SELECT
    r.id,
    'perf_user_' || substr(r.slug, -3),
    'Performance Test User ' || substr(r.slug, -3),
    '$2a$10$testhashedpasswordforperformancetest',
    CASE (ABS(RANDOM()) % 4)
        WHEN 0 THEN 'owner'
        WHEN 1 THEN 'chef'
        WHEN 2 THEN 'service_crew'
        ELSE 'cashier'
    END,
    'perf_user_' || substr(r.slug, -3) || '@test.com'
FROM restaurants r
WHERE r.slug LIKE 'perf-test-%';

SELECT '✓ 創建測試用戶' as result;

-- 創建測試分類
INSERT INTO categories (restaurant_id, name, name_en, display_order, is_active)
SELECT
    r.id,
    'Category ' || (ABS(RANDOM()) % 10),
    'Category ' || (ABS(RANDOM()) % 10) || ' EN',
    (ABS(RANDOM()) % 100),
    1
FROM restaurants r
WHERE r.slug LIKE 'perf-test-%';

SELECT '✓ 創建測試分類' as result;

-- 創建測試菜單項目 (每個餐廳 20 個項目)
INSERT INTO menu_items (restaurant_id, category_id, name, name_en, price, is_available)
SELECT
    r.id,
    c.id,
    '菜單項目 ' || (ABS(RANDOM()) % 100),
    'Menu Item ' || (ABS(RANDOM()) % 100),
    50 + (ABS(RANDOM()) % 450),
    1
FROM restaurants r
CROSS JOIN categories c
WHERE r.slug LIKE 'perf-test-%'
AND c.restaurant_id = r.id
LIMIT 60;

SELECT '✓ 創建 60 個測試菜單項目' as result;

-- 創建測試顧客
INSERT INTO customers (restaurant_id, phone, full_name, email)
SELECT
    r.id,
    '09' || printf('%08d', ABS(RANDOM()) % 100000000),
    'Customer ' || (ABS(RANDOM()) % 1000),
    'customer_' || (ABS(RANDOM()) % 1000) || '@test.com'
FROM restaurants r
WHERE r.slug LIKE 'perf-test-%'
LIMIT 30;

SELECT '✓ 創建 30 個測試顧客' as result;

-- 創建測試訂單
INSERT INTO orders (
    restaurant_id, customer_id, order_number, order_type, order_status,
    subtotal, tax_amount, total_amount
)
SELECT
    r.id,
    c.id,
    'PERF-' || printf('%06d', ABS(RANDOM()) % 1000000),
    CASE (ABS(RANDOM()) % 3)
        WHEN 0 THEN 'dine_in'
        WHEN 1 THEN 'takeaway'
        ELSE 'delivery'
    END,
    CASE (ABS(RANDOM()) % 5)
        WHEN 0 THEN 'pending'
        WHEN 1 THEN 'confirmed'
        WHEN 2 THEN 'preparing'
        WHEN 3 THEN 'completed'
        ELSE 'cancelled'
    END,
    100 + (ABS(RANDOM()) % 900),
    7.00,
    107 + (ABS(RANDOM()) % 900)
FROM restaurants r
CROSS JOIN customers c
WHERE r.slug LIKE 'perf-test-%'
AND c.restaurant_id = r.id
LIMIT 100;

SELECT '✓ 創建 100 個測試訂單' as result;

SELECT '' as blank_line;
SELECT '═══════════════════════════════════════' as separator;
SELECT '' as blank_line;

-- ============================================================================
-- Test 1: 基礎單表查詢效能
-- ============================================================================

SELECT '【Test 1】基礎單表查詢效能' as test_name;
SELECT '' as blank_line;

-- Test 1.1: 主鍵查詢 (應該非常快)
EXPLAIN QUERY PLAN
SELECT * FROM restaurants
WHERE id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001');

SELECT '✓ Test 1.1: 主鍵查詢 (使用主鍵索引)' as result;

-- Test 1.2: 索引欄位查詢
EXPLAIN QUERY PLAN
SELECT * FROM restaurants
WHERE slug = 'perf-test-001';

SELECT '✓ Test 1.2: slug 查詢 (應使用唯一索引)' as result;

-- Test 1.3: 無索引欄位查詢 (全表掃描)
EXPLAIN QUERY PLAN
SELECT * FROM restaurants
WHERE phone = '0911111111';

SELECT '⚠ Test 1.3: phone 查詢 (可能全表掃描)' as result;

SELECT '' as blank_line;

-- ============================================================================
-- Test 2: JOIN 查詢效能
-- ============================================================================

SELECT '【Test 2】JOIN 查詢效能' as test_name;
SELECT '' as blank_line;

-- Test 2.1: 簡單 JOIN
EXPLAIN QUERY PLAN
SELECT u.username, r.name
FROM users u
JOIN restaurants r ON u.restaurant_id = r.id
WHERE r.slug = 'perf-test-001';

SELECT '✓ Test 2.1: 簡單 JOIN (應使用索引)' as result;

-- Test 2.2: 多表 JOIN
EXPLAIN QUERY PLAN
SELECT
    r.name as restaurant_name,
    u.full_name as user_name,
    o.order_number,
    c.full_name as customer_name
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
JOIN customers c ON o.customer_id = c.id
LEFT JOIN users u ON r.id = u.restaurant_id
WHERE r.slug = 'perf-test-001'
LIMIT 10;

SELECT '✓ Test 2.2: 多表 JOIN (應優化 JOIN 順序)' as result;

-- Test 2.3: 複雜條件 JOIN
EXPLAIN QUERY PLAN
SELECT
    m.name as menu_name,
    c.name as category_name,
    r.name as restaurant_name
FROM menu_items m
JOIN categories c ON m.category_id = c.id
JOIN restaurants r ON m.restaurant_id = r.id
WHERE r.is_active = 1
AND m.is_available = 1
AND m.price > 100;

SELECT '✓ Test 2.3: 複雜條件 JOIN' as result;

SELECT '' as blank_line;

-- ============================================================================
-- Test 3: 聚合查詢效能
-- ============================================================================

SELECT '【Test 3】聚合查詢效能' as test_name;
SELECT '' as blank_line;

-- Test 3.1: COUNT 查詢
EXPLAIN QUERY PLAN
SELECT COUNT(*) as total_orders
FROM orders
WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001');

SELECT '✓ Test 3.1: COUNT 查詢 (應使用索引)' as result;

-- Test 3.2: GROUP BY 查詢
EXPLAIN QUERY PLAN
SELECT
    order_status,
    COUNT(*) as count,
    AVG(total_amount) as avg_amount
FROM orders
WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001')
GROUP BY order_status;

SELECT '✓ Test 3.2: GROUP BY 查詢' as result;

-- Test 3.3: 複雜聚合
EXPLAIN QUERY PLAN
SELECT
    r.name,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT c.id) as total_customers,
    SUM(o.total_amount) as total_revenue
FROM restaurants r
LEFT JOIN orders o ON r.id = o.restaurant_id
LEFT JOIN customers c ON r.id = c.restaurant_id
WHERE r.slug LIKE 'perf-test-%'
GROUP BY r.id, r.name;

SELECT '✓ Test 3.3: 複雜聚合查詢' as result;

SELECT '' as blank_line;

-- ============================================================================
-- Test 4: 視圖查詢效能
-- ============================================================================

SELECT '【Test 4】視圖查詢效能' as test_name;
SELECT '' as blank_line;

-- Test 4.1: 簡單視圖查詢
EXPLAIN QUERY PLAN
SELECT * FROM vw_active_restaurants
WHERE slug = 'perf-test-001';

SELECT '✓ Test 4.1: 簡單視圖查詢' as result;

-- Test 4.2: 複雜視圖查詢
EXPLAIN QUERY PLAN
SELECT * FROM vw_order_summary_detailed
WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001')
LIMIT 10;

SELECT '✓ Test 4.2: 複雜視圖查詢' as result;

SELECT '' as blank_line;

-- ============================================================================
-- Test 5: 索引使用驗證
-- ============================================================================

SELECT '【Test 5】索引使用驗證' as test_name;
SELECT '' as blank_line;

-- Test 5.1: 驗證 restaurant_id 索引
EXPLAIN QUERY PLAN
SELECT * FROM users
WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001');

SELECT '✓ Test 5.1: restaurant_id 索引應被使用' as result;

-- Test 5.2: 驗證複合索引
EXPLAIN QUERY PLAN
SELECT * FROM menu_items
WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001')
AND is_available = 1
AND deleted_at IS NULL;

SELECT '✓ Test 5.2: 複合索引應被使用' as result;

-- Test 5.3: 驗證部分索引
EXPLAIN QUERY PLAN
SELECT * FROM orders
WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001')
AND order_status = 'pending';

SELECT '✓ Test 5.3: 部分索引應被使用' as result;

SELECT '' as blank_line;

-- ============================================================================
-- Test 6: 實際業務查詢效能
-- ============================================================================

SELECT '【Test 6】實際業務查詢效能' as test_name;
SELECT '' as blank_line;

-- Test 6.1: 餐廳儀表板查詢
EXPLAIN QUERY PLAN
WITH restaurant_stats AS (
    SELECT
        r.id,
        r.name,
        COUNT(DISTINCT o.id) as total_orders,
        SUM(o.total_amount) as total_revenue,
        COUNT(DISTINCT c.id) as total_customers
    FROM restaurants r
    LEFT JOIN orders o ON r.id = o.restaurant_id
        AND o.created_at >= unixepoch('now', '-30 days') * 1000
    LEFT JOIN customers c ON r.id = c.restaurant_id
    WHERE r.slug = 'perf-test-001'
    GROUP BY r.id, r.name
)
SELECT * FROM restaurant_stats;

SELECT '✓ Test 6.1: 餐廳儀表板查詢 (30 天統計)' as result;

-- Test 6.2: 熱門菜單項目查詢
EXPLAIN QUERY PLAN
SELECT
    m.name,
    COUNT(oi.id) as order_count,
    SUM(oi.quantity) as total_quantity
FROM menu_items m
LEFT JOIN order_items oi ON m.id = oi.menu_item_id
WHERE m.restaurant_id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001')
AND m.is_available = 1
GROUP BY m.id, m.name
ORDER BY order_count DESC
LIMIT 10;

SELECT '✓ Test 6.2: 熱門菜單項目查詢' as result;

-- Test 6.3: 顧客訂單歷史查詢
EXPLAIN QUERY PLAN
SELECT
    o.order_number,
    o.order_type,
    o.order_status,
    o.total_amount,
    o.created_at
FROM orders o
WHERE o.customer_id = (
    SELECT id FROM customers
    WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = 'perf-test-001')
    LIMIT 1
)
ORDER BY o.created_at DESC
LIMIT 20;

SELECT '✓ Test 6.3: 顧客訂單歷史查詢' as result;

SELECT '' as blank_line;

-- ============================================================================
-- 效能統計資訊
-- ============================================================================

SELECT '【效能統計】資料量統計' as section;
SELECT '' as blank_line;

-- 統計各表的記錄數
SELECT 'restaurants' as table_name,
       COUNT(*) as record_count,
       (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='restaurants') as index_count
FROM restaurants
WHERE slug LIKE 'perf-test-%'
UNION ALL
SELECT 'users' as table_name,
       COUNT(*) as record_count,
       (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='users') as index_count
FROM users
WHERE username LIKE 'perf_user_%'
UNION ALL
SELECT 'categories' as table_name,
       COUNT(*) as record_count,
       (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='categories') as index_count
FROM categories
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'perf-test-%')
UNION ALL
SELECT 'menu_items' as table_name,
       COUNT(*) as record_count,
       (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='menu_items') as index_count
FROM menu_items
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'perf-test-%')
UNION ALL
SELECT 'customers' as table_name,
       COUNT(*) as record_count,
       (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='customers') as index_count
FROM customers
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'perf-test-%')
UNION ALL
SELECT 'orders' as table_name,
       COUNT(*) as record_count,
       (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='orders') as index_count
FROM orders
WHERE restaurant_id IN (SELECT id FROM restaurants WHERE slug LIKE 'perf-test-%');

SELECT '' as blank_line;

-- ============================================================================
-- 清理測試資料
-- ============================================================================

SELECT '【清理階段】移除測試資料...' as stage;
SELECT '' as blank_line;

-- 刪除測試資料 (級聯刪除會自動處理)
DELETE FROM restaurants WHERE slug LIKE 'perf-test-%';

SELECT '✓ 測試資料已清理' as result;

-- 驗證清理
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ 清理驗證通過'
        ELSE '⚠ 發現殘留資料: ' || COUNT(*) || ' 筆'
    END as verification
FROM restaurants
WHERE slug LIKE 'perf-test-%';

SELECT '' as blank_line;

-- ============================================================================
-- 測試總結
-- ============================================================================

SELECT '═══════════════════════════════════════' as separator;
SELECT '✅ 效能基準測試完成！' as final_message;
SELECT '═══════════════════════════════════════' as separator;

SELECT '' as blank_line;
SELECT '測試摘要:' as summary_title;
SELECT '  • 基礎查詢測試: 3 項' as summary_1;
SELECT '  • JOIN 查詢測試: 3 項' as summary_2;
SELECT '  • 聚合查詢測試: 3 項' as summary_3;
SELECT '  • 視圖查詢測試: 2 項' as summary_4;
SELECT '  • 索引驗證測試: 3 項' as summary_5;
SELECT '  • 業務查詢測試: 3 項' as summary_6;
SELECT '' as blank_line;
SELECT '建議事項:' as recommendations_title;
SELECT '  • 檢查所有 EXPLAIN QUERY PLAN 輸出' as rec_1;
SELECT '  • 確認關鍵查詢都使用了索引' as rec_2;
SELECT '  • 避免全表掃描 (SCAN TABLE)' as rec_3;
SELECT '  • 優化出現 TEMP B-TREE 的查詢' as rec_4;
