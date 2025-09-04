-- Database Index Optimization Migration
-- Created: 2025-09-03
-- Description: Adds compound indexes and performance optimizations for common queries

-- =================================================================
-- 1. 複合索引優化 - 提升常用查詢性能
-- =================================================================

-- 訂單查詢優化 (餐廳+狀態+時間) - 最常用的查詢模式
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_time 
ON orders(restaurant_id, status, created_at DESC);

-- 訂單按日期範圍查詢優化
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_date_status 
ON orders(restaurant_id, DATE(created_at), status, total_amount);

-- 菜單項目多維度查詢優化 (餐廳+可用性+分類+排序)
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available_category 
ON menu_items(restaurant_id, is_available, category_id, sort_order);

-- 菜單項目價格範圍查詢
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_price 
ON menu_items(restaurant_id, is_available, price);

-- 推薦和熱門菜單查詢
CREATE INDEX IF NOT EXISTS idx_menu_items_featured_popular 
ON menu_items(restaurant_id, is_featured, is_available, sort_order);

-- 用戶角色查詢優化 (餐廳+角色+狀態)
CREATE INDEX IF NOT EXISTS idx_users_restaurant_role_status 
ON users(restaurant_id, role, status);

-- 用戶最後登入時間查詢
CREATE INDEX IF NOT EXISTS idx_users_last_login 
ON users(restaurant_id, last_login_at DESC);

-- =================================================================
-- 2. 桌台管理索引優化
-- =================================================================

-- 桌台狀態查詢 (餐廳+狀態+容量)
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status_capacity 
ON tables(restaurant_id, status, capacity);

-- QR碼查詢優化
CREATE INDEX IF NOT EXISTS idx_tables_qr_active 
ON tables(qr_code, restaurant_id) WHERE qr_code IS NOT NULL;

-- =================================================================
-- 3. 訂單項目查詢優化
-- =================================================================

-- 訂單項目狀態追蹤 (訂單+狀態)
CREATE INDEX IF NOT EXISTS idx_order_items_order_status 
ON order_items(order_id, status, updated_at);

-- 菜單項目銷售分析 (菜單項目+時間)
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_time 
ON order_items(menu_item_id, DATE(created_at), quantity);

-- 廚師工作台查詢 (狀態+創建時間)
CREATE INDEX IF NOT EXISTS idx_order_items_prep_status_time 
ON order_items(status, created_at) WHERE status IN ('pending', 'preparing');

-- =================================================================
-- 4. QR 碼系統索引優化
-- =================================================================

-- QR 碼掃描分析優化
CREATE INDEX IF NOT EXISTS idx_qr_scans_code_success_time 
ON qr_scans(qr_code_id, scan_success, scanned_at DESC);

-- QR 碼下載統計優化
CREATE INDEX IF NOT EXISTS idx_qr_downloads_code_time 
ON qr_downloads(qr_code_id, downloaded_at DESC);

-- QR 碼餐廳關聯查詢
CREATE INDEX IF NOT EXISTS idx_qr_codes_restaurant_active 
ON qr_codes(restaurant_id, is_active, is_deleted);

-- QR 模板使用統計
CREATE INDEX IF NOT EXISTS idx_qr_templates_usage_public 
ON qr_templates(is_public, usage_count DESC, is_active);

-- =================================================================
-- 5. 審計日誌索引優化
-- =================================================================

-- 審計日誌用戶操作查詢 (用戶+時間)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time 
ON audit_logs(user_id, created_at DESC);

-- 審計日誌資源操作查詢 (資源+動作+時間)
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_action_time 
ON audit_logs(resource, action, created_at DESC);

-- 審計日誌餐廳操作查詢 (如果有 restaurant_id 欄位)
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_time 
ON audit_logs(resource_id, created_at DESC) 
WHERE resource IN ('restaurants', 'menu_items', 'orders');

-- =================================================================
-- 6. 會話管理索引優化
-- =================================================================

-- 活躍會話查詢 (用戶+過期時間)
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires 
ON sessions(user_id, expires_at DESC);

-- 會話清理查詢 (過期時間)
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup 
ON sessions(expires_at) WHERE expires_at < datetime('now');

-- =================================================================
-- 7. 新增表格索引 (基於之前的 additional_tables)
-- =================================================================

-- 訂單狀態歷史追蹤
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_time 
ON order_status_history(order_id, created_at DESC);

-- 黑名單 Token 查詢優化
CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_jti_expires 
ON blacklisted_tokens(token_jti, expires_at);

-- 菜單選項查詢
CREATE INDEX IF NOT EXISTS idx_menu_item_options_item_type 
ON menu_item_options(menu_item_id, option_type, is_required);

-- 客戶評價查詢
CREATE INDEX IF NOT EXISTS idx_customer_reviews_restaurant_rating_time 
ON customer_reviews(restaurant_id, rating, created_at DESC, status);

-- 庫存管理查詢
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_category_status 
ON inventory_items(restaurant_id, category, status, current_stock);

-- 庫存異動記錄
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_type_time 
ON stock_movements(inventory_item_id, movement_type, created_at DESC);

-- 桌台訂位查詢
CREATE INDEX IF NOT EXISTS idx_table_reservations_restaurant_date_status 
ON table_reservations(restaurant_id, reservation_date, status);

-- 支付交易查詢
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_status_time 
ON payment_transactions(order_id, status, created_at DESC);

-- =================================================================
-- 8. 文本搜索優化 (如果需要)
-- =================================================================

-- 菜單項目名稱搜索 (SQLite FTS5 - 可選)
-- 注意：這需要 FTS5 擴展，在生產環境確認可用性
-- CREATE VIRTUAL TABLE IF NOT EXISTS menu_items_fts USING fts5(
--     name, description, content='menu_items', content_rowid='id'
-- );

-- 客戶搜索索引
CREATE INDEX IF NOT EXISTS idx_orders_customer_search 
ON orders(restaurant_id, customer_phone, customer_name);

-- =================================================================
-- 9. 統計和分析索引
-- =================================================================

-- 銷售分析 - 按日期統計
CREATE INDEX IF NOT EXISTS idx_orders_revenue_analysis 
ON orders(restaurant_id, DATE(created_at), status) 
WHERE status IN ('completed', 'paid');

-- 熱門時段分析
CREATE INDEX IF NOT EXISTS idx_orders_hourly_analysis 
ON orders(restaurant_id, strftime('%H', created_at), DATE(created_at));

-- 客戶行為分析
CREATE INDEX IF NOT EXISTS idx_orders_customer_behavior 
ON orders(customer_phone, restaurant_id, created_at DESC) 
WHERE customer_phone IS NOT NULL;

-- 桌台使用率分析
CREATE INDEX IF NOT EXISTS idx_orders_table_utilization 
ON orders(table_id, DATE(created_at), status);

-- =================================================================
-- 10. 特殊業務邏輯索引
-- =================================================================

-- 未完成訂單追蹤
CREATE INDEX IF NOT EXISTS idx_orders_pending_preparation 
ON orders(restaurant_id, status, estimated_ready_time) 
WHERE status IN ('pending', 'confirmed', 'preparing');

-- 逾期訂單查詢
CREATE INDEX IF NOT EXISTS idx_orders_overdue 
ON orders(restaurant_id, estimated_ready_time, status) 
WHERE estimated_ready_time < datetime('now') 
  AND status IN ('preparing', 'ready');

-- 今日新客戶統計
CREATE INDEX IF NOT EXISTS idx_orders_new_customers_today 
ON orders(restaurant_id, customer_phone, DATE(created_at));

-- =================================================================
-- 11. 索引使用統計和監控
-- =================================================================

-- 創建索引使用情況監控視圖
CREATE VIEW IF NOT EXISTS index_usage_stats AS
SELECT 
    name as index_name,
    tbl as table_name,
    sql as index_definition
FROM sqlite_master 
WHERE type = 'index' 
  AND name LIKE 'idx_%'
ORDER BY tbl, name;

-- 表大小統計視圖
CREATE VIEW IF NOT EXISTS table_size_stats AS
SELECT 
    name as table_name,
    (SELECT COUNT(*) FROM sqlite_master WHERE tbl_name = name AND type = 'index') as index_count
FROM sqlite_master 
WHERE type = 'table' 
  AND name NOT LIKE 'sqlite_%'
ORDER BY name;

-- =================================================================
-- 結束註釋
-- =================================================================

-- 索引創建完成
-- 注意事項：
-- 1. 這些索引會增加寫入操作的開銷，但顯著提升讀取性能
-- 2. 在生產環境中應該監控索引的實際使用情況
-- 3. 定期使用 ANALYZE 命令更新統計信息
-- 4. 考慮根據實際查詢模式調整索引策略