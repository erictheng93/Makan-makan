-- Group Orders Payment Integration
-- Created: 2025-09-07
-- Description: 為群組訂單添加支付狀態和交易追蹤欄位

-- 為 group_members 表添加支付相關欄位
ALTER TABLE group_members ADD COLUMN payment_status TEXT DEFAULT 'pending' 
    CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded'));

ALTER TABLE group_members ADD COLUMN payment_method TEXT;

ALTER TABLE group_members ADD COLUMN transaction_id TEXT;

ALTER TABLE group_members ADD COLUMN paid_at DATETIME;

ALTER TABLE group_members ADD COLUMN payment_amount DECIMAL(10,2);

-- 為 orders 表添加支付狀態（如果尚未存在）
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending' 
    CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded'));

ALTER TABLE orders ADD COLUMN paid_at DATETIME;

-- 創建索引優化支付查詢
CREATE INDEX idx_group_members_payment_status ON group_members(payment_status);
CREATE INDEX idx_group_members_transaction_id ON group_members(transaction_id);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- 創建視圖方便查詢群組支付狀態
CREATE VIEW group_payment_summary AS
SELECT 
    go.id as group_order_id,
    go.share_code,
    go.restaurant_id,
    go.status as group_status,
    COUNT(gm.id) as total_members,
    COUNT(CASE WHEN gm.payment_status = 'completed' THEN 1 END) as paid_members,
    COUNT(CASE WHEN gm.payment_status = 'pending' THEN 1 END) as pending_members,
    COUNT(CASE WHEN gm.payment_status = 'failed' THEN 1 END) as failed_members,
    SUM(CASE WHEN gm.payment_status = 'completed' THEN gm.payment_amount ELSE 0 END) as total_paid,
    go.total_amount,
    CASE 
        WHEN COUNT(CASE WHEN gm.payment_status = 'completed' THEN 1 END) = COUNT(gm.id) THEN 'all_paid'
        WHEN COUNT(CASE WHEN gm.payment_status = 'completed' THEN 1 END) > 0 THEN 'partially_paid'
        ELSE 'not_paid'
    END as payment_completion_status
FROM group_orders go
LEFT JOIN group_members gm ON go.id = gm.group_order_id
WHERE gm.is_active = TRUE
GROUP BY go.id, go.share_code, go.restaurant_id, go.status, go.total_amount;

-- 創建觸發器自動更新群組訂單狀態
CREATE TRIGGER update_group_order_status_on_payment
AFTER UPDATE OF payment_status ON group_members
WHEN NEW.payment_status = 'completed'
BEGIN
    -- 檢查是否所有成員都已付款
    UPDATE group_orders 
    SET status = CASE 
        WHEN (
            SELECT COUNT(*) FROM group_members 
            WHERE group_order_id = NEW.group_order_id 
              AND is_active = TRUE 
              AND payment_status != 'completed'
        ) = 0 THEN 'completed'
        ELSE status
    END,
    completed_at = CASE 
        WHEN (
            SELECT COUNT(*) FROM group_members 
            WHERE group_order_id = NEW.group_order_id 
              AND is_active = TRUE 
              AND payment_status != 'completed'
        ) = 0 THEN CURRENT_TIMESTAMP
        ELSE completed_at
    END
    WHERE id = NEW.group_order_id;
END;

-- 創建支付事件記錄觸發器
CREATE TRIGGER log_group_payment_events
AFTER UPDATE OF payment_status ON group_members
WHEN NEW.payment_status != OLD.payment_status
BEGIN
    INSERT INTO group_activity_logs (
        id,
        group_order_id,
        member_id,
        action,
        description,
        metadata
    ) VALUES (
        'payment_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.group_order_id,
        NEW.id,
        'payment_status_changed',
        'Payment status changed from ' || OLD.payment_status || ' to ' || NEW.payment_status,
        json_object(
            'old_status', OLD.payment_status,
            'new_status', NEW.payment_status,
            'payment_method', NEW.payment_method,
            'transaction_id', NEW.transaction_id,
            'amount', NEW.payment_amount
        )
    );
END;