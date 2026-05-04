/**
 * SystemService
 * Business logic for system operations within the feature module
 */

import {
  ErrorReportingService,
  createDatabase,
  sql,
  type CreateErrorReportData,
} from "@makanmasak/database";
import { KVCacheService, type CacheService } from "../../../core/cache";
import { ConsoleLogger } from "../../../core/monitoring";
import { CACHE_TTL } from "../../../shared/constants";
import type { Env } from "../../../shared/types";
import type { KVNamespace } from "@cloudflare/workers-types";
import type {
  ErrorReportRequest,
  ErrorReportResponse,
  SystemHealthResponse,
  ErrorStats,
  CleanupResponse,
  ErrorReportItem,
  CriticalErrorNotification,
  ISystemService,
  SystemEvent,
  SystemNotificationUser,
} from "../types";

export class SystemService implements ISystemService {
  private errorReportingService: ErrorReportingService;
  private cache: CacheService;
  private logger: ConsoleLogger;
  private env: Env;

  constructor(db: Env["DB"], env: Env, kv?: Env["CACHE_KV"]) {
    this.errorReportingService = new ErrorReportingService(db, env);
    this.cache = kv
      ? new KVCacheService(kv)
      : new KVCacheService({} as KVNamespace);
    this.logger = new ConsoleLogger("SystemService");
    this.env = env;
  }

  /**
   * Create error report
   */
  async createErrorReport(
    data: ErrorReportRequest,
    userId: number,
    restaurantId: string | null,
    userAgent?: string,
  ): Promise<ErrorReportResponse> {
    try {
      this.logger.debug("Creating error report", {
        errorCount: data.errors.length,
        userId,
      });

      // Filter significant errors
      const significantErrors = data.errors.filter(
        (error) => error.severity === "high" || error.severity === "critical",
      );

      // Prepare error report data
      const errorReportsData: CreateErrorReportData[] = data.errors.map(
        (error) => ({
          userId,
          restaurantId: restaurantId || undefined,
          errorType: error.type,
          severity: error.severity,
          errorCode: error.code?.toString(),
          errorMessage: error.message,
          errorContext: error.context,
          originalError: error.originalError,
          userAgent: error.userAgent || userAgent,
          url: error.url,
          timestamp: new Date(error.timestamp),
        }),
      );

      // Create error reports
      await this.errorReportingService.createBulkErrorReports(errorReportsData);

      // Send critical error notifications if needed
      if (significantErrors.length > 0) {
        await this.sendCriticalErrorNotification(
          significantErrors,
          { id: userId, restaurantId },
          this.env.SLACK_WEBHOOK_URL,
        );
      }

      // Generate report ID
      const reportId = Date.now().toString();

      // Emit event
      await this.emitEvent({
        type: "ERROR_REPORT_CREATED",
        payload: { reportId, errorCount: data.errors.length, userId },
      });

      // If critical errors detected, emit additional event
      if (significantErrors.length > 0) {
        await this.emitEvent({
          type: "CRITICAL_ERROR_DETECTED",
          payload: { errors: significantErrors, userId },
        });
      }

      const response: ErrorReportResponse = {
        success: true,
        message: `Successfully received ${data.errors.length} error reports`,
        data: {
          total_errors: data.errors.length,
          significant_errors: significantErrors.length,
          report_id: reportId,
        },
      };

      this.logger.info("Error report created successfully", {
        userId,
        totalErrors: data.errors.length,
        significantErrors: significantErrors.length,
        reportId,
      });

      return response;
    } catch (error) {
      this.logger.error("Failed to create error report", error as Error, {
        userId,
        errorCount: data.errors.length,
      });
      throw new Error("Failed to submit error report");
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealthResponse> {
    try {
      this.logger.debug("Checking system health");

      // Try cache first
      const cacheKey = "system:health";
      const cached = await this.cache.get<SystemHealthResponse>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached health status");
        return cached;
      }

      // Perform health checks
      const healthChecks = await Promise.allSettled([
        // Database health check
        (async () => {
          const db = createDatabase(this.env.DB);
          const result = await db
            .select({ test: sql<number>`1` })
            .from(sql`(SELECT 1)`)
            .limit(1);
          return result[0];
        })(),

        // KV health check
        this.env.CACHE_KV
          ? this.env.CACHE_KV.get("health-check")
          : Promise.resolve(null),
      ]);

      const dbStatus =
        healthChecks[0].status === "fulfilled" ? "healthy" : "unhealthy";
      const kvStatus =
        healthChecks[1].status === "fulfilled" ? "healthy" : "unhealthy";

      const overallStatus =
        dbStatus === "healthy" && kvStatus === "healthy"
          ? "healthy"
          : "degraded";

      const response: SystemHealthResponse = {
        success: true,
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: dbStatus,
            latency: "N/A",
          },
          cache: {
            status: kvStatus,
            latency: "N/A",
          },
          memory: {
            status: "healthy",
            usage: "N/A",
          },
        },
        version: "1.0.0",
        uptime: "N/A", // Cloudflare Workers don't have persistent uptime
      };

      // Cache the result for a short time
      await this.cache.set(cacheKey, response, CACHE_TTL.SHORT);

      // Emit event if health check failed
      if (overallStatus !== "healthy") {
        await this.emitEvent({
          type: "HEALTH_CHECK_FAILED",
          payload: {
            service: dbStatus !== "healthy" ? "database" : "cache",
            error: "Health check failed",
          },
        });
      }

      this.logger.info("Health check completed", { status: overallStatus });
      return response;
    } catch (error) {
      this.logger.error("System health check failed", error as Error);

      const failedResponse: SystemHealthResponse = {
        success: false,
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: "unhealthy", latency: "N/A" },
          cache: { status: "unhealthy", latency: "N/A" },
          memory: { status: "unhealthy", usage: "N/A" },
        },
        version: "1.0.0",
        uptime: "N/A",
      };

      return failedResponse;
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(restaurantId?: string): Promise<ErrorStats> {
    try {
      this.logger.debug("Getting error statistics", { restaurantId });

      // Try cache first
      const cacheKey = `system:error-stats:${restaurantId || "all"}`;
      const cached = await this.cache.get<ErrorStats>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached error stats");
        return cached;
      }

      // Calculate date ranges
      const now = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Get statistics from database
      const stats = await this.errorReportingService.getErrorStats(
        restaurantId || undefined,
        [yesterday, now],
      );

      // Get common errors
      const commonErrors =
        (await this.errorReportingService.getCommonErrors(
          restaurantId || undefined,
          10,
        )) || [];

      const response: ErrorStats = {
        summary: {
          total_errors_24h: stats.totalErrors,
          unique_users_affected: stats.uniqueUsers,
          error_rate: 0, // Would need total requests to calculate
        },
        stats_24h: Object.entries(stats.errorsByType).map(([type, count]) => ({
          error_type: type,
          error_count: count,
        })),
        weekly_trend: stats.errorTrend,
        common_errors: commonErrors.map((error, index) => ({
          id: index + 1,
          message: error.errorMessage,
          count: error.count,
          lastOccurred: error.latestOccurrence,
        })),
      };

      // Cache the result
      await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);

      this.logger.info("Error statistics retrieved", {
        totalErrors: stats.totalErrors,
        restaurantId,
      });

      return response;
    } catch (error) {
      this.logger.error("Failed to get error statistics", error as Error, {
        restaurantId,
      });
      throw new Error("Failed to get error statistics");
    }
  }

  /**
   * Cleanup old error reports
   */
  async cleanupOldErrorReports(daysOld: number = 30): Promise<CleanupResponse> {
    try {
      this.logger.debug("Cleaning up old error reports", { daysOld });

      const deletedCount =
        await this.errorReportingService.cleanupOldErrorReports(daysOld);

      // Clear related caches
      await this.cache.clear("system:error-stats:*");

      // Emit cleanup event
      await this.emitEvent({
        type: "CLEANUP_COMPLETED",
        payload: { deletedCount },
      });

      const response: CleanupResponse = {
        success: true,
        message: `Cleaned up ${deletedCount} old error reports`,
        data: {
          deleted_count: deletedCount,
        },
      };

      this.logger.info("Error reports cleanup completed", {
        deletedCount,
        daysOld,
      });

      return response;
    } catch (error) {
      this.logger.error("Failed to cleanup error reports", error as Error, {
        daysOld,
      });
      throw new Error("Failed to cleanup error reports");
    }
  }

  /**
   * Send critical error notification
   */
  async sendCriticalErrorNotification(
    errors: ErrorReportItem[],
    user: SystemNotificationUser,
    slackWebhookUrl?: string,
  ): Promise<void> {
    try {
      if (!slackWebhookUrl) {
        this.logger.debug("No Slack webhook configured, skipping notification");
        return;
      }

      this.logger.debug("Sending critical error notification", {
        errorCount: errors.length,
        userId: user.id,
      });

      const errorSummary = errors
        .map(
          (error) =>
            `[${error.severity.toUpperCase()}] ${error.type}: ${error.message}`,
        )
        .join("\n");

      const notificationPayload: CriticalErrorNotification = {
        text: "🚨 關鍵錯誤報告",
        attachments: [
          {
            color: "danger",
            fields: [
              {
                title: "用戶",
                value: `ID: ${user.id}`,
                short: true,
              },
              {
                title: "餐廳",
                value: `ID: ${user.restaurantId || "N/A"}`,
                short: true,
              },
              {
                title: "錯誤數量",
                value: errors.length.toString(),
                short: true,
              },
              {
                title: "時間",
                value: new Date().toISOString(),
                short: true,
              },
              {
                title: "錯誤詳情",
                value: errorSummary,
                short: false,
              },
            ],
          },
        ],
      };

      await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPayload),
      });

      this.logger.info("Critical error notification sent successfully", {
        errorCount: errors.length,
        userId: user.id,
      });
    } catch (error) {
      this.logger.error(
        "Failed to send critical error notification",
        error as Error,
        {
          errorCount: errors.length,
          userId: user.id,
        },
      );
      // Don't throw here as notification failure shouldn't break the main flow
    }
  }

  /**
   * Emit system events (for future event bus integration)
   */
  private async emitEvent(event: SystemEvent): Promise<void> {
    try {
      this.logger.debug("Emitting system event", {
        type: event.type,
        payload: event.payload,
      });

      // In the future, this could integrate with an event bus
      // For now, just log the event
    } catch (error) {
      this.logger.error("Failed to emit event", error as Error, { event });
      // Don't throw here as event emission shouldn't break the main flow
    }
  }
}
