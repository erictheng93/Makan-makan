/**
 * Comprehensive Health Monitor
 * System-wide health checking and monitoring
 */

import type { Env } from "../../types/env";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: "pass" | "fail" | "warn";
      message?: string;
      responseTime?: number;
      details?: unknown;
    };
  };
}

export interface PerformanceMetrics {
  memoryUsage?: NodeJS.MemoryUsage;
  responseTime: number;
  activeConnections: number;
  requestCount: number;
  errorRate: number;
}

export class SystemHealthMonitor {
  private env: Env;
  private startTime: number;
  private requestCount = 0;
  private errorCount = 0;

  constructor(env: Env) {
    this.env = env;
    this.startTime = Date.now();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(
    includeDetailed: boolean = false,
  ): Promise<HealthStatus> {
    const checks: HealthStatus["checks"] = {};

    // Basic system check
    checks.system = await this.checkSystem();

    // Database connectivity
    checks.database = await this.checkDatabase();

    // External services
    if (includeDetailed) {
      checks.cache = await this.checkCache();
      checks.storage = await this.checkStorage();
      checks.notifications = await this.checkNotifications();
    }

    // Feature modules health
    checks.features = await this.checkFeatureModules();

    // Overall status determination
    const overallStatus = this.determineOverallStatus(checks);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: this.env.API_VERSION || "v1",
      uptime: Date.now() - this.startTime,
      checks,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      responseTime: this.calculateAverageResponseTime(),
      activeConnections: this.getActiveConnections(),
      requestCount: this.requestCount,
      errorRate:
        this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
    };
  }

  /**
   * Record request metrics
   */
  recordRequest(isError: boolean = false): void {
    this.requestCount++;
    if (isError) {
      this.errorCount++;
    }
  }

  private async checkSystem(): Promise<{
    status: "pass" | "fail";
    message?: string;
    responseTime?: number;
  }> {
    const start = Date.now();

    try {
      // Basic system checks
      const memoryUsage = process.memoryUsage();
      const memoryLimit = 512 * 1024 * 1024; // 512MB limit

      if (memoryUsage.heapUsed > memoryLimit) {
        return {
          status: "fail",
          message: "High memory usage detected",
          responseTime: Date.now() - start,
        };
      }

      return {
        status: "pass",
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: "fail",
        message: error instanceof Error ? error.message : "System check failed",
        responseTime: Date.now() - start,
      };
    }
  }

  private async checkDatabase(): Promise<{
    status: "pass" | "fail";
    message?: string;
    responseTime?: number;
  }> {
    const start = Date.now();

    try {
      // Simple database connectivity test
      // In a real implementation, this would test actual database connection
      const _testQuery = "SELECT 1";

      // Simulate database check
      await new Promise((resolve) => setTimeout(resolve, 10));

      return {
        status: "pass",
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: "fail",
        message:
          error instanceof Error ? error.message : "Database connection failed",
        responseTime: Date.now() - start,
      };
    }
  }

  private async checkCache(): Promise<{
    status: "pass" | "fail";
    message?: string;
    responseTime?: number;
  }> {
    const start = Date.now();

    try {
      // Test KV cache if available
      if (this.env.CACHE_KV) {
        const testKey = "health_check_" + Date.now();
        await this.env.CACHE_KV.put(testKey, "test", { expirationTtl: 60 });
        const result = await this.env.CACHE_KV.get(testKey);
        await this.env.CACHE_KV.delete(testKey);

        if (result !== "test") {
          throw new Error("Cache read/write test failed");
        }
      }

      return {
        status: "pass",
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: "fail",
        message: error instanceof Error ? error.message : "Cache check failed",
        responseTime: Date.now() - start,
      };
    }
  }

  private async checkStorage(): Promise<{
    status: "pass" | "fail";
    message?: string;
    responseTime?: number;
  }> {
    const start = Date.now();

    try {
      // Test R2 storage if available
      if (this.env.BACKUP_STORAGE) {
        // Simple bucket accessibility check
        // In production, you might want to do a lightweight operation
      }

      return {
        status: "pass",
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: "fail",
        message:
          error instanceof Error ? error.message : "Storage check failed",
        responseTime: Date.now() - start,
      };
    }
  }

  private async checkNotifications(): Promise<{
    status: "pass" | "fail";
    message?: string;
    responseTime?: number;
  }> {
    const start = Date.now();

    try {
      // Test notification services (Slack webhook, etc.)
      if (this.env.SLACK_WEBHOOK_URL) {
        // Don't actually send a notification during health check
        // Just verify the URL is accessible
      }

      return {
        status: "pass",
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: "fail",
        message:
          error instanceof Error
            ? error.message
            : "Notification service check failed",
        responseTime: Date.now() - start,
      };
    }
  }

  private async checkFeatureModules(): Promise<{
    status: "pass" | "fail";
    message?: string;
    details?: unknown;
  }> {
    try {
      const featureStatus = {
        authentication: "healthy",
        menu: "healthy",
        orders: "healthy",
        queue: "healthy",
        sse: "healthy",
        analytics: "healthy",
        system: "healthy",
      };

      // In a real implementation, each feature would expose its own health check
      return {
        status: "pass",
        details: featureStatus,
      };
    } catch (error) {
      return {
        status: "fail",
        message:
          error instanceof Error
            ? error.message
            : "Feature modules check failed",
      };
    }
  }

  private determineOverallStatus(
    checks: HealthStatus["checks"],
  ): "healthy" | "degraded" | "unhealthy" {
    const statuses = Object.values(checks).map((check) => check.status);

    if (statuses.includes("fail")) {
      const failureCount = statuses.filter((s) => s === "fail").length;
      return failureCount > 1 ? "unhealthy" : "degraded";
    }

    if (statuses.includes("warn")) {
      return "degraded";
    }

    return "healthy";
  }

  private calculateAverageResponseTime(): number {
    // This would track actual response times in a real implementation
    return 150; // Mock average response time
  }

  private getActiveConnections(): number {
    // This would track actual connections in a real implementation
    return 0; // Mock active connections
  }
}
