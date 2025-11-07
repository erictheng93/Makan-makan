-- =====================================================
-- Migration: Tenants and Settings (Layer 1)
-- Version: v2-001
-- Date: 2025-10-28
-- Description: 租戶管理和系統設定 - 整個系統的基礎層
--              包含餐廳資訊、多租戶支持、訂閱管理
-- Dependencies: None (基礎層)
-- =====================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. RESTAURANTS TABLE (餐廳主表)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Purpose: 多租戶系統的核心表，每個餐廳是一個獨立租戶
-- Design: UUID 主鍵，完整的業務資訊，支持訂閱管理
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS restaurants (
    -- ═══════════════════════════════════════
    -- 主鍵 (UUID格式)
    -- ═══════════════════════════════════════
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- ═══════════════════════════════════════
    -- 基本資訊
    -- ═══════════════════════════════════════
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,              -- URL-friendly identifier (例: amazing-restaurant-taichung)
    business_type TEXT NOT NULL,            -- restaurant, cafe, bar, bakery, food_truck

    -- ═══════════════════════════════════════
    -- 聯絡資訊
    -- ═══════════════════════════════════════
    email TEXT,
    phone TEXT NOT NULL,
    website TEXT,

    -- ═══════════════════════════════════════
    -- 地址資訊
    -- ═══════════════════════════════════════
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    country TEXT NOT NULL DEFAULT 'TW',

    -- ═══════════════════════════════════════
    -- 地理位置 (用於地圖和距離計算)
    -- ═══════════════════════════════════════
    latitude REAL,
    longitude REAL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',

    -- ═══════════════════════════════════════
    -- 營業資訊 (JSON格式)
    -- ═══════════════════════════════════════
    -- Format: {
    --   "monday": {"open": "09:00", "close": "22:00", "closed": false},
    --   "tuesday": {"open": "09:00", "close": "22:00", "closed": false},
    --   ...
    -- }
    business_hours TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 品牌資訊
    -- ═══════════════════════════════════════
    logo_url TEXT,
    banner_url TEXT,
    -- Format: {"primary": "#FF6B6B", "secondary": "#4ECDC4", "accent": "#FFE66D"}
    brand_colors TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 訂閱和計費
    -- ═══════════════════════════════════════
    subscription_tier TEXT NOT NULL DEFAULT 'basic',      -- basic, pro, enterprise
    subscription_status TEXT NOT NULL DEFAULT 'trial',    -- trial, active, suspended, cancelled
    trial_ends_at INTEGER,                                 -- Unix timestamp (milliseconds)
    subscription_ends_at INTEGER,

    -- ═══════════════════════════════════════
    -- 功能開關 (JSON格式)
    -- ═══════════════════════════════════════
    -- Format: {
    --   "online_ordering": true,
    --   "qr_ordering": true,
    --   "ai_analytics": false,
    --   "inventory_management": true,
    --   "loyalty_program": false
    -- }
    features TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 系統設定 (JSON格式)
    -- ═══════════════════════════════════════
    -- Format: {
    --   "currency": "TWD",
    --   "tax_rate": 0.05,
    --   "service_charge": 0.10,
    --   "default_language": "zh-TW",
    --   "order_auto_confirm": true,
    --   "notification_email": "admin@restaurant.com"
    -- }
    settings TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 狀態管理
    -- ═══════════════════════════════════════
    status TEXT NOT NULL DEFAULT 'active',           -- active, inactive, suspended, closed
    onboarding_completed INTEGER DEFAULT 0,          -- Boolean: 是否完成初始設定

    -- ═══════════════════════════════════════
    -- 統計資訊 (denormalized for performance)
    -- ═══════════════════════════════════════
    total_orders INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    average_rating REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0,

    -- ═══════════════════════════════════════
    -- 擴展欄位 (JSON格式 - 用於未來擴展)
    -- ═══════════════════════════════════════
    metadata TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,                              -- Soft delete

    -- ═══════════════════════════════════════
    -- 約束條件
    -- ═══════════════════════════════════════
    CHECK (business_type IN ('restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'other')),
    CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
    CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
    CHECK (status IN ('active', 'inactive', 'suspended', 'closed')),
    CHECK (onboarding_completed IN (0, 1)),
    CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
    CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
    CHECK (total_orders >= 0),
    CHECK (total_revenue >= 0),
    CHECK (average_rating IS NULL OR (average_rating BETWEEN 0 AND 5)),
    CHECK (review_count >= 0)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR RESTAURANTS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 主要查詢索引
CREATE INDEX IF NOT EXISTS idx_restaurants_slug
    ON restaurants(slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_status
    ON restaurants(status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_subscription
    ON restaurants(subscription_status, subscription_tier)
    WHERE deleted_at IS NULL;

-- 地理位置索引
CREATE INDEX IF NOT EXISTS idx_restaurants_location
    ON restaurants(city, country)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_coordinates
    ON restaurants(latitude, longitude)
    WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- 業務類型索引
CREATE INDEX IF NOT EXISTS idx_restaurants_business_type
    ON restaurants(business_type, status)
    WHERE deleted_at IS NULL;

-- 時間索引
CREATE INDEX IF NOT EXISTS idx_restaurants_created
    ON restaurants(created_at DESC);

-- 軟刪除索引
CREATE INDEX IF NOT EXISTS idx_restaurants_active
    ON restaurants(id)
    WHERE deleted_at IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. RESTAURANT SETTINGS TABLE (餐廳詳細設定)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Purpose: 餐廳的詳細配置，分離出來便於管理
-- Design: 一對一關係，key-value 結構
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS restaurant_settings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- 設定項
    -- ═══════════════════════════════════════
    setting_key TEXT NOT NULL,              -- 設定鍵 (例: 'order_timeout', 'max_tables')
    setting_value TEXT NOT NULL,            -- 設定值 (JSON格式)
    setting_type TEXT NOT NULL,             -- string, number, boolean, json, array
    description TEXT,                       -- 設定說明

    -- ═══════════════════════════════════════
    -- 分類和優先級
    -- ═══════════════════════════════════════
    category TEXT NOT NULL DEFAULT 'general', -- general, ordering, payment, notifications, etc.
    is_system INTEGER DEFAULT 0,            -- 是否為系統設定（不可刪除）
    is_public INTEGER DEFAULT 0,            -- 是否為公開設定（API 可訪問）

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    created_by TEXT,
    updated_by TEXT,

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    UNIQUE(restaurant_id, setting_key),

    CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array')),
    CHECK (category IN ('general', 'ordering', 'payment', 'notifications', 'integrations', 'security', 'other')),
    CHECK (is_system IN (0, 1)),
    CHECK (is_public IN (0, 1))
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR RESTAURANT SETTINGS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_restaurant_settings_restaurant
    ON restaurant_settings(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_settings_key
    ON restaurant_settings(restaurant_id, setting_key);

CREATE INDEX IF NOT EXISTS idx_restaurant_settings_category
    ON restaurant_settings(restaurant_id, category);

CREATE INDEX IF NOT EXISTS idx_restaurant_settings_public
    ON restaurant_settings(restaurant_id, is_public)
    WHERE is_public = 1;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TRIGGERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Auto-update updated_at for restaurants
CREATE TRIGGER IF NOT EXISTS restaurants_updated_at
AFTER UPDATE ON restaurants
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE restaurants
    SET updated_at = unixepoch('now') * 1000
    WHERE id = NEW.id;
END;

-- Auto-update updated_at for restaurant_settings
CREATE TRIGGER IF NOT EXISTS restaurant_settings_updated_at
AFTER UPDATE ON restaurant_settings
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE restaurant_settings
    SET updated_at = unixepoch('now') * 1000
    WHERE id = NEW.id;
END;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VIEWS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Active restaurants view (常用查詢優化)
CREATE VIEW IF NOT EXISTS v_active_restaurants AS
SELECT
    id,
    name,
    slug,
    business_type,
    email,
    phone,
    address_line1,
    city,
    country,
    latitude,
    longitude,
    subscription_tier,
    subscription_status,
    status,
    total_orders,
    total_revenue,
    average_rating,
    review_count,
    created_at
FROM restaurants
WHERE status = 'active'
  AND deleted_at IS NULL
  AND subscription_status IN ('trial', 'active');

-- Restaurant summary view (用於儀表板)
CREATE VIEW IF NOT EXISTS v_restaurant_summary AS
SELECT
    r.id,
    r.name,
    r.business_type,
    r.city,
    r.subscription_tier,
    r.status,
    r.total_orders,
    r.total_revenue,
    r.average_rating,
    CAST((julianday('now') - julianday(r.created_at / 1000.0, 'unixepoch')) AS INTEGER) as days_active,
    CASE
        WHEN r.subscription_status = 'trial' AND r.trial_ends_at > unixepoch('now') * 1000
        THEN 'trial'
        WHEN r.subscription_status = 'active'
        THEN 'active'
        ELSE 'inactive'
    END as effective_status
FROM restaurants r
WHERE r.deleted_at IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SEED DATA (Optional - for testing)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 可在此添加默認餐廳或測試數據

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRATION COMPLETE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Layer 1 - Tenants and Settings
-- Tables Created: 2
-- Indexes Created: 12
-- Views Created: 2
-- Triggers Created: 2
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT '✅ Migration 01_tenants_and_settings completed successfully' as status;
