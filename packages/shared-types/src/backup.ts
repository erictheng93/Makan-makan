/**
 * Multi-tenant Backup System Types
 * Enterprise-grade backup for MakanMakan platform
 */

export type BackupStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type BackupType = "full" | "incremental" | "differential";

export type StorageProvider = "r2" | "kv" | "external";

export interface BackupConfiguration {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  backup_type: BackupType;
  schedule_enabled: boolean;
  schedule_cron?: string; // "0 2 * * *" = daily at 2 AM
  retention_days: number;
  include_tables?: string[];
  exclude_tables?: string[];
  compression_enabled: boolean;
  encryption_enabled: boolean;
  storage_provider: StorageProvider;
  max_parallel_backups: number;
  notifications_enabled: boolean;
  notification_channels: string[]; // email, slack, discord
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BackupRecord {
  id: string;
  restaurant_id: string;
  configuration_id: string;
  name: string;
  backup_type: BackupType;
  status: BackupStatus;
  file_size: number;
  compressed_size: number;
  records_count: number;
  tables_included: string[];
  storage_provider: StorageProvider;
  storage_path: string;
  encryption_enabled: boolean;
  compression_enabled: boolean;
  checksum: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  created_by: string;
  expires_at?: string;
  // Metadata
  metadata: {
    tables_info: Array<{
      table_name: string;
      record_count: number;
      estimated_size: number;
    }>;
    performance_metrics: {
      backup_duration_ms: number;
      compression_ratio: number;
      upload_speed_mbps: number;
    };
    database_snapshot: {
      version: string;
      schema_hash: string;
      total_tables: number;
      total_records: number;
    };
  };
}

export interface RestoreOperation {
  id: string;
  restaurant_id: string;
  backup_id: string;
  status: BackupStatus;
  restore_type: "full" | "selective";
  target_tables?: string[];
  overwrite_existing: boolean;
  started_at: string;
  completed_at?: string;
  tables_restored: number;
  records_restored: number;
  error_message?: string;
  performed_by: string;
  // Safety checks
  safety_checks: {
    backup_integrity_verified: boolean;
    target_compatibility_verified: boolean;
    data_loss_risk_acknowledged: boolean;
  };
}

export interface BackupSchedule {
  id: string;
  restaurant_id: string;
  configuration_id: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  last_run_at?: string;
  next_run_at: string;
  consecutive_failures: number;
  max_retries: number;
  retry_delay_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface BackupMetrics {
  restaurant_id: string;
  period: "hour" | "day" | "week" | "month";
  total_backups: number;
  successful_backups: number;
  failed_backups: number;
  average_backup_size: number;
  average_backup_duration: number;
  storage_usage_bytes: number;
  cost_estimation: number;
  performance_trend: "improving" | "stable" | "degrading";
}

export interface BackupAlert {
  id: string;
  restaurant_id: string;
  alert_type:
    | "backup_failed"
    | "storage_quota_exceeded"
    | "schedule_missed"
    | "restoration_completed"
    | "performance_degraded";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  related_backup_id?: string;
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
}

// Request/Response Types
export interface CreateBackupRequest {
  restaurant_id: string;
  configuration_id?: string;
  name: string;
  description?: string;
  backup_type?: BackupType;
  include_tables?: string[];
  exclude_tables?: string[];
  force_immediate?: boolean;
}

export interface CreateBackupResponse {
  backup_id: string;
  status: BackupStatus;
  estimated_duration_minutes: number;
  message: string;
}

export interface ListBackupsQuery {
  restaurant_id: string;
  status?: BackupStatus;
  backup_type?: BackupType;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: "created_at" | "file_size" | "duration";
  sort_order?: "asc" | "desc";
}

export interface RestoreBackupRequest {
  restaurant_id: string;
  backup_id: string;
  restore_type: "full" | "selective";
  target_tables?: string[];
  overwrite_existing: boolean;
  safety_confirmation: {
    backup_integrity_verified: boolean;
    data_loss_risk_acknowledged: boolean;
    confirmation_phrase: string; // Must be "I understand the risks"
  };
}

export interface BackupSystemHealth {
  overall_status: "healthy" | "warning" | "critical";
  total_restaurants: number;
  active_configurations: number;
  running_backups: number;
  failed_backups_24h: number;
  storage_usage: {
    total_bytes: number;
    available_bytes: number;
    usage_percentage: number;
  };
  performance_metrics: {
    average_backup_duration_minutes: number;
    average_success_rate_percentage: number;
    average_compression_ratio: number;
  };
  alerts_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// Utility Types
export type BackupPermissions = {
  can_create: boolean;
  can_restore: boolean;
  can_delete: boolean;
  can_configure: boolean;
  can_view_all_restaurants: boolean;
  can_manage_schedules: boolean;
};

export interface BackupAuditLog {
  id: string;
  restaurant_id: string;
  action:
    | "backup_created"
    | "backup_deleted"
    | "restore_initiated"
    | "backup_restored"
    | "schedule_modified"
    | "configuration_updated";
  details: Record<string, any>;
  performed_by: string;
  ip_address: string;
  user_agent: string;
  timestamp: string;
}
