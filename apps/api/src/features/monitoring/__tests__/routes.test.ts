/**
 * Monitoring Routes Integration Tests
 * 測試監控 API 路由的端到端功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import monitoringRoutes from "../routes";
import type { Env } from "../../../types/env";

// Mock dependencies
vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
  }),
}));

// Mock the MonitoringService to avoid singleton issues
// Mock the MonitoringService to avoid singleton issues
vi.mock("../services/MonitoringService", async () => {
  const mockAlertRules: any[] = [];

  const mockService = {
    getHealthStatus: vi.fn().mockResolvedValue({
      overall: "healthy",
      components: {
        api: {
          status: "healthy",
          latency: 50,
          errorRate: 0,
          lastCheck: Date.now(),
          issues: [],
        },
        database: {
          status: "healthy",
          latency: 25,
          errorRate: 0,
          lastCheck: Date.now(),
          issues: [],
        },
        cache: {
          status: "healthy",
          lastCheck: Date.now(),
          issues: [],
          metrics: { hitRate: 0.9, totalKeys: 100 },
        },
        external: { status: "healthy", lastCheck: Date.now(), issues: [] },
      },
      uptime: 3600000,
      version: "2.0.0",
      timestamp: Date.now(),
    }),
    getMetrics: vi.fn().mockResolvedValue({
      timestamp: Date.now(),
      apiMetrics: {
        totalRequests: 100,
        errorRate: 0.02,
        averageResponseTime: 250,
        p95ResponseTime: 400,
        p99ResponseTime: 500,
        slowRequestCount: 2,
        requestsPerSecond: 10,
      },
      databaseMetrics: {
        queryCount: 200,
        averageQueryTime: 25,
        slowQueryCount: 1,
        connectionPoolUsage: 0.5,
        errorCount: 0,
      },
      cacheMetrics: {
        hitRate: 0.85,
        totalKeys: 100,
        totalSize: 2048,
        expiringKeysCount: 5,
        invalidationCount: 2,
      },
      resourceMetrics: {
        memoryUsage: 0.6,
        cpuUsage: 0.3,
        activeConnections: 25,
        queueLength: 0,
      },
      errorMetrics: {
        totalErrors: 1,
        criticalErrors: 0,
        warningCount: 1,
        errorsByType: {},
      },
    }),
    resetMetrics: vi.fn().mockResolvedValue(undefined),
    recordError: vi.fn().mockResolvedValue(undefined),
    getAlertRules: vi.fn().mockImplementation(async () => mockAlertRules),
    createAlertRule: vi.fn().mockImplementation(async (rule: any) => {
      const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      mockAlertRules.push({ ...rule, id, triggerCount: 0, isActive: true });
      return id;
    }),
    updateAlertRule: vi
      .fn()
      .mockImplementation(async (id: string, updates: any) => {
        const index = mockAlertRules.findIndex((r) => r.id === id);
        if (index === -1) return false;
        mockAlertRules[index] = { ...mockAlertRules[index], ...updates };
        return true;
      }),
    deleteAlertRule: vi.fn().mockImplementation(async (id: string) => {
      const index = mockAlertRules.findIndex((r) => r.id === id);
      if (index === -1) return false;
      mockAlertRules.splice(index, 1);
      return true;
    }),
  };

  return {
    createMonitoringService: vi.fn().mockReturnValue(mockService),
    MonitoringService: vi.fn(function () {
      return mockService;
    }),
    DEFAULT_ALERT_RULES: [
      {
        name: "High API Error Rate",
        condition: "apiMetrics.errorRate > 0.1",
        metric: "apiMetrics.errorRate",
        operator: ">",
        threshold: 0.1,
        duration: 300,
        config: {
          type: "slack",
          severity: "critical",
          enabled: true,
          interval: 15,
        },
      },
      {
        name: "Slow API Response Time",
        condition: "apiMetrics.averageResponseTime > 1000",
        metric: "apiMetrics.averageResponseTime",
        operator: ">",
        threshold: 1000,
        duration: 300,
        config: {
          type: "slack",
          severity: "warning",
          enabled: true,
          interval: 30,
        },
      },
    ],
  };
});

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set("user", { id: "admin_1", role: 0 });
    await next();
  }),
  requireRole: (roles: number[]) =>
    vi.fn().mockImplementation(async (c: any, next: any) => {
      const user = c.get("user");
      if (roles.includes(user?.role ?? -1)) {
        await next();
      } else {
        return c.json({ success: false, error: "Forbidden" }, 403);
      }
    }),
}));

vi.mock("../../../middleware/validation", () => ({
  validateBody: () =>
    vi.fn().mockImplementation(async (c: any, next: any) => {
      c.set("validatedBody", await c.req.json());
      await next();
    }),
  validateQuery: () =>
    vi.fn().mockImplementation(async (c: any, next: any) => {
      const url = new URL(c.req.url);
      const query: Record<string, any> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      // Set defaults
      query.period = query.period || "24h";
      query.granularity = query.granularity || "1h";
      query.page = parseInt(query.page) || 1;
      query.limit = parseInt(query.limit) || 20;
      query.days = parseInt(query.days) || 7;
      c.set("validatedQuery", query);
      await next();
    }),
}));

describe("Monitoring Routes", () => {
  let app: Hono<{ Bindings: Env }>;
  let mockEnv: Partial<Env>;
  let mockKV: any;

  beforeEach(() => {
    // Mock KV namespace
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [] }),
    };

    // Mock environment
    mockEnv = {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-key-that-is-at-least-32-chars-long",
      API_VERSION: "1.0.0",
      CACHE_KV: mockKV as any,
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
    };

    // Create app with routes
    app = new Hono<{ Bindings: Env }>();
    app.route("/monitoring", monitoringRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /monitoring/health", () => {
    it("應該返回系統健康狀態", async () => {
      const response = await app.request(
        "/monitoring/health",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data).toHaveProperty("overall");
      expect(data).toHaveProperty("components");
      expect(data).toHaveProperty("uptime");
      expect(data).toHaveProperty("version");
      expect(data).toHaveProperty("timestamp");
    });

    it("健康狀態應該包含所有核心組件", async () => {
      const response = await app.request(
        "/monitoring/health",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.components).toHaveProperty("api");
      expect(data.components).toHaveProperty("database");
      expect(data.components).toHaveProperty("cache");
      expect(data.components).toHaveProperty("external");
    });
  });

  describe("GET /monitoring/metrics", () => {
    it("應該返回系統指標（需要管理員權限）", async () => {
      const mockMetrics = {
        timestamp: Date.now(),
        apiMetrics: {
          totalRequests: 100,
          errorRate: 0.02,
          averageResponseTime: 250,
        },
      };
      mockKV.get.mockResolvedValue(JSON.stringify(mockMetrics));

      const response = await app.request(
        "/monitoring/metrics",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("timestamp");
      expect(data.data).toHaveProperty("summary");
    });

    it("應該支持時間段查詢參數", async () => {
      const response = await app.request(
        "/monitoring/metrics?period=1h&granularity=5m",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data.query).toBeDefined();
    });
  });

  describe("DELETE /monitoring/metrics", () => {
    it("應該重置系統指標", async () => {
      const response = await app.request(
        "/monitoring/metrics",
        {
          method: "DELETE",
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.message).toContain("reset");
    });
  });

  describe("POST /monitoring/errors", () => {
    it("應該手動記錄錯誤", async () => {
      const response = await app.request(
        "/monitoring/errors",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "test_error",
            message: "Test error message",
            severity: "warning",
          }),
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data.type).toBe("test_error");
      expect(data.data.severity).toBe("warning");
    });

    it("應該記錄嚴重錯誤", async () => {
      const response = await app.request(
        "/monitoring/errors",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "critical_error",
            message: "Critical system failure",
            severity: "critical",
          }),
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(201);
      const data = (await response.json()) as any;
      expect(data.data.severity).toBe("critical");
    });
  });

  describe("警報規則管理", () => {
    describe("GET /monitoring/alerts/rules", () => {
      it("應該返回警報規則列表", async () => {
        const mockRules = [
          {
            id: "alert_1",
            name: "High Error Rate",
            metric: "apiMetrics.errorRate",
            operator: ">",
            threshold: 0.1,
          },
        ];
        mockKV.get.mockResolvedValue(JSON.stringify(mockRules));

        const response = await app.request(
          "/monitoring/alerts/rules",
          {
            method: "GET",
          },
          mockEnv as Env,
        );

        expect(response.status).toBe(200);
        const data = (await response.json()) as any;
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("rules");
        expect(data.data).toHaveProperty("pagination");
      });

      it("應該支持分頁", async () => {
        const response = await app.request(
          "/monitoring/alerts/rules?page=1&limit=10",
          {
            method: "GET",
          },
          mockEnv as Env,
        );

        expect(response.status).toBe(200);
        const data = (await response.json()) as any;
        expect(data.data.pagination.page).toBe(1);
      });
    });

    describe("POST /monitoring/alerts/rules", () => {
      it("應該創建新的警報規則", async () => {
        const newRule = {
          name: "Test Alert",
          condition: "test condition",
          metric: "apiMetrics.errorRate",
          operator: ">",
          threshold: 0.05,
          duration: 300,
          config: {
            type: "slack",
            severity: "warning",
            enabled: true,
          },
        };

        const response = await app.request(
          "/monitoring/alerts/rules",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRule),
          },
          mockEnv as Env,
        );

        expect(response.status).toBe(201);
        const data = (await response.json()) as any;
        expect(data.success).toBe(true);
        expect(data.data.id).toMatch(/^alert_/);
        expect(data.data.name).toBe("Test Alert");
      });
    });

    describe("PUT /monitoring/alerts/rules/:id", () => {
      it("應該更新現有的警報規則", async () => {
        // First create a rule
        const createResponse = await app.request(
          "/monitoring/alerts/rules",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Rule to Update",
              condition: "test",
              metric: "apiMetrics.errorRate",
              operator: ">",
              threshold: 0.1,
              duration: 300,
              config: { type: "slack", severity: "warning", enabled: true },
            }),
          },
          mockEnv as Env,
        );

        const createData = (await createResponse.json()) as any;
        const ruleId = createData.data.id;

        // Now update it
        const response = await app.request(
          `/monitoring/alerts/rules/${ruleId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threshold: 0.15,
              config: { type: "slack", severity: "critical", enabled: true },
            }),
          },
          mockEnv as Env,
        );

        expect(response.status).toBe(200);
        const data = (await response.json()) as any;
        expect(data.success).toBe(true);
      });

      it("應該返回 404 當規則不存在", async () => {
        const response = await app.request(
          "/monitoring/alerts/rules/non_existent_rule_id",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threshold: 0.1 }),
          },
          mockEnv as Env,
        );

        expect(response.status).toBe(404);
      });
    });

    describe("DELETE /monitoring/alerts/rules/:id", () => {
      it("應該刪除警報規則", async () => {
        // First create a rule
        const createResponse = await app.request(
          "/monitoring/alerts/rules",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Rule to Delete",
              condition: "test",
              metric: "apiMetrics.errorRate",
              operator: ">",
              threshold: 0.1,
              duration: 300,
              config: { type: "slack", severity: "warning", enabled: true },
            }),
          },
          mockEnv as Env,
        );

        const createData = (await createResponse.json()) as any;
        const ruleId = createData.data.id;

        // Now delete it
        const response = await app.request(
          `/monitoring/alerts/rules/${ruleId}`,
          {
            method: "DELETE",
          },
          mockEnv as Env,
        );

        expect(response.status).toBe(200);
        const data = (await response.json()) as any;
        expect(data.success).toBe(true);
      });
    });
  });

  describe("GET /monitoring/alerts/defaults", () => {
    it("應該返回預設警報規則", async () => {
      const response = await app.request(
        "/monitoring/alerts/defaults",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data.rules).toBeDefined();
      expect(Array.isArray(data.data.rules)).toBe(true);
      expect(data.data.rules.length).toBeGreaterThan(0);
    });
  });

  describe("POST /monitoring/alerts/test", () => {
    it("應該發送測試警報", async () => {
      const response = await app.request(
        "/monitoring/alerts/test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "slack",
            severity: "warning",
          }),
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("sent successfully");
    });
  });

  describe("GET /monitoring/overview", () => {
    it("應該返回監控總覽", async () => {
      const response = await app.request(
        "/monitoring/overview",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("status");
      expect(data.data).toHaveProperty("uptime");
      expect(data.data).toHaveProperty("keyMetrics");
      expect(data.data).toHaveProperty("components");
    });

    it("總覽應該包含關鍵指標", async () => {
      const response = await app.request(
        "/monitoring/overview",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      const data = (await response.json()) as any;
      expect(data.data.keyMetrics).toHaveProperty("requestsPerMinute");
      expect(data.data.keyMetrics).toHaveProperty("errorRate");
      expect(data.data.keyMetrics).toHaveProperty("averageResponseTime");
      expect(data.data.keyMetrics).toHaveProperty("cacheHitRate");
    });
  });

  describe("GET /monitoring/reports/performance", () => {
    it("應該生成效能報告", async () => {
      const response = await app.request(
        "/monitoring/reports/performance?days=7",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("period");
      expect(data.data).toHaveProperty("apiPerformance");
      expect(data.data).toHaveProperty("databasePerformance");
      expect(data.data).toHaveProperty("cachePerformance");
      expect(data.data).toHaveProperty("errorAnalysis");
      expect(data.data).toHaveProperty("recommendations");
    });

    it("報告應該包含具體的效能指標", async () => {
      const response = await app.request(
        "/monitoring/reports/performance",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      const data = (await response.json()) as any;
      expect(data.data.apiPerformance).toHaveProperty("totalRequests");
      expect(data.data.apiPerformance).toHaveProperty("averageResponseTime");
      expect(data.data.apiPerformance).toHaveProperty("p95ResponseTime");
      expect(data.data.apiPerformance).toHaveProperty("p99ResponseTime");
      expect(data.data.apiPerformance).toHaveProperty("errorRate");
    });

    it("報告應該包含改善建議", async () => {
      const response = await app.request(
        "/monitoring/reports/performance",
        {
          method: "GET",
        },
        mockEnv as Env,
      );

      const data = (await response.json()) as any;
      expect(Array.isArray(data.data.recommendations)).toBe(true);
    });
  });
});
