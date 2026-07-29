/**
 * Monitoring Types
 * Type definitions for system monitoring and alerting
 */

// ============================================================================
// System Metrics Types
// ============================================================================

export interface SystemMetrics {
  timestamp: number;
  /**
   * Which metric groups the API actually measures. Unmeasured groups still
   * carry zeroes because the shape is fixed, and a zero there is
   * indistinguishable from a real one — check this before rendering a group.
   *
   * Optional so an older API response still typechecks; treat a missing flag
   * as unmeasured.
   */
  measured?: {
    api: boolean;
    database: boolean;
    cache: boolean;
    resources: boolean;
    errors: boolean;
  };
  apiMetrics: ApiMetrics;
  databaseMetrics: DatabaseMetrics;
  cacheMetrics: CacheMetrics;
  resourceMetrics: ResourceMetrics;
  errorMetrics: ErrorMetrics;
}

export interface ApiMetrics {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowRequestCount: number;
  requestsPerSecond: number;
}

export interface DatabaseMetrics {
  queryCount: number;
  averageQueryTime: number;
  slowQueryCount: number;
  connectionPoolUsage: number;
  errorCount: number;
}

export interface CacheMetrics {
  hitRate: number;
  totalKeys: number;
  totalSize: number;
  expiringKeysCount: number;
  invalidationCount: number;
}

export interface ResourceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  queueLength: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  criticalErrors: number;
  warningCount: number;
  errorsByType: Record<string, number>;
}

// ============================================================================
// Health Status Types
// ============================================================================

export type HealthStatusType = "healthy" | "warning" | "critical" | "down";

export interface HealthStatus {
  overall: HealthStatusType;
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
  status: HealthStatusType;
  latency?: number;
  errorRate?: number;
  lastCheck: number;
  issues: string[];
  metrics?: Record<string, number>;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertType = "email" | "slack" | "webhook" | "sms";
export type AlertSeverity = "info" | "warning" | "critical" | "fatal";

export interface AlertConfig {
  type: AlertType;
  severity: AlertSeverity;
  enabled: boolean;
  threshold?: number;
  interval?: number; // minutes
  recipients?: string[];
  webhookUrl?: string;
  template?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  metric: string;
  operator: ">" | "<" | "=" | ">=" | "<=";
  threshold: number;
  duration: number; // seconds
  config: AlertConfig;
  lastTriggered?: number;
  triggerCount: number;
  isActive: boolean;
}

// ============================================================================
// Monitoring Overview Types
// ============================================================================

export interface MonitoringOverview {
  status: HealthStatusType;
  uptime: number;
  version: string;
  timestamp: number;
  keyMetrics: {
    requestsPerMinute: number;
    errorRate: string;
    averageResponseTime: string;
    cacheHitRate: string;
    /** 5xx only — real server faults. */
    serverErrors: number;
    /** 4xx — expired sessions, missing records, failed validation. Usually normal. */
    clientErrors: number;
  };
  components: ComponentOverview[];
  topErrors: ErrorSummary[];
  trends: PerformanceTrends;
}

export interface ComponentOverview {
  name: string;
  status: HealthStatusType;
  latency?: number;
  issues: number;
  issueDetails?: string[];
  lastCheck: number;
}

export interface ErrorSummary {
  type: string;
  count: number;
}

export interface PerformanceTrends {
  responseTime: {
    current: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    totalRequests: number;
  };
}

// ============================================================================
// Performance Report Types
// ============================================================================

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
    errorsByType: ErrorTypeAnalysis[];
  };
  recommendations: string[];
}

export interface ErrorTypeAnalysis {
  type: string;
  count: number;
  percentage: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface MetricsQueryParams {
  period?: "1h" | "6h" | "24h" | "7d" | "30d";
  granularity?: "1m" | "5m" | "15m" | "1h" | "6h";
}

export interface PerformanceReportParams {
  days?: number;
}

export interface CreateAlertRuleRequest {
  name: string;
  condition: string;
  metric: string;
  operator: ">" | "<" | "=" | ">=" | "<=";
  threshold: number;
  duration: number;
  config: AlertConfig;
}

export interface UpdateAlertRuleRequest {
  name?: string;
  condition?: string;
  metric?: string;
  operator?: ">" | "<" | "=" | ">=" | "<=";
  threshold?: number;
  duration?: number;
  config?: Partial<AlertConfig>;
  isActive?: boolean;
}

export interface RecordErrorRequest {
  type: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, any>;
}

export interface TestAlertRequest {
  type: "slack" | "webhook";
  severity: AlertSeverity;
  webhookUrl?: string;
}

export interface AlertRulesPagination {
  page?: number;
  limit?: number;
}

// ============================================================================
// Performance Thresholds
// ============================================================================

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

// ============================================================================
// Utility Types
// ============================================================================

export interface MetricCard {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: "healthy" | "warning" | "critical";
  trend: "up" | "down" | "stable";
  description: string;
}

export interface SystemAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  component: string;
  timestamp: number;
  resolved: boolean;
  actions: string[];
}

// ============================================================================
// Chart Data Types
// ============================================================================

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface MetricTrendData {
  metric: string;
  data: ChartDataPoint[];
  unit: string;
}

// ============================================================================
// Response Wrapper Types
// ============================================================================

export interface MonitoringApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedAlertRulesResponse {
  rules: AlertRule[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
