-- ================================================
-- Migration: 0025_coupon_system.sql
-- Description: 創建優惠券系統相關表結構
-- Created: 2025-09-14
-- ================================================

-- 優惠券主表
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL, -- 所屬餐廳 (空值表示全平台通用)
  
  -- 優惠券基本資訊
  code TEXT NOT NULL UNIQUE, -- 優惠券代碼 (唯一)
  name TEXT NOT NULL, -- 優惠券名稱
  description TEXT, -- 優惠券描述
  
  -- 折扣設定
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')), -- 折扣類型：百分比或固定金額
  discount_value REAL NOT NULL CHECK(discount_value > 0), -- 折扣值
  max_discount_amount REAL, -- 最大折扣金額 (僅百分比折扣需要)
  
  -- 使用條件
  min_order_amount REAL DEFAULT 0, -- 最低訂單金額
  applicable_menu_items TEXT, -- 適用商品 (JSON array, 空值表示全部商品)
  applicable_categories TEXT, -- 適用分類 (JSON array, 空值表示全部分類)
  
  -- 使用限制
  usage_limit INTEGER, -- 總使用次數限制 (NULL表示無限制)
  usage_limit_per_user INTEGER, -- 每用戶使用次數限制 (NULL表示無限制)
  used_count INTEGER DEFAULT 0, -- 已使用次數
  
  -- 有效期設定
  valid_from DATETIME NOT NULL, -- 有效期開始時間
  valid_to DATETIME NOT NULL, -- 有效期結束時間
  
  -- 狀態控制
  is_active BOOLEAN DEFAULT 1, -- 是否啟用
  is_visible BOOLEAN DEFAULT 1, -- 是否對用戶可見
  
  -- 元數據
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER, -- 創建者用戶ID
  
  -- 外鍵約束
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 優惠券使用記錄表
CREATE TABLE IF NOT EXISTS coupon_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  user_id INTEGER, -- 使用者ID (可為空，支援匿名用戶)
  
  -- 使用詳情
  discount_amount REAL NOT NULL, -- 實際折扣金額
  original_amount REAL NOT NULL, -- 使用前訂單金額
  final_amount REAL NOT NULL, -- 使用後訂單金額
  
  -- 使用時間和狀態
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'refunded', 'cancelled')), -- 使用狀態
  
  -- 元數據
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 外鍵約束
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  
  -- 防重複使用約束 (同一訂單不能使用多張相同優惠券)
  UNIQUE(coupon_id, order_id)
);

-- 優惠券發放記錄表 (用於追蹤發放歷史)
CREATE TABLE IF NOT EXISTS coupon_distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  
  -- 發放資訊
  distribution_type TEXT NOT NULL CHECK(distribution_type IN ('manual', 'auto', 'bulk', 'promotion')), -- 發放類型
  target_type TEXT CHECK(target_type IN ('all', 'user', 'group', 'new_user', 'vip')), -- 目標類型
  target_criteria TEXT, -- 目標條件 (JSON格式)
  
  -- 發放統計
  total_distributed INTEGER DEFAULT 0, -- 總發放數量
  total_used INTEGER DEFAULT 0, -- 總使用數量
  
  -- 發放時間
  distributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- 發放過期時間
  
  -- 元數據
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER, -- 發放者用戶ID
  notes TEXT, -- 發放備註
  
  -- 外鍵約束
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 優惠券模板表 (用於快速創建常用優惠券)
CREATE TABLE IF NOT EXISTS coupon_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT, -- 所屬餐廳 (空值表示系統級模板)
  
  -- 模板資訊
  name TEXT NOT NULL, -- 模板名稱
  description TEXT, -- 模板描述
  template_data TEXT NOT NULL, -- 模板配置 (JSON格式)
  
  -- 使用統計
  usage_count INTEGER DEFAULT 0, -- 使用次數
  
  -- 狀態控制
  is_active BOOLEAN DEFAULT 1, -- 是否啟用
  is_system_template BOOLEAN DEFAULT 0, -- 是否為系統模板
  
  -- 元數據
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER, -- 創建者用戶ID
  
  -- 外鍵約束
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ================================================
-- 創建索引以優化查詢性能
-- ================================================

-- 優惠券表索引
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_restaurant_id ON coupons(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_period ON coupons(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(is_active, is_visible);
CREATE INDEX IF NOT EXISTS idx_coupons_discount_type ON coupons(discount_type);

-- 使用記錄表索引
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_used_at ON coupon_usage(used_at);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_status ON coupon_usage(status);

-- 發放記錄表索引
CREATE INDEX IF NOT EXISTS idx_coupon_distributions_coupon_id ON coupon_distributions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_distributions_type ON coupon_distributions(distribution_type);
CREATE INDEX IF NOT EXISTS idx_coupon_distributions_distributed_at ON coupon_distributions(distributed_at);

-- 模板表索引
CREATE INDEX IF NOT EXISTS idx_coupon_templates_restaurant_id ON coupon_templates(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_coupon_templates_active ON coupon_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_templates_system ON coupon_templates(is_system_template);

-- ================================================
-- 創建觸發器以自動更新 updated_at 欄位
-- ================================================

-- 優惠券表觸發器
CREATE TRIGGER IF NOT EXISTS update_coupons_updated_at 
AFTER UPDATE ON coupons 
BEGIN
  UPDATE coupons SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 使用記錄表觸發器
CREATE TRIGGER IF NOT EXISTS update_coupon_usage_updated_at 
AFTER UPDATE ON coupon_usage 
BEGIN
  UPDATE coupon_usage SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 模板表觸發器
CREATE TRIGGER IF NOT EXISTS update_coupon_templates_updated_at 
AFTER UPDATE ON coupon_templates 
BEGIN
  UPDATE coupon_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ================================================
-- 創建視圖以簡化常用查詢
-- ================================================

-- 可用優惠券視圖 (包含有效期和使用限制檢查)
CREATE VIEW IF NOT EXISTS available_coupons AS
SELECT 
  c.*,
  CASE 
    WHEN c.usage_limit IS NULL THEN 'unlimited'
    WHEN c.used_count < c.usage_limit THEN 'available'
    ELSE 'exhausted'
  END as availability_status,
  (c.usage_limit - c.used_count) as remaining_uses
FROM coupons c
WHERE 
  c.is_active = 1 
  AND c.is_visible = 1
  AND datetime('now') BETWEEN c.valid_from AND c.valid_to
  AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit);

-- 優惠券使用統計視圖
CREATE VIEW IF NOT EXISTS coupon_statistics AS
SELECT 
  c.id,
  c.code,
  c.name,
  c.restaurant_id,
  c.discount_type,
  c.discount_value,
  c.usage_limit,
  c.used_count,
  COUNT(cu.id) as actual_usage_count,
  COALESCE(SUM(cu.discount_amount), 0) as total_discount_given,
  COALESCE(AVG(cu.discount_amount), 0) as avg_discount_amount,
  COALESCE(MAX(cu.used_at), NULL) as last_used_at,
  c.created_at,
  c.valid_from,
  c.valid_to
FROM coupons c
LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id AND cu.status = 'active'
GROUP BY c.id, c.code, c.name, c.restaurant_id, c.discount_type, 
         c.discount_value, c.usage_limit, c.used_count, c.created_at, 
         c.valid_from, c.valid_to;

-- ================================================
-- 插入系統級優惠券模板
-- ================================================

INSERT OR IGNORE INTO coupon_templates (
  name, description, template_data, is_system_template, created_at
) VALUES 
(
  '新用戶歡迎折扣', 
  '新註冊用戶專享10%折扣',
  '{"discount_type": "percentage", "discount_value": 10, "max_discount_amount": 50, "min_order_amount": 100, "usage_limit_per_user": 1, "valid_days": 30}',
  1,
  CURRENT_TIMESTAMP
),
(
  '滿額折扣', 
  '訂單滿200元減20元',
  '{"discount_type": "fixed", "discount_value": 20, "min_order_amount": 200, "usage_limit_per_user": 5, "valid_days": 60}',
  1,
  CURRENT_TIMESTAMP
),
(
  '週末特惠', 
  '週末訂單享85折優惠',
  '{"discount_type": "percentage", "discount_value": 15, "max_discount_amount": 100, "min_order_amount": 150, "usage_limit_per_user": 2, "valid_days": 7, "applicable_days": ["saturday", "sunday"]}',
  1,
  CURRENT_TIMESTAMP
),
(
  '生日專屬折扣', 
  '生日月份專享20%折扣',
  '{"discount_type": "percentage", "discount_value": 20, "max_discount_amount": 80, "min_order_amount": 120, "usage_limit_per_user": 1, "valid_days": 30}',
  1,
  CURRENT_TIMESTAMP
),
(
  '會員回饋金', 
  'VIP會員專享固定金額折扣',
  '{"discount_type": "fixed", "discount_value": 30, "min_order_amount": 180, "usage_limit_per_user": 3, "valid_days": 90, "target_type": "vip"}',
  1,
  CURRENT_TIMESTAMP
);

-- ================================================
-- 完成訊息
-- ================================================
-- Migration 0025_coupon_system.sql executed successfully
-- Created tables: coupons, coupon_usage, coupon_distributions, coupon_templates
-- Created indexes for optimal query performance
-- Created triggers for automatic timestamp updates
-- Created views for simplified querying
-- Inserted system-level coupon templates