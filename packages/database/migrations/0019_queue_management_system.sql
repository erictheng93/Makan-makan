-- Queue Management System Migration  
-- Created: 2025-09-07
-- Description: 添加候位系統功能所需的資料表

-- 1. 等候隊列主表
CREATE TABLE waiting_queue (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    queue_number INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    party_size INTEGER NOT NULL,
    special_requests TEXT,
    priority INTEGER DEFAULT 0, -- 優先級（0=普通, 1=會員, 2=VIP, 3=特殊需求）
    queue_type TEXT DEFAULT 'walkin' CHECK (queue_type IN ('walkin', 'online', 'phone', 'reservation')),
    estimated_wait_minutes INTEGER NOT NULL,
    actual_wait_minutes INTEGER,
    table_preferences TEXT DEFAULT '[]', -- JSON 桌台偏好
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'notified', 'seated', 'cancelled', 'no_show', 'expired')),
    notification_methods TEXT DEFAULT '[]', -- JSON 通知方式
    notification_sent BOOLEAN DEFAULT FALSE,
    last_notification_at DATETIME,
    notification_count INTEGER DEFAULT 0,
    check_in_code TEXT, -- 報到確認碼
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME,
    notified_at DATETIME,
    seated_at DATETIME,
    cancelled_at DATETIME,
    assigned_table_id INTEGER,
    served_by INTEGER, -- 處理的員工
    notes TEXT,
    metadata TEXT DEFAULT '{}', -- JSON 額外資料
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_table_id) REFERENCES tables(id) ON DELETE SET NULL,
    FOREIGN KEY (served_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(restaurant_id, queue_number, DATE(joined_at))
);

-- 2. 隊列通知記錄表
CREATE TABLE queue_notifications (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('sms', 'push', 'email', 'call', 'display')),
    recipient TEXT NOT NULL, -- 接收者（電話/Email/設備ID）
    message_template TEXT NOT NULL,
    message_content TEXT NOT NULL,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'expired')),
    delivery_provider TEXT, -- 發送服務商
    provider_response TEXT, -- JSON 服務商回應
    delivery_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    sent_at DATETIME,
    delivered_at DATETIME,
    failed_at DATETIME,
    error_message TEXT,
    cost DECIMAL(8,4) DEFAULT 0, -- 發送成本
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (queue_id) REFERENCES waiting_queue(id) ON DELETE CASCADE
);

-- 3. 候位系統設定表
CREATE TABLE queue_settings (
    restaurant_id INTEGER PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT TRUE,
    max_queue_size INTEGER DEFAULT 50,
    avg_service_time INTEGER DEFAULT 45, -- 平均用餐時間（分鐘）
    max_wait_time INTEGER DEFAULT 120, -- 最大等待時間（分鐘）
    min_advance_notice INTEGER DEFAULT 5, -- 提前通知時間（分鐘）
    notification_methods TEXT DEFAULT '["sms"]', -- JSON 可用通知方式
    auto_call_enabled BOOLEAN DEFAULT TRUE,
    auto_call_interval INTEGER DEFAULT 10, -- 自動呼叫間隔（分鐘）
    no_show_timeout INTEGER DEFAULT 15, -- 未報到超時（分鐘）
    queue_number_reset TEXT DEFAULT 'daily' CHECK (queue_number_reset IN ('daily', 'weekly', 'monthly', 'never')),
    priority_rules TEXT DEFAULT '{}', -- JSON 優先級規則
    table_assignment_rules TEXT DEFAULT '{}', -- JSON 桌台分配規則
    notification_templates TEXT DEFAULT '{}', -- JSON 通知模板
    business_hours TEXT DEFAULT '{}', -- JSON 營業時間
    holiday_settings TEXT DEFAULT '{}', -- JSON 假日設定
    display_settings TEXT DEFAULT '{}', -- JSON 顯示設定
    integration_settings TEXT DEFAULT '{}', -- JSON 整合設定
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 4. 候位統計表（每日統計）
CREATE TABLE queue_statistics (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    stat_date DATE NOT NULL,
    total_customers INTEGER DEFAULT 0,
    peak_queue_size INTEGER DEFAULT 0,
    avg_wait_time INTEGER DEFAULT 0, -- 分鐘
    max_wait_time INTEGER DEFAULT 0, -- 分鐘
    customers_seated INTEGER DEFAULT 0,
    customers_cancelled INTEGER DEFAULT 0,
    customers_no_show INTEGER DEFAULT 0,
    notification_sent_count INTEGER DEFAULT 0,
    notification_success_rate DECIMAL(5,2) DEFAULT 0, -- 百分比
    peak_hours TEXT DEFAULT '[]', -- JSON 高峰時段
    table_turnover_rate DECIMAL(5,2) DEFAULT 0,
    customer_satisfaction DECIMAL(3,2), -- 1-5 評分
    hourly_breakdown TEXT DEFAULT '{}', -- JSON 每小時統計
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, stat_date)
);

-- 5. 桌台狀態歷史表
CREATE TABLE table_status_history (
    id TEXT PRIMARY KEY,
    table_id INTEGER NOT NULL,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    queue_id TEXT, -- 關聯的等候記錄
    changed_by INTEGER,
    change_reason TEXT,
    estimated_available_at DATETIME,
    actual_available_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
    FOREIGN KEY (queue_id) REFERENCES waiting_queue(id) ON DELETE SET NULL,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 6. 候位顯示配置表
CREATE TABLE queue_displays (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    location TEXT,
    display_type TEXT NOT NULL CHECK (display_type IN ('main', 'secondary', 'mobile', 'kiosk')),
    layout_template TEXT DEFAULT 'standard',
    display_settings TEXT DEFAULT '{}', -- JSON 顯示設定
    content_filter TEXT DEFAULT '{}', -- JSON 內容過濾規則
    refresh_interval INTEGER DEFAULT 30, -- 刷新間隔（秒）
    is_active BOOLEAN DEFAULT TRUE,
    last_active_at DATETIME,
    device_info TEXT DEFAULT '{}', -- JSON 設備資訊
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 7. 候位事件日誌表
CREATE TABLE queue_events (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    queue_id TEXT,
    event_type TEXT NOT NULL, -- 'joined', 'called', 'seated', 'cancelled', 'no_show', 'notification_sent', etc.
    event_data TEXT DEFAULT '{}', -- JSON 事件詳細資料
    triggered_by INTEGER, -- 觸發者（員工ID）
    triggered_by_system BOOLEAN DEFAULT FALSE,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (queue_id) REFERENCES waiting_queue(id) ON DELETE SET NULL,
    FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 創建性能索引
CREATE INDEX idx_waiting_queue_restaurant_id ON waiting_queue(restaurant_id);
CREATE INDEX idx_waiting_queue_status ON waiting_queue(status);
CREATE INDEX idx_waiting_queue_joined_at ON waiting_queue(joined_at);
CREATE INDEX idx_waiting_queue_priority ON waiting_queue(priority DESC);
CREATE INDEX idx_waiting_queue_queue_number ON waiting_queue(restaurant_id, queue_number, DATE(joined_at));
CREATE INDEX idx_waiting_queue_customer_phone ON waiting_queue(customer_phone);

CREATE INDEX idx_queue_notifications_queue_id ON queue_notifications(queue_id);
CREATE INDEX idx_queue_notifications_type ON queue_notifications(notification_type);
CREATE INDEX idx_queue_notifications_status ON queue_notifications(delivery_status);
CREATE INDEX idx_queue_notifications_created_at ON queue_notifications(created_at);

CREATE INDEX idx_queue_statistics_restaurant_date ON queue_statistics(restaurant_id, stat_date);

CREATE INDEX idx_table_status_history_table_id ON table_status_history(table_id);
CREATE INDEX idx_table_status_history_created_at ON table_status_history(created_at);

CREATE INDEX idx_queue_displays_restaurant_id ON queue_displays(restaurant_id);
CREATE INDEX idx_queue_displays_is_active ON queue_displays(is_active);

CREATE INDEX idx_queue_events_restaurant_id ON queue_events(restaurant_id);
CREATE INDEX idx_queue_events_queue_id ON queue_events(queue_id);
CREATE INDEX idx_queue_events_type ON queue_events(event_type);
CREATE INDEX idx_queue_events_created_at ON queue_events(created_at);

-- 創建觸發器
CREATE TRIGGER update_queue_settings_updated_at 
AFTER UPDATE ON queue_settings
BEGIN
    UPDATE queue_settings SET updated_at = CURRENT_TIMESTAMP WHERE restaurant_id = NEW.restaurant_id;
END;

CREATE TRIGGER update_queue_displays_updated_at 
AFTER UPDATE ON queue_displays
BEGIN
    UPDATE queue_displays SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 自動記錄隊列事件的觸發器
CREATE TRIGGER log_queue_join_event 
AFTER INSERT ON waiting_queue
BEGIN
    INSERT INTO queue_events (
        id, restaurant_id, queue_id, event_type, event_data, triggered_by_system
    ) VALUES (
        'evt_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.restaurant_id,
        NEW.id,
        'joined',
        json_object(
            'queue_number', NEW.queue_number,
            'party_size', NEW.party_size,
            'estimated_wait', NEW.estimated_wait_minutes
        ),
        true
    );
END;

CREATE TRIGGER log_queue_status_change 
AFTER UPDATE OF status ON waiting_queue
WHEN OLD.status != NEW.status
BEGIN
    INSERT INTO queue_events (
        id, restaurant_id, queue_id, event_type, event_data, triggered_by_system
    ) VALUES (
        'evt_' || NEW.id || '_' || strftime('%s', 'now'),
        NEW.restaurant_id,
        NEW.id,
        'status_changed',
        json_object(
            'old_status', OLD.status,
            'new_status', NEW.status,
            'queue_number', NEW.queue_number
        ),
        true
    );
END;

-- 自動計算實際等待時間
CREATE TRIGGER calculate_actual_wait_time 
AFTER UPDATE OF status ON waiting_queue
WHEN NEW.status IN ('seated', 'cancelled', 'no_show') AND OLD.status != NEW.status
BEGIN
    UPDATE waiting_queue 
    SET actual_wait_minutes = CAST(
        (julianday(CURRENT_TIMESTAMP) - julianday(joined_at)) * 24 * 60 AS INTEGER
    )
    WHERE id = NEW.id;
END;

-- 創建有用的視圖
-- 當前等候隊列視圖
CREATE VIEW current_queue AS
SELECT 
    q.*,
    CASE 
        WHEN q.status = 'waiting' THEN 
            ROW_NUMBER() OVER (
                PARTITION BY q.restaurant_id 
                ORDER BY q.priority DESC, q.joined_at ASC
            )
        ELSE NULL 
    END as current_position,
    CAST((julianday(CURRENT_TIMESTAMP) - julianday(q.joined_at)) * 24 * 60 AS INTEGER) as actual_wait_so_far
FROM waiting_queue q
WHERE q.status IN ('waiting', 'called', 'notified')
  AND DATE(q.joined_at) = DATE('now');

-- 每日隊列統計視圖
CREATE VIEW daily_queue_stats AS
SELECT 
    restaurant_id,
    DATE(joined_at) as queue_date,
    COUNT(*) as total_customers,
    MAX(queue_number) as max_queue_number,
    AVG(CAST(actual_wait_minutes AS REAL)) as avg_actual_wait,
    MAX(actual_wait_minutes) as max_actual_wait,
    COUNT(CASE WHEN status = 'seated' THEN 1 END) as customers_seated,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as customers_cancelled,
    COUNT(CASE WHEN status = 'no_show' THEN 1 END) as customers_no_show,
    ROUND(
        COUNT(CASE WHEN status = 'seated' THEN 1 END) * 100.0 / COUNT(*), 2
    ) as service_success_rate
FROM waiting_queue
WHERE DATE(joined_at) = DATE('now')
GROUP BY restaurant_id, DATE(joined_at);

-- 桌台可用性視圖
CREATE VIEW table_availability AS
SELECT 
    t.*,
    CASE 
        WHEN t.status = 'available' THEN 'immediate'
        WHEN t.status = 'occupied' AND tsh.estimated_available_at IS NOT NULL THEN
            CASE 
                WHEN tsh.estimated_available_at <= CURRENT_TIMESTAMP THEN 'soon'
                ELSE 'later'
            END
        ELSE 'unknown'
    END as availability_status,
    tsh.estimated_available_at,
    wq.party_size as current_party_size
FROM tables t
LEFT JOIN (
    SELECT 
        table_id,
        estimated_available_at,
        ROW_NUMBER() OVER (PARTITION BY table_id ORDER BY created_at DESC) as rn
    FROM table_status_history
) tsh ON t.id = tsh.table_id AND tsh.rn = 1
LEFT JOIN waiting_queue wq ON t.current_order_id = (
    SELECT id FROM orders WHERE table_id = t.id AND status IN ('confirmed', 'preparing', 'ready') LIMIT 1
);

-- 自動清理過期通知記錄（30天後）
CREATE VIEW expired_notifications AS
SELECT id 
FROM queue_notifications 
WHERE created_at < datetime('now', '-30 days');

-- 自動清理舊隊列記錄（90天後）
CREATE VIEW old_queue_records AS
SELECT id 
FROM waiting_queue 
WHERE joined_at < datetime('now', '-90 days')
  AND status IN ('seated', 'cancelled', 'no_show');