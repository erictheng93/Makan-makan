// D1 資料庫查詢結果類型
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

// D1 單一結果
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

// D1 批量操作結果
export interface D1BatchResult {
  results: D1Result[];
  success: boolean;
  error?: string;
}

// 資料庫連接配置
export interface DatabaseConfig {
  name: string;
  binding: string;
  environment: 'local' | 'staging' | 'production';
}

// 查詢構建器選項
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

// 資料庫遷移狀態
export interface MigrationStatus {
  version: number;
  name: string;
  appliedAt: string;
  checksum: string;
}

// 資料庫統計資訊
export interface DatabaseStats {
  tables: Array<{
    name: string;
    rowCount: number;
    size: number;
  }>;
  totalSize: number;
  lastUpdated: string;
}