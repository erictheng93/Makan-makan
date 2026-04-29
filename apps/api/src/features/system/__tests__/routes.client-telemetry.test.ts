import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const { mockCreateErrorReport } = vi.hoisted(() => ({
  mockCreateErrorReport: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 7,
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    });
    await next();
  }),
  requireRole: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../services/SystemService", () => ({
  SystemService: vi.fn(function () {
    return {
      createErrorReport: mockCreateErrorReport,
    };
  }),
}));

import systemRoutes from "../routes";

function createMockKV() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
  };
}

function buildApp(kv = createMockKV()) {
  const app = new Hono<any>();
  app.route("/system", systemRoutes);
  return { app, kv };
}

describe("System loose client telemetry routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateErrorReport.mockResolvedValue({
      success: true,
      data: {
        total_errors: 1,
        significant_errors: 1,
      },
    });
  });

  it("stores client performance telemetry payloads", async () => {
    const { app, kv } = buildApp();
    const payload = {
      report_id: "perf-1",
      timestamp: 1777392000000,
      url: "https://example.test/menu",
      webVitals: { lcp: 1200 },
    };

    const response = await app.request(
      "/system/performance",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Vitest",
        },
        body: JSON.stringify(payload),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        reportId: "perf-1",
        stored: true,
        restaurantId: "rest-1",
      },
    });
    expect(kv.put).toHaveBeenCalledWith(
      "system:performance:rest-1:7:perf-1",
      expect.stringContaining('"url":"https://example.test/menu"'),
      { expirationTtl: 2592000 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "system:performance:rest-1:7:latest",
      expect.stringContaining('"userAgent":"Vitest"'),
      { expirationTtl: 2592000 },
    );
  });

  it("normalizes loose client tracker errors into system error reports", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/system/errors",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Vitest",
        },
        body: JSON.stringify({
          id: "err-1",
          name: "AuthError",
          message: "Session expired",
          category: "authentication",
          severity: "high",
          timestamp: 1777392000000,
          context: {
            user: { id: "customer-1" },
            extra: { restaurantId: "rest-2" },
          },
        }),
      },
      { DB: {}, CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockCreateErrorReport).toHaveBeenCalledWith(
      {
        errors: [
          expect.objectContaining({
            type: "permission",
            severity: "high",
            message: "Session expired",
            timestamp: "2026-04-28T16:00:00.000Z",
            userAgent: "Vitest",
            userId: "customer-1",
            restaurantId: "rest-2",
          }),
        ],
      },
      7,
      "rest-1",
      "Vitest",
    );
  });
});
