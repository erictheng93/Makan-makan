-- Printer System Migration
-- Created: 2025-09-07
-- Description: 打印機系統和作業管理所需的資料表

-- 1. 打印機設備表 - 管理註冊的打印機設備
CREATE TABLE printer_devices (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('thermal', 'impact', 'inkjet', 'laser')),
    brand TEXT NOT NULL, -- 'epson', 'star', 'citizen', 'bixolon', etc.
    model TEXT NOT NULL,
    connection_type TEXT NOT NULL CHECK (connection_type IN ('usb', 'ethernet', 'bluetooth', 'wifi', 'serial')),
    connection_string TEXT NOT NULL, -- IP地址、USB路徑、藍牙地址等
    capabilities TEXT DEFAULT '{}', -- JSON 設備能力 (supports_cutter, supports_drawer, etc.)
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'maintenance')),
    last_seen DATETIME,
    is_default BOOLEAN DEFAULT FALSE,
    settings TEXT DEFAULT '{}', -- JSON 設定（紙張寬度、編碼等）
    notes TEXT,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 2. 打印作業表 - 管理打印任務佇列
CREATE TABLE print_jobs (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('customer_receipt', 'kitchen_order', 'order_summary', 'daily_report', 'custom')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'printing', 'completed', 'failed', 'cancelled')),
    content TEXT NOT NULL, -- JSON 打印內容
    print_data BLOB, -- 實際的打印機命令（ESC/POS、CPCL等）
    options TEXT DEFAULT '{}', -- JSON 打印選項 (copies, cut_paper, open_drawer, etc.)
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    estimated_time INTEGER, -- 估計打印時間（秒）
    actual_time INTEGER, -- 實際打印時間（秒）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES printer_devices(id) ON DELETE CASCADE
);

-- 3. 打印模板表 - 管理收據和報表模板
CREATE TABLE print_templates (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('customer_receipt', 'kitchen_order', 'daily_report', 'invoice', 'custom')),
    language TEXT DEFAULT 'zh-TW',
    content_template TEXT NOT NULL, -- 模板內容（支持變數替換）
    style_settings TEXT DEFAULT '{}', -- JSON 樣式設定 (font_size, alignment, etc.)
    paper_width INTEGER DEFAULT 80, -- 紙張寬度（mm）
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(restaurant_id, name, type)
);

-- 4. 打印統計表 - 記錄打印機使用統計
CREATE TABLE print_statistics (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_jobs INTEGER DEFAULT 0,
    successful_jobs INTEGER DEFAULT 0,
    failed_jobs INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0, -- 總頁數（對熱敏紙來說是總張數）
    total_print_time INTEGER DEFAULT 0, -- 總打印時間（秒）
    paper_used_mm INTEGER DEFAULT 0, -- 使用的紙張長度（mm）
    average_job_time REAL DEFAULT 0, -- 平均作業時間
    peak_hour INTEGER, -- 最忙碌的小時
    error_rate REAL DEFAULT 0, -- 錯誤率
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES printer_devices(id) ON DELETE CASCADE,
    UNIQUE(device_id, date)
);

-- 5. 打印機配置表 - 儲存地區化和個性化設定
CREATE TABLE printer_configurations (
    id TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    country_code TEXT NOT NULL DEFAULT 'TW',
    currency TEXT NOT NULL DEFAULT 'TWD',
    timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
    date_format TEXT DEFAULT 'YYYY/MM/DD',
    time_format TEXT DEFAULT 'HH:mm:ss',
    number_format TEXT DEFAULT '{}', -- JSON 數字格式設定
    tax_settings TEXT DEFAULT '{}', -- JSON 稅務設定
    receipt_header TEXT, -- 收據頁首
    receipt_footer TEXT, -- 收據頁尾
    logo_url TEXT, -- 商標圖片 URL
    contact_info TEXT DEFAULT '{}', -- JSON 聯絡資訊
    legal_info TEXT DEFAULT '{}', -- JSON 法律資訊
    custom_fields TEXT DEFAULT '{}', -- JSON 自定義欄位
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, country_code)
);

-- 創建索引以提升性能
CREATE INDEX idx_printer_devices_restaurant_id ON printer_devices(restaurant_id);
CREATE INDEX idx_printer_devices_status ON printer_devices(status);
CREATE INDEX idx_printer_devices_type ON printer_devices(type);
CREATE INDEX idx_printer_devices_is_default ON printer_devices(is_default);

CREATE INDEX idx_print_jobs_device_id ON print_jobs(device_id);
CREATE INDEX idx_print_jobs_status ON print_jobs(status);
CREATE INDEX idx_print_jobs_type ON print_jobs(type);
CREATE INDEX idx_print_jobs_priority ON print_jobs(priority);
CREATE INDEX idx_print_jobs_created_at ON print_jobs(created_at);
CREATE INDEX idx_print_jobs_status_priority ON print_jobs(status, priority);

CREATE INDEX idx_print_templates_restaurant_id ON print_templates(restaurant_id);
CREATE INDEX idx_print_templates_type ON print_templates(type);
CREATE INDEX idx_print_templates_is_active ON print_templates(is_active);
CREATE INDEX idx_print_templates_is_default ON print_templates(is_default);

CREATE INDEX idx_print_statistics_device_id ON print_statistics(device_id);
CREATE INDEX idx_print_statistics_date ON print_statistics(date);

CREATE INDEX idx_printer_configurations_restaurant_id ON printer_configurations(restaurant_id);
CREATE INDEX idx_printer_configurations_country_code ON printer_configurations(country_code);

-- 創建觸發器自動更新 updated_at 欄位
CREATE TRIGGER update_printer_devices_updated_at 
AFTER UPDATE ON printer_devices
BEGIN
    UPDATE printer_devices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_print_jobs_updated_at 
AFTER UPDATE ON print_jobs
BEGIN
    UPDATE print_jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_print_templates_updated_at 
AFTER UPDATE ON print_templates
BEGIN
    UPDATE print_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_print_statistics_updated_at 
AFTER UPDATE ON print_statistics
BEGIN
    UPDATE print_statistics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_printer_configurations_updated_at 
AFTER UPDATE ON printer_configurations
BEGIN
    UPDATE printer_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 確保每個餐廳只有一台預設打印機的觸發器
CREATE TRIGGER ensure_single_default_printer
AFTER UPDATE OF is_default ON printer_devices
WHEN NEW.is_default = TRUE
BEGIN
    UPDATE printer_devices 
    SET is_default = FALSE 
    WHERE restaurant_id = NEW.restaurant_id 
      AND id != NEW.id 
      AND is_default = TRUE;
END;

-- 自動更新打印統計的觸發器
CREATE TRIGGER update_print_statistics_on_job_complete
AFTER UPDATE OF status ON print_jobs
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    INSERT OR IGNORE INTO print_statistics (
        id, device_id, date, total_jobs, successful_jobs, total_print_time
    ) VALUES (
        NEW.device_id || '_' || date('now'),
        NEW.device_id,
        date('now'),
        0, 0, 0
    );
    
    UPDATE print_statistics
    SET 
        total_jobs = total_jobs + 1,
        successful_jobs = successful_jobs + 1,
        total_print_time = total_print_time + COALESCE(NEW.actual_time, 0),
        average_job_time = CAST(total_print_time AS REAL) / total_jobs,
        updated_at = CURRENT_TIMESTAMP
    WHERE device_id = NEW.device_id AND date = date('now');
END;

CREATE TRIGGER update_print_statistics_on_job_failed
AFTER UPDATE OF status ON print_jobs
WHEN NEW.status = 'failed' AND OLD.status != 'failed'
BEGIN
    INSERT OR IGNORE INTO print_statistics (
        id, device_id, date, total_jobs, failed_jobs
    ) VALUES (
        NEW.device_id || '_' || date('now'),
        NEW.device_id,
        date('now'),
        0, 0
    );
    
    UPDATE print_statistics
    SET 
        total_jobs = total_jobs + 1,
        failed_jobs = failed_jobs + 1,
        error_rate = CAST(failed_jobs AS REAL) / total_jobs * 100,
        updated_at = CURRENT_TIMESTAMP
    WHERE device_id = NEW.device_id AND date = date('now');
END;

-- 創建視圖方便查詢
CREATE VIEW active_print_queue AS
SELECT 
    pj.*,
    pd.name as device_name,
    pd.type as device_type,
    pd.status as device_status
FROM print_jobs pj
JOIN printer_devices pd ON pj.device_id = pd.id
WHERE pj.status IN ('pending', 'printing')
ORDER BY 
    CASE pj.priority 
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
    END,
    pj.created_at;

CREATE VIEW printer_health_status AS
SELECT 
    pd.id,
    pd.restaurant_id,
    pd.name,
    pd.type,
    pd.status,
    pd.last_seen,
    ps.total_jobs,
    ps.successful_jobs,
    ps.failed_jobs,
    ps.error_rate,
    ps.average_job_time,
    CASE 
        WHEN pd.status = 'offline' THEN 'unhealthy'
        WHEN pd.status = 'error' THEN 'unhealthy'
        WHEN ps.error_rate > 10 THEN 'degraded'
        WHEN pd.status = 'online' THEN 'healthy'
        ELSE 'unknown'
    END as health_status
FROM printer_devices pd
LEFT JOIN print_statistics ps ON pd.id = ps.device_id AND ps.date = date('now');

-- 插入預設配置資料
INSERT INTO printer_configurations (
    id, restaurant_id, country_code, currency, timezone, 
    date_format, time_format, receipt_header, receipt_footer
) VALUES (
    'default_tw_config', 1, 'TW', 'TWD', 'Asia/Taipei',
    'YYYY/MM/DD', 'HH:mm:ss',
    '歡迎光臨\n{restaurant_name}\n{restaurant_address}\n統編: {tax_id}\n================================',
    '================================\n謝謝惠顧，歡迎再度光臨！\n客服電話: {restaurant_phone}\n'
);

-- 插入預設收據模板
INSERT INTO print_templates (
    id, restaurant_id, name, type, content_template, created_by
) VALUES (
    'default_customer_receipt', 1, '顧客收據', 'customer_receipt',
    '{header}\n\n日期: {order_date}\n時間: {order_time}\n單號: {order_id}\n桌號: {table_id}\n\n================================\n{items_list}\n================================\n\n小計: {subtotal}\n稅額: {tax_amount}\n總計: {total_amount}\n\n付款方式: {payment_method}\n{footer}',
    1
);

INSERT INTO print_templates (
    id, restaurant_id, name, type, content_template, created_by
) VALUES (
    'default_kitchen_order', 1, '廚房訂單', 'kitchen_order',
    '** 廚房訂單 **\n\n時間: {order_time}\n單號: {order_id}\n桌號: {table_id}\n客人: {customer_name}\n\n{items_list_kitchen}\n\n備註: {special_instructions}\n\n預估時間: {estimated_prep_time} 分鐘',
    1
);