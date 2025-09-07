-- Group Ordering System Migration
-- Created: 2025-09-07
-- Description: 添加群組點餐和分帳功能所需的資料表

-- 1. 群組訂單表 - 管理群組點餐會話
CREATE TABLE group_orders (
    id TEXT PRIMARY KEY,
    share_code TEXT UNIQUE NOT NULL,
    master_order_id INTEGER,
    created_by INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    table_id INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ordering', 'checkout', 'completed', 'cancelled')),
    split_type TEXT DEFAULT 'equal' CHECK (split_type IN ('equal', 'proportional', 'individual', 'custom')),
    total_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    service_charge DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2) DEFAULT 0,
    expires_at DATETIME NOT NULL,
    locked_at DATETIME, -- 鎖定時間（開始分帳時）
    completed_at DATETIME, -- 完成時間
    settings TEXT DEFAULT '{}', -- JSON 設定（最大成員數、權限等）
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (master_order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
);

-- 2. 群組成員表 - 管理加入群組的成員
CREATE TABLE group_members (
    id TEXT PRIMARY KEY,
    group_order_id TEXT NOT NULL,
    user_id INTEGER,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'member')),
    permissions TEXT DEFAULT '{}', -- JSON 權限設定
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    left_at DATETIME,
    
    FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(group_order_id, session_id)
);

-- 3. 群組購物車項目 - 儲存群組內所有點餐項目
CREATE TABLE group_cart_items (
    id TEXT PRIMARY KEY,
    group_order_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    menu_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    customizations TEXT DEFAULT '{}', -- JSON 客製化選項
    special_instructions TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed', 'ordered')),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- 4. 分帳記錄表 - 管理每個成員的分帳資訊
CREATE TABLE split_bills (
    id TEXT PRIMARY KEY,
    group_order_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0, -- 小計
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- 稅額
    service_charge DECIMAL(10,2) NOT NULL DEFAULT 0, -- 服務費
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- 折扣
    tip_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- 小費
    total_amount DECIMAL(10,2) NOT NULL, -- 應付總額
    items TEXT DEFAULT '[]', -- JSON 包含的項目列表
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded')),
    payment_method TEXT,
    payment_reference TEXT, -- 支付系統參考號
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE
);

-- 5. 分享代碼表 - 管理分享代碼和連結
CREATE TABLE share_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('group_order', 'menu_share', 'table_share')),
    resource_id TEXT NOT NULL, -- 對應的資源ID
    created_by INTEGER NOT NULL,
    usage_limit INTEGER DEFAULT -1, -- -1 表示無限制
    usage_count INTEGER DEFAULT 0,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    metadata TEXT DEFAULT '{}', -- JSON 額外資料
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. 群組活動記錄表 - 記錄群組內的所有活動
CREATE TABLE group_activity_logs (
    id TEXT PRIMARY KEY,
    group_order_id TEXT NOT NULL,
    member_id TEXT,
    action TEXT NOT NULL, -- 'joined', 'left', 'added_item', 'removed_item', 'payment_made', etc.
    description TEXT,
    metadata TEXT DEFAULT '{}', -- JSON 活動詳細資料
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE SET NULL
);

-- 創建索引以提升性能
CREATE INDEX idx_group_orders_share_code ON group_orders(share_code);
CREATE INDEX idx_group_orders_restaurant_id ON group_orders(restaurant_id);
CREATE INDEX idx_group_orders_table_id ON group_orders(table_id);
CREATE INDEX idx_group_orders_status ON group_orders(status);
CREATE INDEX idx_group_orders_created_at ON group_orders(created_at);
CREATE INDEX idx_group_orders_expires_at ON group_orders(expires_at);

CREATE INDEX idx_group_members_group_order_id ON group_members(group_order_id);
CREATE INDEX idx_group_members_session_id ON group_members(session_id);
CREATE INDEX idx_group_members_is_active ON group_members(is_active);

CREATE INDEX idx_group_cart_items_group_order_id ON group_cart_items(group_order_id);
CREATE INDEX idx_group_cart_items_member_id ON group_cart_items(member_id);
CREATE INDEX idx_group_cart_items_menu_item_id ON group_cart_items(menu_item_id);
CREATE INDEX idx_group_cart_items_status ON group_cart_items(status);

CREATE INDEX idx_split_bills_group_order_id ON split_bills(group_order_id);
CREATE INDEX idx_split_bills_member_id ON split_bills(member_id);
CREATE INDEX idx_split_bills_payment_status ON split_bills(payment_status);

CREATE INDEX idx_share_codes_code ON share_codes(code);
CREATE INDEX idx_share_codes_type ON share_codes(type);
CREATE INDEX idx_share_codes_resource_id ON share_codes(resource_id);
CREATE INDEX idx_share_codes_expires_at ON share_codes(expires_at);

CREATE INDEX idx_group_activity_logs_group_order_id ON group_activity_logs(group_order_id);
CREATE INDEX idx_group_activity_logs_action ON group_activity_logs(action);
CREATE INDEX idx_group_activity_logs_created_at ON group_activity_logs(created_at);

-- 創建觸發器自動更新 updated_at 欄位
CREATE TRIGGER update_group_orders_updated_at 
AFTER UPDATE ON group_orders
BEGIN
    UPDATE group_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_group_cart_items_updated_at 
AFTER UPDATE ON group_cart_items
BEGIN
    UPDATE group_cart_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_split_bills_updated_at 
AFTER UPDATE ON split_bills
BEGIN
    UPDATE split_bills SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 創建自動清理過期群組訂單的視圖（用於定期清理任務）
CREATE VIEW expired_group_orders AS
SELECT id, share_code, restaurant_id, created_at, expires_at
FROM group_orders 
WHERE expires_at < CURRENT_TIMESTAMP 
  AND status IN ('active', 'ordering')
  AND created_at < datetime('now', '-1 day');

-- 添加約束和檢查
-- 確保群組總金額計算正確的觸發器
CREATE TRIGGER update_group_order_total 
AFTER INSERT ON group_cart_items
BEGIN
    UPDATE group_orders 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM group_cart_items 
        WHERE group_order_id = NEW.group_order_id 
          AND status = 'active'
    )
    WHERE id = NEW.group_order_id;
END;

CREATE TRIGGER update_group_order_total_on_update 
AFTER UPDATE ON group_cart_items
BEGIN
    UPDATE group_orders 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM group_cart_items 
        WHERE group_order_id = NEW.group_order_id 
          AND status = 'active'
    )
    WHERE id = NEW.group_order_id;
END;

CREATE TRIGGER update_group_order_total_on_delete 
AFTER DELETE ON group_cart_items
BEGIN
    UPDATE group_orders 
    SET total_amount = (
        SELECT COALESCE(SUM(total_price), 0) 
        FROM group_cart_items 
        WHERE group_order_id = OLD.group_order_id 
          AND status = 'active'
    )
    WHERE id = OLD.group_order_id;
END;