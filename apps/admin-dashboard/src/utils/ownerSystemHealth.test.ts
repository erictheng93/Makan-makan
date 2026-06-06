import { describe, expect, it } from "vitest";
import {
  resolveOwnerSystemHealth,
  type OwnerHealthStatusPayload,
} from "./ownerSystemHealth";

const healthyPayload: OwnerHealthStatusPayload = {
  overall: "healthy",
  components: {
    api: {
      status: "healthy",
      latency: 24,
      errorRate: 0,
      lastCheck: 1,
      issues: [],
    },
    database: {
      status: "healthy",
      latency: 4,
      errorRate: 0,
      lastCheck: 1,
      issues: [],
    },
    cache: {
      status: "healthy",
      lastCheck: 1,
      issues: [],
    },
    external: {
      status: "healthy",
      lastCheck: 1,
      issues: [],
    },
  },
  uptime: 1000,
  version: "2.0.0",
  timestamp: 1,
};

describe("resolveOwnerSystemHealth", () => {
  it("uses the current monitoring health contract for API and database status", () => {
    expect(
      resolveOwnerSystemHealth({
        healthData: healthyPayload,
        tableTotal: 0,
        todayOrders: 0,
      }),
    ).toEqual({
      api: "healthy",
      database: "healthy",
      realtime: "healthy",
    });
  });

  it("keeps legacy status ok payloads compatible", () => {
    expect(
      resolveOwnerSystemHealth({
        healthData: { status: "ok" },
        tableTotal: 0,
        todayOrders: 0,
      }),
    ).toEqual({
      api: "healthy",
      database: "warning",
      realtime: "healthy",
    });
  });

  it("falls back to warning when monitoring health is unavailable", () => {
    expect(
      resolveOwnerSystemHealth({
        healthData: null,
        tableTotal: 0,
        todayOrders: 0,
      }),
    ).toEqual({
      api: "warning",
      database: "warning",
      realtime: "warning",
    });
  });
});
