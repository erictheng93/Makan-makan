-- Restaurant Business Hours Optimization Migration
-- Created: 2025-09-03
-- Description: Normalizes business hours from JSON to dedicated table structure

-- =================================================================
-- 1. 餐廳營業時間獨立表
-- =================================================================

-- 創建餐廳營業時間表
CREATE TABLE IF NOT EXISTS restaurant_business_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday...6=Saturday
    open_time TIME,  -- 營業開始時間
    close_time TIME, -- 營業結束時間
    is_closed BOOLEAN DEFAULT FALSE, -- 當天是否休息
    is_24_hours BOOLEAN DEFAULT FALSE, -- 是否24小時營業
    break_start_time TIME, -- 休息開始時間（如午休）
    break_end_time TIME,   -- 休息結束時間
    notes TEXT, -- 特殊說明
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, day_of_week)
);

-- =================================================================
-- 2. 餐廳特殊營業日表（節假日、特殊活動等）
-- =================================================================

CREATE TABLE IF NOT EXISTS restaurant_special_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    special_date DATE NOT NULL,
    special_type TEXT NOT NULL CHECK (special_type IN ('holiday', 'event', 'maintenance', 'extended_hours', 'closed')),
    description TEXT NOT NULL, -- 說明原因
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT FALSE,
    is_24_hours BOOLEAN DEFAULT FALSE,
    break_start_time TIME,
    break_end_time TIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, special_date)
);

-- =================================================================
-- 3. 菜單項目供應時間表（替代 JSON 字段）
-- =================================================================

CREATE TABLE IF NOT EXISTS menu_item_availability_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    UNIQUE(menu_item_id, day_of_week, start_time)
);

-- =================================================================
-- 4. 餐廳設置選項表（替代部分 JSON settings）
-- =================================================================

CREATE TABLE IF NOT EXISTS restaurant_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type TEXT NOT NULL CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    category TEXT DEFAULT 'general', -- 設置分類：general, payment, notification, ordering, etc.
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- 是否可以在前端顯示
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, setting_key)
);

-- =================================================================
-- 5. 創建相關索引
-- =================================================================

-- 營業時間查詢索引
CREATE INDEX IF NOT EXISTS idx_business_hours_restaurant_day 
ON restaurant_business_hours(restaurant_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_business_hours_day_time 
ON restaurant_business_hours(day_of_week, open_time, close_time);

-- 特殊營業日索引
CREATE INDEX IF NOT EXISTS idx_special_hours_restaurant_date 
ON restaurant_special_hours(restaurant_id, special_date);

CREATE INDEX IF NOT EXISTS idx_special_hours_date_type 
ON restaurant_special_hours(special_date, special_type);

-- 菜單供應時間索引
CREATE INDEX IF NOT EXISTS idx_menu_availability_item_day 
ON menu_item_availability_schedule(menu_item_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_menu_availability_time 
ON menu_item_availability_schedule(day_of_week, start_time, end_time);

-- 餐廳設置索引
CREATE INDEX IF NOT EXISTS idx_restaurant_settings_key 
ON restaurant_settings(restaurant_id, setting_key);

CREATE INDEX IF NOT EXISTS idx_restaurant_settings_category 
ON restaurant_settings(restaurant_id, category);

-- =================================================================
-- 6. 創建視圖和函數
-- =================================================================

-- 當前營業狀態視圖
CREATE VIEW IF NOT EXISTS restaurant_current_status AS
SELECT 
    r.id,
    r.name,
    CASE 
        WHEN sh.is_closed = 1 THEN 'closed_special'
        WHEN sh.is_24_hours = 1 THEN 'open_24h'
        WHEN bh.is_closed = 1 THEN 'closed_regular'
        WHEN bh.is_24_hours = 1 THEN 'open_24h'
        WHEN TIME('now', 'localtime') BETWEEN bh.open_time AND bh.close_time THEN 'open'
        WHEN bh.break_start_time IS NOT NULL 
         AND TIME('now', 'localtime') BETWEEN bh.break_start_time AND bh.break_end_time THEN 'break'
        ELSE 'closed'
    END as current_status,
    COALESCE(sh.open_time, bh.open_time) as today_open_time,
    COALESCE(sh.close_time, bh.close_time) as today_close_time,
    COALESCE(sh.break_start_time, bh.break_start_time) as break_start,
    COALESCE(sh.break_end_time, bh.break_end_time) as break_end,
    COALESCE(sh.description, 'Regular hours') as status_description
FROM restaurants r
LEFT JOIN restaurant_business_hours bh 
    ON r.id = bh.restaurant_id 
    AND bh.day_of_week = CAST(strftime('%w', 'now', 'localtime') AS INTEGER)
LEFT JOIN restaurant_special_hours sh 
    ON r.id = sh.restaurant_id 
    AND sh.special_date = DATE('now', 'localtime')
WHERE r.status = 'active';

-- 本週營業時間視圖
CREATE VIEW IF NOT EXISTS restaurant_weekly_hours AS
SELECT 
    r.id as restaurant_id,
    r.name as restaurant_name,
    bh.day_of_week,
    CASE bh.day_of_week
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday' 
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END as day_name,
    bh.open_time,
    bh.close_time,
    bh.is_closed,
    bh.is_24_hours,
    bh.break_start_time,
    bh.break_end_time,
    bh.notes
FROM restaurants r
JOIN restaurant_business_hours bh ON r.id = bh.restaurant_id
WHERE r.status = 'active'
ORDER BY r.id, bh.day_of_week;

-- 菜單項目當前可用性視圖
CREATE VIEW IF NOT EXISTS menu_item_current_availability AS
SELECT 
    mi.id,
    mi.restaurant_id,
    mi.name,
    mi.is_available as base_availability,
    CASE 
        WHEN mas.is_available IS NULL THEN mi.is_available
        WHEN TIME('now', 'localtime') BETWEEN mas.start_time AND mas.end_time 
         THEN (mi.is_available AND mas.is_available)
        ELSE FALSE
    END as current_availability,
    mas.start_time as available_from,
    mas.end_time as available_until
FROM menu_items mi
LEFT JOIN menu_item_availability_schedule mas 
    ON mi.id = mas.menu_item_id 
    AND mas.day_of_week = CAST(strftime('%w', 'now', 'localtime') AS INTEGER)
WHERE mi.status = 'active';

-- =================================================================
-- 7. 觸發器
-- =================================================================

-- 自動更新 updated_at 時間戳
CREATE TRIGGER IF NOT EXISTS update_business_hours_timestamp
AFTER UPDATE ON restaurant_business_hours
FOR EACH ROW
BEGIN
    UPDATE restaurant_business_hours 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_special_hours_timestamp
AFTER UPDATE ON restaurant_special_hours
FOR EACH ROW
BEGIN
    UPDATE restaurant_special_hours 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_menu_availability_timestamp
AFTER UPDATE ON menu_item_availability_schedule
FOR EACH ROW
BEGIN
    UPDATE menu_item_availability_schedule 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_restaurant_settings_timestamp
AFTER UPDATE ON restaurant_settings
FOR EACH ROW
BEGIN
    UPDATE restaurant_settings 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- 數據完整性檢查觸發器
CREATE TRIGGER IF NOT EXISTS validate_business_hours
BEFORE INSERT ON restaurant_business_hours
FOR EACH ROW
WHEN NEW.open_time IS NOT NULL AND NEW.close_time IS NOT NULL
     AND NEW.is_24_hours = FALSE AND NEW.is_closed = FALSE
BEGIN
    SELECT CASE 
        WHEN NEW.open_time >= NEW.close_time 
        THEN RAISE(ABORT, 'Open time must be before close time')
        WHEN NEW.break_start_time IS NOT NULL AND NEW.break_end_time IS NOT NULL
         AND NEW.break_start_time >= NEW.break_end_time
        THEN RAISE(ABORT, 'Break start time must be before break end time')
        WHEN NEW.break_start_time IS NOT NULL 
         AND (NEW.break_start_time < NEW.open_time OR NEW.break_start_time > NEW.close_time)
        THEN RAISE(ABORT, 'Break time must be within business hours')
    END;
END;

-- =================================================================
-- 8. 預設數據插入
-- =================================================================

-- 插入標準營業時間範例（週一到週日 09:00-22:00）
-- 注意：這些是範例數據，實際使用時需要根據餐廳實際情況調整
-- 可以通過 API 或管理介面來設定實際的營業時間

-- 插入常用餐廳設置選項
INSERT OR IGNORE INTO restaurant_settings (restaurant_id, setting_key, setting_value, setting_type, category, description, is_public) 
SELECT 
    1 as restaurant_id,
    'service_charge_rate' as setting_key,
    '10.0' as setting_value,
    'number' as setting_type,
    'payment' as category,
    'Service charge percentage' as description,
    FALSE as is_public
WHERE EXISTS (SELECT 1 FROM restaurants WHERE id = 1)
UNION ALL
SELECT 1, 'tax_rate', '6.0', 'number', 'payment', 'Tax rate percentage', FALSE
WHERE EXISTS (SELECT 1 FROM restaurants WHERE id = 1)
UNION ALL  
SELECT 1, 'allow_online_ordering', 'true', 'boolean', 'ordering', 'Enable online ordering', TRUE
WHERE EXISTS (SELECT 1 FROM restaurants WHERE id = 1)
UNION ALL
SELECT 1, 'min_order_amount', '15.00', 'number', 'ordering', 'Minimum order amount', TRUE
WHERE EXISTS (SELECT 1 FROM restaurants WHERE id = 1)
UNION ALL
SELECT 1, 'estimated_prep_time', '20', 'number', 'ordering', 'Default preparation time in minutes', TRUE
WHERE EXISTS (SELECT 1 FROM restaurants WHERE id = 1);

-- =================================================================
-- 9. 數據遷移輔助視圖（用於從 JSON 遷移數據）
-- =================================================================

-- 遷移輔助：提取現有的 JSON 設置
CREATE VIEW IF NOT EXISTS restaurant_json_settings_extract AS
SELECT 
    r.id as restaurant_id,
    r.settings as json_settings,
    json_extract(r.settings, '$.service_charge_rate') as service_charge_rate,
    json_extract(r.settings, '$.tax_rate') as tax_rate,
    json_extract(r.settings, '$.business_hours') as business_hours_json
FROM restaurants r
WHERE r.settings IS NOT NULL 
  AND r.settings != '{}';

-- =================================================================
-- 完成
-- =================================================================

-- 資料結構優化完成
-- 
-- 主要改進：
-- 1. 將營業時間從 JSON 字段正規化為獨立表格
-- 2. 支援特殊營業日和節假日設定
-- 3. 菜單項目供應時間的精確控制
-- 4. 餐廳設置的結構化存儲
-- 5. 提供即時營業狀態查詢視圖
-- 6. 完整的數據完整性檢查