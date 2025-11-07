-- =====================================================
-- 策略：嘗試直接 RENAME _new 表
-- 如果失敗（因為舊表存在），我們會手動處理
-- =====================================================

PRAGMA foreign_keys=OFF;

-- 核心表
ALTER TABLE users_new RENAME TO users;
ALTER TABLE categories_new RENAME TO categories;
ALTER TABLE menu_items_new RENAME TO menu_items;
ALTER TABLE tables_new RENAME TO tables;
ALTER TABLE orders_new RENAME TO orders;

PRAGMA foreign_keys=ON;
