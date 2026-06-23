-- POS System Migration
-- Created: 2025-09-07
-- Description: 添加完整POS系統功能所需的資料表

-- 1. 收銀機管理表
CREATE TABLE cash_registers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    restaurant_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    current_shift_id TEXT,
    hardware_config TEXT DEFAULT '{}', -- JSON 硬件配置
    peripherals TEXT DEFAULT '{}', -- JSON 周邊設備配置
    settings TEXT DEFAULT '{}', -- JSON 收銀機設定
    last_maintenance_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 2. 班次管理表
CREATE TABLE cash_shifts (
    id TEXT PRIMARY KEY,
    register_id TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    start_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- 開班金額
    end_amount DECIMAL(10,2), -- 結班金額
    expected_amount DECIMAL(10,2) DEFAULT 0, -- 預期金額
    actual_amount DECIMAL(10,2), -- 實際盤點金額
    difference_amount DECIMAL(10,2) DEFAULT 0, -- 差額
    total_sales DECIMAL(10,2) DEFAULT 0, -- 總銷售額
    total_refunds DECIMAL(10,2) DEFAULT 0, -- 總退款額
    cash_sales DECIMAL(10,2) DEFAULT 0, -- 現金銷售
    card_sales DECIMAL(10,2) DEFAULT 0, -- 刷卡銷售
    digital_sales DECIMAL(10,2) DEFAULT 0, -- 電子支付銷售
    total_transactions INTEGER DEFAULT 0, -- 交易筆數
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'suspended')),
    notes TEXT,
    closing_notes TEXT,
    
    FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. 現金流動記錄表
CREATE TABLE cash_movements (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    register_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'cash_in', 'cash_out', 'count', 'opening', 'closing', 'adjustment', 'payout', 'deposit')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    reference_id INTEGER, -- 關聯ID（訂單ID、退款ID等）
    reference_type TEXT, -- 關聯類型（'order', 'refund', 'adjustment', etc.）
    payment_method TEXT, -- 支付方式
    denomination_breakdown TEXT DEFAULT '{}', -- JSON 面額分解
    recorded_by TEXT NOT NULL,
    approved_by TEXT, -- 需要審核的操作
    approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    receipt_number TEXT,
    metadata TEXT DEFAULT '{}', -- JSON 額外資料
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. 收據記錄表
CREATE TABLE receipts (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    register_id TEXT NOT NULL,
    shift_id TEXT,
    receipt_number TEXT NOT NULL,
    receipt_type TEXT DEFAULT 'customer' CHECK (receipt_type IN ('customer', 'kitchen', 'merchant', 'duplicate')),
    template_name TEXT DEFAULT 'standard',
    content TEXT NOT NULL, -- 收據內容/模板數據
    raw_content TEXT, -- 原始打印內容
    print_status TEXT DEFAULT 'pending' CHECK (print_status IN ('pending', 'printing', 'printed', 'failed', 'cancelled')),
    print_attempts INTEGER DEFAULT 0,
    printer_name TEXT,
    printer_response TEXT,
    printed_at DATETIME,
    reprinted_count INTEGER DEFAULT 0,
    last_reprint_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL
);

-- 5. 退款記錄表  
CREATE TABLE refunds (
    id TEXT PRIMARY KEY,
    original_order_id TEXT NOT NULL,
    register_id TEXT NOT NULL,
    shift_id TEXT,
    refund_number TEXT NOT NULL UNIQUE,
    refund_type TEXT NOT NULL CHECK (refund_type IN ('full', 'partial', 'item', 'service')),
    original_amount DECIMAL(10,2) NOT NULL,
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_method TEXT NOT NULL, -- 退款方式
    reason_code TEXT NOT NULL,
    reason_description TEXT,
    items_refunded TEXT DEFAULT '[]', -- JSON 退款項目
    processed_by TEXT NOT NULL,
    approved_by TEXT,
    customer_signature TEXT, -- 客戶簽名（Base64）
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    processed_at DATETIME,
    completed_at DATETIME,
    metadata TEXT DEFAULT '{}',
    
    FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL,
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. 促銷和折扣表
CREATE TABLE promotions (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    promotion_type TEXT NOT NULL CHECK (promotion_type IN ('discount_percent', 'discount_amount', 'buy_x_get_y', 'combo', 'time_based', 'member_only')),
    discount_value DECIMAL(10,2), -- 折扣值（百分比或金額）
    min_order_amount DECIMAL(10,2), -- 最低消費金額
    max_discount_amount DECIMAL(10,2), -- 最大折扣金額
    applicable_items TEXT DEFAULT '[]', -- JSON 適用商品ID列表
    conditions TEXT DEFAULT '{}', -- JSON 促銷條件
    usage_limit INTEGER DEFAULT -1, -- -1表示無限制
    usage_count INTEGER DEFAULT 0,
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NOT NULL,
    time_restrictions TEXT DEFAULT '{}', -- JSON 時間限制
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. 折扣券表
CREATE TABLE discount_coupons (
    id TEXT PRIMARY KEY,
    promotion_id TEXT NOT NULL,
    coupon_code TEXT UNIQUE NOT NULL,
    usage_limit INTEGER DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    assigned_to TEXT, -- 客戶電話或Email
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE
);

-- 8. 班次報表表
CREATE TABLE shift_reports (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL UNIQUE,
    register_id TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    report_data TEXT NOT NULL, -- JSON 完整報表數據
    summary_data TEXT NOT NULL, -- JSON 摘要數據
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    printed_at DATETIME,
    exported_at DATETIME,
    export_format TEXT, -- 'pdf', 'excel', 'json'
    
    FOREIGN KEY (shift_id) REFERENCES cash_shifts(id) ON DELETE CASCADE,
    FOREIGN KEY (register_id) REFERENCES cash_registers(id) ON DELETE CASCADE,
    FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 創建性能索引
CREATE INDEX idx_cash_registers_restaurant_id ON cash_registers(restaurant_id);
CREATE INDEX idx_cash_registers_is_active ON cash_registers(is_active);

CREATE INDEX idx_cash_shifts_register_id ON cash_shifts(register_id);
CREATE INDEX idx_cash_shifts_operator_id ON cash_shifts(operator_id);
CREATE INDEX idx_cash_shifts_status ON cash_shifts(status);
CREATE INDEX idx_cash_shifts_started_at ON cash_shifts(started_at);

CREATE INDEX idx_cash_movements_shift_id ON cash_movements(shift_id);
CREATE INDEX idx_cash_movements_register_id ON cash_movements(register_id);
CREATE INDEX idx_cash_movements_type ON cash_movements(type);
CREATE INDEX idx_cash_movements_reference ON cash_movements(reference_id, reference_type);
CREATE INDEX idx_cash_movements_created_at ON cash_movements(created_at);

CREATE INDEX idx_receipts_order_id ON receipts(order_id);
CREATE INDEX idx_receipts_register_id ON receipts(register_id);
CREATE INDEX idx_receipts_receipt_number ON receipts(receipt_number);
CREATE INDEX idx_receipts_print_status ON receipts(print_status);
CREATE INDEX idx_receipts_created_at ON receipts(created_at);

CREATE INDEX idx_refunds_original_order_id ON refunds(original_order_id);
CREATE INDEX idx_refunds_register_id ON refunds(register_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_processed_at ON refunds(processed_at);

CREATE INDEX idx_promotions_restaurant_id ON promotions(restaurant_id);
CREATE INDEX idx_promotions_is_active ON promotions(is_active);
CREATE INDEX idx_promotions_valid_from ON promotions(valid_from);
CREATE INDEX idx_promotions_valid_until ON promotions(valid_until);

CREATE INDEX idx_discount_coupons_coupon_code ON discount_coupons(coupon_code);
CREATE INDEX idx_discount_coupons_promotion_id ON discount_coupons(promotion_id);
CREATE INDEX idx_discount_coupons_status ON discount_coupons(status);

-- 創建觸發器
CREATE TRIGGER update_cash_registers_updated_at 
AFTER UPDATE ON cash_registers
BEGIN
    UPDATE cash_registers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_promotions_updated_at 
AFTER UPDATE ON promotions
BEGIN
    UPDATE promotions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 自動更新班次統計的觸發器
CREATE TRIGGER update_shift_stats_on_movement 
AFTER INSERT ON cash_movements
BEGIN
    UPDATE cash_shifts 
    SET 
        total_sales = CASE 
            WHEN NEW.type = 'sale' THEN total_sales + NEW.amount 
            ELSE total_sales 
        END,
        total_refunds = CASE 
            WHEN NEW.type = 'refund' THEN total_refunds + NEW.amount 
            ELSE total_refunds 
        END,
        cash_sales = CASE 
            WHEN NEW.type = 'sale' AND NEW.payment_method = 'cash' THEN cash_sales + NEW.amount 
            ELSE cash_sales 
        END,
        card_sales = CASE 
            WHEN NEW.type = 'sale' AND NEW.payment_method IN ('card', 'credit_card', 'debit_card') THEN card_sales + NEW.amount 
            ELSE card_sales 
        END,
        digital_sales = CASE 
            WHEN NEW.type = 'sale' AND NEW.payment_method IN ('digital_wallet', 'mobile_payment', 'online') THEN digital_sales + NEW.amount 
            ELSE digital_sales 
        END,
        total_transactions = CASE 
            WHEN NEW.type = 'sale' THEN total_transactions + 1 
            ELSE total_transactions 
        END
    WHERE id = NEW.shift_id;
END;

-- 自動更新收銀機當前班次
CREATE TRIGGER update_register_current_shift 
AFTER INSERT ON cash_shifts
WHEN NEW.status = 'active'
BEGIN
    UPDATE cash_registers 
    SET current_shift_id = NEW.id 
    WHERE id = NEW.register_id;
END;

CREATE TRIGGER clear_register_current_shift 
AFTER UPDATE ON cash_shifts
WHEN NEW.status = 'closed' AND OLD.status = 'active'
BEGIN
    UPDATE cash_registers 
    SET current_shift_id = NULL 
    WHERE id = NEW.register_id;
END;

-- 創建有用的視圖
-- 活躍班次視圖
CREATE VIEW active_shifts AS
SELECT 
    s.*,
    r.name as register_name,
    u.full_name as operator_name,
    (s.start_amount + s.total_sales - s.total_refunds) as expected_amount
FROM cash_shifts s
JOIN cash_registers r ON s.register_id = r.id
JOIN users u ON s.operator_id = u.id
WHERE s.status = 'active';

-- 日銷售統計視圖
CREATE VIEW daily_sales_summary AS
SELECT 
    DATE(s.started_at) as sale_date,
    s.register_id,
    r.name as register_name,
    COUNT(*) as shift_count,
    SUM(s.total_sales) as total_sales,
    SUM(s.total_refunds) as total_refunds,
    SUM(s.cash_sales) as cash_sales,
    SUM(s.card_sales) as card_sales,
    SUM(s.digital_sales) as digital_sales,
    SUM(s.total_transactions) as total_transactions
FROM cash_shifts s
JOIN cash_registers r ON s.register_id = r.id
WHERE s.status = 'closed'
GROUP BY DATE(s.started_at), s.register_id;