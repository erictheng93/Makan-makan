type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
type BackupType = 'full' | 'incremental' | 'differential';
type StorageProvider = 'r2' | 'kv' | 'external';
interface BackupRecord {
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
    checksum: string;
    started_at: string;
    completed_at?: string;
    error_message?: string;
    created_by: string;
    expires_at?: string;
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
type __VLS_Props = {
    backup: BackupRecord;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    delete: (backup: BackupRecord) => any;
    download: (backup: BackupRecord) => any;
    restore: (backup: BackupRecord) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onDelete?: ((backup: BackupRecord) => any) | undefined;
    onDownload?: ((backup: BackupRecord) => any) | undefined;
    onRestore?: ((backup: BackupRecord) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
