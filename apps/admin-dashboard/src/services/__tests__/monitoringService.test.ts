/**
 * Monitoring Service Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiDelete = vi.hoisted(() => vi.fn());
const mockApiPut = vi.hoisted(() => vi.fn());

vi.mock("@/services/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    delete: mockApiDelete,
    put: mockApiPut,
  },
}));

import MonitoringService from "../monitoringService";
import type { SystemMetrics } from "@/types/monitoring";

describe("MonitoringService", () => {
  let service: MonitoringService;

  beforeEach(() => {
    service = new MonitoringService();
    vi.clearAllMocks();
  });

  describe("getHealthStatus", () => {
    it("should fetch and return health status", async () => {
      const health = { overall: "healthy", components: {} };
      mockApiGet.mockResolvedValue({ data: { data: health } });

      const result = await service.getHealthStatus();

      expect(mockApiGet).toHaveBeenCalledWith("/monitoring/health");
      expect(result).toEqual(health);
    });

    it("should throw on error", async () => {
      mockApiGet.mockRejectedValue(new Error("down"));
      await expect(service.getHealthStatus()).rejects.toThrow("down");
    });
  });

  describe("getOverview", () => {
    it("should fetch monitoring overview", async () => {
      const overview = { health: "healthy", activeAlerts: 0 };
      mockApiGet.mockResolvedValue({ data: { data: overview } });

      const result = await service.getOverview();

      expect(mockApiGet).toHaveBeenCalledWith("/monitoring/overview");
      expect(result).toEqual(overview);
    });
  });

  describe("getMetrics", () => {
    it("should fetch metrics with params", async () => {
      const metrics = { apiMetrics: {}, databaseMetrics: {} };
      mockApiGet.mockResolvedValue({ data: { data: metrics } });

      const params = { period: "1h" };
      const result = await service.getMetrics(params as never);

      expect(mockApiGet).toHaveBeenCalledWith("/monitoring/metrics", params);
      expect(result).toEqual(metrics);
    });
  });

  describe("resetMetrics", () => {
    it("should call DELETE on metrics endpoint", async () => {
      const response = { message: "Reset", timestamp: Date.now() };
      mockApiDelete.mockResolvedValue({ data: { data: response } });

      const result = await service.resetMetrics();

      expect(mockApiDelete).toHaveBeenCalledWith("/monitoring/metrics");
      expect(result).toEqual(response);
    });
  });

  describe("Alert Rules", () => {
    it("should get alert rules with pagination", async () => {
      const rulesResponse = { rules: [], total: 0 };
      mockApiGet.mockResolvedValue({ data: { data: rulesResponse } });

      const result = await service.getAlertRules({ page: 2, limit: 10 });

      expect(mockApiGet).toHaveBeenCalledWith("/monitoring/alerts/rules", {
        page: 2,
        limit: 10,
      });
      expect(result).toEqual(rulesResponse);
    });

    it("should create alert rule", async () => {
      const rule = { id: "r1", name: "CPU Alert" };
      mockApiPost.mockResolvedValue({ data: { data: rule } });

      const request = { name: "CPU Alert", metric: "cpu", threshold: 90 };
      const result = await service.createAlertRule(request as never);

      expect(mockApiPost).toHaveBeenCalledWith(
        "/monitoring/alerts/rules",
        request,
      );
      expect(result).toEqual(rule);
    });

    it("should update alert rule", async () => {
      const response = { id: "r1", updated: Date.now() };
      mockApiPut.mockResolvedValue({ data: { data: response } });

      const result = await service.updateAlertRule("r1", {
        name: "Updated",
      } as never);

      expect(mockApiPut).toHaveBeenCalledWith("/monitoring/alerts/rules/r1", {
        name: "Updated",
      });
      expect(result).toEqual(response);
    });

    it("should delete alert rule", async () => {
      const response = { message: "Deleted" };
      mockApiDelete.mockResolvedValue({ data: { data: response } });

      const result = await service.deleteAlertRule("r1");

      expect(mockApiDelete).toHaveBeenCalledWith("/monitoring/alerts/rules/r1");
      expect(result).toEqual(response);
    });
  });

  describe("testAlert", () => {
    it("should POST test alert", async () => {
      const response = {
        message: "Test sent",
        type: "cpu",
        severity: "warning",
        timestamp: Date.now(),
      };
      mockApiPost.mockResolvedValue({ data: { data: response } });

      const request = { type: "cpu", severity: "warning" };
      const result = await service.testAlert(request as never);

      expect(mockApiPost).toHaveBeenCalledWith(
        "/monitoring/alerts/test",
        request,
      );
      expect(result).toEqual(response);
    });
  });

  describe("recordError", () => {
    it("should POST error record", async () => {
      const response = { message: "Error", timestamp: Date.now() };
      mockApiPost.mockResolvedValue({ data: { data: response } });

      const error = { message: "Something failed", source: "frontend" };
      const result = await service.recordError(error as never);

      expect(mockApiPost).toHaveBeenCalledWith("/monitoring/errors", error);
      expect(result).toEqual(response);
    });
  });

  describe("getPerformanceReport", () => {
    it("should fetch report with default params", async () => {
      const report = { summary: {} };
      mockApiGet.mockResolvedValue({ data: { data: report } });

      const result = await service.getPerformanceReport();

      expect(mockApiGet).toHaveBeenCalledWith(
        "/monitoring/reports/performance",
        { days: 7 },
      );
      expect(result).toEqual(report);
    });
  });

  describe("getRecentAlerts", () => {
    it("should fetch recent alerts", async () => {
      const alerts = [{ id: "a1" }];
      mockApiGet.mockResolvedValue({
        data: { data: { alerts, timestamp: Date.now() } },
      });

      const result = await service.getRecentAlerts();

      expect(mockApiGet).toHaveBeenCalledWith("/monitoring/alerts/recent", {});
      expect(result).toEqual(alerts);
    });

    it("should pass since param", async () => {
      mockApiGet.mockResolvedValue({
        data: { data: { alerts: [], timestamp: Date.now() } },
      });

      await service.getRecentAlerts(1000);

      expect(mockApiGet).toHaveBeenCalledWith("/monitoring/alerts/recent", {
        since: "1000",
      });
    });

    it("should return empty array on error", async () => {
      mockApiGet.mockRejectedValue(new Error("fail"));

      const result = await service.getRecentAlerts();
      expect(result).toEqual([]);
    });
  });

  describe("Utility Methods", () => {
    describe("isComponentHealthy", () => {
      it("should return true for healthy", () => {
        expect(service.isComponentHealthy("healthy")).toBe(true);
      });

      it("should return false for critical", () => {
        expect(service.isComponentHealthy("critical")).toBe(false);
      });
    });

    describe("getHealthStatusColor", () => {
      it("should return green for healthy", () => {
        expect(service.getHealthStatusColor("healthy")).toBe("green");
      });

      it("should return red for critical", () => {
        expect(service.getHealthStatusColor("critical")).toBe("red");
      });
    });

    describe("getAlertSeverityColor", () => {
      it("should return blue for info", () => {
        expect(service.getAlertSeverityColor("info")).toBe("blue");
      });

      it("should return purple for fatal", () => {
        expect(service.getAlertSeverityColor("fatal")).toBe("purple");
      });
    });

    describe("formatUptime", () => {
      it("should format days and hours", () => {
        expect(service.formatUptime(90000)).toBe("1天 1小時");
      });

      it("should format hours and minutes", () => {
        expect(service.formatUptime(3660)).toBe("1小時 1分鐘");
      });

      it("should format minutes only", () => {
        expect(service.formatUptime(300)).toBe("5分鐘");
      });
    });

    describe("formatRelativeTime", () => {
      it("should return just now for recent", () => {
        expect(service.formatRelativeTime(Date.now() - 30000)).toBe("剛才");
      });

      it("should return minutes ago", () => {
        expect(service.formatRelativeTime(Date.now() - 300000)).toBe("5分鐘前");
      });
    });

    describe("calculateHealthScore", () => {
      it("should return 100 for perfect metrics", () => {
        const metrics = {
          apiMetrics: { averageResponseTime: 50, errorRate: 0 },
          databaseMetrics: { averageQueryTime: 10 },
          cacheMetrics: { hitRate: 0.95 },
          errorMetrics: { criticalErrors: 0 },
        } as SystemMetrics;

        expect(service.calculateHealthScore(metrics)).toBe(100);
      });

      it("should deduct points for slow API", () => {
        const metrics = {
          apiMetrics: { averageResponseTime: 1500, errorRate: 0 },
          databaseMetrics: { averageQueryTime: 10 },
          cacheMetrics: { hitRate: 0.95 },
          errorMetrics: { criticalErrors: 0 },
        } as SystemMetrics;

        expect(service.calculateHealthScore(metrics)).toBe(70);
      });

      it("should deduct for multiple issues", () => {
        const metrics = {
          apiMetrics: { averageResponseTime: 1500, errorRate: 0.2 },
          databaseMetrics: { averageQueryTime: 600 },
          cacheMetrics: { hitRate: 0.2 },
          errorMetrics: { criticalErrors: 3 },
        } as SystemMetrics;

        const score = service.calculateHealthScore(metrics);
        expect(score).toBeLessThan(30);
        expect(score).toBeGreaterThanOrEqual(0);
      });
    });

    describe("checkThresholds", () => {
      it("should return empty array for healthy metrics", () => {
        const metrics = {
          apiMetrics: { averageResponseTime: 50, errorRate: 0 },
          databaseMetrics: { averageQueryTime: 10 },
          cacheMetrics: { hitRate: 0.95 },
          errorMetrics: { criticalErrors: 0 },
        } as SystemMetrics;

        expect(service.checkThresholds(metrics)).toEqual([]);
      });

      it("should detect violations", () => {
        const metrics = {
          apiMetrics: { averageResponseTime: 2000, errorRate: 0.15 },
          databaseMetrics: { averageQueryTime: 10 },
          cacheMetrics: { hitRate: 0.1 },
          errorMetrics: { criticalErrors: 2 },
        } as SystemMetrics;

        const violations = service.checkThresholds(metrics);
        expect(violations.length).toBe(4);
      });
    });
  });
});
