-- Schema Optimization Migration
-- Created: 2025-12-06
-- Purpose: Phase 1 補充索引 + Phase 2 軟刪除支援

-- ============================================================================
-- PHASE 1: 補充關鍵索引（核心業務表）
-- ============================================================================

-- 1. 用戶表：活躍員工查詢優化（補充 isActive 條件）
CREATE INDEX IF NOT EXISTS idx_users_restaurant_role_active
  ON users(restaurant_id, role, is_active);

-- 2. 訂單表：客戶訂單歷史查詢優化
CREATE INDEX IF NOT EXISTS idx_orders_customer_history
  ON orders(customer_id, created_at DESC);

-- 3. 群組訂單：分享碼查詢優化
CREATE INDEX IF NOT EXISTS idx_group_orders_share_code
  ON group_orders(share_code);

-- ============================================================================
-- PHASE 2: 軟刪除支援（核心業務表）
-- ============================================================================

-- 1. 用戶表軟刪除
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at);

-- 2. 餐廳表軟刪除
ALTER TABLE restaurants ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_restaurants_deleted ON restaurants(deleted_at);

-- 3. 菜單項目表軟刪除
ALTER TABLE menu_items ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted ON menu_items(deleted_at);

-- 4. 分類表軟刪除
ALTER TABLE categories ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_categories_deleted ON categories(deleted_at);

-- 5. 桌位表軟刪除
ALTER TABLE tables ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_tables_deleted ON tables(deleted_at);

-- 6. 座位表軟刪除
ALTER TABLE seats ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_seats_deleted ON seats(deleted_at);

-- 7. 優惠券表軟刪除
ALTER TABLE coupons ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_coupons_deleted ON coupons(deleted_at);

-- ============================================================================
-- 更新統計資訊
-- ============================================================================

ANALYZE users;
ANALYZE restaurants;
ANALYZE menu_items;
ANALYZE categories;
ANALYZE tables;
ANALYZE orders;
ANALYZE order_items;
ANALYZE sessions;

-- ============================================================================
-- 使用說明
-- ============================================================================

-- 軟刪除使用方式：
-- 1. 刪除操作改為：UPDATE users SET deleted_at = unixepoch() WHERE id = ?
-- 2. 查詢時增加條件：WHERE deleted_at IS NULL
-- 3. 恢復操作：UPDATE users SET deleted_at = NULL WHERE id = ?
-- 4. 永久刪除（定期清理）：DELETE FROM users WHERE deleted_at < unixepoch() - 7776000 (90天)

-- ============================================================================
-- ROLLBACK (如需回滾)
-- ============================================================================

/*
DROP INDEX IF EXISTS idx_users_restaurant_role_active;
DROP INDEX IF EXISTS idx_orders_customer_history;
DROP INDEX IF EXISTS idx_group_orders_share_code;
DROP INDEX IF EXISTS idx_users_deleted;
DROP INDEX IF EXISTS idx_restaurants_deleted;
DROP INDEX IF EXISTS idx_menu_items_deleted;
DROP INDEX IF EXISTS idx_categories_deleted;
DROP INDEX IF EXISTS idx_tables_deleted;
DROP INDEX IF EXISTS idx_seats_deleted;
DROP INDEX IF EXISTS idx_coupons_deleted;

-- 注意：SQLite 不支援 DROP COLUMN，需要重建表才能移除 deleted_at 欄位
*/
