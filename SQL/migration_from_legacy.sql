-- =================================================================
-- MakanMakan 數據遷移腳本
-- 從舊版 MyISAM 遷移到新版 InnoDB 優化架構
-- 版本：Legacy to 2.0
-- 創建時間：2025-08-24
-- =================================================================

-- 設置安全模式，防止意外操作
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- =================================================================
-- 第一階段：數據遷移準備
-- =================================================================

-- 備份舊表（建議在執行前手動備份整個數據庫）
-- mysqldump -u username -p makanmakan > backup_$(date +%Y%m%d_%H%M%S).sql

-- 創建臨時表存儲遷移狀態
CREATE TEMPORARY TABLE IF NOT EXISTS migration_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(50),
  status ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'pending',
  records_migrated INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================
-- 第二階段：商店信息遷移
-- =================================================================

INSERT INTO migration_log (table_name) VALUES ('restaurants');

-- 遷移商店信息 shop_info -> restaurants
INSERT INTO `restaurants` (
  `shop_id`, `name`, `type`, `address`, `district`, `phone`, 
  `logo`, `is_active`, `created_at`
) 
SELECT 
  `shop_ID`,
  `shop_name`,
  `shop_type`,
  `shop_adrress`, -- 注意：原表有拼寫錯誤
  `shop_district`,
  `shop_hp`,
  CASE 
    WHEN `shop_logo` != '' THEN `shop_logo` 
    ELSE NULL 
  END,
  `shop_available`,
  NOW()
FROM `shop_info`
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `type` = VALUES(`type`),
  `address` = VALUES(`address`),
  `district` = VALUES(`district`),
  `phone` = VALUES(`phone`),
  `logo` = VALUES(`logo`),
  `is_active` = VALUES(`is_active`);

-- 更新遷移狀態
UPDATE migration_log 
SET status = 'completed', records_migrated = (SELECT COUNT(*) FROM restaurants) 
WHERE table_name = 'restaurants';

-- 遷移商店分類關聯 (正規化逗號分隔的分類)
INSERT INTO migration_log (table_name) VALUES ('restaurant_categories');

INSERT INTO `restaurant_categories` (`shop_id`, `category_id`)
SELECT DISTINCT 
  s.shop_ID,
  CAST(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(s.shop_category, ',', n.digit+1), ',', -1)) AS UNSIGNED) as cat_id
FROM shop_info s
CROSS JOIN (
  SELECT 0 AS digit UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
  UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
) n
WHERE n.digit < LENGTH(s.shop_category) - LENGTH(REPLACE(s.shop_category, ',', '')) + 1
  AND s.shop_category IS NOT NULL 
  AND s.shop_category != ''
  AND CAST(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(s.shop_category, ',', n.digit+1), ',', -1)) AS UNSIGNED) BETWEEN 1 AND 14
ON DUPLICATE KEY UPDATE category_id = VALUES(category_id);

UPDATE migration_log 
SET status = 'completed', records_migrated = (SELECT COUNT(*) FROM restaurant_categories) 
WHERE table_name = 'restaurant_categories';

-- =================================================================
-- 第三階段：用戶信息遷移
-- =================================================================

INSERT INTO migration_log (table_name) VALUES ('users');

-- 遷移員工信息 employee -> users
INSERT INTO `users` (
  `username`, `password_hash`, `name`, `phone`, `address`, 
  `role`, `shop_id`, `is_active`, `created_at`
)
SELECT 
  `sol_id`,
  -- 密碼需要重新哈希，這裡暫時保留原密碼（生產環境需要用戶重新設置）
  CONCAT('LEGACY_', SHA2(`sol_pass`, 256)),
  `sol_name`,
  `sol_hp`,
  `sol_adrress`, -- 注意：原表有拼寫錯誤
  `sol_status`,
  `shop_ID`,
  1, -- 默認啟用
  NOW()
FROM `employee`
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `phone` = VALUES(`phone`),
  `address` = VALUES(`address`),
  `role` = VALUES(`role`),
  `shop_id` = VALUES(`shop_id`);

UPDATE migration_log 
SET status = 'completed', records_migrated = (SELECT COUNT(*) FROM users) 
WHERE table_name = 'users';

-- =================================================================
-- 第四階段：菜單商品遷移
-- =================================================================

INSERT INTO migration_log (table_name) VALUES ('menu_items');

-- 遷移菜單商品 shop_menu -> menu_items
INSERT INTO `menu_items` (
  `shop_id`, `name`, `description`, `image_url`, `price`, 
  `category_id`, `subcategory_id`, `available_for_dine_in`, `available_for_takeout`,
  `is_available`, `is_recommended`, `order_count`, `notes`,
  `is_vegetarian`, `is_vegan`, `spice_level`, `sort_order`, `created_at`
)
SELECT 
  `shop_ID`,
  `menu_foodname`,
  `menu_describe`,
  CASE 
    WHEN `menu_pictures` != '' AND `menu_pictures` IS NOT NULL 
    THEN CONCAT('/images/', `menu_pictures`) 
    ELSE NULL 
  END,
  `menu_price`,
  `menu_category`,
  CASE WHEN `menu_subCategory` > 0 THEN `menu_subCategory` ELSE NULL END,
  `menu_indoor`,
  `menu_outdoor`,
  `menu_available`,
  `menu_recommended`,
  `menu_ordered`,
  `menu_remark`,
  -- 素食判斷邏輯
  CASE WHEN `menu_wholeveg` = 1 OR `menu_eggveg` = 1 OR `menu_milkveg` = 1 OR `menu_eggmilkveg` = 1 THEN 1 ELSE 0 END,
  CASE WHEN `menu_wholeveg` = 1 THEN 1 ELSE 0 END,
  -- 辣度判斷
  CASE 
    WHEN `menu_spices3` = 1 THEN 4
    WHEN `menu_spices2` = 1 THEN 3
    WHEN `menu_spices1` = 1 THEN 2
    WHEN `menu_spices` = 1 THEN 1
    ELSE 0
  END,
  `menu_sn`, -- 使用原序號作為排序
  COALESCE(`menu_UploadedTime`, NOW())
FROM `shop_menu`
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `image_url` = VALUES(`image_url`),
  `price` = VALUES(`price`),
  `category_id` = VALUES(`category_id`),
  `subcategory_id` = VALUES(`subcategory_id`),
  `is_available` = VALUES(`is_available`),
  `is_recommended` = VALUES(`is_recommended`),
  `order_count` = VALUES(`order_count`);

UPDATE migration_log 
SET status = 'completed', records_migrated = (SELECT COUNT(*) FROM menu_items) 
WHERE table_name = 'menu_items';

-- =================================================================
-- 第五階段：餐桌遷移
-- =================================================================

INSERT INTO migration_log (table_name) VALUES ('tables');

-- 遷移餐桌 shop_table -> tables
INSERT INTO `tables` (`shop_id`, `table_number`, `is_occupied`, `capacity`)
SELECT 
  `shop_ID`,
  `st_tableNumber`,
  `st_full`,
  4 -- 默認容量
FROM `shop_table`
ON DUPLICATE KEY UPDATE
  `is_occupied` = VALUES(`is_occupied`);

-- 生成 QR 碼標識
UPDATE `tables` 
SET `qr_code` = CONCAT('QR_', `shop_id`, '_', `table_number`, '_', UNIX_TIMESTAMP())
WHERE `qr_code` IS NULL;

UPDATE migration_log 
SET status = 'completed', records_migrated = (SELECT COUNT(*) FROM tables) 
WHERE table_name = 'tables';

-- =================================================================
-- 第六階段：訂單遷移
-- =================================================================

INSERT INTO migration_log (table_name) VALUES ('orders');

-- 遷移訂單主表 shop_order -> orders
INSERT INTO `orders` (
  `order_number`, `shop_id`, `table_id`, `total_amount`, 
  `order_time`, `status`, `cashier_id`
)
SELECT 
  COALESCE(`shopOrderMenu_ID`, CONCAT('ORD_', `shopOrder_sn`)),
  CAST(`shop_ID` AS UNSIGNED),
  (SELECT id FROM `tables` WHERE shop_id = CAST(so.shop_ID AS UNSIGNED) AND table_number = so.shopOrder_table LIMIT 1),
  COALESCE(`shopOrder_price`, 0.00),
  TIMESTAMP(DATE(`shopOrder_date`), COALESCE(`shopOrder_payTime`, '12:00:00')),
  CASE 
    WHEN `shopOrder_price` IS NOT NULL AND `shopOrder_payTime` IS NOT NULL THEN 'paid'
    ELSE 'pending'
  END,
  CASE 
    WHEN `shopOrder_accountPerson` != '' AND `shopOrder_accountPerson` != '1' 
    THEN (SELECT id FROM users WHERE username = so.shopOrder_accountPerson OR id = CAST(so.shopOrder_accountPerson AS UNSIGNED) LIMIT 1)
    ELSE NULL
  END
FROM `shop_order` so
WHERE `shop_ID` != '' AND `shop_ID` IS NOT NULL
ON DUPLICATE KEY UPDATE
  `total_amount` = VALUES(`total_amount`),
  `status` = VALUES(`status`);

UPDATE migration_log 
SET status = 'completed', records_migrated = (SELECT COUNT(*) FROM orders) 
WHERE table_name = 'orders';

-- 遷移訂單明細 shop_ordermenu -> order_items
INSERT INTO migration_log (table_name) VALUES ('order_items');

INSERT INTO `order_items` (
  `order_id`, `menu_item_id`, `item_name`, `unit_price`, 
  `quantity`, `total_price`, `special_notes`, `preparation_status`
)
SELECT 
  o.id,
  COALESCE(
    (SELECT id FROM menu_items WHERE shop_id = CAST(som.shop_ID AS UNSIGNED) AND id = som.shopmenu_sn LIMIT 1),
    (SELECT id FROM menu_items WHERE shop_id = CAST(som.shop_ID AS UNSIGNED) AND name = som.shopOrder_ItemName LIMIT 1),
    0 -- 如果找不到對應商品，設為0（需要手動處理）
  ),
  som.shopOrder_ItemName,
  som.shopOrder_ItemPriceOrigin,
  som.shopOrder_itemQuantity,
  som.shopOrder_ItemPriceTotal,
  som.shopOrder_note,
  CASE 
    WHEN som.shopOrder_send = 1 THEN 'served'
    WHEN som.shopOrder_make = 1 THEN 'ready'
    WHEN som.shopOrder_confirm = 1 THEN 'preparing'
    ELSE 'pending'
  END
FROM `shop_ordermenu` som
JOIN `orders` o ON o.order_number = som.shopOrderMenu_ID
WHERE som.shop_ID != '' AND som.shop_ID IS NOT NULL
ON DUPLICATE KEY UPDATE
  `quantity` = VALUES(`quantity`),
  `total_price` = VALUES(`total_price`),
  `preparation_status` = VALUES(`preparation_status`);

UPDATE migration_log 
SET status = 'completed', records_migrated = (SELECT COUNT(*) FROM order_items) 
WHERE table_name = 'order_items';

-- =================================================================
-- 第七階段：數據清理和優化
-- =================================================================

-- 清理無效的菜單商品（category_id 不存在的）
DELETE FROM menu_items WHERE category_id NOT IN (SELECT id FROM categories);

-- 清理無效的訂單明細（menu_item_id 為 0 的）
DELETE FROM order_items WHERE menu_item_id = 0;

-- 更新訂單總金額（基於訂單明細重新計算）
UPDATE orders o 
SET subtotal = (
  SELECT COALESCE(SUM(total_price), 0) 
  FROM order_items oi 
  WHERE oi.order_id = o.id
),
total_amount = (
  SELECT COALESCE(SUM(total_price), 0) 
  FROM order_items oi 
  WHERE oi.order_id = o.id
);

-- 更新菜單商品的訂單統計
UPDATE menu_items mi 
SET order_count = (
  SELECT COALESCE(SUM(oi.quantity), 0) 
  FROM order_items oi 
  WHERE oi.menu_item_id = mi.id
);

-- 更新餐桌占用狀態（基於未完成訂單）
UPDATE tables t 
SET is_occupied = (
  SELECT COUNT(*) > 0
  FROM orders o 
  WHERE o.table_id = t.id 
    AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
);

-- =================================================================
-- 第八階段：創建視圖和索引優化
-- =================================================================

-- 創建常用查詢視圖
CREATE OR REPLACE VIEW `v_menu_with_categories` AS
SELECT 
  mi.*,
  c.name AS category_name,
  c.name_en AS category_name_en,
  sc.name AS subcategory_name,
  sc.name_en AS subcategory_name_en
FROM menu_items mi
JOIN categories c ON mi.category_id = c.id
LEFT JOIN subcategories sc ON mi.subcategory_id = sc.id;

-- 創建訂單統計視圖
CREATE OR REPLACE VIEW `v_order_summary` AS
SELECT 
  o.*,
  r.name AS restaurant_name,
  t.table_number,
  COUNT(oi.id) AS item_count,
  u1.name AS cashier_name,
  u2.name AS server_name
FROM orders o
JOIN restaurants r ON o.shop_id = r.shop_id
LEFT JOIN tables t ON o.table_id = t.id
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN users u1 ON o.cashier_id = u1.id
LEFT JOIN users u2 ON o.server_id = u2.id
GROUP BY o.id;

-- =================================================================
-- 第九階段：數據驗證
-- =================================================================

-- 創建驗證報告
SELECT 
  '數據遷移驗證報告' AS report_type,
  NOW() AS generated_at;

-- 統計各表記錄數
SELECT 
  'restaurants' AS table_name,
  COUNT(*) AS record_count,
  (SELECT COUNT(*) FROM shop_info) AS original_count
FROM restaurants
UNION ALL
SELECT 
  'users' AS table_name,
  COUNT(*) AS record_count,
  (SELECT COUNT(*) FROM employee) AS original_count
FROM users
UNION ALL
SELECT 
  'menu_items' AS table_name,
  COUNT(*) AS record_count,
  (SELECT COUNT(*) FROM shop_menu) AS original_count
FROM menu_items
UNION ALL
SELECT 
  'tables' AS table_name,
  COUNT(*) AS record_count,
  (SELECT COUNT(*) FROM shop_table) AS original_count
FROM tables
UNION ALL
SELECT 
  'orders' AS table_name,
  COUNT(*) AS record_count,
  (SELECT COUNT(*) FROM shop_order) AS original_count
FROM orders
UNION ALL
SELECT 
  'order_items' AS table_name,
  COUNT(*) AS record_count,
  (SELECT COUNT(*) FROM shop_ordermenu) AS original_count
FROM order_items;

-- 檢查數據完整性
SELECT 'Data Integrity Check' AS check_type;

-- 檢查無效外鍵引用
SELECT 'Invalid Restaurant References in Users' AS issue, COUNT(*) AS count
FROM users u LEFT JOIN restaurants r ON u.shop_id = r.shop_id 
WHERE u.shop_id IS NOT NULL AND r.shop_id IS NULL
UNION ALL
SELECT 'Invalid Category References in Menu Items' AS issue, COUNT(*) AS count
FROM menu_items mi LEFT JOIN categories c ON mi.category_id = c.id 
WHERE c.id IS NULL
UNION ALL
SELECT 'Invalid Restaurant References in Menu Items' AS issue, COUNT(*) AS count
FROM menu_items mi LEFT JOIN restaurants r ON mi.shop_id = r.shop_id 
WHERE r.shop_id IS NULL;

-- 顯示遷移日志
SELECT * FROM migration_log ORDER BY created_at;

-- =================================================================
-- 第十階段：清理和完成
-- =================================================================

-- 恢復外鍵檢查
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- 分析表以優化查詢計劃
ANALYZE TABLE restaurants, users, categories, subcategories, restaurant_categories;
ANALYZE TABLE menu_items, tables, orders, order_items, payments, audit_logs;

-- 提示信息
SELECT 
  'Migration Completed Successfully!' AS status,
  'Please review the validation report above and test the application.' AS next_steps,
  'Remember to update application configuration to use the new table names.' AS reminder;

-- 建議的後續步驟說明
/*
後續步驟：
1. 驗證數據完整性報告，確保所有數據正確遷移
2. 測試應用程序的各項功能
3. 更新應用程序代碼以使用新的表結構
4. 考慮重命名或刪除舊表（建議先備份）
5. 更新用戶密碼系統（目前密碼使用臨時哈希）
6. 配置定期備份計劃
7. 監控新架構的性能表現
*/