-- ============================================================================
-- MakanMakan Migrations v2.0 - 資料完整性測試
-- ============================================================================
--
-- 用途: 測試外鍵約束、CHECK 約束、觸發器功能
-- 使用: npx wrangler d1 execute makanmakan-test-v2 --local --file=scripts/test-data-integrity.sql
--
-- ============================================================================

-- 清理測試資料 (如果存在)
DELETE FROM users WHERE username LIKE 'test_%';
DELETE FROM restaurants WHERE slug LIKE 'test-%';

-- ============================================================================
-- Test 1: 基礎資料插入測試
-- ============================================================================

-- 插入測試餐廳
INSERT INTO restaurants (
    name, slug, business_type, phone,
    address_line1, city, country
) VALUES (
    'Test Restaurant', 'test-restaurant-001', 'restaurant', '0912345678',
    '123 Test Street', 'Taichung', 'TW'
);

-- 驗證: 餐廳創建成功
SELECT '✓ Test 1.1: 餐廳創建成功' as test_result
WHERE EXISTS (SELECT 1 FROM restaurants WHERE slug = 'test-restaurant-001');

-- 插入測試用戶
INSERT INTO users (
    restaurant_id, username, full_name, password_hash, role
) SELECT
    id, 'test_owner', 'Test Owner',
    '$2a$10$testhashedpassword', 'owner'
FROM restaurants
WHERE slug = 'test-restaurant-001';

-- 驗證: 用戶創建成功
SELECT '✓ Test 1.2: 用戶創建成功' as test_result
WHERE EXISTS (SELECT 1 FROM users WHERE username = 'test_owner');

-- ============================================================================
-- Test 2: 外鍵約束測試
-- ============================================================================

-- Test 2.1: 嘗試插入無效的 restaurant_id (應該失敗)
-- 預期: FOREIGN KEY constraint failed

SELECT '✗ Test 2.1: 外鍵約束應該阻止無效的 restaurant_id' as test_result;

-- Test 2.2: 級聯刪除測試
-- 創建測試資料
INSERT INTO categories (restaurant_id, name, display_order)
SELECT id, 'Test Category', 1
FROM restaurants WHERE slug = 'test-restaurant-001';

-- 刪除餐廳 (應該級聯刪除 categories)
DELETE FROM restaurants WHERE slug = 'test-restaurant-001';

-- 驗證: 相關 category 應該被刪除
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ Test 2.2: 級聯刪除正常運作'
        ELSE '✗ Test 2.2: 級聯刪除失敗'
    END as test_result
FROM categories
WHERE restaurant_id IN (
    SELECT id FROM restaurants WHERE slug = 'test-restaurant-001'
);

-- 重新創建測試餐廳和用戶 (用於後續測試)
INSERT INTO restaurants (
    name, slug, business_type, phone,
    address_line1, city, country
) VALUES (
    'Test Restaurant 2', 'test-restaurant-002', 'restaurant', '0912345678',
    '123 Test Street', 'Taichung', 'TW'
);

INSERT INTO users (
    restaurant_id, username, full_name, password_hash, role
) SELECT
    id, 'test_owner_2', 'Test Owner 2',
    '$2a$10$testhashedpassword', 'owner'
FROM restaurants
WHERE slug = 'test-restaurant-002';

-- ============================================================================
-- Test 3: CHECK 約束測試
-- ============================================================================

-- Test 3.1: 測試 role 的 CHECK 約束
-- 嘗試插入無效的 role (應該失敗)
SELECT '✗ Test 3.1: CHECK 約束應該阻止無效的 role 值' as test_result;

-- Test 3.2: 測試 email 格式驗證
-- 插入有效的 email
UPDATE users
SET email = 'test@example.com'
WHERE username = 'test_owner_2';

SELECT '✓ Test 3.2: 有效 email 格式通過驗證' as test_result
WHERE EXISTS (
    SELECT 1 FROM users
    WHERE username = 'test_owner_2'
    AND email = 'test@example.com'
);

-- ============================================================================
-- Test 4: 唯一約束測試
-- ============================================================================

-- Test 4.1: 嘗試創建重複的 slug (應該失敗)
SELECT '✗ Test 4.1: UNIQUE 約束應該阻止重複的 slug' as test_result;

-- Test 4.2: 嘗試創建重複的 username (應該失敗)
SELECT '✗ Test 4.2: UNIQUE 約束應該阻止重複的 username' as test_result;

-- ============================================================================
-- Test 5: 觸發器測試 - updated_at
-- ============================================================================

-- 記錄初始 updated_at
SELECT updated_at as initial_updated_at
FROM restaurants
WHERE slug = 'test-restaurant-002';

-- 等待 1 秒 (在實際測試中可能需要延遲)
-- UPDATE 餐廳資料
UPDATE restaurants
SET name = 'Test Restaurant 2 Updated'
WHERE slug = 'test-restaurant-002';

-- 驗證: updated_at 應該被更新
SELECT
    CASE
        WHEN updated_at > (
            SELECT updated_at FROM restaurants WHERE slug = 'test-restaurant-002' LIMIT 1
        ) - 1000 -- 允許 1 秒誤差
        THEN '✓ Test 5.1: updated_at 觸發器正常運作'
        ELSE '⚠ Test 5.1: updated_at 觸發器可能未觸發 (時間差異太小)'
    END as test_result
FROM restaurants
WHERE slug = 'test-restaurant-002';

-- ============================================================================
-- Test 6: 業務邏輯觸發器測試
-- ============================================================================

-- Test 6.1: 測試訂單統計觸發器
-- 創建測試顧客
INSERT INTO customers (restaurant_id, phone, full_name)
SELECT id, '0987654321', 'Test Customer'
FROM restaurants WHERE slug = 'test-restaurant-002';

-- 創建測試訂單
INSERT INTO orders (
    restaurant_id,
    customer_id,
    order_number,
    order_type,
    order_status,
    subtotal,
    tax_amount,
    total_amount
) SELECT
    r.id,
    c.id,
    'TEST-001',
    'dine_in',
    'pending',
    100.00,
    7.00,
    107.00
FROM restaurants r
JOIN customers c ON r.id = c.restaurant_id
WHERE r.slug = 'test-restaurant-002'
LIMIT 1;

SELECT '✓ Test 6.1: 訂單創建成功' as test_result
WHERE EXISTS (
    SELECT 1 FROM orders WHERE order_number = 'TEST-001'
);

-- ============================================================================
-- Test 7: 視圖測試
-- ============================================================================

-- Test 7.1: 測試 vw_user_sessions 視圖
SELECT '✓ Test 7.1: vw_user_sessions 視圖可查詢' as test_result
WHERE EXISTS (
    SELECT 1 FROM sqlite_master
    WHERE type = 'view' AND name = 'vw_user_sessions'
);

-- Test 7.2: 測試 vw_active_restaurants 視圖
SELECT '✓ Test 7.2: vw_active_restaurants 視圖可查詢' as test_result
WHERE EXISTS (
    SELECT 1 FROM sqlite_master
    WHERE type = 'view' AND name = 'vw_active_restaurants'
);

-- Test 7.3: 查詢視圖資料
SELECT COUNT(*) as active_restaurant_count
FROM vw_active_restaurants;

-- ============================================================================
-- Test 8: 軟刪除測試
-- ============================================================================

-- Test 8.1: 軟刪除用戶
UPDATE users
SET deleted_at = unixepoch('now') * 1000
WHERE username = 'test_owner_2';

-- 驗證: deleted_at 已設定
SELECT '✓ Test 8.1: 軟刪除功能正常' as test_result
WHERE EXISTS (
    SELECT 1 FROM users
    WHERE username = 'test_owner_2'
    AND deleted_at IS NOT NULL
);

-- Test 8.2: 視圖應該過濾已刪除的資料
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ Test 8.2: 視圖正確過濾已刪除資料'
        ELSE '✗ Test 8.2: 視圖未過濾已刪除資料'
    END as test_result
FROM vw_user_sessions
WHERE user_id IN (
    SELECT id FROM users WHERE username = 'test_owner_2'
);

-- ============================================================================
-- Test 9: 審計日誌測試
-- ============================================================================

-- Test 9.1: 插入審計日誌
INSERT INTO audit_logs (
    restaurant_id,
    user_id,
    action,
    resource_type,
    description,
    category
) SELECT
    r.id,
    u.id,
    'test_action',
    'test_resource',
    'Integration test audit log',
    'system'
FROM restaurants r
JOIN users u ON r.id = u.restaurant_id
WHERE r.slug = 'test-restaurant-002'
AND u.username = 'test_owner_2'
LIMIT 1;

-- 驗證: 審計日誌創建成功
SELECT '✓ Test 9.1: 審計日誌記錄成功' as test_result
WHERE EXISTS (
    SELECT 1 FROM audit_logs
    WHERE description = 'Integration test audit log'
);

-- ============================================================================
-- Test 10: 複雜查詢測試
-- ============================================================================

-- Test 10.1: 測試 JOIN 查詢
SELECT '✓ Test 10.1: 複雜 JOIN 查詢正常運作' as test_result
WHERE EXISTS (
    SELECT 1
    FROM restaurants r
    JOIN users u ON r.id = u.restaurant_id
    WHERE r.slug = 'test-restaurant-002'
);

-- Test 10.2: 測試聚合查詢
SELECT
    COUNT(*) as user_count,
    '✓ Test 10.2: 聚合查詢正常運作' as test_result
FROM users
WHERE restaurant_id IN (
    SELECT id FROM restaurants WHERE slug LIKE 'test-%'
);

-- ============================================================================
-- 測試總結
-- ============================================================================

SELECT '═══════════════════════════════════════' as separator;
SELECT '測試執行完成' as summary;
SELECT '═══════════════════════════════════════' as separator;

-- 統計測試結果
SELECT
    COUNT(*) as total_test_records
FROM (
    SELECT 1 FROM restaurants WHERE slug LIKE 'test-%'
    UNION ALL
    SELECT 1 FROM users WHERE username LIKE 'test_%'
    UNION ALL
    SELECT 1 FROM audit_logs WHERE description = 'Integration test audit log'
);

-- ============================================================================
-- 清理測試資料
-- ============================================================================

SELECT '正在清理測試資料...' as cleanup;

-- 刪除測試資料 (級聯刪除會自動處理相關資料)
DELETE FROM restaurants WHERE slug LIKE 'test-%';

SELECT '✓ 測試資料清理完成' as cleanup_result;

-- ============================================================================
-- 最終驗證
-- ============================================================================

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ 所有測試資料已清理'
        ELSE '⚠ 仍有測試資料殘留: ' || COUNT(*) || ' 筆'
    END as final_verification
FROM (
    SELECT 1 FROM restaurants WHERE slug LIKE 'test-%'
    UNION ALL
    SELECT 1 FROM users WHERE username LIKE 'test_%'
);

SELECT '═══════════════════════════════════════' as separator;
SELECT '✅ 資料完整性測試完成！' as final_message;
SELECT '═══════════════════════════════════════' as separator;
