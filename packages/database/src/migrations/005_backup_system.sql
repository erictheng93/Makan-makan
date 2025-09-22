-- Multi-tenant Backup System Database Schema
-- Enhanced version based on RestaurentPOS backup system
-- Adds multi-tenant isolation and enterprise features

-- ============================================================================
-- BACKUP CONFIGURATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_configurations (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    backup_type TEXT NOT NULL DEFAULT 'full' CHECK (backup_type IN ('full', 'incremental', 'differential')),
    schedule_enabled BOOLEAN DEFAULT false,
    schedule_cron TEXT, -- "0 2 * * *" for daily at 2 AM
    timezone TEXT DEFAULT 'UTC',
    retention_days INTEGER DEFAULT 30,
    include_tables TEXT, -- JSON array of table names
    exclude_tables TEXT, -- JSON array of table names
    compression_enabled BOOLEAN DEFAULT true,
    encryption_enabled BOOLEAN DEFAULT true,
    storage_provider TEXT DEFAULT 'r2' CHECK (storage_provider IN ('r2', 'kv', 'external')),
    max_parallel_backups INTEGER DEFAULT 3,
    notifications_enabled BOOLEAN DEFAULT true,
    notification_channels TEXT, -- JSON array: ["email", "slack"]
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================================================
-- BACKUP RECORDS TABLE (Enhanced from RestaurentPOS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    configuration_id TEXT,
    name TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'full' CHECK (backup_type IN ('full', 'incremental', 'differential')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),

    -- File Information
    file_size INTEGER DEFAULT 0,
    compressed_size INTEGER DEFAULT 0,
    records_count INTEGER DEFAULT 0,
    tables_included TEXT, -- JSON array of table names that were backed up

    -- Storage Information
    storage_provider TEXT DEFAULT 'r2',
    storage_path TEXT, -- R2 object key or KV key
    encryption_enabled BOOLEAN DEFAULT true,
    checksum TEXT, -- SHA-256 hash for integrity verification

    -- Timing
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    expires_at DATETIME, -- Auto-deletion date based on retention policy

    -- Error Handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- User Tracking
    created_by TEXT NOT NULL,

    -- Metadata (JSON)
    metadata TEXT, -- Complex backup metadata as JSON

    -- Constraints
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (configuration_id) REFERENCES backup_configurations(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================================================
-- RESTORE OPERATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS restore_operations (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    backup_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    restore_type TEXT NOT NULL CHECK (restore_type IN ('full', 'selective')),
    target_tables TEXT, -- JSON array of tables to restore (for selective restore)
    overwrite_existing BOOLEAN DEFAULT false,

    -- Timing
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,

    -- Results
    tables_restored INTEGER DEFAULT 0,
    records_restored INTEGER DEFAULT 0,
    error_message TEXT,

    -- Safety and Audit
    performed_by TEXT NOT NULL,
    safety_checks TEXT, -- JSON with safety verification flags
    ip_address TEXT,
    user_agent TEXT,

    -- Constraints
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (backup_id) REFERENCES backup_records(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- ============================================================================
-- BACKUP SCHEDULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_schedules (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    configuration_id TEXT NOT NULL,
    cron_expression TEXT NOT NULL, -- "0 2 * * *"
    timezone TEXT DEFAULT 'UTC',
    enabled BOOLEAN DEFAULT true,

    -- Schedule Tracking
    last_run_at DATETIME,
    next_run_at DATETIME NOT NULL,
    consecutive_failures INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 30,

    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (configuration_id) REFERENCES backup_configurations(id) ON DELETE CASCADE
);

-- ============================================================================
-- BACKUP ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_alerts (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('backup_failed', 'storage_quota_exceeded', 'schedule_missed', 'restoration_completed', 'performance_degraded')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_backup_id TEXT,

    -- Status
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    resolved BOOLEAN DEFAULT false,
    resolved_at DATETIME,

    -- Constraints
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (related_backup_id) REFERENCES backup_records(id) ON DELETE SET NULL,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id)
);

-- ============================================================================
-- BACKUP AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_audit_logs (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('backup_created', 'backup_deleted', 'restore_initiated', 'schedule_modified', 'configuration_updated')),
    details TEXT, -- JSON with action details
    performed_by TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- ============================================================================
-- BACKUP METRICS AGGREGATES (For Performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_metrics_daily (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_backups INTEGER DEFAULT 0,
    successful_backups INTEGER DEFAULT 0,
    failed_backups INTEGER DEFAULT 0,
    total_size_bytes INTEGER DEFAULT 0,
    average_duration_seconds INTEGER DEFAULT 0,
    storage_cost_estimate REAL DEFAULT 0,

    -- Computed at end of day
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, date)
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Backup Records Indexes
CREATE INDEX IF NOT EXISTS idx_backup_records_restaurant_status ON backup_records(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_backup_records_created_at ON backup_records(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_records_expires_at ON backup_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_backup_records_storage_path ON backup_records(storage_path);

-- Backup Configurations Indexes
CREATE INDEX IF NOT EXISTS idx_backup_configs_restaurant ON backup_configurations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_configs_schedule ON backup_configurations(schedule_enabled, restaurant_id);

-- Restore Operations Indexes
CREATE INDEX IF NOT EXISTS idx_restore_ops_restaurant_status ON restore_operations(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_restore_ops_backup ON restore_operations(backup_id);
CREATE INDEX IF NOT EXISTS idx_restore_ops_started_at ON restore_operations(started_at);

-- Backup Schedules Indexes
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_restaurant ON backup_schedules(restaurant_id);

-- Backup Alerts Indexes
CREATE INDEX IF NOT EXISTS idx_backup_alerts_restaurant_severity ON backup_alerts(restaurant_id, severity);
CREATE INDEX IF NOT EXISTS idx_backup_alerts_unresolved ON backup_alerts(resolved, triggered_at);
CREATE INDEX IF NOT EXISTS idx_backup_alerts_type ON backup_alerts(alert_type, restaurant_id);

-- Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_backup_audit_restaurant_action ON backup_audit_logs(restaurant_id, action);
CREATE INDEX IF NOT EXISTS idx_backup_audit_timestamp ON backup_audit_logs(timestamp);

-- Metrics Indexes
CREATE INDEX IF NOT EXISTS idx_backup_metrics_restaurant_date ON backup_metrics_daily(restaurant_id, date);

-- ============================================================================
-- DEFAULT BACKUP CONFIGURATIONS
-- ============================================================================

-- Insert default backup configuration template
INSERT OR IGNORE INTO backup_configurations (
    id,
    restaurant_id,
    name,
    description,
    backup_type,
    schedule_enabled,
    schedule_cron,
    retention_days,
    compression_enabled,
    encryption_enabled,
    created_by
) VALUES (
    'default-template',
    'template',
    'Default Backup Configuration',
    'Template configuration for new restaurants',
    'full',
    true,
    '0 2 * * *',
    30,
    true,
    true,
    'system'
);

-- ============================================================================
-- CLEANUP PROCEDURES (For Cloudflare Workers Cron)
-- ============================================================================

-- Note: These would be implemented as Worker cron jobs
-- 1. Clean up expired backups: DELETE FROM backup_records WHERE expires_at < CURRENT_TIMESTAMP
-- 2. Clean up old audit logs: DELETE FROM backup_audit_logs WHERE timestamp < datetime('now', '-90 days')
-- 3. Aggregate daily metrics: INSERT INTO backup_metrics_daily ...
-- 4. Check for failed schedules and create alerts
-- 5. Cleanup resolved alerts older than 30 days