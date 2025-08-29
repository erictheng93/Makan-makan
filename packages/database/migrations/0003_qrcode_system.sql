-- QR Code System Database Schema
-- Migration: 0003_qrcode_system.sql

-- QR碼記錄表
CREATE TABLE IF NOT EXISTS qr_codes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,                          -- QR碼內容
    style_json TEXT NOT NULL DEFAULT '{}',          -- 樣式配置 JSON
    format TEXT NOT NULL DEFAULT 'png',             -- 格式: png, svg, pdf, jpeg
    url TEXT NOT NULL,                              -- 生成的QR碼URL
    metadata_json TEXT DEFAULT '{}',                -- 元數據 JSON
    
    -- 關聯資訊
    table_id INTEGER REFERENCES tables(id),         -- 關聯桌台ID（可選）
    restaurant_id INTEGER REFERENCES restaurants(id), -- 關聯餐廳ID（可選）
    created_by INTEGER REFERENCES users(id),        -- 創建者
    
    -- 統計資訊
    download_count INTEGER DEFAULT 0,               -- 下載次數
    scan_count INTEGER DEFAULT 0,                   -- 掃描次數
    
    -- 時間戳
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,                                 -- 過期時間（可選）
    
    -- 狀態
    is_active BOOLEAN DEFAULT 1,                    -- 是否啟用
    is_deleted BOOLEAN DEFAULT 0                    -- 軟刪除標記
);

-- QR碼模板表
CREATE TABLE IF NOT EXISTS qr_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                             -- 模板名稱
    description TEXT,                               -- 模板描述
    category TEXT NOT NULL DEFAULT 'classic',       -- 類別: modern, classic, colorful, minimalist, branded
    style_json TEXT NOT NULL,                       -- 樣式配置 JSON
    preview_url TEXT,                               -- 預覽圖URL
    
    -- 權限設定
    is_public BOOLEAN DEFAULT 1,                    -- 是否公開
    created_by INTEGER REFERENCES users(id),        -- 創建者
    restaurant_id INTEGER REFERENCES restaurants(id), -- 所屬餐廳（私有模板）
    
    -- 使用統計
    usage_count INTEGER DEFAULT 0,                  -- 使用次數
    
    -- 時間戳
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- 狀態
    is_active BOOLEAN DEFAULT 1,                    -- 是否啟用
    is_featured BOOLEAN DEFAULT 0                   -- 是否為精選模板
);

-- QR碼批次生成表
CREATE TABLE IF NOT EXISTS qr_batches (
    batch_id TEXT PRIMARY KEY,
    qr_code_ids TEXT NOT NULL,                      -- QR碼ID列表 JSON
    options_json TEXT NOT NULL,                     -- 批次生成選項 JSON
    generated_count INTEGER NOT NULL DEFAULT 0,     -- 生成數量
    
    -- 關聯資訊
    restaurant_id INTEGER REFERENCES restaurants(id),
    created_by INTEGER REFERENCES users(id),
    
    -- 下載資訊
    download_url TEXT,                              -- 批次下載URL
    download_count INTEGER DEFAULT 0,               -- 下載次數
    
    -- 狀態
    status TEXT DEFAULT 'completed',                 -- 狀態: pending, processing, completed, failed
    error_message TEXT,                             -- 錯誤訊息（如有）
    
    -- 時間戳
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,                              -- 完成時間
    expires_at TEXT                                 -- 過期時間
);

-- QR碼下載記錄表
CREATE TABLE IF NOT EXISTS qr_downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_code_id TEXT NOT NULL REFERENCES qr_codes(id),
    batch_id TEXT REFERENCES qr_batches(batch_id),  -- 批次下載ID（可選）
    
    -- 下載資訊
    format TEXT NOT NULL,                           -- 下載格式
    file_size INTEGER,                              -- 檔案大小（bytes）
    
    -- 用戶資訊
    user_id INTEGER REFERENCES users(id),           -- 下載用戶（可選）
    ip_address TEXT,                                -- IP地址
    user_agent TEXT,                                -- 用戶代理
    referrer TEXT,                                  -- 來源頁面
    
    -- 地理位置（可選）
    country_code TEXT,                              -- 國家代碼
    city TEXT,                                      -- 城市
    
    -- 時間戳
    downloaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- QR碼掃描記錄表
CREATE TABLE IF NOT EXISTS qr_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_code_id TEXT NOT NULL REFERENCES qr_codes(id),
    
    -- 掃描資訊
    scanned_content TEXT,                           -- 掃描到的內容
    scan_method TEXT DEFAULT 'camera',              -- 掃描方式: camera, file, manual
    
    -- 設備資訊
    device_type TEXT,                               -- 設備類型: mobile, tablet, desktop
    browser TEXT,                                   -- 瀏覽器
    os TEXT,                                        -- 操作系統
    
    -- 用戶資訊
    user_id INTEGER REFERENCES users(id),           -- 掃描用戶（可選）
    customer_id TEXT,                               -- 顧客ID（可選）
    ip_address TEXT,                                -- IP地址
    user_agent TEXT,                                -- 用戶代理
    
    -- 地理位置
    country_code TEXT,                              -- 國家代碼
    city TEXT,                                      -- 城市
    latitude REAL,                                  -- 緯度
    longitude REAL,                                 -- 經度
    
    -- 掃描結果
    scan_success BOOLEAN DEFAULT 1,                 -- 掃描是否成功
    error_message TEXT,                             -- 錯誤訊息（如有）
    
    -- 後續動作
    action_taken TEXT,                              -- 採取的動作: redirect, order, view_menu, etc.
    order_id INTEGER REFERENCES orders(id),         -- 產生的訂單ID（如有）
    
    -- 時間戳
    scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- QR碼樣式配置表（用於快速查詢常用樣式）
CREATE TABLE IF NOT EXISTS qr_style_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                             -- 預設名稱
    description TEXT,                               -- 描述
    style_json TEXT NOT NULL,                       -- 樣式配置 JSON
    
    -- 分類標籤
    tags TEXT,                                      -- 標籤 JSON 數組
    color_scheme TEXT,                              -- 色彩方案: light, dark, colorful, monochrome
    
    -- 使用統計
    usage_count INTEGER DEFAULT 0,                  -- 使用次數
    popularity_score REAL DEFAULT 0.0,              -- 受歡迎程度評分
    
    -- 權限設定
    is_public BOOLEAN DEFAULT 1,                    -- 是否公開
    created_by INTEGER REFERENCES users(id),
    
    -- 時間戳
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- 狀態
    is_active BOOLEAN DEFAULT 1
);

-- 創建索引以提高查詢性能

-- qr_codes 表索引
CREATE INDEX IF NOT EXISTS idx_qr_codes_table_id ON qr_codes(table_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_restaurant_id ON qr_codes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_created_by ON qr_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_qr_codes_created_at ON qr_codes(created_at);
CREATE INDEX IF NOT EXISTS idx_qr_codes_format ON qr_codes(format);
CREATE INDEX IF NOT EXISTS idx_qr_codes_active ON qr_codes(is_active, is_deleted);
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires ON qr_codes(expires_at);

-- qr_templates 表索引
CREATE INDEX IF NOT EXISTS idx_qr_templates_category ON qr_templates(category);
CREATE INDEX IF NOT EXISTS idx_qr_templates_public ON qr_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_qr_templates_restaurant_id ON qr_templates(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_templates_created_by ON qr_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_qr_templates_usage ON qr_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_qr_templates_featured ON qr_templates(is_featured, is_active);

-- qr_batches 表索引
CREATE INDEX IF NOT EXISTS idx_qr_batches_restaurant_id ON qr_batches(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_qr_batches_created_by ON qr_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_qr_batches_status ON qr_batches(status);
CREATE INDEX IF NOT EXISTS idx_qr_batches_created_at ON qr_batches(created_at);

-- qr_downloads 表索引
CREATE INDEX IF NOT EXISTS idx_qr_downloads_qr_code_id ON qr_downloads(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_downloads_batch_id ON qr_downloads(batch_id);
CREATE INDEX IF NOT EXISTS idx_qr_downloads_user_id ON qr_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_downloads_downloaded_at ON qr_downloads(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_qr_downloads_ip_address ON qr_downloads(ip_address);

-- qr_scans 表索引
CREATE INDEX IF NOT EXISTS idx_qr_scans_qr_code_id ON qr_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_user_id ON qr_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_customer_id ON qr_scans(customer_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scans_success ON qr_scans(scan_success);
CREATE INDEX IF NOT EXISTS idx_qr_scans_action_taken ON qr_scans(action_taken);
CREATE INDEX IF NOT EXISTS idx_qr_scans_order_id ON qr_scans(order_id);

-- qr_style_presets 表索引
CREATE INDEX IF NOT EXISTS idx_qr_style_presets_color_scheme ON qr_style_presets(color_scheme);
CREATE INDEX IF NOT EXISTS idx_qr_style_presets_public ON qr_style_presets(is_public);
CREATE INDEX IF NOT EXISTS idx_qr_style_presets_popularity ON qr_style_presets(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_qr_style_presets_usage ON qr_style_presets(usage_count DESC);

-- 創建觸發器自動更新統計數據

-- 更新 qr_codes 下載計數
CREATE TRIGGER IF NOT EXISTS update_qr_download_count
    AFTER INSERT ON qr_downloads
    FOR EACH ROW
BEGIN
    UPDATE qr_codes 
    SET download_count = download_count + 1, 
        updated_at = datetime('now')
    WHERE id = NEW.qr_code_id;
END;

-- 更新 qr_codes 掃描計數
CREATE TRIGGER IF NOT EXISTS update_qr_scan_count
    AFTER INSERT ON qr_scans
    FOR EACH ROW
    WHEN NEW.scan_success = 1
BEGIN
    UPDATE qr_codes 
    SET scan_count = scan_count + 1, 
        updated_at = datetime('now')
    WHERE id = NEW.qr_code_id;
END;

-- 更新 qr_templates 使用計數
CREATE TRIGGER IF NOT EXISTS update_template_usage_count
    AFTER INSERT ON qr_codes
    FOR EACH ROW
    WHEN json_extract(NEW.style_json, '$.templateId') IS NOT NULL
BEGIN
    UPDATE qr_templates 
    SET usage_count = usage_count + 1,
        updated_at = datetime('now')
    WHERE id = json_extract(NEW.style_json, '$.templateId');
END;

-- 更新 qr_style_presets 使用計數
CREATE TRIGGER IF NOT EXISTS update_preset_usage_count
    AFTER INSERT ON qr_codes
    FOR EACH ROW
    WHEN json_extract(NEW.style_json, '$.presetId') IS NOT NULL
BEGIN
    UPDATE qr_style_presets 
    SET usage_count = usage_count + 1,
        updated_at = datetime('now')
    WHERE id = json_extract(NEW.style_json, '$.presetId');
END;

-- 更新 qr_batches 下載計數
CREATE TRIGGER IF NOT EXISTS update_batch_download_count
    AFTER INSERT ON qr_downloads
    FOR EACH ROW
    WHEN NEW.batch_id IS NOT NULL
BEGIN
    UPDATE qr_batches 
    SET download_count = download_count + 1
    WHERE batch_id = NEW.batch_id;
END;

-- 自動更新 updated_at 時間戳
CREATE TRIGGER IF NOT EXISTS update_qr_codes_timestamp
    AFTER UPDATE ON qr_codes
    FOR EACH ROW
BEGIN
    UPDATE qr_codes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_qr_templates_timestamp
    AFTER UPDATE ON qr_templates
    FOR EACH ROW
BEGIN
    UPDATE qr_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_qr_style_presets_timestamp
    AFTER UPDATE ON qr_style_presets
    FOR EACH ROW
BEGIN
    UPDATE qr_style_presets SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 插入一些預設的樣式預設和模板數據

-- 預設樣式預設
INSERT OR IGNORE INTO qr_style_presets (name, description, style_json, tags, color_scheme) VALUES
('經典黑白', '簡潔的黑白設計，適合所有場景', '{"backgroundColor":"#FFFFFF","foregroundColor":"#000000","size":300,"errorCorrection":"M","cornerStyle":"square","dotStyle":"square"}', '["classic","minimal","business"]', 'monochrome'),
('現代藍調', '現代感的藍色主題', '{"backgroundColor":"#F8FAFC","foregroundColor":"#1E40AF","size":300,"errorCorrection":"M","cornerStyle":"rounded","dotStyle":"rounded","gradientType":"linear","gradientColors":{"start":"#3B82F6","end":"#1E40AF","direction":45}}', '["modern","blue","gradient"]', 'colorful'),
('餐廳專用', '溫暖的餐廳風格', '{"backgroundColor":"#FEF7ED","foregroundColor":"#EA580C","size":300,"errorCorrection":"H","cornerStyle":"rounded","dotStyle":"circle"}', '["restaurant","warm","orange"]', 'colorful'),
('極簡風格', '極簡主義設計', '{"backgroundColor":"#FAFAFA","foregroundColor":"#374151","size":250,"errorCorrection":"L","cornerStyle":"rounded","dotStyle":"square"}', '["minimal","clean","simple"]', 'light'),
('彩色漸層', '吸引眼球的彩色設計', '{"backgroundColor":"#FFFFFF","foregroundColor":"#8B5CF6","size":300,"errorCorrection":"M","cornerStyle":"circle","dotStyle":"rounded","gradientType":"radial","gradientColors":{"start":"#8B5CF6","end":"#EC4899"}}', '["colorful","gradient","vibrant"]', 'colorful');

-- 更新統計信息的VIEW
CREATE VIEW IF NOT EXISTS qr_statistics AS
SELECT 
    'total_qr_codes' as metric,
    COUNT(*) as value
FROM qr_codes 
WHERE is_active = 1 AND is_deleted = 0
UNION ALL
SELECT 
    'active_templates' as metric,
    COUNT(*) as value
FROM qr_templates 
WHERE is_active = 1
UNION ALL
SELECT 
    'total_downloads' as metric,
    COUNT(*) as value
FROM qr_downloads
UNION ALL
SELECT 
    'total_scans' as metric,
    COUNT(*) as value
FROM qr_scans 
WHERE scan_success = 1
UNION ALL
SELECT 
    'monthly_generations' as metric,
    COUNT(*) as value
FROM qr_codes 
WHERE created_at >= datetime('now', 'start of month')
    AND is_active = 1 AND is_deleted = 0;

-- 熱門模板視圖
CREATE VIEW IF NOT EXISTS popular_qr_templates AS
SELECT 
    t.*,
    COALESCE(t.usage_count, 0) + COALESCE(download_stats.downloads, 0) as popularity_score
FROM qr_templates t
LEFT JOIN (
    SELECT 
        json_extract(q.style_json, '$.templateId') as template_id,
        COUNT(d.id) as downloads
    FROM qr_codes q
    LEFT JOIN qr_downloads d ON q.id = d.qr_code_id
    WHERE template_id IS NOT NULL
    GROUP BY template_id
) download_stats ON t.id = download_stats.template_id
WHERE t.is_active = 1
ORDER BY popularity_score DESC;

-- QR碼使用分析視圖
CREATE VIEW IF NOT EXISTS qr_usage_analytics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as generated,
    COUNT(CASE WHEN format = 'png' THEN 1 END) as png_count,
    COUNT(CASE WHEN format = 'svg' THEN 1 END) as svg_count,
    COUNT(CASE WHEN format = 'pdf' THEN 1 END) as pdf_count,
    COUNT(CASE WHEN json_extract(style_json, '$.logo') IS NOT NULL THEN 1 END) as with_logo,
    COUNT(CASE WHEN json_extract(style_json, '$.gradientType') != 'none' THEN 1 END) as with_gradient,
    AVG(download_count) as avg_downloads,
    AVG(scan_count) as avg_scans
FROM qr_codes 
WHERE is_active = 1 AND is_deleted = 0
    AND created_at >= datetime('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date DESC;