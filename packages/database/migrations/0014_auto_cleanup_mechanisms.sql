-- Auto Cleanup Mechanisms Migration
-- Created: 2025-09-03
-- Description: Implements automatic cleanup triggers and procedures for data maintenance

-- =================================================================
-- 1. 會話清理機制
-- =================================================================

-- 創建清理過期會話的觸發器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions_on_insert
AFTER INSERT ON sessions
WHEN (SELECT COUNT(*) FROM sessions) > 5000
BEGIN
    DELETE FROM sessions WHERE expires_at < datetime('now');
END;

-- 定期清理觸發器（當會話更新時也清理）
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions_on_update
AFTER UPDATE ON sessions
WHEN (SELECT COUNT(*) FROM sessions WHERE expires_at < datetime('now')) > 100
BEGIN
    DELETE FROM sessions WHERE expires_at < datetime('now');
END;

-- =================================================================
-- 2. 黑名單 Token 清理機制
-- =================================================================

-- 清理過期的黑名單 token
CREATE TRIGGER IF NOT EXISTS cleanup_expired_blacklisted_tokens_on_insert
AFTER INSERT ON blacklisted_tokens
WHEN (SELECT COUNT(*) FROM blacklisted_tokens WHERE expires_at < datetime('now')) > 100
BEGIN
    DELETE FROM blacklisted_tokens 
    WHERE expires_at < datetime('now', '-1 days');
END;

-- 定期大量清理（防止表過大）
CREATE TRIGGER IF NOT EXISTS cleanup_blacklisted_tokens_bulk
AFTER INSERT ON blacklisted_tokens
WHEN (SELECT COUNT(*) FROM blacklisted_tokens) > 10000
BEGIN
    DELETE FROM blacklisted_tokens 
    WHERE expires_at < datetime('now')
       OR created_at < datetime('now', '-30 days');
END;

-- =================================================================
-- 3. 審計日誌清理機制
-- =================================================================

-- 創建審計日誌歸檔表
CREATE TABLE IF NOT EXISTS audit_logs_archive (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id INTEGER,
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    archived_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 自動歸檔舊審計日誌（超過90天的記錄）
CREATE TRIGGER IF NOT EXISTS archive_old_audit_logs
AFTER INSERT ON audit_logs
WHEN (SELECT COUNT(*) FROM audit_logs) > 100000
BEGIN
    -- 將90天前的記錄移到歸檔表
    INSERT INTO audit_logs_archive (
        id, user_id, action, resource, resource_id, 
        details, ip_address, user_agent, created_at
    )
    SELECT id, user_id, action, resource, resource_id, 
           details, ip_address, user_agent, created_at
    FROM audit_logs 
    WHERE created_at < datetime('now', '-90 days')
    LIMIT 5000; -- 批量處理，避免一次處理過多
    
    -- 刪除已歸檔的記錄
    DELETE FROM audit_logs 
    WHERE id IN (
        SELECT id FROM audit_logs 
        WHERE created_at < datetime('now', '-90 days')
        LIMIT 5000
    );
END;

-- 清理超過1年的歸檔記錄
CREATE TRIGGER IF NOT EXISTS cleanup_old_archived_logs
AFTER INSERT ON audit_logs_archive
WHEN (SELECT COUNT(*) FROM audit_logs_archive) > 200000
BEGIN
    DELETE FROM audit_logs_archive 
    WHERE archived_at < datetime('now', '-1 year')
    LIMIT 10000;
END;

-- =================================================================
-- 4. QR 碼下載記錄清理
-- =================================================================

-- 清理舊的 QR 下載記錄（保留6個月）
CREATE TRIGGER IF NOT EXISTS cleanup_old_qr_downloads
AFTER INSERT ON qr_downloads
WHEN (SELECT COUNT(*) FROM qr_downloads) > 100000
BEGIN
    DELETE FROM qr_downloads 
    WHERE downloaded_at < datetime('now', '-6 months')
    LIMIT 10000;
END;

-- 清理無效的 QR 下載記錄（關聯的 QR 碼已被刪除）
CREATE TRIGGER IF NOT EXISTS cleanup_orphaned_qr_downloads
AFTER INSERT ON qr_downloads
WHEN (SELECT COUNT(*) FROM qr_downloads) % 1000 = 0
BEGIN
    DELETE FROM qr_downloads 
    WHERE qr_code_id NOT IN (
        SELECT id FROM qr_codes WHERE is_deleted = 0
    )
    LIMIT 1000;
END;

-- =================================================================
-- 5. QR 碼掃描記錄清理
-- =================================================================

-- 清理舊的掃描記錄（保留3個月的詳細記錄）
CREATE TRIGGER IF NOT EXISTS cleanup_old_qr_scans
AFTER INSERT ON qr_scans
WHEN (SELECT COUNT(*) FROM qr_scans) > 500000
BEGIN
    -- 保留重要的掃描資料（成功的掃描），刪除失敗的舊記錄
    DELETE FROM qr_scans 
    WHERE scanned_at < datetime('now', '-3 months')
      AND scan_success = 0
    LIMIT 10000;
    
    -- 清理超過1年的所有掃描記錄
    DELETE FROM qr_scans 
    WHERE scanned_at < datetime('now', '-1 year')
    LIMIT 5000;
END;

-- =================================================================
-- 6. 庫存異動記錄清理
-- =================================================================

-- 創建庫存異動歷史歸檔表
CREATE TABLE IF NOT EXISTS stock_movements_archive (
    id INTEGER PRIMARY KEY,
    inventory_item_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_cost DECIMAL(10,2),
    reason TEXT,
    reference_id INTEGER,
    reference_type TEXT,
    recorded_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    archived_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 歸檔舊的庫存異動記錄（保留1年活躍記錄）
CREATE TRIGGER IF NOT EXISTS archive_old_stock_movements
AFTER INSERT ON stock_movements
WHEN (SELECT COUNT(*) FROM stock_movements) > 100000
BEGIN
    -- 歸檔1年前的記錄
    INSERT INTO stock_movements_archive (
        id, inventory_item_id, movement_type, quantity, unit_cost,
        reason, reference_id, reference_type, recorded_by, created_at
    )
    SELECT id, inventory_item_id, movement_type, quantity, unit_cost,
           reason, reference_id, reference_type, recorded_by, created_at
    FROM stock_movements 
    WHERE created_at < datetime('now', '-1 year')
    LIMIT 5000;
    
    DELETE FROM stock_movements 
    WHERE id IN (
        SELECT id FROM stock_movements 
        WHERE created_at < datetime('now', '-1 year')
        LIMIT 5000
    );
END;

-- =================================================================
-- 7. 訂單狀態歷史清理
-- =================================================================

-- 清理舊的訂單狀態變更記錄（保留6個月）
CREATE TRIGGER IF NOT EXISTS cleanup_old_order_status_history
AFTER INSERT ON order_status_history
WHEN (SELECT COUNT(*) FROM order_status_history) > 500000
BEGIN
    DELETE FROM order_status_history 
    WHERE created_at < datetime('now', '-6 months')
    LIMIT 10000;
END;

-- 清理孤立的狀態記錄（對應訂單已刪除）
CREATE TRIGGER IF NOT EXISTS cleanup_orphaned_order_status_history
AFTER INSERT ON order_status_history
WHEN (SELECT COUNT(*) FROM order_status_history) % 5000 = 0
BEGIN
    DELETE FROM order_status_history 
    WHERE order_id NOT IN (SELECT id FROM orders)
    LIMIT 1000;
END;

-- =================================================================
-- 8. 客戶評價清理機制
-- =================================================================

-- 清理被標記為隱藏/違規的舊評價（保留6個月用於申訴）
CREATE TRIGGER IF NOT EXISTS cleanup_hidden_customer_reviews
AFTER INSERT ON customer_reviews
WHEN (SELECT COUNT(*) FROM customer_reviews WHERE status IN ('hidden', 'flagged')) > 1000
BEGIN
    DELETE FROM customer_reviews 
    WHERE status IN ('hidden', 'flagged')
      AND created_at < datetime('now', '-6 months')
    LIMIT 500;
END;

-- =================================================================
-- 9. 錯誤報告清理機制
-- =================================================================

-- 清理已解決的舊錯誤報告（保留30天）
CREATE TRIGGER IF NOT EXISTS cleanup_resolved_error_reports
AFTER INSERT ON error_reports
WHEN (SELECT COUNT(*) FROM error_reports WHERE status = 'resolved') > 5000
BEGIN
    DELETE FROM error_reports 
    WHERE status = 'resolved'
      AND created_at < datetime('now', '-30 days')
    LIMIT 1000;
END;

-- 清理重複的錯誤報告（相同錯誤類型和訊息）
CREATE TRIGGER IF NOT EXISTS cleanup_duplicate_error_reports
AFTER INSERT ON error_reports
WHEN (SELECT COUNT(*) FROM error_reports) % 1000 = 0
BEGIN
    DELETE FROM error_reports 
    WHERE id NOT IN (
        SELECT MIN(id) 
        FROM error_reports 
        GROUP BY error_type, error_message
    )
    AND created_at < datetime('now', '-7 days')
    LIMIT 100;
END;

-- =================================================================
-- 10. 系統維護清理程序
-- =================================================================

-- 創建系統清理日誌表
CREATE TABLE IF NOT EXISTS system_cleanup_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cleanup_type TEXT NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    records_archived INTEGER DEFAULT 0,
    execution_time_ms INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'partial')),
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- 每日統計快取清理（保留1年）
CREATE TRIGGER IF NOT EXISTS cleanup_old_daily_statistics
AFTER INSERT ON daily_restaurant_statistics
WHEN (SELECT COUNT(*) FROM daily_restaurant_statistics WHERE stat_date < DATE('now', '-1 year')) > 1000
BEGIN
    INSERT INTO system_cleanup_logs (cleanup_type, started_at) 
    VALUES ('daily_statistics_cleanup', datetime('now'));
    
    DELETE FROM daily_restaurant_statistics 
    WHERE stat_date < DATE('now', '-1 year');
    
    DELETE FROM daily_menu_item_statistics 
    WHERE stat_date < DATE('now', '-1 year');
    
    DELETE FROM daily_inventory_statistics 
    WHERE stat_date < DATE('now', '-1 year');
    
    DELETE FROM daily_staff_performance_statistics 
    WHERE stat_date < DATE('now', '-1 year');
    
    UPDATE system_cleanup_logs 
    SET completed_at = datetime('now'), 
        status = 'completed',
        records_deleted = changes()
    WHERE id = (SELECT MAX(id) FROM system_cleanup_logs WHERE cleanup_type = 'daily_statistics_cleanup');
END;

-- QR 碼軟刪除清理（永久刪除標記為刪除超過30天的記錄）
CREATE TRIGGER IF NOT EXISTS cleanup_soft_deleted_qr_codes
AFTER UPDATE ON qr_codes
WHEN NEW.is_deleted = 1 AND OLD.is_deleted = 0
   AND (SELECT COUNT(*) FROM qr_codes WHERE is_deleted = 1 AND updated_at < datetime('now', '-30 days')) > 100
BEGIN
    -- 記錄清理開始
    INSERT INTO system_cleanup_logs (cleanup_type, started_at) 
    VALUES ('qr_codes_permanent_deletion', datetime('now'));
    
    -- 永久刪除相關記錄
    DELETE FROM qr_downloads 
    WHERE qr_code_id IN (
        SELECT id FROM qr_codes 
        WHERE is_deleted = 1 AND updated_at < datetime('now', '-30 days')
        LIMIT 100
    );
    
    DELETE FROM qr_scans 
    WHERE qr_code_id IN (
        SELECT id FROM qr_codes 
        WHERE is_deleted = 1 AND updated_at < datetime('now', '-30 days')
        LIMIT 100
    );
    
    DELETE FROM qr_codes 
    WHERE is_deleted = 1 AND updated_at < datetime('now', '-30 days')
    LIMIT 100;
    
    -- 記錄清理完成
    UPDATE system_cleanup_logs 
    SET completed_at = datetime('now'), 
        status = 'completed',
        records_deleted = changes()
    WHERE id = (SELECT MAX(id) FROM system_cleanup_logs WHERE cleanup_type = 'qr_codes_permanent_deletion');
END;

-- =================================================================
-- 11. 清理統計視圖
-- =================================================================

-- 系統清理統計視圖
CREATE VIEW IF NOT EXISTS cleanup_statistics AS
SELECT 
    'sessions' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN expires_at < datetime('now') THEN 1 END) as expired_records,
    'sessions' as cleanup_type
FROM sessions
UNION ALL
SELECT 
    'blacklisted_tokens',
    COUNT(*),
    COUNT(CASE WHEN expires_at < datetime('now') THEN 1 END),
    'tokens'
FROM blacklisted_tokens
UNION ALL
SELECT 
    'audit_logs',
    COUNT(*),
    COUNT(CASE WHEN created_at < datetime('now', '-90 days') THEN 1 END),
    'audit_logs'
FROM audit_logs
UNION ALL
SELECT 
    'qr_downloads',
    COUNT(*),
    COUNT(CASE WHEN downloaded_at < datetime('now', '-6 months') THEN 1 END),
    'qr_downloads'
FROM qr_downloads
UNION ALL
SELECT 
    'qr_scans',
    COUNT(*),
    COUNT(CASE WHEN scanned_at < datetime('now', '-3 months') THEN 1 END),
    'qr_scans'
FROM qr_scans
UNION ALL
SELECT 
    'daily_restaurant_statistics',
    COUNT(*),
    COUNT(CASE WHEN stat_date < DATE('now', '-1 year') THEN 1 END),
    'daily_stats'
FROM daily_restaurant_statistics;

-- 清理日誌摘要視圖
CREATE VIEW IF NOT EXISTS cleanup_log_summary AS
SELECT 
    cleanup_type,
    COUNT(*) as execution_count,
    SUM(records_deleted) as total_records_deleted,
    SUM(records_archived) as total_records_archived,
    AVG(execution_time_ms) as avg_execution_time_ms,
    MAX(started_at) as last_execution,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions
FROM system_cleanup_logs
WHERE started_at >= datetime('now', '-30 days')
GROUP BY cleanup_type
ORDER BY last_execution DESC;

-- =================================================================
-- 12. 手動清理程序觸發器
-- =================================================================

-- 緊急清理觸發器（當資料庫大小增長過快時）
CREATE TRIGGER IF NOT EXISTS emergency_cleanup
AFTER INSERT ON audit_logs
WHEN (SELECT COUNT(*) FROM audit_logs) > 1000000
BEGIN
    -- 立即清理所有過期和無用資料
    DELETE FROM sessions WHERE expires_at < datetime('now');
    DELETE FROM blacklisted_tokens WHERE expires_at < datetime('now', '-1 days');
    DELETE FROM qr_downloads WHERE downloaded_at < datetime('now', '-3 months') LIMIT 50000;
    DELETE FROM qr_scans WHERE scanned_at < datetime('now', '-2 months') AND scan_success = 0 LIMIT 50000;
    DELETE FROM order_status_history WHERE created_at < datetime('now', '-3 months') LIMIT 50000;
    
    -- 記錄緊急清理
    INSERT INTO system_cleanup_logs (cleanup_type, records_deleted, status) 
    VALUES ('emergency_cleanup', changes(), 'completed');
END;

-- =================================================================
-- 索引支持清理操作
-- =================================================================

-- 為清理操作創建必要的索引
CREATE INDEX IF NOT EXISTS idx_sessions_expires_cleanup 
ON sessions(expires_at) WHERE expires_at < datetime('now', '+1 day');

CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires_cleanup 
ON blacklisted_tokens(expires_at) WHERE expires_at < datetime('now', '+1 day');

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_cleanup 
ON audit_logs(created_at) WHERE created_at < datetime('now', '-30 days');

CREATE INDEX IF NOT EXISTS idx_qr_downloads_date_cleanup 
ON qr_downloads(downloaded_at) WHERE downloaded_at < datetime('now', '-3 months');

CREATE INDEX IF NOT EXISTS idx_qr_scans_date_success_cleanup 
ON qr_scans(scanned_at, scan_success) WHERE scanned_at < datetime('now', '-1 month');

CREATE INDEX IF NOT EXISTS idx_system_cleanup_logs_type_date 
ON system_cleanup_logs(cleanup_type, started_at);

-- =================================================================
-- 完成
-- =================================================================

-- 自動清理機制創建完成
-- 
-- 主要清理機制：
-- 1. 會話過期自動清理
-- 2. 黑名單 Token 清理
-- 3. 審計日誌歸檔和清理
-- 4. QR 碼下載/掃描記錄清理
-- 5. 庫存異動記錄歸檔
-- 6. 訂單狀態歷史清理
-- 7. 客戶評價清理
-- 8. 錯誤報告清理
-- 9. 每日統計快取清理
-- 10. 系統維護清理
-- 11. 緊急清理機制
-- 12. 清理統計和監控視圖
--
-- 這些機制將確保資料庫保持最佳性能和合理的大小