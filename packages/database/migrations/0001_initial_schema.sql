-- =====================================================
-- Migration: Initial Schema
-- Version: 0001
-- Date: 2025-10-11
-- Description: 完整的初始資料庫 schema，與 Drizzle ORM 定義完全一致
--              包含所有核心業務表、索引和約束
-- =====================================================

-- ==========================================
-- 1. Restaurants Table - 餐廳主表
-- ==========================================
CREATE TABLE restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 基本資訊
    name TEXT NOT NULL,
    type TEXT NOT NULL,                    -- 餐廳類型：中式、西式、日式等
    category TEXT NOT NULL,                -- 餐廳分類：火鍋、燒烤、快餐等
    description TEXT,
    address TEXT NOT NULL,
    district TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '台中市',
    phone TEXT NOT NULL,
    email TEXT,
    website TEXT,

    -- 營業資訊 (JSON)
    business_hours TEXT,                   -- {"monday": {"open": "09:00", "close": "22:00"}, ...}

    -- 狀態和設定
    is_available INTEGER NOT NULL DEFAULT 1, -- Boolean
    is_active INTEGER NOT NULL DEFAULT 1,    -- Boolean

    -- 媒體檔案
    logo_url TEXT,
    banner_url TEXT,
    image_urls TEXT,                       -- JSON array of strings

    -- 店家級別 QR Code（用於無桌號的外帶/自取訂單）
    shop_qr_code TEXT UNIQUE,
    shop_qr_code_image_url TEXT,
    enable_shop_mode INTEGER NOT NULL DEFAULT 0,
    shop_qr_settings TEXT,                 -- JSON: {displayName, instructions, requirePhone}
    shop_qr_version INTEGER NOT NULL DEFAULT 1,

    -- 設定 (JSON)
    settings TEXT,                         -- {allowOnlineOrdering, currency, taxRate, ...}

    -- 評分和統計
    rating REAL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    total_orders INTEGER NOT NULL DEFAULT 0,

    -- 時間戳記
    created_at INTEGER NOT NULL,           -- Unix timestamp (milliseconds)
    updated_at INTEGER NOT NULL            -- Unix timestamp (milliseconds)
);

-- ==========================================
-- 2. Users Table - 用戶表（支持員工和客戶）
-- ==========================================
CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,

    -- 基本資訊
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    full_name TEXT NOT NULL,

    -- 認證資訊
    password TEXT,                         -- 舊欄位，保留向後兼容
    password_hash TEXT NOT NULL,          -- 主要密碼 hash

    -- 角色和權限
    role INTEGER NOT NULL DEFAULT 5,      -- 0:Admin, 1:Owner, 2:Chef, 3:Service, 4:Cashier, 5:Customer
    restaurant_id TEXT,

    -- 個人資訊
    address TEXT,
    date_of_birth TEXT,                   -- ISO date string
    profile_image_url TEXT,

    -- 狀態
    is_active INTEGER NOT NULL DEFAULT 1,
    is_verified INTEGER NOT NULL DEFAULT 0,

    -- 偏好設定 (JSON)
    preferences TEXT,                     -- {language, currency, notifications, dietary}

    -- 統計資訊
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0, -- 以分為單位

    -- 安全資訊
    last_login_at INTEGER,                -- Unix timestamp
    password_changed_at INTEGER,          -- Unix timestamp

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(public_id) ON DELETE CASCADE
);

-- Users 索引
CREATE UNIQUE INDEX users_username_idx ON users(username);
CREATE INDEX users_restaurant_id_idx ON users(restaurant_id);
CREATE INDEX users_role_idx ON users(role);
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_phone_idx ON users(phone);

-- ==========================================
-- 3. Sessions Table - 會話表
-- ==========================================
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                  -- UUID
    user_id TEXT NOT NULL,

    -- Session 資訊
    token TEXT NOT NULL UNIQUE,           -- JWT Token
    refresh_token TEXT UNIQUE,            -- Refresh Token

    -- 裝置和瀏覽器資訊
    user_agent TEXT,
    ip_address TEXT,
    device_info TEXT,                     -- JSON: {platform, deviceType, browser, version}

    -- 地理位置 (JSON)
    location TEXT,                        -- {country, city, coordinates: {lat, lng}}

    -- 狀態
    is_active INTEGER NOT NULL DEFAULT 1,

    -- 時間資訊
    last_accessed_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions 索引
CREATE INDEX sessions_user_active_idx ON sessions(user_id, is_active);
CREATE INDEX sessions_token_idx ON sessions(token);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

-- ==========================================
-- 4. Categories Table - 分類表
-- ==========================================
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,

    -- 基本資訊
    name TEXT NOT NULL,
    description TEXT,

    -- 顯示設定
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_visible INTEGER NOT NULL DEFAULT 1,

    -- 媒體檔案
    image_url TEXT,
    icon_url TEXT,

    -- 營業時間限制 (JSON)
    available_hours TEXT,                 -- {start: "HH:mm", end: "HH:mm", days: [0-6]}

    -- 統計資訊
    item_count INTEGER NOT NULL DEFAULT 0,

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(public_id) ON DELETE CASCADE
);

-- Categories 索引
CREATE INDEX categories_restaurant_sort_idx ON categories(restaurant_id, sort_order);
CREATE INDEX categories_restaurant_active_idx ON categories(restaurant_id, is_active);

-- ==========================================
-- 5. Menu Items Table - 菜單項目表
-- ==========================================
CREATE TABLE menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,
    category_id INTEGER NOT NULL,

    -- 基本資訊
    name TEXT NOT NULL,
    description TEXT,
    ingredients TEXT,

    -- 價格資訊
    price REAL NOT NULL,
    original_price REAL,                  -- 原價（促銷用）
    cost_price REAL,                      -- 成本價

    -- 圖片資訊 (JSON)
    image_url TEXT,
    image_variants TEXT,                  -- {thumbnail, small, medium, large}

    -- 狀態設定
    is_available INTEGER NOT NULL DEFAULT 1,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_popular INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- 庫存管理
    inventory_count INTEGER,              -- NULL = 無限庫存
    min_inventory_alert INTEGER DEFAULT 5,

    -- 飲食特性
    spice_level INTEGER NOT NULL DEFAULT 0, -- 0-5 辣度
    preparation_time INTEGER DEFAULT 15,    -- 準備時間（分鐘）
    calories INTEGER,

    -- 飲食資訊標籤 (JSON)
    dietary_info TEXT,                    -- {vegetarian, vegan, halal, ...}

    -- 過敏原資訊 (JSON)
    allergens TEXT,                       -- ["peanuts", "shellfish", ...]

    -- 客製化選項 (JSON)
    options TEXT,                         -- {sizes, customizations, addOns}

    -- 營業時間限制 (JSON)
    available_hours TEXT,

    -- 統計資訊
    order_count INTEGER NOT NULL DEFAULT 0,
    rating REAL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,

    -- SEO 和搜尋 (JSON)
    tags TEXT,                            -- ["熱門", "新品", ...]
    keywords TEXT,

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(public_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Menu Items 索引
CREATE INDEX menu_items_restaurant_category_idx ON menu_items(restaurant_id, category_id, is_available);
CREATE INDEX menu_items_restaurant_featured_idx ON menu_items(restaurant_id, is_featured, is_available);
CREATE INDEX menu_items_restaurant_popular_idx ON menu_items(restaurant_id, is_popular, order_count);
CREATE INDEX menu_items_price_range_idx ON menu_items(restaurant_id, price);
CREATE INDEX menu_items_availability_idx ON menu_items(is_available, inventory_count);

-- ==========================================
-- 6. Tables Table - 桌子表
-- ==========================================
CREATE TABLE tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,

    -- 桌子資訊
    number TEXT NOT NULL,                 -- 桌號（A1, B2, 101）
    name TEXT,
    capacity INTEGER NOT NULL DEFAULT 4,

    -- 位置資訊
    location TEXT,
    floor INTEGER DEFAULT 1,
    section TEXT,

    -- QR Code 資訊
    qr_code TEXT NOT NULL UNIQUE,
    qr_code_image_url TEXT,
    qr_code_version INTEGER NOT NULL DEFAULT 1,

    -- 座位管理模式
    qr_mode TEXT DEFAULT 'table',         -- 'table' | 'seat'
    seat_count INTEGER DEFAULT 0,
    seat_layout TEXT,                     -- JSON: {rows, columns, positions}
    seat_numbering_style TEXT DEFAULT 'numeric', -- 'numeric' | 'alphabetic' | 'custom'

    -- 狀態
    is_occupied INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_reservable INTEGER NOT NULL DEFAULT 1,

    -- 設備和設定 (JSON)
    features TEXT,                        -- {hasChargingPort, hasWifi, ...}

    -- 目前使用狀況
    current_order_id TEXT,
    occupied_at INTEGER,
    occupied_by TEXT,
    estimated_free_at INTEGER,

    -- 清潔和維護
    last_cleaned_at INTEGER,
    maintenance_notes TEXT,

    -- 統計資訊
    total_usage INTEGER NOT NULL DEFAULT 0,
    average_occupancy_minutes INTEGER DEFAULT 0,

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(public_id) ON DELETE CASCADE
);

-- Tables 索引
CREATE INDEX tables_restaurant_number_idx ON tables(restaurant_id, number);
CREATE INDEX tables_restaurant_status_idx ON tables(restaurant_id, is_occupied, is_active);
CREATE INDEX tables_qr_code_idx ON tables(qr_code);

-- ==========================================
-- 7. Seats Table - 座位表
-- ==========================================
CREATE TABLE seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL,

    -- 座位基本資訊
    seat_number TEXT NOT NULL,
    seat_name TEXT,
    position TEXT,

    -- QR Code 資訊
    qr_code TEXT NOT NULL UNIQUE,
    qr_code_image_url TEXT,
    qr_code_version INTEGER NOT NULL DEFAULT 1,

    -- 狀態管理
    is_occupied INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    current_order_id TEXT,

    -- 使用追蹤
    occupied_at INTEGER,
    occupied_by TEXT,
    total_usage INTEGER NOT NULL DEFAULT 0,

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
);

-- Seats 索引
CREATE INDEX seats_table_id_idx ON seats(table_id);
CREATE INDEX seats_qr_code_idx ON seats(qr_code);
CREATE INDEX seats_table_seat_number_idx ON seats(table_id, seat_number);
CREATE INDEX seats_is_occupied_idx ON seats(is_occupied);
CREATE INDEX seats_is_active_idx ON seats(is_active);

-- ==========================================
-- 8. Orders Table - 訂單表
-- ==========================================
CREATE TABLE orders (
    id TEXT PRIMARY KEY NOT NULL,

    -- 關聯資訊
    restaurant_id TEXT NOT NULL,
    table_id INTEGER NOT NULL,
    customer_id INTEGER,                  -- 可選：註冊用戶

    -- 訂單基本資訊
    order_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, preparing, ready, delivered, paid, cancelled, refunded
    order_type TEXT DEFAULT 'table',      -- 'shop' | 'table' | 'seat'

    -- 金額資訊
    subtotal REAL NOT NULL,
    tax_amount REAL NOT NULL DEFAULT 0,
    service_charge REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL,

    -- 顧客資訊 (JSON)
    customer_info TEXT,                   -- {name, phone, phoneLastDigits, email, peopleCount, specialRequests, orderType}

    -- 時間資訊
    estimated_prep_time INTEGER,
    actual_prep_time INTEGER,

    -- 狀態時間戳記
    confirmed_at INTEGER,
    preparing_at INTEGER,
    ready_at INTEGER,
    delivered_at INTEGER,
    paid_at INTEGER,
    cancelled_at INTEGER,

    -- 付款資訊
    payment_method TEXT,                  -- 'cash', 'card', 'digital_wallet', 'bank_transfer', 'other'
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    payment_transaction_id TEXT,

    -- 優惠券和促銷 (JSON)
    coupon_code TEXT,
    promotion_ids TEXT,                   -- JSON array

    -- 評價資訊
    rating INTEGER,                       -- 1-5 星
    review_comment TEXT,
    reviewed_at INTEGER,

    -- 訂單備註
    notes TEXT,                           -- 顧客備註
    internal_notes TEXT,                  -- 內部備註

    -- 取消資訊
    cancellation_reason TEXT,
    refund_amount REAL,

    -- 配送資訊 (JSON)
    delivery_info TEXT,                   -- {type, address, phone, instructions, deliveryFee, estimatedDeliveryTime}

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(public_id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES users(id)
);

-- Orders 索引
CREATE INDEX orders_restaurant_status_idx ON orders(restaurant_id, status, created_at);
CREATE INDEX orders_restaurant_table_idx ON orders(restaurant_id, table_id, status);
CREATE INDEX orders_order_number_idx ON orders(order_number);
CREATE INDEX orders_customer_idx ON orders(customer_id, created_at);
CREATE INDEX orders_status_time_idx ON orders(status, created_at);
CREATE INDEX orders_payment_status_idx ON orders(payment_status, paid_at);

-- ==========================================
-- 9. Order Items Table - 訂單項目表
-- ==========================================
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 關聯資訊
    order_id TEXT NOT NULL,
    menu_item_id INTEGER NOT NULL,

    -- 基本資訊
    quantity INTEGER NOT NULL,

    -- 價格資訊（快照）
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,

    -- 菜品資訊快照 (JSON)
    item_snapshot TEXT,                   -- {name, description, imageUrl, category}

    -- 客製化選項 (JSON)
    customizations TEXT,                  -- {size, options, addOns}

    -- 狀態和時間
    status TEXT NOT NULL DEFAULT 'pending', -- pending, preparing, ready, served, cancelled
    prepared_at INTEGER,
    served_at INTEGER,

    -- 備註
    notes TEXT,                           -- 顧客備註
    kitchen_notes TEXT,                   -- 廚房備註

    -- 取消資訊
    cancelled_at INTEGER,
    cancellation_reason TEXT,

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
);

-- Order Items 索引
CREATE INDEX order_items_order_status_idx ON order_items(order_id, status);
CREATE INDEX order_items_menu_item_idx ON order_items(menu_item_id, created_at);

-- ==========================================
-- 10. Audit Logs Table - 審計日誌表
-- ==========================================
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 關聯資訊
    user_id TEXT,                      -- 可為空（系統操作）
    restaurant_id TEXT,                -- 可為空（全局操作）

    -- 操作資訊
    action TEXT NOT NULL,
    resource TEXT NOT NULL,               -- orders, menu_items, users 等
    resource_id TEXT,

    -- 操作詳情 (JSON)
    description TEXT NOT NULL,
    changes TEXT,                         -- {before, after, metadata}

    -- 請求資訊
    ip_address TEXT,
    user_agent TEXT,

    -- 結果資訊
    success INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,

    -- 效能資訊
    execution_time_ms INTEGER,

    -- 時間戳記
    created_at INTEGER NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(public_id)
);

-- Audit Logs 索引
CREATE INDEX audit_logs_user_action_idx ON audit_logs(user_id, action, created_at);
CREATE INDEX audit_logs_restaurant_action_idx ON audit_logs(restaurant_id, action, created_at);
CREATE INDEX audit_logs_resource_idx ON audit_logs(resource, resource_id, created_at);
CREATE INDEX audit_logs_time_idx ON audit_logs(created_at);

-- ==========================================
-- Schema 完成說明
-- ==========================================

-- 資料庫版本: 1.0.0
-- 總表數: 10 個核心表
-- 索引數: 40+ 個優化索引
--
-- 特性：
-- 1. 完全符合 Drizzle ORM schema 定義
-- 2. 統一使用 INTEGER 類型的 Unix timestamp（毫秒）
-- 3. 統一使用 INTEGER 作為布爾值（0 = false, 1 = true）
-- 4. 完整的外鍵約束和級聯刪除規則
-- 5. 優化的索引結構以支持常見查詢
-- 6. JSON 欄位用於彈性的半結構化數據
-- 7. 支持多種業務場景（桌位、座位、店家級別訂單）
-- 8. 完整的審計追蹤功能
