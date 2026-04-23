-- Canonical backup-system schema (legacy-track mirror of
-- migrations_fresh/0021_backup_system.sql). See that file for the
-- rationale: this replaces the broken, orphaned
-- packages/database/src/migrations/005_backup_system.sql which had a
-- bogus index on a non-existent backup_records.created_at column and
-- therefore never applied cleanly.
--
-- Keeping migrations/ and migrations_fresh/ in sync follows the
-- dual-track pattern established by earlier Wave commits
-- (0053_add_user_token_version + 0016_add_user_token_version,
-- 0054_idempotency_keys + 0017_idempotency-keys, etc.).

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
    schedule_cron TEXT,
    timezone TEXT DEFAULT 'UTC',
    retention_days INTEGER DEFAULT 30,
    include_tables TEXT,
    exclude_tables TEXT,
    compression_enabled BOOLEAN DEFAULT true,
    encryption_enabled BOOLEAN DEFAULT true,
    storage_provider TEXT DEFAULT 'r2' CHECK (storage_provider IN ('r2', 'kv', 'external')),
    max_parallel_backups INTEGER DEFAULT 3,
    notifications_enabled BOOLEAN DEFAULT true,
    notification_channels TEXT,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BACKUP RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    configuration_id TEXT,
    name TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'full' CHECK (backup_type IN ('full', 'incremental', 'differential')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    file_size INTEGER DEFAULT 0,
    compressed_size INTEGER DEFAULT 0,
    records_count INTEGER DEFAULT 0,
    tables_included TEXT,
    storage_provider TEXT DEFAULT 'r2',
    storage_path TEXT,
    encryption_enabled BOOLEAN DEFAULT true,
    checksum TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    expires_at DATETIME,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    metadata TEXT
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
    target_tables TEXT,
    overwrite_existing BOOLEAN DEFAULT false,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    tables_restored INTEGER DEFAULT 0,
    records_restored INTEGER DEFAULT 0,
    error_message TEXT,
    performed_by TEXT NOT NULL,
    safety_checks TEXT,
    ip_address TEXT,
    user_agent TEXT
);

-- ============================================================================
-- BACKUP SCHEDULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_schedules (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    configuration_id TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    enabled BOOLEAN DEFAULT true,
    last_run_at DATETIME,
    next_run_at DATETIME NOT NULL,
    consecutive_failures INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 30,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    resolved BOOLEAN DEFAULT false,
    resolved_at DATETIME
);

-- ============================================================================
-- BACKUP AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_audit_logs (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('backup_created', 'backup_deleted', 'restore_initiated', 'schedule_modified', 'configuration_updated')),
    details TEXT,
    performed_by TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BACKUP METRICS AGGREGATES
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
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, date)
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_backup_records_restaurant_status ON backup_records(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_backup_records_started_at ON backup_records(started_at);
CREATE INDEX IF NOT EXISTS idx_backup_records_expires_at ON backup_records(expires_at);
CREATE INDEX IF NOT EXISTS idx_backup_records_storage_path ON backup_records(storage_path);
CREATE INDEX IF NOT EXISTS idx_backup_configs_restaurant ON backup_configurations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_configs_schedule ON backup_configurations(schedule_enabled, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restore_ops_restaurant_status ON restore_operations(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_restore_ops_backup ON restore_operations(backup_id);
CREATE INDEX IF NOT EXISTS idx_restore_ops_started_at ON restore_operations(started_at);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_restaurant ON backup_schedules(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_alerts_restaurant_severity ON backup_alerts(restaurant_id, severity);
CREATE INDEX IF NOT EXISTS idx_backup_alerts_unresolved ON backup_alerts(resolved, triggered_at);
CREATE INDEX IF NOT EXISTS idx_backup_alerts_type ON backup_alerts(alert_type, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_audit_restaurant_action ON backup_audit_logs(restaurant_id, action);
CREATE INDEX IF NOT EXISTS idx_backup_audit_timestamp ON backup_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_backup_metrics_restaurant_date ON backup_metrics_daily(restaurant_id, date);
