-- Canonical backup-system schema (legacy-track mirror of
-- migrations_fresh/0021_backup_system.sql). See that file for the
-- rationale: both replace the orphan
-- packages/database/src/migrations/005_backup_system.sql which (1) was
-- never applied because it lived under src/migrations/, and (2) had
-- drifted from the Drizzle source of truth in
-- packages/database/src/schema/backup.ts (mismatched columns +
-- bogus index on a non-existent backup_records.created_at).
--
-- Keeping migrations/ and migrations_fresh/ in sync follows the
-- dual-track pattern established by earlier Wave commits
-- (0053_add_user_token_version + 0016_add_user_token_version,
-- 0054_idempotency_keys + 0017_idempotency-keys, etc.).

-- ============================================================================
-- BACKUP CONFIGURATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_configurations (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    backup_type TEXT NOT NULL DEFAULT 'full',
    schedule_enabled INTEGER NOT NULL DEFAULT 0,
    schedule_cron TEXT,
    retention_days INTEGER NOT NULL DEFAULT 30,
    include_tables TEXT DEFAULT '[]',
    exclude_tables TEXT DEFAULT '[]',
    compression_enabled INTEGER NOT NULL DEFAULT 1,
    encryption_enabled INTEGER NOT NULL DEFAULT 0,
    storage_provider TEXT NOT NULL DEFAULT 'r2',
    max_parallel_backups INTEGER NOT NULL DEFAULT 1,
    notifications_enabled INTEGER NOT NULL DEFAULT 0,
    notification_channels TEXT DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
);

-- ============================================================================
-- BACKUP RECORDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_records (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    configuration_id TEXT,
    name TEXT NOT NULL,
    backup_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    file_size INTEGER NOT NULL DEFAULT 0,
    compressed_size INTEGER NOT NULL DEFAULT 0,
    records_count INTEGER NOT NULL DEFAULT 0,
    tables_included TEXT NOT NULL DEFAULT '[]',
    storage_provider TEXT NOT NULL DEFAULT 'r2',
    storage_path TEXT NOT NULL DEFAULT '',
    encryption_enabled INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL DEFAULT '',
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    created_by TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    updated_at TEXT
);

-- ============================================================================
-- BACKUP SCHEDULES
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_schedules (
    id TEXT PRIMARY KEY,
    configuration_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);

-- ============================================================================
-- BACKUP ALERTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_alerts (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    message TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    acknowledged INTEGER NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0,
    triggered_at TEXT,
    resolved_at TEXT
);

-- ============================================================================
-- BACKUP AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS backup_audit_logs (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    performed_by TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TEXT
);

-- ============================================================================
-- RESTORE OPERATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS restore_operations (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL,
    backup_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    restore_type TEXT NOT NULL,
    target_tables TEXT DEFAULT '[]',
    overwrite_existing INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    completed_at TEXT,
    tables_restored INTEGER NOT NULL DEFAULT 0,
    records_restored INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    performed_by TEXT NOT NULL,
    safety_checks TEXT DEFAULT '{}'
);

-- ============================================================================
-- INDEXES (names mirror packages/database/src/schema/backup.ts)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_backup_records_restaurant ON backup_records(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_backup_records_started_at ON backup_records(started_at);
CREATE INDEX IF NOT EXISTS idx_backup_records_config ON backup_records(configuration_id);

CREATE INDEX IF NOT EXISTS idx_backup_configurations_restaurant ON backup_configurations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_configurations_schedule ON backup_configurations(schedule_enabled);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_config ON backup_schedules(configuration_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_restaurant ON backup_schedules(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled);

CREATE INDEX IF NOT EXISTS idx_backup_alerts_restaurant ON backup_alerts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_alerts_resolved ON backup_alerts(restaurant_id, resolved);
CREATE INDEX IF NOT EXISTS idx_backup_alerts_triggered_at ON backup_alerts(triggered_at);

CREATE INDEX IF NOT EXISTS idx_backup_audit_logs_restaurant ON backup_audit_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_backup_audit_logs_action ON backup_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_backup_audit_logs_timestamp ON backup_audit_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_restore_operations_restaurant ON restore_operations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restore_operations_backup ON restore_operations(backup_id);
CREATE INDEX IF NOT EXISTS idx_restore_operations_status ON restore_operations(status);
