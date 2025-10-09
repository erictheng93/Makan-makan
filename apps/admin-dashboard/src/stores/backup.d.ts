/**
 * Backup Store - Pinia store for backup management
 * Handles all backup-related API interactions and state management
 */
import type { BackupConfiguration, BackupRecord, BackupSystemHealth, BackupAlert, CreateBackupRequest, CreateBackupResponse, ListBackupsQuery, RestoreBackupRequest } from '@makanmakan/shared-types';
export type { BackupStatus, BackupType, StorageProvider } from '@makanmakan/shared-types';
export declare const useBackupStore: import("pinia").StoreDefinition<"backup", Pick<{
    isLoading: import("vue").Ref<boolean, boolean>;
    backups: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        configuration_id: string;
        name: string;
        backup_type: import("@shared/backup").BackupType;
        status: import("@shared/backup").BackupStatus;
        file_size: number;
        compressed_size: number;
        records_count: number;
        tables_included: string[];
        storage_provider: import("@shared/backup").StorageProvider;
        storage_path: string;
        encryption_enabled: boolean;
        compression_enabled: boolean;
        checksum: string;
        started_at: string;
        completed_at?: string | undefined;
        error_message?: string | undefined;
        created_by: string;
        expires_at?: string | undefined;
        metadata: {
            tables_info: {
                table_name: string;
                record_count: number;
                estimated_size: number;
            }[];
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
    }[], BackupRecord[] | {
        id: string;
        restaurant_id: string;
        configuration_id: string;
        name: string;
        backup_type: import("@shared/backup").BackupType;
        status: import("@shared/backup").BackupStatus;
        file_size: number;
        compressed_size: number;
        records_count: number;
        tables_included: string[];
        storage_provider: import("@shared/backup").StorageProvider;
        storage_path: string;
        encryption_enabled: boolean;
        compression_enabled: boolean;
        checksum: string;
        started_at: string;
        completed_at?: string | undefined;
        error_message?: string | undefined;
        created_by: string;
        expires_at?: string | undefined;
        metadata: {
            tables_info: {
                table_name: string;
                record_count: number;
                estimated_size: number;
            }[];
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
    }[]>;
    configurations: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        name: string;
        description?: string | undefined;
        backup_type: import("@shared/backup").BackupType;
        schedule_enabled: boolean;
        schedule_cron?: string | undefined;
        retention_days: number;
        include_tables?: string[] | undefined;
        exclude_tables?: string[] | undefined;
        compression_enabled: boolean;
        encryption_enabled: boolean;
        storage_provider: import("@shared/backup").StorageProvider;
        max_parallel_backups: number;
        notifications_enabled: boolean;
        notification_channels: string[];
        created_by: string;
        created_at: string;
        updated_at: string;
    }[], BackupConfiguration[] | {
        id: string;
        restaurant_id: string;
        name: string;
        description?: string | undefined;
        backup_type: import("@shared/backup").BackupType;
        schedule_enabled: boolean;
        schedule_cron?: string | undefined;
        retention_days: number;
        include_tables?: string[] | undefined;
        exclude_tables?: string[] | undefined;
        compression_enabled: boolean;
        encryption_enabled: boolean;
        storage_provider: import("@shared/backup").StorageProvider;
        max_parallel_backups: number;
        notifications_enabled: boolean;
        notification_channels: string[];
        created_by: string;
        created_at: string;
        updated_at: string;
    }[]>;
    systemHealth: import("vue").Ref<{
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
    } | null, BackupSystemHealth | {
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
    } | null>;
    alerts: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        alert_type: "backup_failed" | "storage_quota_exceeded" | "schedule_missed" | "restoration_completed" | "performance_degraded";
        severity: "low" | "medium" | "high" | "critical";
        title: string;
        message: string;
        related_backup_id?: string | undefined;
        triggered_at: string;
        acknowledged: boolean;
        acknowledged_by?: string | undefined;
        acknowledged_at?: string | undefined;
        resolved: boolean;
        resolved_at?: string | undefined;
    }[], BackupAlert[] | {
        id: string;
        restaurant_id: string;
        alert_type: "backup_failed" | "storage_quota_exceeded" | "schedule_missed" | "restoration_completed" | "performance_degraded";
        severity: "low" | "medium" | "high" | "critical";
        title: string;
        message: string;
        related_backup_id?: string | undefined;
        triggered_at: string;
        acknowledged: boolean;
        acknowledged_by?: string | undefined;
        acknowledged_at?: string | undefined;
        resolved: boolean;
        resolved_at?: string | undefined;
    }[]>;
    createBackup: (request: CreateBackupRequest) => Promise<CreateBackupResponse>;
    listBackups: (query: ListBackupsQuery) => Promise<any>;
    getBackup: (backupId: string) => Promise<BackupRecord>;
    downloadBackup: (backupId: string) => Promise<void>;
    restoreBackup: (request: RestoreBackupRequest) => Promise<string>;
    deleteBackup: (backupId: string) => Promise<void>;
    getBackupConfigurations: (restaurantId: string) => Promise<BackupConfiguration[]>;
    createOrUpdateConfiguration: (config: Partial<BackupConfiguration>) => Promise<BackupConfiguration>;
    getSystemHealth: () => Promise<BackupSystemHealth>;
    getRestaurantMetrics: (restaurantId: string, period?: "hour" | "day" | "week" | "month") => Promise<any>;
    getRestaurantAlerts: (restaurantId: string, unresolved_only?: boolean) => Promise<BackupAlert[]>;
    acknowledgeAlert: (alertId: string) => Promise<void>;
    resolveAlert: (alertId: string) => Promise<void>;
    refreshBackups: (restaurantId: string) => Promise<void>;
    clearCache: () => void;
    subscribeToUpdates: (restaurantId: string) => void;
    unsubscribeFromUpdates: () => void;
    pollBackupStatus: (backupId: string) => Promise<BackupRecord>;
    startAutoRefresh: (_restaurantId?: string) => NodeJS.Timeout;
}, "isLoading" | "backups" | "configurations" | "systemHealth" | "alerts">, Pick<{
    isLoading: import("vue").Ref<boolean, boolean>;
    backups: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        configuration_id: string;
        name: string;
        backup_type: import("@shared/backup").BackupType;
        status: import("@shared/backup").BackupStatus;
        file_size: number;
        compressed_size: number;
        records_count: number;
        tables_included: string[];
        storage_provider: import("@shared/backup").StorageProvider;
        storage_path: string;
        encryption_enabled: boolean;
        compression_enabled: boolean;
        checksum: string;
        started_at: string;
        completed_at?: string | undefined;
        error_message?: string | undefined;
        created_by: string;
        expires_at?: string | undefined;
        metadata: {
            tables_info: {
                table_name: string;
                record_count: number;
                estimated_size: number;
            }[];
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
    }[], BackupRecord[] | {
        id: string;
        restaurant_id: string;
        configuration_id: string;
        name: string;
        backup_type: import("@shared/backup").BackupType;
        status: import("@shared/backup").BackupStatus;
        file_size: number;
        compressed_size: number;
        records_count: number;
        tables_included: string[];
        storage_provider: import("@shared/backup").StorageProvider;
        storage_path: string;
        encryption_enabled: boolean;
        compression_enabled: boolean;
        checksum: string;
        started_at: string;
        completed_at?: string | undefined;
        error_message?: string | undefined;
        created_by: string;
        expires_at?: string | undefined;
        metadata: {
            tables_info: {
                table_name: string;
                record_count: number;
                estimated_size: number;
            }[];
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
    }[]>;
    configurations: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        name: string;
        description?: string | undefined;
        backup_type: import("@shared/backup").BackupType;
        schedule_enabled: boolean;
        schedule_cron?: string | undefined;
        retention_days: number;
        include_tables?: string[] | undefined;
        exclude_tables?: string[] | undefined;
        compression_enabled: boolean;
        encryption_enabled: boolean;
        storage_provider: import("@shared/backup").StorageProvider;
        max_parallel_backups: number;
        notifications_enabled: boolean;
        notification_channels: string[];
        created_by: string;
        created_at: string;
        updated_at: string;
    }[], BackupConfiguration[] | {
        id: string;
        restaurant_id: string;
        name: string;
        description?: string | undefined;
        backup_type: import("@shared/backup").BackupType;
        schedule_enabled: boolean;
        schedule_cron?: string | undefined;
        retention_days: number;
        include_tables?: string[] | undefined;
        exclude_tables?: string[] | undefined;
        compression_enabled: boolean;
        encryption_enabled: boolean;
        storage_provider: import("@shared/backup").StorageProvider;
        max_parallel_backups: number;
        notifications_enabled: boolean;
        notification_channels: string[];
        created_by: string;
        created_at: string;
        updated_at: string;
    }[]>;
    systemHealth: import("vue").Ref<{
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
    } | null, BackupSystemHealth | {
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
    } | null>;
    alerts: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        alert_type: "backup_failed" | "storage_quota_exceeded" | "schedule_missed" | "restoration_completed" | "performance_degraded";
        severity: "low" | "medium" | "high" | "critical";
        title: string;
        message: string;
        related_backup_id?: string | undefined;
        triggered_at: string;
        acknowledged: boolean;
        acknowledged_by?: string | undefined;
        acknowledged_at?: string | undefined;
        resolved: boolean;
        resolved_at?: string | undefined;
    }[], BackupAlert[] | {
        id: string;
        restaurant_id: string;
        alert_type: "backup_failed" | "storage_quota_exceeded" | "schedule_missed" | "restoration_completed" | "performance_degraded";
        severity: "low" | "medium" | "high" | "critical";
        title: string;
        message: string;
        related_backup_id?: string | undefined;
        triggered_at: string;
        acknowledged: boolean;
        acknowledged_by?: string | undefined;
        acknowledged_at?: string | undefined;
        resolved: boolean;
        resolved_at?: string | undefined;
    }[]>;
    createBackup: (request: CreateBackupRequest) => Promise<CreateBackupResponse>;
    listBackups: (query: ListBackupsQuery) => Promise<any>;
    getBackup: (backupId: string) => Promise<BackupRecord>;
    downloadBackup: (backupId: string) => Promise<void>;
    restoreBackup: (request: RestoreBackupRequest) => Promise<string>;
    deleteBackup: (backupId: string) => Promise<void>;
    getBackupConfigurations: (restaurantId: string) => Promise<BackupConfiguration[]>;
    createOrUpdateConfiguration: (config: Partial<BackupConfiguration>) => Promise<BackupConfiguration>;
    getSystemHealth: () => Promise<BackupSystemHealth>;
    getRestaurantMetrics: (restaurantId: string, period?: "hour" | "day" | "week" | "month") => Promise<any>;
    getRestaurantAlerts: (restaurantId: string, unresolved_only?: boolean) => Promise<BackupAlert[]>;
    acknowledgeAlert: (alertId: string) => Promise<void>;
    resolveAlert: (alertId: string) => Promise<void>;
    refreshBackups: (restaurantId: string) => Promise<void>;
    clearCache: () => void;
    subscribeToUpdates: (restaurantId: string) => void;
    unsubscribeFromUpdates: () => void;
    pollBackupStatus: (backupId: string) => Promise<BackupRecord>;
    startAutoRefresh: (_restaurantId?: string) => NodeJS.Timeout;
}, never>, Pick<{
    isLoading: import("vue").Ref<boolean, boolean>;
    backups: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        configuration_id: string;
        name: string;
        backup_type: import("@shared/backup").BackupType;
        status: import("@shared/backup").BackupStatus;
        file_size: number;
        compressed_size: number;
        records_count: number;
        tables_included: string[];
        storage_provider: import("@shared/backup").StorageProvider;
        storage_path: string;
        encryption_enabled: boolean;
        compression_enabled: boolean;
        checksum: string;
        started_at: string;
        completed_at?: string | undefined;
        error_message?: string | undefined;
        created_by: string;
        expires_at?: string | undefined;
        metadata: {
            tables_info: {
                table_name: string;
                record_count: number;
                estimated_size: number;
            }[];
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
    }[], BackupRecord[] | {
        id: string;
        restaurant_id: string;
        configuration_id: string;
        name: string;
        backup_type: import("@shared/backup").BackupType;
        status: import("@shared/backup").BackupStatus;
        file_size: number;
        compressed_size: number;
        records_count: number;
        tables_included: string[];
        storage_provider: import("@shared/backup").StorageProvider;
        storage_path: string;
        encryption_enabled: boolean;
        compression_enabled: boolean;
        checksum: string;
        started_at: string;
        completed_at?: string | undefined;
        error_message?: string | undefined;
        created_by: string;
        expires_at?: string | undefined;
        metadata: {
            tables_info: {
                table_name: string;
                record_count: number;
                estimated_size: number;
            }[];
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
    }[]>;
    configurations: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        name: string;
        description?: string | undefined;
        backup_type: import("@shared/backup").BackupType;
        schedule_enabled: boolean;
        schedule_cron?: string | undefined;
        retention_days: number;
        include_tables?: string[] | undefined;
        exclude_tables?: string[] | undefined;
        compression_enabled: boolean;
        encryption_enabled: boolean;
        storage_provider: import("@shared/backup").StorageProvider;
        max_parallel_backups: number;
        notifications_enabled: boolean;
        notification_channels: string[];
        created_by: string;
        created_at: string;
        updated_at: string;
    }[], BackupConfiguration[] | {
        id: string;
        restaurant_id: string;
        name: string;
        description?: string | undefined;
        backup_type: import("@shared/backup").BackupType;
        schedule_enabled: boolean;
        schedule_cron?: string | undefined;
        retention_days: number;
        include_tables?: string[] | undefined;
        exclude_tables?: string[] | undefined;
        compression_enabled: boolean;
        encryption_enabled: boolean;
        storage_provider: import("@shared/backup").StorageProvider;
        max_parallel_backups: number;
        notifications_enabled: boolean;
        notification_channels: string[];
        created_by: string;
        created_at: string;
        updated_at: string;
    }[]>;
    systemHealth: import("vue").Ref<{
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
    } | null, BackupSystemHealth | {
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
    } | null>;
    alerts: import("vue").Ref<{
        id: string;
        restaurant_id: string;
        alert_type: "backup_failed" | "storage_quota_exceeded" | "schedule_missed" | "restoration_completed" | "performance_degraded";
        severity: "low" | "medium" | "high" | "critical";
        title: string;
        message: string;
        related_backup_id?: string | undefined;
        triggered_at: string;
        acknowledged: boolean;
        acknowledged_by?: string | undefined;
        acknowledged_at?: string | undefined;
        resolved: boolean;
        resolved_at?: string | undefined;
    }[], BackupAlert[] | {
        id: string;
        restaurant_id: string;
        alert_type: "backup_failed" | "storage_quota_exceeded" | "schedule_missed" | "restoration_completed" | "performance_degraded";
        severity: "low" | "medium" | "high" | "critical";
        title: string;
        message: string;
        related_backup_id?: string | undefined;
        triggered_at: string;
        acknowledged: boolean;
        acknowledged_by?: string | undefined;
        acknowledged_at?: string | undefined;
        resolved: boolean;
        resolved_at?: string | undefined;
    }[]>;
    createBackup: (request: CreateBackupRequest) => Promise<CreateBackupResponse>;
    listBackups: (query: ListBackupsQuery) => Promise<any>;
    getBackup: (backupId: string) => Promise<BackupRecord>;
    downloadBackup: (backupId: string) => Promise<void>;
    restoreBackup: (request: RestoreBackupRequest) => Promise<string>;
    deleteBackup: (backupId: string) => Promise<void>;
    getBackupConfigurations: (restaurantId: string) => Promise<BackupConfiguration[]>;
    createOrUpdateConfiguration: (config: Partial<BackupConfiguration>) => Promise<BackupConfiguration>;
    getSystemHealth: () => Promise<BackupSystemHealth>;
    getRestaurantMetrics: (restaurantId: string, period?: "hour" | "day" | "week" | "month") => Promise<any>;
    getRestaurantAlerts: (restaurantId: string, unresolved_only?: boolean) => Promise<BackupAlert[]>;
    acknowledgeAlert: (alertId: string) => Promise<void>;
    resolveAlert: (alertId: string) => Promise<void>;
    refreshBackups: (restaurantId: string) => Promise<void>;
    clearCache: () => void;
    subscribeToUpdates: (restaurantId: string) => void;
    unsubscribeFromUpdates: () => void;
    pollBackupStatus: (backupId: string) => Promise<BackupRecord>;
    startAutoRefresh: (_restaurantId?: string) => NodeJS.Timeout;
}, "createBackup" | "listBackups" | "getBackup" | "downloadBackup" | "restoreBackup" | "deleteBackup" | "getBackupConfigurations" | "createOrUpdateConfiguration" | "getSystemHealth" | "getRestaurantMetrics" | "getRestaurantAlerts" | "acknowledgeAlert" | "resolveAlert" | "refreshBackups" | "clearCache" | "subscribeToUpdates" | "unsubscribeFromUpdates" | "pollBackupStatus" | "startAutoRefresh">>;
