/**
 * Monitoring Feature Types
 * Type definitions for monitoring and alerting functionality
 */

// 監控指標接口
export interface SystemMetrics {
  timestamp: number;
  /**
   * Which metric groups are backed by a real data source.
   *
   * A group that is not measured still carries zeroes, because the shape is
   * fixed — and a zero is indistinguishable from a genuine zero. Consumers must
   * check this before displaying a group, or they will present "0 queries,
   * 0ms" as if it had been observed. The monitoring dashboard was plotting
   * exactly that next to real API latency.
   */
  measured: {
    api: boolean;
    database: boolean;
    cache: boolean;
    resources: boolean;
    errors: boolean;
  };
  apiMetrics: {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    slowRequestCount: number;
    requestsPerSecond: number;
  };
  databaseMetrics: {
    queryCount: number;
    averageQueryTime: number;
    slowQueryCount: number;
    connectionPoolUsage: number;
    errorCount: number;
  };
  cacheMetrics: {
    hitRate: number;
    totalKeys: number;
    totalSize: number;
    expiringKeysCount: number;
    invalidationCount: number;
  };
  resourceMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    queueLength: number;
  };
  errorMetrics: {
    totalErrors: number;
    criticalErrors: number;
    warningCount: number;
    errorsByType: Record<string, number>;
  };
}

// 警報配置
export interface AlertConfig {
  type: "email" | "slack" | "webhook" | "sms";
  severity: "info" | "warning" | "critical" | "fatal";
  enabled: boolean;
  threshold?: number;
  interval?: number; // 分鐘
  recipients?: string[];
  webhookUrl?: string;
  template?: string;
}

// 警報規則
export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  metric: keyof SystemMetrics | string;
  operator: ">" | "<" | "=" | ">=" | "<=";
  threshold: number;
  duration: number; // 持續時間（秒）
  config: AlertConfig;
  lastTriggered?: number;
  triggerCount: number;
  isActive: boolean;
}

// 健康狀態
export interface HealthStatus {
  overall: "healthy" | "warning" | "critical" | "down";
  components: {
    api: ComponentHealth;
    database: ComponentHealth;
    cache: ComponentHealth;
    external: ComponentHealth;
  };
  uptime: number;
  version: string;
  timestamp: number;
}

export interface ComponentHealth {
  status: "healthy" | "warning" | "critical" | "down";
  latency?: number;
  errorRate?: number;
  lastCheck: number;
  issues: string[];
  metrics?: Record<string, number>;
}

// 效能基準
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME_WARNING: 500, // ms
  API_RESPONSE_TIME_CRITICAL: 1000, // ms
  DATABASE_QUERY_TIME_WARNING: 100, // ms
  DATABASE_QUERY_TIME_CRITICAL: 500, // ms
  ERROR_RATE_WARNING: 0.05, // 5%
  ERROR_RATE_CRITICAL: 0.1, // 10%
  CACHE_HIT_RATE_WARNING: 0.6, // 60%
  CACHE_HIT_RATE_CRITICAL: 0.3, // 30%
  MEMORY_USAGE_WARNING: 0.8, // 80%
  MEMORY_USAGE_CRITICAL: 0.9, // 90%
} as const;

// Error reporting types
export interface ErrorReportRequest {
  type: string;
  message: string;
  severity: "info" | "warning" | "critical" | "fatal";
  metadata?: Record<string, unknown>;
}

// Metrics query types
export interface MetricsQuery {
  period: "1h" | "6h" | "24h" | "7d" | "30d";
  granularity: "1m" | "5m" | "15m" | "1h" | "6h";
}

// Performance report types
export interface PerformanceReport {
  period: string;
  generatedAt: number;
  apiPerformance: {
    totalRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: string;
    slowRequests: number;
  };
  databasePerformance: {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
    queryErrorRate: string;
  };
  cachePerformance: {
    hitRate: string;
    totalKeys: number;
    totalSize: string;
    expiringKeys: number;
  };
  errorAnalysis: {
    totalErrors: number;
    criticalErrors: number;
    warningsCount: number;
    errorsByType: Array<{
      type: string;
      count: number;
      percentage: string;
    }>;
  };
  recommendations: string[];
}

// Test alert request interface (use validation schema type instead)
// export interface TestAlertRequest {
//   type: 'slack' | 'webhook'
//   severity: 'info' | 'warning' | 'critical' | 'fatal'
//   webhookUrl?: string
// }

// Monitoring overview
export interface MonitoringOverview {
  status: "healthy" | "warning" | "critical" | "down";
  uptime: number;
  version: string;
  timestamp: number;
  keyMetrics: {
    requestsPerMinute: number;
    errorRate: string;
    averageResponseTime: string;
    cacheHitRate: string;
    activeErrors: number;
  };
  components: Array<{
    name: string;
    status: "healthy" | "warning" | "critical" | "down";
    latency?: number;
    issues: number;
    lastCheck: number;
  }>;
  topErrors: Array<{
    type: string;
    count: number;
  }>;
  trends: {
    responseTime: {
      current: number;
      p95: number;
      p99: number;
    };
    throughput: {
      requestsPerSecond: number;
      totalRequests: number;
    };
  };
}
