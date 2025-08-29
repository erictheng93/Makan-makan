-- =================================================================
-- MakanMakan 優化版數據庫架構
-- 版本：2.0 - 優化版 (InnoDB + 完整約束)
-- 創建時間：2025-08-24
-- =================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

-- 設置字符集為 utf8mb4 (支持完整 Unicode，包括 emoji)
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- 創建數據庫
-- CREATE DATABASE IF NOT EXISTS `makanmakan` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `makanmakan`;

-- =================================================================
-- 1. 商店信息表 (主表)
-- =================================================================
DROP TABLE IF EXISTS `restaurants`;
CREATE TABLE `restaurants` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `shop_id` int NOT NULL UNIQUE COMMENT '商店唯一識別碼',
  `name` varchar(100) NOT NULL COMMENT '商店名稱',
  `type` varchar(50) NOT NULL COMMENT '商店類型',
  `address` varchar(200) NOT NULL COMMENT '商店地址',
  `district` varchar(50) NOT NULL COMMENT '所在區域',
  `phone` varchar(20) NOT NULL COMMENT '聯絡電話',
  `logo` varchar(255) DEFAULT NULL COMMENT '商店LOGO文件路徑',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否營業中：1=營業，0=停業',
  `business_hours` JSON DEFAULT NULL COMMENT '營業時間 JSON',
  `settings` JSON DEFAULT NULL COMMENT '商店設置 JSON',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_id` (`shop_id`),
  INDEX `idx_active` (`is_active`),
  INDEX `idx_district` (`district`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='餐廳基本信息表';

-- =================================================================
-- 2. 用戶/員工表 (支持多角色)
-- =================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `username` varchar(50) NOT NULL COMMENT '用戶名',
  `password_hash` varchar(255) NOT NULL COMMENT '密碼哈希',
  `name` varchar(100) NOT NULL COMMENT '真實姓名',
  `email` varchar(100) DEFAULT NULL COMMENT '電子郵件',
  `phone` varchar(20) NOT NULL COMMENT '聯絡電話',
  `address` varchar(200) DEFAULT NULL COMMENT '地址',
  `role` tinyint NOT NULL DEFAULT 1 COMMENT '角色：0=系統管理員，1=店主，2=廚師，3=服務員，4=收銀員',
  `shop_id` int DEFAULT NULL COMMENT '所屬商店ID',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '賬號是否啟用',
  `last_login_at` timestamp NULL DEFAULT NULL COMMENT '最後登入時間',
  `login_count` int NOT NULL DEFAULT 0 COMMENT '登入次數',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`),
  INDEX `idx_shop_role` (`shop_id`, `role`),
  INDEX `idx_active` (`is_active`),
  INDEX `idx_role` (`role`),
  CONSTRAINT `fk_users_shop` FOREIGN KEY (`shop_id`) REFERENCES `restaurants` (`shop_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用戶及員工信息表';

-- =================================================================
-- 3. 菜品分類表
-- =================================================================
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `name` varchar(50) NOT NULL COMMENT '分類名稱',
  `name_en` varchar(50) DEFAULT NULL COMMENT '英文名稱',
  `description` varchar(200) DEFAULT NULL COMMENT '分類描述',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序順序',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否啟用',
  `icon` varchar(100) DEFAULT NULL COMMENT '圖標',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品分類表';

-- =================================================================
-- 4. 菜品子分類表
-- =================================================================
DROP TABLE IF EXISTS `subcategories`;
CREATE TABLE `subcategories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `category_id` int NOT NULL COMMENT '主分類ID',
  `name` varchar(50) NOT NULL COMMENT '子分類名稱',
  `name_en` varchar(50) DEFAULT NULL COMMENT '英文名稱',
  `description` varchar(200) DEFAULT NULL COMMENT '子分類描述',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序順序',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否啟用',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_category_active` (`category_id`, `is_active`),
  INDEX `idx_sort` (`sort_order`),
  CONSTRAINT `fk_subcategories_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜品子分類表';

-- =================================================================
-- 5. 商店分類關聯表 (正規化原本的逗號分隔值)
-- =================================================================
DROP TABLE IF EXISTS `restaurant_categories`;
CREATE TABLE `restaurant_categories` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `shop_id` int NOT NULL COMMENT '商店ID',
  `category_id` int NOT NULL COMMENT '分類ID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_category` (`shop_id`, `category_id`),
  INDEX `idx_shop` (`shop_id`),
  INDEX `idx_category` (`category_id`),
  CONSTRAINT `fk_restaurant_categories_shop` FOREIGN KEY (`shop_id`) REFERENCES `restaurants` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_restaurant_categories_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商店分類關聯表';

-- =================================================================
-- 6. 菜單商品表
-- =================================================================
DROP TABLE IF EXISTS `menu_items`;
CREATE TABLE `menu_items` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `shop_id` int NOT NULL COMMENT '商店ID',
  `name` varchar(100) NOT NULL COMMENT '商品名稱',
  `name_en` varchar(100) DEFAULT NULL COMMENT '英文名稱',
  `description` text DEFAULT NULL COMMENT '商品描述',
  `image_url` varchar(300) DEFAULT NULL COMMENT '商品圖片URL',
  `price` decimal(8,2) NOT NULL COMMENT '商品價格',
  `cost_price` decimal(8,2) DEFAULT NULL COMMENT '成本價格',
  `category_id` int NOT NULL COMMENT '主分類ID',
  `subcategory_id` int DEFAULT NULL COMMENT '子分類ID',
  
  -- 供應選項
  `available_for_dine_in` tinyint(1) NOT NULL DEFAULT 1 COMMENT '內用供應',
  `available_for_takeout` tinyint(1) NOT NULL DEFAULT 1 COMMENT '外帶供應',
  `available_for_delivery` tinyint(1) NOT NULL DEFAULT 1 COMMENT '外送供應',
  
  -- 狀態和推薦
  `is_available` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否供應',
  `is_recommended` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否推薦商品',
  `is_popular` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否熱門商品',
  
  -- 飲食限制
  `is_vegetarian` tinyint(1) DEFAULT 0 COMMENT '素食',
  `is_vegan` tinyint(1) DEFAULT 0 COMMENT '純素',
  `is_gluten_free` tinyint(1) DEFAULT 0 COMMENT '無麩質',
  `contains_dairy` tinyint(1) DEFAULT 0 COMMENT '含奶製品',
  `contains_eggs` tinyint(1) DEFAULT 0 COMMENT '含蛋',
  
  -- 辣度等級
  `spice_level` tinyint DEFAULT 0 COMMENT '辣度等級：0=不辣，1=微辣，2=小辣，3=中辣，4=大辣',
  
  -- 統計數據
  `order_count` int NOT NULL DEFAULT 0 COMMENT '被點次數',
  `avg_rating` decimal(3,2) DEFAULT NULL COMMENT '平均評分',
  `review_count` int NOT NULL DEFAULT 0 COMMENT '評價數量',
  
  -- 其他
  `preparation_time` int DEFAULT NULL COMMENT '製作時間（分鐘）',
  `calories` int DEFAULT NULL COMMENT '卡路里',
  `notes` varchar(300) DEFAULT NULL COMMENT '備註',
  `sort_order` int NOT NULL DEFAULT 0 COMMENT '排序順序',
  
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  INDEX `idx_shop_category` (`shop_id`, `category_id`),
  INDEX `idx_available` (`is_available`),
  INDEX `idx_recommended` (`is_recommended`),
  INDEX `idx_popular` (`is_popular`),
  INDEX `idx_price` (`price`),
  INDEX `idx_order_count` (`order_count` DESC),
  INDEX `idx_rating` (`avg_rating` DESC),
  INDEX `idx_spice` (`spice_level`),
  INDEX `idx_dietary` (`is_vegetarian`, `is_vegan`, `is_gluten_free`),
  
  CONSTRAINT `fk_menu_items_shop` FOREIGN KEY (`shop_id`) REFERENCES `restaurants` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_items_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_items_subcategory` FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜單商品表';

-- =================================================================
-- 7. 餐桌管理表
-- =================================================================
DROP TABLE IF EXISTS `tables`;
CREATE TABLE `tables` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `shop_id` int NOT NULL COMMENT '商店ID',
  `table_number` varchar(10) NOT NULL COMMENT '桌號',
  `table_name` varchar(50) DEFAULT NULL COMMENT '桌台名稱',
  `capacity` tinyint NOT NULL DEFAULT 4 COMMENT '可坐人數',
  `qr_code` varchar(100) DEFAULT NULL COMMENT 'QR碼標識',
  `is_occupied` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否被占用',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否啟用',
  `area` varchar(50) DEFAULT NULL COMMENT '區域（如：室內、戶外、VIP）',
  `notes` varchar(200) DEFAULT NULL COMMENT '備註',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_table` (`shop_id`, `table_number`),
  INDEX `idx_shop_occupied` (`shop_id`, `is_occupied`),
  INDEX `idx_active` (`is_active`),
  INDEX `idx_qr` (`qr_code`),
  
  CONSTRAINT `fk_tables_shop` FOREIGN KEY (`shop_id`) REFERENCES `restaurants` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='餐桌管理表';

-- =================================================================
-- 8. 訂單主表
-- =================================================================
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `order_number` varchar(30) NOT NULL COMMENT '訂單編號',
  `shop_id` int NOT NULL COMMENT '商店ID',
  `table_id` int DEFAULT NULL COMMENT '餐桌ID',
  `customer_name` varchar(100) DEFAULT NULL COMMENT '顧客姓名',
  `customer_phone` varchar(20) DEFAULT NULL COMMENT '顾客電話',
  `customer_notes` text DEFAULT NULL COMMENT '顧客備註',
  
  -- 訂單狀態
  `status` enum('pending','confirmed','preparing','ready','served','paid','cancelled') NOT NULL DEFAULT 'pending' COMMENT '訂單狀態',
  `order_type` enum('dine_in','takeout','delivery') NOT NULL DEFAULT 'dine_in' COMMENT '訂單類型',
  
  -- 金額信息
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '小計',
  `service_charge` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '服務費',
  `tax_amount` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '稅費',
  `discount_amount` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '折扣金額',
  `total_amount` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT '總金額',
  
  -- 時間追蹤
  `order_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下單時間',
  `confirmed_at` timestamp NULL DEFAULT NULL COMMENT '確認時間',
  `prepared_at` timestamp NULL DEFAULT NULL COMMENT '完成製作時間',
  `served_at` timestamp NULL DEFAULT NULL COMMENT '送達時間',
  `paid_at` timestamp NULL DEFAULT NULL COMMENT '結帳時間',
  `estimated_time` int DEFAULT NULL COMMENT '預估製作時間（分鐘）',
  
  -- 處理人員
  `cashier_id` int DEFAULT NULL COMMENT '收銀員ID',
  `server_id` int DEFAULT NULL COMMENT '服務員ID',
  
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_number` (`order_number`),
  INDEX `idx_shop_status` (`shop_id`, `status`),
  INDEX `idx_table_time` (`table_id`, `order_time`),
  INDEX `idx_status_time` (`status`, `order_time`),
  INDEX `idx_order_date` (`shop_id`, DATE(`order_time`)),
  INDEX `idx_customer` (`customer_phone`),
  
  CONSTRAINT `fk_orders_shop` FOREIGN KEY (`shop_id`) REFERENCES `restaurants` (`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_table` FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_cashier` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_server` FOREIGN KEY (`server_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='訂單主表';

-- =================================================================
-- 9. 訂單商品明細表
-- =================================================================
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `order_id` int NOT NULL COMMENT '訂單ID',
  `menu_item_id` int NOT NULL COMMENT '菜單商品ID',
  `item_name` varchar(100) NOT NULL COMMENT '商品名稱（快照）',
  `unit_price` decimal(8,2) NOT NULL COMMENT '單價',
  `quantity` int NOT NULL DEFAULT 1 COMMENT '數量',
  `total_price` decimal(10,2) NOT NULL COMMENT '小計金額',
  
  -- 定制選項
  `customizations` json DEFAULT NULL COMMENT '定制選項 JSON',
  `special_notes` varchar(300) DEFAULT NULL COMMENT '特殊要求',
  
  -- 製作狀態
  `preparation_status` enum('pending','preparing','ready','served') NOT NULL DEFAULT 'pending' COMMENT '製作狀態',
  `chef_id` int DEFAULT NULL COMMENT '負責廚師ID',
  `prepared_at` timestamp NULL DEFAULT NULL COMMENT '完成製作時間',
  
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  INDEX `idx_order` (`order_id`),
  INDEX `idx_menu_item` (`menu_item_id`),
  INDEX `idx_prep_status` (`preparation_status`),
  INDEX `idx_chef_status` (`chef_id`, `preparation_status`),
  
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_menu` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_chef` FOREIGN KEY (`chef_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='訂單商品明細表';

-- =================================================================
-- 10. 支付記錄表
-- =================================================================
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `order_id` int NOT NULL COMMENT '訂單ID',
  `payment_method` enum('cash','credit_card','debit_card','online','e_wallet','other') NOT NULL COMMENT '支付方式',
  `amount` decimal(10,2) NOT NULL COMMENT '支付金額',
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending' COMMENT '支付狀態',
  `transaction_id` varchar(100) DEFAULT NULL COMMENT '交易ID',
  `payment_details` json DEFAULT NULL COMMENT '支付詳情 JSON',
  `processed_by` int DEFAULT NULL COMMENT '處理員工ID',
  `processed_at` timestamp NULL DEFAULT NULL COMMENT '處理時間',
  `notes` varchar(300) DEFAULT NULL COMMENT '備註',
  
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  INDEX `idx_order` (`order_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_method` (`payment_method`),
  INDEX `idx_transaction` (`transaction_id`),
  INDEX `idx_processed_by` (`processed_by`),
  
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_user` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付記錄表';

-- =================================================================
-- 11. 審計日志表
-- =================================================================
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主鍵ID',
  `user_id` int DEFAULT NULL COMMENT '操作用戶ID',
  `shop_id` int DEFAULT NULL COMMENT '商店ID',
  `action` varchar(50) NOT NULL COMMENT '操作類型',
  `table_name` varchar(50) NOT NULL COMMENT '操作表名',
  `record_id` int DEFAULT NULL COMMENT '記錄ID',
  `old_values` json DEFAULT NULL COMMENT '舊值 JSON',
  `new_values` json DEFAULT NULL COMMENT '新值 JSON',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `user_agent` varchar(500) DEFAULT NULL COMMENT '用戶代理',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  INDEX `idx_user_time` (`user_id`, `created_at`),
  INDEX `idx_shop_time` (`shop_id`, `created_at`),
  INDEX `idx_action` (`action`),
  INDEX `idx_table_record` (`table_name`, `record_id`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='審計日志表';

-- =================================================================
-- 插入基礎數據
-- =================================================================

-- 插入分類數據
INSERT INTO `categories` (`id`, `name`, `name_en`, `sort_order`) VALUES
(1, '主食', 'Main Dishes', 1),
(2, '飲料', 'Beverages', 2),
(3, '小菜', 'Side Dishes', 3),
(4, '甜品', 'Desserts', 4),
(5, '小吃', 'Snacks', 5),
(6, '配料', 'Condiments', 6),
(7, '湯品', 'Soups', 7),
(8, '海鮮', 'Seafood', 8),
(9, '燒烤', 'BBQ', 9),
(10, '特色菜餚', 'Specialty Dishes', 10),
(11, '火鍋', 'Hot Pot', 11),
(12, '牛排', 'Steaks', 12),
(13, '鐵板', 'Teppanyaki', 13),
(14, '其他', 'Others', 14);

-- 插入子分類數據
INSERT INTO `subcategories` (`id`, `category_id`, `name`, `name_en`, `sort_order`) VALUES
(1, 1, '飯類', 'Rice Dishes', 1),
(2, 1, '麵類', 'Noodles', 2),
(3, 1, '米粉類', 'Rice Noodles', 3),
(4, 1, '冬粉類', 'Vermicelli', 4),
(5, 1, '粿條類', 'Flat Noodles', 5),
(6, 2, '咖啡類', 'Coffee', 1),
(7, 2, '茶飲類', 'Tea', 2),
(8, 2, '碳酸飲料', 'Soft Drinks', 3),
(9, 2, '果菜汁類', 'Juices', 4),
(10, 2, '酒類', 'Alcoholic Drinks', 5),
(11, 2, '醋類', 'Vinegar Drinks', 6),
(12, 2, '保健飲料', 'Health Drinks', 7),
(13, 2, '礦泉水類', 'Water', 8),
(14, 2, '特調飲料', 'Specialty Drinks', 9),
(15, 2, '其他', 'Others', 10),
(16, 3, '其他', 'Others', 1),
(17, 4, '麵包', 'Bread', 1),
(18, 4, '蛋糕', 'Cakes', 2),
(19, 4, '糕點', 'Pastries', 3),
(20, 4, '餅干', 'Cookies', 4),
(21, 4, '肉干', 'Jerky', 5),
(22, 7, '鹹湯', 'Savory Soup', 1),
(23, 7, '甜湯', 'Sweet Soup', 2),
(24, 7, '保健湯', 'Health Soup', 3),
(25, 5, '其他', 'Others', 1);

-- 重置自增值
ALTER TABLE `categories` AUTO_INCREMENT = 15;
ALTER TABLE `subcategories` AUTO_INCREMENT = 33;
ALTER TABLE `restaurants` AUTO_INCREMENT = 1;
ALTER TABLE `users` AUTO_INCREMENT = 1;
ALTER TABLE `menu_items` AUTO_INCREMENT = 1;
ALTER TABLE `tables` AUTO_INCREMENT = 1;
ALTER TABLE `orders` AUTO_INCREMENT = 1;
ALTER TABLE `order_items` AUTO_INCREMENT = 1;
ALTER TABLE `payments` AUTO_INCREMENT = 1;
ALTER TABLE `audit_logs` AUTO_INCREMENT = 1;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;