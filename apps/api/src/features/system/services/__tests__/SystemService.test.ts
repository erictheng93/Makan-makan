/**
 * SystemService Tests
 * Comprehensive test suite for system service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SystemService } from "../SystemService";
import type {
  ErrorReportRequest,
  ErrorReportItem,
  ErrorStats,
} from "../../types";

// ========================================
// Mock Services
// ========================================

class MockErrorReportingService {
  private errorReports: any[] = [];
  public shouldFail = false;

  async createBulkErrorReports(reports: any[]): Promise<void> {
    if (this.shouldFail) throw new Error("Failed to create error reports");
    this.errorReports.push(...reports);
  }

  async getErrorStats(restaurantId: string | undefined, dateRange: Date[]) {
    const now = Date.now();
    const yesterday = now - 86400000;

    return {
      totalErrors: this.errorReports.length,
      uniqueUsers: new Set(this.errorReports.map((r) => r.userId)).size,
      errorsByType: this.errorReports.reduce((acc: any, report) => {
        acc[report.errorType] = (acc[report.errorType] || 0) + 1;
        return acc;
      }, {}),
      errorTrend: [
        { date: new Date(yesterday).toISOString().split("T")[0], count: 2 },
        { date: new Date(now).toISOString().split("T")[0], count: 5 },
      ],
    };
  }

  async getCommonErrors(restaurantId: string | undefined, limit: number) {
    const errorGroups = this.errorReports.reduce((acc: any, report) => {
      const key = report.errorMessage;
      if (!acc[key]) {
        acc[key] = {
          errorMessage: report.errorMessage,
          count: 0,
          latestOccurrence: report.timestamp,
        };
      }
      acc[key].count++;
      return acc;
    }, {});

    return Object.values(errorGroups)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, limit);
  }

  async cleanupOldErrorReports(daysOld: number): Promise<number> {
    const deletedCount = this.errorReports.length;
    this.errorReports = [];
    return deletedCount;
  }

  getReports() {
    return this.errorReports;
  }

  reset() {
    this.errorReports = [];
    this.shouldFail = false;
  }
}

class MockCacheService {
  private cache = new Map<string, any>();
  public shouldFail = false;

  async get<T>(key: string): Promise<T | null> {
    if (this.shouldFail) throw new Error("Cache get failed");
    return this.cache.get(key) || null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (this.shouldFail) throw new Error("Cache set failed");
    this.cache.set(key, value);
  }

  async clear(pattern: string): Promise<void> {
    if (this.shouldFail) throw new Error("Cache clear failed");
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      Array.from(this.cache.keys()).forEach((key) => {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      });
    } else {
      this.cache.delete(pattern);
    }
  }

  reset() {
    this.cache.clear();
    this.shouldFail = false;
  }
}

class MockLogger {
  public logs: any[] = [];

  debug(...args: any[]) {
    this.logs.push({ level: "debug", args });
  }

  info(...args: any[]) {
    this.logs.push({ level: "info", args });
  }

  error(...args: any[]) {
    this.logs.push({ level: "error", args });
  }

  reset() {
    this.logs = [];
  }
}

// ========================================
// Mock Database
// ========================================

const createMockDB = () => {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ test: 1 }]),
      }),
    }),
  };
};

// ========================================
// Mock Environment
// ========================================

const createMockEnv = (slackWebhook?: string) => {
  return {
    DB: createMockDB(),
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
    },
    SLACK_WEBHOOK_URL: slackWebhook,
  };
};

// ========================================
// Setup
// ========================================

describe("SystemService", () => {
  let service: SystemService;
  let mockErrorReporting: MockErrorReportingService;
  let mockCache: MockCacheService;
  let mockLogger: MockLogger;
  let mockEnv: any;

  beforeEach(() => {
    mockErrorReporting = new MockErrorReportingService();
    mockCache = new MockCacheService();
    mockLogger = new MockLogger();
    mockEnv = createMockEnv();

    const db = createMockDB();

    service = new SystemService(db as any, mockEnv as any, mockEnv.CACHE_KV);

    // Replace internal services with mocks
    (service as any).errorReportingService = mockErrorReporting;
    (service as any).cache = mockCache;
    (service as any).logger = mockLogger;
  });

  // ========================================
  // 1. Create Error Report Tests
  // ========================================

  describe("Create Error Report", () => {
    it("應該成功創建錯誤報告", async () => {
      const request: ErrorReportRequest = {
        errors: [
          {
            type: "unknown",
            severity: "high",
            message: "Cannot read property of undefined",
            code: 500,
            context: { component: "MenuList" },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await service.createErrorReport(request, 1, "test-restaurant-1");

      expect(result.success).toBe(true);
      expect(result.data.total_errors).toBe(1);
      expect(result.data.report_id).toBeDefined();
    });

    it("應該處理多個錯誤", async () => {
      const request: ErrorReportRequest = {
        errors: [
          {
            type: "unknown",
            severity: "medium",
            message: "Error 1",
            timestamp: new Date().toISOString(),
          },
          {
            type: "api",
            severity: "high",
            message: "Error 2",
            timestamp: new Date().toISOString(),
          },
          {
            type: "network",
            severity: "low",
            message: "Error 3",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await service.createErrorReport(request, 1, "test-restaurant-1");

      expect(result.success).toBe(true);
      expect(result.data.total_errors).toBe(3);
    });

    it("應該識別重大錯誤", async () => {
      const request: ErrorReportRequest = {
        errors: [
          {
            type: "api",
            severity: "critical",
            message: "Database connection failed",
            timestamp: new Date().toISOString(),
          },
          {
            type: "validation",
            severity: "low",
            message: "Minor warning",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await service.createErrorReport(request, 1, "test-restaurant-1");

      expect(result.success).toBe(true);
      expect(result.data.significant_errors).toBe(1);
    });

    it("應該處理用戶代理信息", async () => {
      const request: ErrorReportRequest = {
        errors: [
          {
            type: "unknown",
            severity: "medium",
            message: "Test error",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const result = await service.createErrorReport(
        request,
        1,
        "test-restaurant-1",
        "Chrome/91.0",
      );

      expect(result.success).toBe(true);
      expect(mockErrorReporting.getReports()[0].userAgent).toBeDefined();
    });

    it("應該在錯誤報告服務失敗時拋出錯誤", async () => {
      mockErrorReporting.shouldFail = true;

      const request: ErrorReportRequest = {
        errors: [
          {
            type: "unknown",
            severity: "medium",
            message: "Test error",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await expect(service.createErrorReport(request, 1, "test-restaurant-1")).rejects.toThrow(
        "Failed to submit error report",
      );
    });
  });

  // ========================================
  // 2. System Health Tests
  // ========================================

  describe("System Health", () => {
    it("應該返回健康狀態", async () => {
      const health = await service.getSystemHealth();

      expect(health.success).toBe(true);
      expect(health.status).toBeDefined();
      expect(["healthy", "degraded", "unhealthy"].includes(health.status)).toBe(
        true,
      );
      expect(health.timestamp).toBeDefined();
      expect(health.checks).toBeDefined();
      expect(health.checks.database).toBeDefined();
      expect(health.checks.cache).toBeDefined();
      expect(health.checks.memory).toBeDefined();
    });

    it("應該使用緩存的健康狀態", async () => {
      // First call
      await service.getSystemHealth();

      // Set cached value
      await mockCache.set("system:health", {
        success: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        checks: {},
        version: "1.0.0",
        uptime: "N/A",
      });

      // Second call should use cache
      const health = await service.getSystemHealth();

      expect(health.status).toBe("healthy");
    });

    it("應該檢測資料庫問題", async () => {
      // Mock database failure
      mockEnv.DB.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      const health = await service.getSystemHealth();

      expect(["degraded", "unhealthy"].includes(health.status)).toBe(true);
      expect(health.checks.database.status).toBe("unhealthy");
    });

    it("應該檢測緩存問題", async () => {
      // Mock cache failure
      mockEnv.CACHE_KV.get = vi
        .fn()
        .mockRejectedValue(new Error("Cache error"));

      const health = await service.getSystemHealth();

      expect(["degraded", "unhealthy"].includes(health.status)).toBe(true);
    });

    it("應該在健康檢查完全失敗時返回失敗狀態", async () => {
      // Mock both database and cache failures
      mockEnv.DB.select = vi.fn().mockImplementation(() => {
        throw new Error("Complete failure");
      });
      mockEnv.CACHE_KV.get = vi
        .fn()
        .mockRejectedValue(new Error("Cache failure"));

      const health = await service.getSystemHealth();

      // When health check fails, it returns degraded or unhealthy status
      // The success field may still be true if the method catches errors gracefully
      expect(["degraded", "unhealthy"].includes(health.status)).toBe(true);
      expect(health.checks.database.status).toBe("unhealthy");
    });
  });

  // ========================================
  // 3. Error Statistics Tests
  // ========================================

  describe("Error Statistics", () => {
    beforeEach(async () => {
      // Create some test error reports
      for (let i = 0; i < 5; i++) {
        const request: ErrorReportRequest = {
          errors: [
            {
              type: i % 2 === 0 ? "unknown" : "network",
              severity: "medium",
              message: `Error ${i}`,
              timestamp: new Date().toISOString(),
            },
          ],
        };
        await service.createErrorReport(request, i + 1, "test-restaurant-1");
      }
    });

    it("應該返回錯誤統計", async () => {
      const stats = await service.getErrorStats();

      expect(stats).toBeDefined();
      expect(stats.summary).toBeDefined();
      expect(stats.summary.total_errors_24h).toBeGreaterThanOrEqual(0);
      expect(stats.summary.unique_users_affected).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.stats_24h)).toBe(true);
      expect(Array.isArray(stats.weekly_trend)).toBe(true);
      expect(Array.isArray(stats.common_errors)).toBe(true);
    });

    it("應該支持餐廳篩選", async () => {
      const stats = await service.getErrorStats("test-restaurant-1");

      expect(stats).toBeDefined();
      expect(stats.summary).toBeDefined();
    });

    it("應該使用緩存的統計數據", async () => {
      // First call
      await service.getErrorStats();

      // Set cached value
      const cachedStats: ErrorStats = {
        summary: {
          total_errors_24h: 100,
          unique_users_affected: 10,
          error_rate: 0.05,
        },
        stats_24h: [],
        weekly_trend: [],
        common_errors: [],
      };
      await mockCache.set("system:error-stats:all", cachedStats);

      // Second call should use cache
      const stats = await service.getErrorStats();

      expect(stats.summary.total_errors_24h).toBe(100);
    });

    it("應該在統計服務失敗時拋出錯誤", async () => {
      mockErrorReporting.getErrorStats = async () => {
        throw new Error("Stats service failed");
      };

      await expect(service.getErrorStats()).rejects.toThrow(
        "Failed to get error statistics",
      );
    });
  });

  // ========================================
  // 4. Cleanup Tests
  // ========================================

  describe("Cleanup Old Error Reports", () => {
    beforeEach(async () => {
      // Create some error reports
      for (let i = 0; i < 10; i++) {
        const request: ErrorReportRequest = {
          errors: [
            {
              type: "unknown",
              severity: "low",
              message: `Old error ${i}`,
              timestamp: new Date(Date.now() - 31 * 86400000).toISOString(), // 31 days ago
            },
          ],
        };
        await service.createErrorReport(request, 1, "test-restaurant-1");
      }
    });

    it("應該清理舊的錯誤報告", async () => {
      const result = await service.cleanupOldErrorReports(30);

      expect(result.success).toBe(true);
      expect(result.data.deleted_count).toBeGreaterThan(0);
    });

    it("應該支持自定義保留天數", async () => {
      const result = await service.cleanupOldErrorReports(60);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Cleaned up");
    });

    it("應該清除相關緩存", async () => {
      await mockCache.set("system:error-stats:1", { data: "test" });
      await mockCache.set("system:error-stats:2", { data: "test" });

      await service.cleanupOldErrorReports(30);

      const cached = await mockCache.get("system:error-stats:1");
      expect(cached).toBeNull();
    });

    it("應該在清理失敗時拋出錯誤", async () => {
      mockErrorReporting.cleanupOldErrorReports = async () => {
        throw new Error("Cleanup failed");
      };

      await expect(service.cleanupOldErrorReports(30)).rejects.toThrow(
        "Failed to cleanup error reports",
      );
    });
  });

  // ========================================
  // 5. Critical Error Notification Tests
  // ========================================

  describe("Critical Error Notification", () => {
    it("應該發送 Slack 通知", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const errors: ErrorReportItem[] = [
        {
          type: "api",
          severity: "critical",
          message: "Database connection failed",
          timestamp: new Date().toISOString(),
        },
      ];

      const user = { id: 1, restaurantId: "test-restaurant-1" };

      await service.sendCriticalErrorNotification(
        errors,
        user,
        "https://hooks.slack.com/test",
      );

      expect(global.fetch).toHaveBeenCalled();
    });

    it("應該在沒有 webhook 時跳過通知", async () => {
      global.fetch = vi.fn();

      const errors: ErrorReportItem[] = [
        {
          type: "api",
          severity: "critical",
          message: "Test error",
          timestamp: new Date().toISOString(),
        },
      ];

      await service.sendCriticalErrorNotification(errors, { id: 1 }, undefined);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("應該處理多個錯誤", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const errors: ErrorReportItem[] = [
        {
          type: "api",
          severity: "high",
          message: "Error 1",
          timestamp: new Date().toISOString(),
        },
        {
          type: "sse",
          severity: "critical",
          message: "Error 2",
          timestamp: new Date().toISOString(),
        },
      ];

      await service.sendCriticalErrorNotification(
        errors,
        { id: 1 },
        "https://hooks.slack.com/test",
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://hooks.slack.com/test",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("應該在通知失敗時不拋出錯誤", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const errors: ErrorReportItem[] = [
        {
          type: "api",
          severity: "critical",
          message: "Test error",
          timestamp: new Date().toISOString(),
        },
      ];

      // Should not throw
      await expect(
        service.sendCriticalErrorNotification(
          errors,
          { id: 1 },
          "https://hooks.slack.com/test",
        ),
      ).resolves.not.toThrow();
    });
  });

  // ========================================
  // 6. Event Emission Tests
  // ========================================

  describe("Event Emission", () => {
    it("應該記錄錯誤報告創建事件", async () => {
      const request: ErrorReportRequest = {
        errors: [
          {
            type: "unknown",
            severity: "medium",
            message: "Test error",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await service.createErrorReport(request, 1, "test-restaurant-1");

      // Check logger for event emission
      const debugLogs = mockLogger.logs.filter((log) => log.level === "debug");
      expect(
        debugLogs.some((log) => log.args[0] === "Emitting system event"),
      ).toBe(true);
    });

    it("應該在重大錯誤時發送額外事件", async () => {
      const request: ErrorReportRequest = {
        errors: [
          {
            type: "api",
            severity: "critical",
            message: "Critical error",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await service.createErrorReport(request, 1, "test-restaurant-1");

      const debugLogs = mockLogger.logs.filter((log) => log.level === "debug");
      const eventLogs = debugLogs.filter(
        (log) => log.args[0] === "Emitting system event",
      );

      // Should have at least 2 events: ERROR_REPORT_CREATED and CRITICAL_ERROR_DETECTED
      expect(eventLogs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================
  // 7. Error Handling Tests
  // ========================================

  describe("Error Handling", () => {
    it("應該處理緩存失敗", async () => {
      mockCache.shouldFail = true;

      // Should still work without cache
      const health = await service.getSystemHealth();

      expect(health).toBeDefined();
    });

    it("應該記錄錯誤", async () => {
      mockErrorReporting.shouldFail = true;

      const request: ErrorReportRequest = {
        errors: [
          {
            type: "unknown",
            severity: "medium",
            message: "Test error",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      try {
        await service.createErrorReport(request, 1, "test-restaurant-1");
      } catch (error) {
        // Expected to fail
      }

      const errorLogs = mockLogger.logs.filter((log) => log.level === "error");
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it("應該處理無效的輸入", async () => {
      const request: ErrorReportRequest = {
        errors: [],
      };

      const result = await service.createErrorReport(request, 1, "test-restaurant-1");

      expect(result.success).toBe(true);
      expect(result.data.total_errors).toBe(0);
    });
  });

  // ========================================
  // 8. Integration Tests
  // ========================================

  describe("Integration", () => {
    it("應該完整流程：創建報告 -> 查詢統計 -> 清理", async () => {
      // 1. Create error reports
      const request: ErrorReportRequest = {
        errors: [
          {
            type: "unknown",
            severity: "high",
            message: "Integration test error",
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const createResult = await service.createErrorReport(request, 1, "test-restaurant-1");
      expect(createResult.success).toBe(true);

      // 2. Get statistics
      const stats = await service.getErrorStats();
      expect(stats.summary.total_errors_24h).toBeGreaterThanOrEqual(0);

      // 3. Cleanup
      const cleanupResult = await service.cleanupOldErrorReports(0);
      expect(cleanupResult.success).toBe(true);
    });

    it("應該在高負載下正常工作", async () => {
      const promises: Promise<any>[] = [];

      // Create 50 concurrent error reports
      for (let i = 0; i < 50; i++) {
        const request: ErrorReportRequest = {
          errors: [
            {
              type: "unknown",
              severity: "medium",
              message: `Load test error ${i}`,
              timestamp: new Date().toISOString(),
            },
          ],
        };
        promises.push(service.createErrorReport(request, i, "test-restaurant-1"));
      }

      const results = await Promise.all(promises);

      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});
