-- 創建錯誤報告表
-- 用於存儲客戶端錯誤報告和系統異常

CREATE TABLE error_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  restaurant_id INTEGER,
  error_type TEXT NOT NULL CHECK (error_type IN ('network', 'api', 'sse', 'validation', 'permission', 'unknown')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  error_code TEXT,
  error_message TEXT NOT NULL,
  error_context TEXT, -- JSON 格式的錯誤上下文
  original_error TEXT, -- JSON 格式的原始錯誤對象
  user_agent TEXT,
  url TEXT,
  timestamp DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  resolved_by INTEGER,
  resolution_notes TEXT,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 創建索引以優化查詢性能
CREATE INDEX idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX idx_error_reports_restaurant_id ON error_reports(restaurant_id);
CREATE INDEX idx_error_reports_error_type ON error_reports(error_type);
CREATE INDEX idx_error_reports_severity ON error_reports(severity);
CREATE INDEX idx_error_reports_timestamp ON error_reports(timestamp);
CREATE INDEX idx_error_reports_created_at ON error_reports(created_at);

-- 複合索引用於常見查詢
CREATE INDEX idx_error_reports_type_severity ON error_reports(error_type, severity);
CREATE INDEX idx_error_reports_restaurant_timestamp ON error_reports(restaurant_id, timestamp);
CREATE INDEX idx_error_reports_unresolved ON error_reports(resolved_at) WHERE resolved_at IS NULL;

-- 創建系統警報表 (用於存儲系統級別的警報)
CREATE TABLE system_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  alert_type TEXT NOT NULL,
  restaurant_id INTEGER, -- NULL 表示全系統警報
  affected_component TEXT, -- 受影響的系統組件
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  resolved_by INTEGER,
  resolution_notes TEXT,
  auto_resolved BOOLEAN DEFAULT FALSE,
  
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 系統警報索引
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_system_alerts_restaurant_id ON system_alerts(restaurant_id);
CREATE INDEX idx_system_alerts_created_at ON system_alerts(created_at);
CREATE INDEX idx_system_alerts_unresolved ON system_alerts(resolved_at) WHERE resolved_at IS NULL;

-- 創建錯誤統計視圖（用於快速查詢錯誤統計）
CREATE VIEW error_statistics AS
SELECT 
  error_type,
  severity,
  restaurant_id,
  DATE(created_at) as error_date,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM error_reports
GROUP BY error_type, severity, restaurant_id, DATE(created_at);

-- 創建每日錯誤摘要視圖
CREATE VIEW daily_error_summary AS
SELECT 
  DATE(created_at) as summary_date,
  restaurant_id,
  COUNT(*) as total_errors,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_errors,
  COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_errors,
  COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_errors,
  COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_errors,
  COUNT(DISTINCT user_id) as affected_users,
  COUNT(DISTINCT error_type) as unique_error_types
FROM error_reports
GROUP BY DATE(created_at), restaurant_id;

-- 插入一些示例系統警報（可選）
INSERT INTO system_alerts (title, description, severity, alert_type, restaurant_id) VALUES
('廚房設備異常', '爐具 #2 溫度過高，需要立即檢查', 'critical', 'equipment_failure', NULL),
('庫存不足警告', '主要食材庫存低於安全標準', 'medium', 'inventory_low', NULL),
('系統性能警告', 'API 響應時間超過正常範圍', 'high', 'performance_issue', NULL);

-- 創建觸發器：自動解決過期的低級別警報
CREATE TRIGGER auto_resolve_old_alerts 
AFTER INSERT ON system_alerts
BEGIN
  UPDATE system_alerts 
  SET resolved_at = CURRENT_TIMESTAMP,
      auto_resolved = TRUE,
      resolution_notes = 'Automatically resolved due to age'
  WHERE severity = 'low' 
    AND resolved_at IS NULL 
    AND created_at < datetime('now', '-7 days');
END;

-- 創建觸發器：清理舊的錯誤報告（保留30天）
CREATE TRIGGER cleanup_old_error_reports
AFTER INSERT ON error_reports
WHEN (SELECT COUNT(*) FROM error_reports) > 10000
BEGIN
  DELETE FROM error_reports 
  WHERE created_at < datetime('now', '-30 days')
    AND severity NOT IN ('critical', 'high');
END;