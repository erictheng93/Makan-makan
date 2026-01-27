/**
 * System Types
 * TypeScript type definitions for the system feature
 */

// Error reporting types
export interface ErrorReportItem {
  type: "network" | "api" | "sse" | "validation" | "permission" | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  code?: string | number;
  message: string;
  originalError?: any;
  context?: Record<string, any>;
  timestamp: string;
  userAgent?: string;
  url?: string;
  userId?: number | string;
  restaurantId?: string | null;
}

export interface ErrorReportRequest {
  errors: ErrorReportItem[];
}

export interface ErrorReportResponse {
  success: boolean;
  message: string;
  data: {
    total_errors: number;
    significant_errors: number;
    report_id: string;
  };
}

// Health check types
export interface HealthCheck {
  status: "healthy" | "unhealthy" | "degraded";
  latency?: string;
  usage?: string;
}

export interface SystemHealthResponse {
  success: boolean;
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  checks: {
    database: HealthCheck;
    cache: HealthCheck;
    memory: HealthCheck;
  };
  version: string;
  uptime: string;
}

// Error statistics types
export interface ErrorStats {
  summary: {
    total_errors_24h: number;
    unique_users_affected: number;
    error_rate: number;
  };
  stats_24h: Array<{
    error_type: string;
    error_count: number;
  }>;
  weekly_trend: Array<{
    date: string;
    count: number;
  }>;
  common_errors: Array<{
    id: number;
    message: string;
    count: number;
    lastOccurred: string;
  }>;
}

export interface ErrorStatsResponse {
  success: boolean;
  data: ErrorStats;
}

// Cleanup operation types
export interface CleanupResponse {
  success: boolean;
  message: string;
  data: {
    deleted_count: number;
  };
}

// Critical error notification types
export interface CriticalErrorNotification {
  text: string;
  attachments: Array<{
    color: string;
    fields: Array<{
      title: string;
      value: string;
      short: boolean;
    }>;
  }>;
}

// Service interfaces
export interface ISystemService {
  createErrorReport(
    data: ErrorReportRequest,
    userId: number,
    restaurantId: string | null,
    userAgent?: string,
  ): Promise<ErrorReportResponse>;
  getSystemHealth(): Promise<SystemHealthResponse>;
  getErrorStats(restaurantId?: string): Promise<ErrorStats>;
  cleanupOldErrorReports(daysOld?: number): Promise<CleanupResponse>;
  sendCriticalErrorNotification(
    errors: ErrorReportItem[],
    user: any,
    slackWebhookUrl?: string,
  ): Promise<void>;
}

// Event types for system operations
export type SystemEvent =
  | {
      type: "ERROR_REPORT_CREATED";
      payload: { reportId: string; errorCount: number; userId: number };
    }
  | {
      type: "CRITICAL_ERROR_DETECTED";
      payload: { errors: ErrorReportItem[]; userId: number };
    }
  | { type: "HEALTH_CHECK_FAILED"; payload: { service: string; error: string } }
  | { type: "CLEANUP_COMPLETED"; payload: { deletedCount: number } };
