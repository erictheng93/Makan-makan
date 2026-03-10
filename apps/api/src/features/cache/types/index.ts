/**
 * Cache Feature Types
 * Type definitions for the cache feature module
 */

export interface CacheConfig {
  ttl: number; // 存活時間（秒）
  tags?: readonly string[] | string[]; // 快取標籤，用於批量失效
  staleWhileRevalidate?: number; // 過期後仍可使用的寬限期（秒）
  maxRetries?: number; // 快取更新最大重試次數
  priority?: "low" | "normal" | "high"; // 快取優先級
}

export interface CacheMetadata {
  key: string;
  createdAt: number;
  expiresAt: number;
  tags: string[];
  hitCount: number;
  size: number; // 數據大小（字節）
  priority: "low" | "normal" | "high";
}

export interface CacheStats {
  totalKeys: number;
  hitCount: number;
  missCount: number;
  totalSize: number;
  averageHitRate: number;
  mostAccessedKeys: Array<{ key: string; hits: number }>;
  expiringKeys: Array<{ key: string; expiresAt: number }>;
}

export interface CacheHealthStatus {
  status: "healthy" | "warning" | "critical";
  issues: string[];
  recommendations: string[];
  metrics: {
    hitRate: number;
    totalKeys: number;
    totalSize: number;
    expiringKeysCount: number;
  };
}

export interface CacheInvalidationRequest {
  tags: string[];
  reason?: string;
}

export interface CacheWarmupRequest {
  keys: Array<{
    key: string;
    strategy: CacheStrategyName;
  }>;
}

export interface CacheCleanupRequest {
  maxAge?: number;
  dryRun?: boolean;
}

export type CacheStrategyName =
  | "MENU"
  | "RESTAURANT"
  | "ANALYTICS"
  | "SESSION"
  | "TABLE"
  | "QR_CODE";

export interface CacheTestResult {
  setSuccess: boolean;
  getSuccess: boolean;
  dataIntegrity: boolean;
  deleteSuccess: boolean;
  testKey: string;
  timestamp: number;
}
