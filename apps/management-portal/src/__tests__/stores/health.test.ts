/**
 * Health Store Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useHealthStore } from "@/stores/health";
import type { HealthCheck } from "@/types";

vi.mock("@/services/api", () => ({
  healthApi: {
    getAllStatus: vi.fn(),
    getTenantStatus: vi.fn(),
    check: vi.fn(),
  },
}));

import { healthApi } from "@/services/api";

const mockChecks: HealthCheck[] = [
  {
    id: "h1",
    tenantId: "t1",
    status: "healthy",
    responseTimeMs: 45,
    checkedAt: "2026-03-01T00:00:00Z",
    details: {
      api: "healthy",
      database: "healthy",
      cache: "healthy",
      storage: "healthy",
    },
  },
  {
    id: "h2",
    tenantId: "t2",
    status: "degraded",
    responseTimeMs: 250,
    checkedAt: "2026-03-01T00:01:00Z",
    details: {
      api: "healthy",
      database: "degraded",
      cache: "healthy",
      storage: "healthy",
    },
  },
  {
    id: "h3",
    tenantId: "t3",
    status: "down",
    responseTimeMs: undefined,
    checkedAt: "2026-03-01T00:02:00Z",
  },
  {
    id: "h4",
    tenantId: "t4",
    status: "healthy",
    responseTimeMs: 60,
    checkedAt: "2026-03-01T00:03:00Z",
  },
];

describe("Health Store", () => {
  let store: ReturnType<typeof useHealthStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useHealthStore();
  });

  describe("initial state", () => {
    it("has empty health checks", () => {
      expect(store.healthChecks).toEqual([]);
    });

    it("has loading false", () => {
      expect(store.loading).toBe(false);
    });

    it("has null lastUpdated", () => {
      expect(store.lastUpdated).toBeNull();
    });
  });

  describe("computed properties", () => {
    beforeEach(() => {
      store.healthChecks = [...mockChecks];
    });

    it("healthyCount returns correct count", () => {
      expect(store.healthyCount).toBe(2);
    });

    it("degradedCount returns correct count", () => {
      expect(store.degradedCount).toBe(1);
    });

    it("downCount returns correct count", () => {
      expect(store.downCount).toBe(1);
    });

    it("overallStatus returns down when any is down", () => {
      expect(store.overallStatus).toBe("down");
    });

    it("overallStatus returns degraded when none is down but some degraded", () => {
      store.healthChecks = mockChecks.filter((h) => h.status !== "down");
      expect(store.overallStatus).toBe("degraded");
    });

    it("overallStatus returns healthy when all healthy", () => {
      store.healthChecks = mockChecks.filter((h) => h.status === "healthy");
      expect(store.overallStatus).toBe("healthy");
    });

    it("overallStatus returns unknown when no checks", () => {
      store.healthChecks = [];
      expect(store.overallStatus).toBe("unknown");
    });

    it("averageResponseTime calculates correctly (excludes undefined)", () => {
      // (45 + 250 + 60) / 3 = 118.33 -> 118
      expect(store.averageResponseTime).toBe(118);
    });

    it("averageResponseTime returns 0 with no checks", () => {
      store.healthChecks = [];
      expect(store.averageResponseTime).toBe(0);
    });

    it("groupedByStatus groups correctly", () => {
      const grouped = store.groupedByStatus;
      expect(grouped.healthy).toHaveLength(2);
      expect(grouped.degraded).toHaveLength(1);
      expect(grouped.down).toHaveLength(1);
      expect(grouped.unknown).toHaveLength(0);
    });
  });

  describe("fetchAllHealthChecks", () => {
    it("fetches and stores health checks", async () => {
      vi.mocked(healthApi.getAllStatus).mockResolvedValue(mockChecks);

      await store.fetchAllHealthChecks();

      expect(healthApi.getAllStatus).toHaveBeenCalled();
      expect(store.healthChecks).toEqual(mockChecks);
      expect(store.lastUpdated).toBeInstanceOf(Date);
      expect(store.loading).toBe(false);
    });

    it("sets loading during fetch", async () => {
      let resolvePromise: any;
      vi.mocked(healthApi.getAllStatus).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const fetchPromise = store.fetchAllHealthChecks();
      expect(store.loading).toBe(true);

      resolvePromise(mockChecks);
      await fetchPromise;
      expect(store.loading).toBe(false);
    });

    it("handles errors", async () => {
      vi.mocked(healthApi.getAllStatus).mockRejectedValue(new Error("fail"));

      await expect(store.fetchAllHealthChecks()).rejects.toThrow("fail");
      expect(store.loading).toBe(false);
    });
  });

  describe("checkTenantHealth", () => {
    it("updates existing check in list", async () => {
      store.healthChecks = [...mockChecks];
      const updatedCheck: HealthCheck = {
        id: "h2-new",
        tenantId: "t2",
        status: "healthy",
        responseTimeMs: 40,
        checkedAt: "2026-03-01T01:00:00Z",
      };
      vi.mocked(healthApi.check).mockResolvedValue(updatedCheck);

      const result = await store.checkTenantHealth("t2");

      expect(result).toEqual(updatedCheck);
      const t2Check = store.healthChecks.find((h) => h.tenantId === "t2");
      expect(t2Check!.status).toBe("healthy");
    });

    it("adds new check if tenant not in list", async () => {
      store.healthChecks = [];
      const newCheck: HealthCheck = {
        id: "h-new",
        tenantId: "t99",
        status: "healthy",
        responseTimeMs: 30,
        checkedAt: "2026-03-01T00:00:00Z",
      };
      vi.mocked(healthApi.check).mockResolvedValue(newCheck);

      await store.checkTenantHealth("t99");

      expect(store.healthChecks).toHaveLength(1);
      expect(store.healthChecks[0].tenantId).toBe("t99");
    });
  });

  describe("utility methods", () => {
    it("getStatusColor returns correct colors", () => {
      expect(store.getStatusColor("healthy")).toBe("green");
      expect(store.getStatusColor("degraded")).toBe("yellow");
      expect(store.getStatusColor("down")).toBe("red");
      expect(store.getStatusColor("unknown")).toBe("gray");
    });

    it("getStatusLabel returns correct labels", () => {
      expect(store.getStatusLabel("healthy")).toBe("正常");
      expect(store.getStatusLabel("degraded")).toBe("降級");
      expect(store.getStatusLabel("down")).toBe("離線");
      expect(store.getStatusLabel("unknown")).toBe("未知");
    });
  });
});
