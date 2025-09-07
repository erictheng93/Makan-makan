-- Restaurant ID Migration: INTEGER to TEXT
-- Created: 2025-09-07
-- Description: 將所有 restaurant_id 欄位從 INTEGER 改為 TEXT 以支援更靈活的多租戶架構

-- 此遷移需要謹慎執行，建議在維護時段進行

-- 1. 創建新的暫存表格（以 restaurants 表為例）
CREATE TABLE restaurants_new (
    id TEXT PRIMARY KEY, -- 改為 TEXT
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    settings TEXT DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 複製現有資料並生成新的TEXT ID
INSERT INTO restaurants_new (
    id, name, description, address, phone, email, logo_url, 
    settings, status, created_at, updated_at
)
SELECT 
    'rest_' || LOWER(REPLACE(REPLACE(name, ' ', '_'), '-', '_')) || '_' || 
    SUBSTR('0000' || CAST(id AS TEXT), -4) as new_id,
    name, description, address, phone, email, logo_url,
    settings, status, created_at, updated_at
FROM restaurants;

-- 3. 更新所有相關表格的 restaurant_id 欄位

-- 3.1 Users 表
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT,
    full_name TEXT,
    role INTEGER NOT NULL DEFAULT 4,
    restaurant_id TEXT, -- 改為 TEXT
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE
);

INSERT INTO users_new (
    id, username, password, email, full_name, role, restaurant_id,
    status, last_login_at, created_at, updated_at
)
SELECT 
    u.id, u.username, u.password, u.email, u.full_name, u.role,
    r.id as new_restaurant_id,
    u.status, u.last_login_at, u.created_at, u.updated_at
FROM users u
LEFT JOIN restaurants_new r ON ('rest_' || LOWER(REPLACE(REPLACE((SELECT name FROM restaurants WHERE id = u.restaurant_id), ' ', '_'), '-', '_')) || '_' || 
    SUBSTR('0000' || CAST(u.restaurant_id AS TEXT), -4)) = r.id;

-- 3.2 Categories 表
CREATE TABLE categories_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL, -- 改為 TEXT
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE
);

INSERT INTO categories_new (
    id, restaurant_id, name, name_en, description, image_url,
    sort_order, status, created_at, updated_at
)
SELECT 
    c.id,
    r.id as new_restaurant_id,
    c.name, c.name_en, c.description, c.image_url,
    c.sort_order, c.status, c.created_at, c.updated_at
FROM categories c
JOIN restaurants_new r ON ('rest_' || LOWER(REPLACE(REPLACE((SELECT name FROM restaurants WHERE id = c.restaurant_id), ' ', '_'), '-', '_')) || '_' || 
    SUBSTR('0000' || CAST(c.restaurant_id AS TEXT), -4)) = r.id;

-- 3.3 Menu Items 表
CREATE TABLE menu_items_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL, -- 改為 TEXT
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    description_en TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    image_variants TEXT DEFAULT '{}',
    ingredients TEXT,
    allergens TEXT,
    nutritional_info TEXT,
    customization_options TEXT DEFAULT '{}',
    availability_schedule TEXT DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories_new(id) ON DELETE CASCADE
);

INSERT INTO menu_items_new (
    id, restaurant_id, category_id, name, name_en, description, description_en,
    price, image_url, image_variants, ingredients, allergens, nutritional_info,
    customization_options, availability_schedule, sort_order, is_featured,
    is_available, status, created_at, updated_at
)
SELECT 
    m.id,
    r.id as new_restaurant_id,
    m.category_id, m.name, m.name_en, m.description, m.description_en,
    m.price, m.image_url, m.image_variants, m.ingredients, m.allergens, m.nutritional_info,
    m.customization_options, m.availability_schedule, m.sort_order, m.is_featured,
    m.is_available, m.status, m.created_at, m.updated_at
FROM menu_items m
JOIN restaurants_new r ON ('rest_' || LOWER(REPLACE(REPLACE((SELECT name FROM restaurants WHERE id = m.restaurant_id), ' ', '_'), '-', '_')) || '_' || 
    SUBSTR('0000' || CAST(m.restaurant_id AS TEXT), -4)) = r.id;

-- 3.4 Tables 表
CREATE TABLE tables_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL, -- 改為 TEXT
    table_number TEXT NOT NULL,
    table_name TEXT,
    capacity INTEGER DEFAULT 4,
    qr_code TEXT NOT NULL UNIQUE,
    qr_code_url TEXT,
    location TEXT,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
    current_order_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, table_number)
);

INSERT INTO tables_new (
    id, restaurant_id, table_number, table_name, capacity, qr_code, qr_code_url,
    location, status, current_order_id, created_at, updated_at
)
SELECT 
    t.id,
    r.id as new_restaurant_id,
    t.table_number, t.table_name, t.capacity, t.qr_code, t.qr_code_url,
    t.location, t.status, t.current_order_id, t.created_at, t.updated_at
FROM tables t
JOIN restaurants_new r ON ('rest_' || LOWER(REPLACE(REPLACE((SELECT name FROM restaurants WHERE id = t.restaurant_id), ' ', '_'), '-', '_')) || '_' || 
    SUBSTR('0000' || CAST(t.restaurant_id AS TEXT), -4)) = r.id;

-- 3.5 Orders 表
CREATE TABLE orders_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL, -- 改為 TEXT
    table_id INTEGER,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT,
    customer_phone TEXT,
    order_type TEXT DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'digital_wallet', 'bank_transfer')),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    service_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    special_requests TEXT,
    estimated_ready_time DATETIME,
    served_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables_new(id) ON DELETE SET NULL
);

INSERT INTO orders_new (
    id, restaurant_id, table_id, order_number, customer_name, customer_phone,
    order_type, status, payment_status, payment_method, subtotal, tax_amount,
    service_charge, discount_amount, total_amount, notes, special_requests,
    estimated_ready_time, served_at, completed_at, created_at, updated_at
)
SELECT 
    o.id,
    r.id as new_restaurant_id,
    o.table_id, o.order_number, o.customer_name, o.customer_phone,
    o.order_type, o.status, o.payment_status, o.payment_method, o.subtotal, o.tax_amount,
    o.service_charge, o.discount_amount, o.total_amount, o.notes, o.special_requests,
    o.estimated_ready_time, o.served_at, o.completed_at, o.created_at, o.updated_at
FROM orders o
JOIN restaurants_new r ON ('rest_' || LOWER(REPLACE(REPLACE((SELECT name FROM restaurants WHERE id = o.restaurant_id), ' ', '_'), '-', '_')) || '_' || 
    SUBSTR('0000' || CAST(o.restaurant_id AS TEXT), -4)) = r.id;

-- 4. 更新新功能相關表格

-- 4.1 Group Orders 表
DROP TABLE IF EXISTS group_orders;
CREATE TABLE group_orders (
    id TEXT PRIMARY KEY,
    share_code TEXT UNIQUE NOT NULL,
    master_order_id INTEGER,
    created_by INTEGER NOT NULL,
    restaurant_id TEXT NOT NULL, -- 改為 TEXT
    table_id INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ordering', 'checkout', 'completed', 'cancelled')),
    split_type TEXT DEFAULT 'equal' CHECK (split_type IN ('equal', 'proportional', 'individual', 'custom')),
    total_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    service_charge DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2) DEFAULT 0,
    expires_at DATETIME NOT NULL,
    locked_at DATETIME,
    completed_at DATETIME,
    settings TEXT DEFAULT '{}',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (master_order_id) REFERENCES orders_new(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users_new(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables_new(id) ON DELETE SET NULL
);

-- 4.2 Cash Registers 表
DROP TABLE IF EXISTS cash_registers;
CREATE TABLE cash_registers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    restaurant_id TEXT NOT NULL, -- 改為 TEXT
    is_active BOOLEAN DEFAULT TRUE,
    current_shift_id TEXT,
    hardware_config TEXT DEFAULT '{}',
    peripherals TEXT DEFAULT '{}',
    settings TEXT DEFAULT '{}',
    last_maintenance_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE
);

-- 4.3 Waiting Queue 表
DROP TABLE IF EXISTS waiting_queue;
CREATE TABLE waiting_queue (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL, -- 改為 TEXT
    queue_number INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    party_size INTEGER NOT NULL,
    special_requests TEXT,
    priority INTEGER DEFAULT 0,
    queue_type TEXT DEFAULT 'walkin' CHECK (queue_type IN ('walkin', 'online', 'phone', 'reservation')),
    estimated_wait_minutes INTEGER NOT NULL,
    actual_wait_minutes INTEGER,
    table_preferences TEXT DEFAULT '[]',
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'notified', 'seated', 'cancelled', 'no_show', 'expired')),
    notification_methods TEXT DEFAULT '[]',
    notification_sent BOOLEAN DEFAULT FALSE,
    last_notification_at DATETIME,
    notification_count INTEGER DEFAULT 0,
    check_in_code TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME,
    notified_at DATETIME,
    seated_at DATETIME,
    cancelled_at DATETIME,
    assigned_table_id INTEGER,
    served_by INTEGER,
    notes TEXT,
    metadata TEXT DEFAULT '{}',
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_table_id) REFERENCES tables_new(id) ON DELETE SET NULL,
    FOREIGN KEY (served_by) REFERENCES users_new(id) ON DELETE SET NULL,
    UNIQUE(restaurant_id, queue_number, DATE(joined_at))
);

-- 4.4 Queue Settings 表
DROP TABLE IF EXISTS queue_settings;
CREATE TABLE queue_settings (
    restaurant_id TEXT PRIMARY KEY, -- 改為 TEXT
    is_enabled BOOLEAN DEFAULT TRUE,
    max_queue_size INTEGER DEFAULT 50,
    avg_service_time INTEGER DEFAULT 45,
    max_wait_time INTEGER DEFAULT 120,
    min_advance_notice INTEGER DEFAULT 5,
    notification_methods TEXT DEFAULT '["sms"]',
    auto_call_enabled BOOLEAN DEFAULT TRUE,
    auto_call_interval INTEGER DEFAULT 10,
    no_show_timeout INTEGER DEFAULT 15,
    queue_number_reset TEXT DEFAULT 'daily' CHECK (queue_number_reset IN ('daily', 'weekly', 'monthly', 'never')),
    priority_rules TEXT DEFAULT '{}',
    table_assignment_rules TEXT DEFAULT '{}',
    notification_templates TEXT DEFAULT '{}',
    business_hours TEXT DEFAULT '{}',
    holiday_settings TEXT DEFAULT '{}',
    display_settings TEXT DEFAULT '{}',
    integration_settings TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants_new(id) ON DELETE CASCADE
);

-- 5. 刪除舊表格並重新命名新表格
-- 注意：在生產環境中請謹慎執行此步驟

-- 備份舊表格（可選）
-- CREATE TABLE restaurants_backup AS SELECT * FROM restaurants;

-- 刪除舊表格
DROP TABLE IF EXISTS restaurants;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS orders;

-- 重新命名新表格
ALTER TABLE restaurants_new RENAME TO restaurants;
ALTER TABLE users_new RENAME TO users;
ALTER TABLE categories_new RENAME TO categories;
ALTER TABLE menu_items_new RENAME TO menu_items;
ALTER TABLE tables_new RENAME TO tables;
ALTER TABLE orders_new RENAME TO orders;

-- 6. 重新創建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_restaurant_id ON users(restaurant_id);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX idx_categories_status ON categories(status);

CREATE INDEX idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_status ON menu_items(status);
CREATE INDEX idx_menu_items_availability ON menu_items(is_available);

CREATE INDEX idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX idx_tables_qr_code ON tables(qr_code);
CREATE INDEX idx_tables_status ON tables(status);

CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- 新功能表格的索引
CREATE INDEX idx_group_orders_restaurant_id ON group_orders(restaurant_id);
CREATE INDEX idx_group_orders_share_code ON group_orders(share_code);
CREATE INDEX idx_group_orders_status ON group_orders(status);

CREATE INDEX idx_cash_registers_restaurant_id ON cash_registers(restaurant_id);
CREATE INDEX idx_cash_registers_is_active ON cash_registers(is_active);

CREATE INDEX idx_waiting_queue_restaurant_id ON waiting_queue(restaurant_id);
CREATE INDEX idx_waiting_queue_status ON waiting_queue(status);
CREATE INDEX idx_waiting_queue_joined_at ON waiting_queue(joined_at);
CREATE INDEX idx_waiting_queue_priority ON waiting_queue(priority DESC);

-- 7. 重新創建觸發器
-- Restaurant ID 生成函數
CREATE TRIGGER generate_restaurant_id
AFTER INSERT ON restaurants
WHEN NEW.id IS NULL OR NEW.id = ''
BEGIN
    UPDATE restaurants 
    SET id = 'rest_' || LOWER(REPLACE(REPLACE(NEW.name, ' ', '_'), '-', '_')) || '_' || 
             SUBSTR('0000' || CAST((SELECT COUNT(*) FROM restaurants) AS TEXT), -4)
    WHERE rowid = NEW.rowid;
END;

-- Updated_at 觸發器
CREATE TRIGGER update_restaurants_updated_at 
AFTER UPDATE ON restaurants
BEGIN
    UPDATE restaurants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_users_updated_at 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_categories_updated_at 
AFTER UPDATE ON categories
BEGIN
    UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_menu_items_updated_at 
AFTER UPDATE ON menu_items
BEGIN
    UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_tables_updated_at 
AFTER UPDATE ON tables
BEGIN
    UPDATE tables SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_orders_updated_at 
AFTER UPDATE ON orders
BEGIN
    UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 8. 創建餐廳ID生成輔助函數（用於API）
-- 這個可以在應用程式層面實現
-- 格式建議：
-- rest_{type}_{location}_{sequence}
-- 例如：rest_mamak_kl_001, rest_western_pj_002, rest_chinese_subang_003

-- 遷移完成說明
-- 1. 所有 restaurant_id 欄位已從 INTEGER 改為 TEXT
-- 2. 新的餐廳ID格式：rest_{name}_{sequence}
-- 3. 保持了所有外鍵關聯和約束
-- 4. 重新創建了所有必要的索引和觸發器
-- 5. 新功能表格已使用 TEXT restaurant_id

-- 注意事項：
-- 1. 此遷移會影響所有API端點，需要同步更新應用程式碼
-- 2. 建議先在測試環境執行並驗證
-- 3. 生產環境執行前請備份資料庫
-- 4. 考慮分步驟執行，避免長時間鎖表