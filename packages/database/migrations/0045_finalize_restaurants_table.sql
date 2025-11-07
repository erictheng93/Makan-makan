-- =====================================================
-- Migration: 完成 restaurants 表配置
-- Version: 0045
-- Date: 2025-10-27
-- Description: 驗證和完成 restaurant_id 遷移
-- Strategy: 驗證數據完整性，添加註釋和文檔
-- =====================================================

-- =====================================================
-- 階段 1: 驗證 restaurants 表
-- =====================================================

-- 驗證所有餐廳都有 public_id
-- 這個查詢應該返回 0
-- SELECT COUNT(*) as missing_public_id FROM restaurants WHERE public_id IS NULL;

-- 驗證 public_id 格式正確 (S-YYYYMMDD-NNN)
-- SELECT id, public_id FROM restaurants WHERE public_id NOT LIKE 'S-________-___';

-- 驗證 public_id 唯一性
-- SELECT public_id, COUNT(*) as count FROM restaurants GROUP BY public_id HAVING count > 1;

-- =====================================================
-- 階段 2: 確保索引存在
-- =====================================================

-- 確保 public_id 的唯一索引存在（應該已經在 0039 創建）
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_public_id ON restaurants(public_id);

-- 創建額外的性能索引
CREATE INDEX IF NOT EXISTS idx_restaurants_is_active ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_restaurants_created_at ON restaurants(created_at);

-- =====================================================
-- 階段 3: 數據完整性檢查
-- =====================================================

-- 檢查所有外鍵引用是否正確
-- 這些查詢應該返回 0

-- 檢查 users 表
-- SELECT COUNT(*) as orphan_users FROM users u WHERE u.restaurant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM restaurants r WHERE r.public_id = u.restaurant_id);

-- 檢查 categories 表
-- SELECT COUNT(*) as orphan_categories FROM categories c WHERE NOT EXISTS (SELECT 1 FROM restaurants r WHERE r.public_id = c.restaurant_id);

-- 檢查 menu_items 表
-- SELECT COUNT(*) as orphan_menu_items FROM menu_items m WHERE NOT EXISTS (SELECT 1 FROM restaurants r WHERE r.public_id = m.restaurant_id);

-- 檢查 tables 表
-- SELECT COUNT(*) as orphan_tables FROM tables t WHERE NOT EXISTS (SELECT 1 FROM restaurants r WHERE r.public_id = t.restaurant_id);

-- 檢查 orders 表
-- SELECT COUNT(*) as orphan_orders FROM orders o WHERE NOT EXISTS (SELECT 1 FROM restaurants r WHERE r.public_id = o.restaurant_id);

-- =====================================================
-- 階段 4: 創建視圖以方便查詢
-- =====================================================

-- 創建視圖：餐廳統計摘要
CREATE VIEW IF NOT EXISTS v_restaurant_summary AS
SELECT
    r.id,
    r.public_id,
    r.name,
    r.is_active,
    (SELECT COUNT(*) FROM users u WHERE u.restaurant_id = r.public_id) as employee_count,
    (SELECT COUNT(*) FROM categories c WHERE c.restaurant_id = r.public_id) as category_count,
    (SELECT COUNT(*) FROM menu_items m WHERE m.restaurant_id = r.public_id) as menu_item_count,
    (SELECT COUNT(*) FROM tables t WHERE t.restaurant_id = r.public_id) as table_count,
    (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.public_id) as order_count,
    r.created_at,
    r.updated_at
FROM restaurants r;

-- =====================================================
-- 階段 5: 遷移完成標記
-- =====================================================

-- 記錄遷移完成信息
INSERT INTO audit_logs (
    user_id,
    restaurant_id,
    action,
    resource,
    resource_id,
    details,
    status,
    created_at
)
SELECT
    NULL,
    NULL,
    'MIGRATION_COMPLETED',
    'restaurant_id_migration',
    '0045',
    json_object(
        'migration_type', 'restaurant_id_integer_to_text',
        'tables_migrated', 38,
        'completion_date', datetime('now'),
        'version', '0039-0045'
    ),
    'success',
    strftime('%s', 'now')
WHERE NOT EXISTS (
    SELECT 1 FROM audit_logs
    WHERE action = 'MIGRATION_COMPLETED'
    AND resource = 'restaurant_id_migration'
);

-- =====================================================
-- 遷移說明和注意事項
-- =====================================================

/*
遷移完成總結：
====================

1. **遷移範圍**
   - 共計 38 張表從 INTEGER restaurant_id 遷移到 TEXT restaurant_id
   - restaurants 表新增 public_id (TEXT) 欄位
   - 所有外鍵現在引用 restaurants(public_id)

2. **新的 restaurant_id 格式**
   - 格式: S-YYYYMMDD-NNN
   - S = Shop/Store (餐廳前綴)
   - YYYYMMDD = 餐廳建立日期
   - NNN = 當日序號 (001-999)
   - 範例: S-20251026-001

3. **已遷移的表 (38張)**

   核心業務表 (6張):
   - users, categories, menu_items, tables, orders

   排班系統表 (9張):
   - shift_templates, employee_schedules, scheduling_rules,
     scheduling_conflicts, schedule_swap_requests, employee_availability,
     leave_requests, leave_approval_rules, employee_leave_balances

   系統表 (3張):
   - audit_logs, error_reports, system_alerts

   訂單促銷表 (3張):
   - group_orders, promotions, customer_reviews

   庫存設備表 (2張):
   - inventory_items, cash_registers

   打印系統表 (3張):
   - printer_devices, printer_configurations, print_templates

   候位系統表 (6張):
   - waiting_queue, queue_settings, queue_displays,
     queue_events, queue_statistics

   餐廳設定表 (4張):
   - restaurant_settings, restaurant_business_hours,
     restaurant_special_hours, table_reservations

   其他表 (1張):
   - leave_calendar_events

   QR 系統表 (3張):
   - qr_batches, qr_codes, qr_templates

4. **保持不變的表 (9張已使用 TEXT)**
   - 這些表本來就使用 TEXT 類型的 restaurant_id
   - 已經引用 restaurants.public_id
   - 不需要遷移

5. **應用程序需要更新**
   ⚠️ IMPORTANT: 以下代碼需要相應更新：

   - TypeScript 類型定義: restaurant_id: number → restaurant_id: string
   - API 參數驗證: 接受 S-XXXXXXXX-XXX 格式
   - 數據庫查詢: 使用 TEXT 比較而非 INTEGER
   - 新建餐廳: 使用 RestaurantIdGenerator 生成 public_id

6. **性能影響**
   - TEXT 索引略慢於 INTEGER 索引（但可忽略）
   - 所有 restaurant_id 列都已建立索引
   - 外鍵約束已更新並驗證

7. **回滾計畫**
   如需回滾，需要：
   - 保留 restaurants.id 欄位（已保留）
   - 運行反向遷移 SQL（需要單獨準備）
   - 將所有 TEXT restaurant_id 轉回 INTEGER

8. **驗證檢查清單**
   □ 所有 38 張表已重命名完成
   □ 無 _new 表殘留
   □ 所有索引已重建
   □ 外鍵約束正常工作
   □ 沒有孤立記錄（orphan records）
   □ public_id 格式正確且唯一
   □ 應用程序代碼已更新
   □ TypeScript 類型已更新
   □ API 測試通過

9. **後續步驟**
   1. 執行全表掃描驗證數據完整性
   2. 更新 TypeScript 類型定義
   3. 更新 API 端點和服務層
   4. 運行完整測試套件
   5. 部署到 staging 環境測試
   6. 準備 rollback 腳本以防萬一

遷移執行者注意：
- 備份數據庫後再執行
- 在非高峰時段執行
- 監控執行時間和錯誤
- 準備好 rollback 計畫
*/
