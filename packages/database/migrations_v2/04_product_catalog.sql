-- =====================================================
-- Migration: Product Catalog (Layer 2)
-- Version: v2-004
-- Date: 2025-10-28
-- Description: 完整的產品目錄系統 - 分類、菜單、選項、標籤
--              支持多層分類、複雜選項、庫存管理
-- Dependencies: 01_tenants_and_settings.sql
-- =====================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. CATEGORIES TABLE (分類表)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Purpose: 菜單分類管理，支持多層級結構
-- Design: 支持父子關係、排序、可見性控制
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS categories (
    -- ═══════════════════════════════════════
    -- 主鍵 (UUID格式)
    -- ═══════════════════════════════════════
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- 基本資訊
    -- ═══════════════════════════════════════
    name TEXT NOT NULL,
    slug TEXT NOT NULL,                    -- URL-friendly name
    description TEXT,

    -- ═══════════════════════════════════════
    -- 層級結構
    -- ═══════════════════════════════════════
    parent_id TEXT,                        -- 父分類ID (NULL = 頂層)
    path TEXT,                             -- 完整路徑 (例: /1/2/3)
    level INTEGER NOT NULL DEFAULT 0,      -- 層級深度 (0 = 頂層)

    -- ═══════════════════════════════════════
    -- 顯示設定
    -- ═══════════════════════════════════════
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_visible INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,

    -- ═══════════════════════════════════════
    -- 媒體資源
    -- ═══════════════════════════════════════
    image_url TEXT,
    icon_url TEXT,
    banner_url TEXT,

    -- ═══════════════════════════════════════
    -- 營業時間限制 (JSON格式)
    -- ═══════════════════════════════════════
    -- Format: {
    --   "available_days": [1,2,3,4,5],  // Monday-Friday
    --   "start_time": "10:00",
    --   "end_time": "22:00"
    -- }
    availability_schedule TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 統計資訊 (denormalized)
    -- ═══════════════════════════════════════
    item_count INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,

    -- ═══════════════════════════════════════
    -- SEO 和顯示
    -- ═══════════════════════════════════════
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT,

    -- ═══════════════════════════════════════
    -- 擴展欄位
    -- ═══════════════════════════════════════
    metadata TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,
    created_by TEXT,

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE(restaurant_id, slug),

    CHECK (is_visible IN (0, 1)),
    CHECK (is_active IN (0, 1)),
    CHECK (level >= 0),
    CHECK (sort_order >= 0),
    CHECK (item_count >= 0)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR CATEGORIES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_categories_restaurant
    ON categories(restaurant_id, is_active, sort_order)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_parent
    ON categories(parent_id, sort_order)
    WHERE parent_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_slug
    ON categories(restaurant_id, slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_visible
    ON categories(restaurant_id, is_visible, is_active)
    WHERE deleted_at IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. MENU_ITEMS TABLE (菜單項目表)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Purpose: 核心菜單項目，包含完整的產品資訊
-- Design: 支持變體、庫存、定價、營養資訊
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS menu_items (
    -- ═══════════════════════════════════════
    -- 主鍵 (UUID格式)
    -- ═══════════════════════════════════════
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,
    category_id TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- 基本資訊
    -- ═══════════════════════════════════════
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    ingredients TEXT,                      -- 食材列表

    -- ═══════════════════════════════════════
    -- SKU 和編碼
    -- ═══════════════════════════════════════
    sku TEXT,                              -- Stock Keeping Unit
    barcode TEXT,                          -- 條碼

    -- ═══════════════════════════════════════
    -- 價格資訊
    -- ═══════════════════════════════════════
    price REAL NOT NULL,
    compare_at_price REAL,                 -- 原價（用於顯示折扣）
    cost_price REAL,                       -- 成本價

    -- ═══════════════════════════════════════
    -- 圖片資訊 (JSON格式)
    -- ═══════════════════════════════════════
    -- Format: {
    --   "primary": "url",
    --   "gallery": ["url1", "url2"],
    --   "thumbnail": "url"
    -- }
    images TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 狀態和顯示
    -- ═══════════════════════════════════════
    is_available INTEGER NOT NULL DEFAULT 1,
    is_visible INTEGER NOT NULL DEFAULT 1,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_popular INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- ═══════════════════════════════════════
    -- 庫存管理
    -- ═══════════════════════════════════════
    track_inventory INTEGER DEFAULT 0,     -- 是否追蹤庫存
    inventory_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    allow_backorder INTEGER DEFAULT 0,     -- 允許缺貨預訂

    -- ═══════════════════════════════════════
    -- 準備和服務
    -- ═══════════════════════════════════════
    preparation_time INTEGER DEFAULT 15,   -- 準備時間（分鐘）
    serving_size TEXT,                     -- 份量說明
    serves INTEGER DEFAULT 1,              -- 幾人份

    -- ═══════════════════════════════════════
    -- 飲食特性
    -- ═══════════════════════════════════════
    spice_level INTEGER DEFAULT 0,         -- 0-5 辣度
    calories INTEGER,
    -- Format: {
    --   "vegetarian": true,
    --   "vegan": false,
    --   "gluten_free": true,
    --   "halal": true,
    --   "kosher": false
    -- }
    dietary_tags TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 過敏原資訊 (JSON陣列)
    -- ═══════════════════════════════════════
    -- Format: ["peanuts", "shellfish", "dairy", "eggs", "soy", "wheat", "fish", "tree_nuts"]
    allergens TEXT DEFAULT '[]',

    -- ═══════════════════════════════════════
    -- 營養資訊 (JSON格式)
    -- ═══════════════════════════════════════
    -- Format: {
    --   "calories": 500,
    --   "protein": 25,
    --   "carbs": 45,
    --   "fat": 20,
    --   "fiber": 5,
    --   "sodium": 800
    -- }
    nutrition_info TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 營業時間限制 (JSON格式)
    -- ═══════════════════════════════════════
    availability_schedule TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 統計資訊 (denormalized)
    -- ═══════════════════════════════════════
    order_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    review_count INTEGER DEFAULT 0,

    -- ═══════════════════════════════════════
    -- SEO 和搜尋
    -- ═══════════════════════════════════════
    meta_title TEXT,
    meta_description TEXT,
    -- Format: ["熱門", "新品", "推薦", "季節限定"]
    tags TEXT DEFAULT '[]',
    search_keywords TEXT,                  -- 搜尋關鍵字

    -- ═══════════════════════════════════════
    -- 擴展欄位
    -- ═══════════════════════════════════════
    metadata TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,
    created_by TEXT,

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE(restaurant_id, slug),
    UNIQUE(restaurant_id, sku) WHERE sku IS NOT NULL,

    CHECK (is_available IN (0, 1)),
    CHECK (is_visible IN (0, 1)),
    CHECK (is_featured IN (0, 1)),
    CHECK (is_popular IN (0, 1)),
    CHECK (track_inventory IN (0, 1)),
    CHECK (allow_backorder IN (0, 1)),
    CHECK (price >= 0),
    CHECK (cost_price IS NULL OR cost_price >= 0),
    CHECK (inventory_quantity >= 0),
    CHECK (spice_level BETWEEN 0 AND 5),
    CHECK (preparation_time > 0),
    CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
    CHECK (order_count >= 0),
    CHECK (view_count >= 0)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR MENU_ITEMS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant
    ON menu_items(restaurant_id, is_available, sort_order)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_category
    ON menu_items(category_id, is_available, sort_order)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_slug
    ON menu_items(restaurant_id, slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_sku
    ON menu_items(restaurant_id, sku)
    WHERE sku IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_featured
    ON menu_items(restaurant_id, is_featured, is_available)
    WHERE is_featured = 1 AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_popular
    ON menu_items(restaurant_id, is_popular, order_count DESC)
    WHERE is_popular = 1 AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_price
    ON menu_items(restaurant_id, price)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_inventory
    ON menu_items(restaurant_id, track_inventory, inventory_quantity)
    WHERE track_inventory = 1 AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_low_stock
    ON menu_items(restaurant_id, inventory_quantity)
    WHERE track_inventory = 1
      AND inventory_quantity <= low_stock_threshold
      AND deleted_at IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. MENU_MODIFIERS TABLE (菜單選項表)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Purpose: 菜單項目的客製化選項（尺寸、配料、加料等）
-- Design: 支持選項組、多選/單選、價格調整
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS menu_modifiers (
    -- ═══════════════════════════════════════
    -- 主鍵 (UUID格式)
    -- ═══════════════════════════════════════
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- 選項組資訊
    -- ═══════════════════════════════════════
    group_name TEXT NOT NULL,              -- 選項組名稱（例：尺寸、配料）
    group_type TEXT NOT NULL,              -- single, multiple

    -- ═══════════════════════════════════════
    -- 選項詳情 (JSON陣列)
    -- ═══════════════════════════════════════
    -- Format: [
    --   {
    --     "id": "opt1",
    --     "name": "大杯",
    --     "price_adjustment": 20,
    --     "is_default": true,
    --     "is_available": true
    --   }
    -- ]
    options TEXT NOT NULL DEFAULT '[]',

    -- ═══════════════════════════════════════
    -- 規則和限制
    -- ═══════════════════════════════════════
    is_required INTEGER NOT NULL DEFAULT 0,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER,                -- NULL = 無限制

    -- ═══════════════════════════════════════
    -- 顯示設定
    -- ═══════════════════════════════════════
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,

    CHECK (group_type IN ('single', 'multiple')),
    CHECK (is_required IN (0, 1)),
    CHECK (is_active IN (0, 1)),
    CHECK (min_selections >= 0),
    CHECK (max_selections IS NULL OR max_selections >= min_selections)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR MENU_MODIFIERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_menu_modifiers_item
    ON menu_modifiers(menu_item_id, sort_order)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_modifiers_restaurant
    ON menu_modifiers(restaurant_id)
    WHERE deleted_at IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. MENU_ITEM_TAGS TABLE (菜單標籤表)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Purpose: 標籤系統，用於分類和搜尋
-- Design: 多對多關係，支持標籤分組
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS tags (
    -- ═══════════════════════════════════════
    -- 主鍵 (UUID格式)
    -- ═══════════════════════════════════════
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- 標籤資訊
    -- ═══════════════════════════════════════
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,

    -- ═══════════════════════════════════════
    -- 標籤類型
    -- ═══════════════════════════════════════
    tag_type TEXT NOT NULL DEFAULT 'general', -- general, dietary, feature, seasonal, promotion

    -- ═══════════════════════════════════════
    -- 顯示設定
    -- ═══════════════════════════════════════
    color_code TEXT DEFAULT '#3B82F6',
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- ═══════════════════════════════════════
    -- 統計
    -- ═══════════════════════════════════════
    usage_count INTEGER DEFAULT 0,

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    UNIQUE(restaurant_id, slug),

    CHECK (tag_type IN ('general', 'dietary', 'feature', 'seasonal', 'promotion')),
    CHECK (usage_count >= 0)
);

-- Many-to-many relationship table
CREATE TABLE IF NOT EXISTS menu_item_tags (
    menu_item_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    PRIMARY KEY (menu_item_id, tag_id),
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR TAGS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_tags_restaurant
    ON tags(restaurant_id, tag_type, sort_order);

CREATE INDEX IF NOT EXISTS idx_tags_slug
    ON tags(restaurant_id, slug);

CREATE INDEX IF NOT EXISTS idx_menu_item_tags_item
    ON menu_item_tags(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_menu_item_tags_tag
    ON menu_item_tags(tag_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TRIGGERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Auto-update updated_at
CREATE TRIGGER IF NOT EXISTS categories_updated_at
AFTER UPDATE ON categories
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE categories SET updated_at = unixepoch('now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS menu_items_updated_at
AFTER UPDATE ON menu_items
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE menu_items SET updated_at = unixepoch('now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS menu_modifiers_updated_at
AFTER UPDATE ON menu_modifiers
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE menu_modifiers SET updated_at = unixepoch('now') * 1000 WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tags_updated_at
AFTER UPDATE ON tags
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE tags SET updated_at = unixepoch('now') * 1000 WHERE id = NEW.id;
END;

-- Update category item_count
CREATE TRIGGER IF NOT EXISTS menu_items_increment_category_count
AFTER INSERT ON menu_items
FOR EACH ROW
WHEN NEW.deleted_at IS NULL
BEGIN
    UPDATE categories
    SET item_count = item_count + 1
    WHERE id = NEW.category_id;
END;

CREATE TRIGGER IF NOT EXISTS menu_items_decrement_category_count
AFTER UPDATE OF deleted_at ON menu_items
FOR EACH ROW
WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
BEGIN
    UPDATE categories
    SET item_count = item_count - 1
    WHERE id = OLD.category_id AND item_count > 0;
END;

-- Update tag usage_count
CREATE TRIGGER IF NOT EXISTS menu_item_tags_increment_usage
AFTER INSERT ON menu_item_tags
FOR EACH ROW
BEGIN
    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
END;

CREATE TRIGGER IF NOT EXISTS menu_item_tags_decrement_usage
AFTER DELETE ON menu_item_tags
FOR EACH ROW
BEGIN
    UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id AND usage_count > 0;
END;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VIEWS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Available menu items with category
CREATE VIEW IF NOT EXISTS v_available_menu_items AS
SELECT
    mi.id,
    mi.restaurant_id,
    mi.category_id,
    c.name as category_name,
    mi.name,
    mi.slug,
    mi.description,
    mi.price,
    mi.compare_at_price,
    mi.images,
    mi.is_featured,
    mi.is_popular,
    mi.preparation_time,
    mi.spice_level,
    mi.rating,
    mi.review_count,
    mi.order_count,
    mi.dietary_tags,
    mi.allergens
FROM menu_items mi
JOIN categories c ON mi.category_id = c.id
WHERE mi.is_available = 1
  AND mi.is_visible = 1
  AND mi.deleted_at IS NULL
  AND c.is_active = 1
  AND c.is_visible = 1
  AND c.deleted_at IS NULL;

-- Low stock items
CREATE VIEW IF NOT EXISTS v_low_stock_items AS
SELECT
    mi.id,
    mi.restaurant_id,
    mi.name,
    mi.sku,
    mi.inventory_quantity,
    mi.low_stock_threshold,
    c.name as category_name
FROM menu_items mi
JOIN categories c ON mi.category_id = c.id
WHERE mi.track_inventory = 1
  AND mi.inventory_quantity <= mi.low_stock_threshold
  AND mi.deleted_at IS NULL;

-- Popular items
CREATE VIEW IF NOT EXISTS v_popular_items AS
SELECT
    mi.id,
    mi.restaurant_id,
    mi.name,
    mi.price,
    mi.order_count,
    mi.rating,
    mi.review_count,
    c.name as category_name
FROM menu_items mi
JOIN categories c ON mi.category_id = c.id
WHERE mi.deleted_at IS NULL
  AND c.deleted_at IS NULL
ORDER BY mi.order_count DESC, mi.rating DESC
LIMIT 50;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRATION COMPLETE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Layer 2 - Product Catalog
-- Tables Created: 6
-- Indexes Created: 25
-- Views Created: 3
-- Triggers Created: 8
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT '✅ Migration 04_product_catalog completed successfully' as status;
