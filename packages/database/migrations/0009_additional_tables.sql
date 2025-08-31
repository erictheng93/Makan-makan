-- Additional Tables Migration
-- 創建 API 需要的額外表格
-- Created: 2025-08-30

-- 1. Order Status History - 訂單狀態變更歷史
CREATE TABLE order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    changed_by INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Blacklisted Tokens - JWT Token 黑名單
CREATE TABLE blacklisted_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_jti TEXT NOT NULL UNIQUE, -- JWT ID claim
    token_hash TEXT NOT NULL, -- Token hash for security
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    reason TEXT, -- 'logout', 'expired', 'revoked', etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Menu Item Options - 菜單項目選項 (size, extras, etc.)
CREATE TABLE menu_item_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    option_type TEXT NOT NULL, -- 'size', 'extra', 'customization'
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    price_adjustment DECIMAL(10,2) DEFAULT 0, -- 價格調整 (+/-)
    is_required BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- 4. Customer Reviews - 客戶評價
CREATE TABLE customer_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    customer_name TEXT,
    customer_email TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    response TEXT, -- 餐廳回覆
    response_by INTEGER, -- 回覆者
    response_at DATETIME,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'flagged')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (response_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Inventory Items - 庫存管理
CREATE TABLE inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT, -- 'ingredient', 'beverage', 'supply'
    unit TEXT NOT NULL, -- 'kg', 'pcs', 'bottles'
    current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_stock_level DECIMAL(10,2),
    cost_per_unit DECIMAL(10,2),
    supplier_info TEXT, -- JSON format
    last_restocked_at DATETIME,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 6. Stock Movements - 庫存異動記錄
CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_item_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'waste')),
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2),
    reason TEXT,
    reference_id INTEGER, -- 關聯的訂單或其他記錄
    reference_type TEXT, -- 'order', 'adjustment', 'restock'
    recorded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Table Reservations - 訂位管理  
CREATE TABLE table_reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    party_size INTEGER NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 120, -- 預設2小時
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
    special_requests TEXT,
    notes TEXT,
    confirmed_by INTEGER,
    confirmed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
    FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 8. Payment Transactions - 支付交易記錄
CREATE TABLE payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    transaction_id TEXT NOT NULL UNIQUE, -- 外部支付系統的交易ID
    payment_method TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'MYR',
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
    payment_gateway TEXT, -- 支付閘道提供商
    gateway_response TEXT, -- JSON format
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 索引創建
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);

CREATE INDEX idx_blacklisted_tokens_token_jti ON blacklisted_tokens(token_jti);
CREATE INDEX idx_blacklisted_tokens_user_id ON blacklisted_tokens(user_id);
CREATE INDEX idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);

CREATE INDEX idx_menu_item_options_menu_item_id ON menu_item_options(menu_item_id);
CREATE INDEX idx_menu_item_options_type ON menu_item_options(option_type);

CREATE INDEX idx_customer_reviews_order_id ON customer_reviews(order_id);
CREATE INDEX idx_customer_reviews_restaurant_id ON customer_reviews(restaurant_id);
CREATE INDEX idx_customer_reviews_rating ON customer_reviews(rating);
CREATE INDEX idx_customer_reviews_created_at ON customer_reviews(created_at);

CREATE INDEX idx_inventory_items_restaurant_id ON inventory_items(restaurant_id);
CREATE INDEX idx_inventory_items_category ON inventory_items(category);
CREATE INDEX idx_inventory_items_status ON inventory_items(status);

CREATE INDEX idx_stock_movements_inventory_item_id ON stock_movements(inventory_item_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

CREATE INDEX idx_table_reservations_restaurant_id ON table_reservations(restaurant_id);
CREATE INDEX idx_table_reservations_table_id ON table_reservations(table_id);
CREATE INDEX idx_table_reservations_date ON table_reservations(reservation_date);
CREATE INDEX idx_table_reservations_status ON table_reservations(status);

CREATE INDEX idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_transaction_id ON payment_transactions(transaction_id);

-- 觸發器：自動更新 updated_at 欄位
CREATE TRIGGER update_menu_item_options_updated_at 
AFTER UPDATE ON menu_item_options
BEGIN
    UPDATE menu_item_options SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_customer_reviews_updated_at 
AFTER UPDATE ON customer_reviews
BEGIN
    UPDATE customer_reviews SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_inventory_items_updated_at 
AFTER UPDATE ON inventory_items
BEGIN
    UPDATE inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_table_reservations_updated_at 
AFTER UPDATE ON table_reservations
BEGIN
    UPDATE table_reservations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 觸發器：清理過期的黑名單 token
CREATE TRIGGER cleanup_expired_blacklisted_tokens
AFTER INSERT ON blacklisted_tokens
WHEN (SELECT COUNT(*) FROM blacklisted_tokens) > 1000
BEGIN
    DELETE FROM blacklisted_tokens 
    WHERE expires_at < datetime('now', '-1 days');
END;

-- 觸發器：庫存不足警報
CREATE TRIGGER inventory_low_stock_alert
AFTER UPDATE ON inventory_items
WHEN NEW.current_stock <= NEW.min_stock_level AND OLD.current_stock > OLD.min_stock_level
BEGIN
    INSERT INTO system_alerts (
        title, description, severity, alert_type, restaurant_id, affected_component
    ) VALUES (
        '庫存不足警報',
        '商品 "' || NEW.name || '" 庫存已低於安全標準 (' || NEW.current_stock || ' ' || NEW.unit || ')',
        'medium',
        'inventory_low',
        NEW.restaurant_id,
        'inventory'
    );
END;

-- 視圖：庫存狀態概覽
CREATE VIEW inventory_status AS
SELECT 
    i.id,
    i.restaurant_id,
    i.name,
    i.category,
    i.current_stock,
    i.min_stock_level,
    i.unit,
    CASE 
        WHEN i.current_stock <= i.min_stock_level THEN 'low'
        WHEN i.current_stock <= i.min_stock_level * 1.5 THEN 'warning'
        ELSE 'normal'
    END as stock_status,
    i.cost_per_unit,
    i.current_stock * i.cost_per_unit as total_value,
    i.last_restocked_at,
    i.status
FROM inventory_items i
WHERE i.status = 'active';

-- 視圖：今日訂位概覽
CREATE VIEW today_reservations AS
SELECT 
    r.*,
    t.table_number,
    t.table_name,
    t.capacity,
    rest.name as restaurant_name
FROM table_reservations r
JOIN tables t ON r.table_id = t.id
JOIN restaurants rest ON r.restaurant_id = rest.id
WHERE DATE(r.reservation_date) = DATE('now')
ORDER BY r.reservation_time;