export interface D1Result<T = any> {
    results: T[];
    success: boolean;
    meta: {
        served_by: string;
        duration: number;
        changes: number;
        last_row_id: number;
        rows_read: number;
        rows_written: number;
        size_after: number;
    };
}
export interface D1SingleResult<T = any> {
    result: T | null;
    success: boolean;
    meta: {
        served_by: string;
        duration: number;
        changes: number;
        last_row_id: number;
        rows_read: number;
        rows_written: number;
        size_after: number;
    };
}
export interface D1BatchResult {
    results: D1Result[];
    success: boolean;
    error?: string;
}
export interface DatabaseConfig {
    name: string;
    binding: string;
    environment: 'local' | 'staging' | 'production';
}
export interface QueryOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    where?: Record<string, any>;
    joins?: Array<{
        table: string;
        on: string;
        type?: 'INNER' | 'LEFT' | 'RIGHT';
    }>;
}
export interface MigrationStatus {
    version: number;
    name: string;
    appliedAt: string;
    checksum: string;
}
export interface DatabaseStats {
    tables: Array<{
        name: string;
        rowCount: number;
        size: number;
    }>;
    totalSize: number;
    lastUpdated: string;
}
//# sourceMappingURL=database.d.ts.map