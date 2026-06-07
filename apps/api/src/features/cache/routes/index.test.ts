import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  service: {
    cleanup: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getExpiringKeys: vi.fn(),
    getStats: vi.fn(),
    invalidateByTags: vi.fn(),
    resetStats: vi.fn(),
    set: vi.fn(),
    warmup: vi.fn(),
  },
  createCacheService: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c, next) => {
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../services/CacheService", () => ({
  CACHE_STRATEGIES: {
    MENU: {
      ttl: 300,
      tags: ["menu"],
      priority: "high",
      staleWhileRevalidate: 60,
    },
    RESTAURANT: {
      ttl: 1800,
      tags: ["restaurant"],
      priority: "normal",
      staleWhileRevalidate: 300,
    },
    SESSION: {
      ttl: 3600,
      tags: ["session", "auth"],
      priority: "high",
    },
  },
  createCacheService: mocks.createCacheService,
}));

import routes from "./index";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function request(path: string, method = "GET", body?: unknown) {
  return routes.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    { CACHE_KV: { binding: "cache" } } as never,
  );
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string; details?: unknown };
  };
}

describe("cache routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    mocks.createCacheService.mockReturnValue(mocks.service);
    mocks.service.getStats.mockResolvedValue({
      totalKeys: 12,
      hitCount: 30,
      missCount: 10,
      totalSize: 2 * 1024 * 1024,
      averageHitRate: 0.75,
      mostAccessedKeys: [{ key: "menu:1", hits: 8 }],
      expiringKeys: [],
    });
    mocks.service.getExpiringKeys.mockResolvedValue([
      { key: "menu:1", expiresAt: 1710000001000 },
      { key: "table:1:2", expiresAt: 1710000002000 },
    ]);
    mocks.service.invalidateByTags.mockResolvedValue(3);
    mocks.service.cleanup.mockResolvedValue(4);
    mocks.service.warmup.mockResolvedValue(1);
    mocks.service.resetStats.mockResolvedValue(undefined);
    mocks.service.set.mockResolvedValue(undefined);
    mocks.service.get.mockResolvedValue(null);
    mocks.service.delete.mockResolvedValue(true);
  });

  it("returns cache stats with derived fields", async () => {
    const response = await request("/stats");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      totalKeys: 12,
      expiringIn30Min: 2,
      hitRatePercentage: "75.00",
      totalSizeMB: "2.00",
      strategies: ["MENU", "RESTAURANT", "SESSION"],
      timestamp: 1710000000000,
    });
    expect(body.data?.expiringKeys).toEqual([
      { key: "menu:1", expiresAt: 1710000001000 },
      { key: "table:1:2", expiresAt: 1710000002000 },
    ]);
    expect(mocks.service.getExpiringKeys).toHaveBeenCalledWith(30);
  });

  it("reports healthy, warning, and critical cache health states", async () => {
    let response = await request("/health");
    let body = await json(response);
    expect(body.data).toMatchObject({
      status: "healthy",
      metrics: {
        hitRate: 0.75,
        totalKeys: 12,
        totalSize: 2 * 1024 * 1024,
        expiringKeysCount: 2,
      },
    });

    mocks.service.getStats.mockResolvedValueOnce({
      totalKeys: 12,
      hitCount: 4,
      missCount: 6,
      totalSize: 20 * 1024 * 1024,
      averageHitRate: 0.5,
      mostAccessedKeys: [],
      expiringKeys: [],
    });
    mocks.service.getExpiringKeys.mockResolvedValueOnce(
      Array.from({ length: 101 }, (_, index) => ({ key: `key:${index}` })),
    );
    response = await request("/health");
    body = await json(response);
    expect(body.data).toMatchObject({
      status: "warning",
    });
    expect(body.data?.issues).toContain("Low cache hit rate (< 60%)");
    expect(body.data?.issues).toContain("Many keys expiring soon (101)");

    mocks.service.getStats.mockResolvedValueOnce({
      totalKeys: 12,
      hitCount: 1,
      missCount: 9,
      totalSize: 600 * 1024 * 1024,
      averageHitRate: 0.2,
      mostAccessedKeys: [],
      expiringKeys: [],
    });
    mocks.service.getExpiringKeys.mockResolvedValueOnce([]);
    response = await request("/health");
    body = await json(response);
    expect(body.data).toMatchObject({
      status: "critical",
    });
    expect(body.data?.issues).toContain("Very low cache hit rate (< 30%)");
    expect(body.data?.issues).toContain("Large cache size detected");

    mocks.service.getStats.mockResolvedValueOnce({
      totalKeys: 12,
      hitCount: 1,
      missCount: 9,
      totalSize: 20 * 1024 * 1024,
      averageHitRate: 0.2,
      mostAccessedKeys: [],
      expiringKeys: [],
    });
    mocks.service.getExpiringKeys.mockResolvedValueOnce(
      Array.from({ length: 101 }, (_, index) => ({ key: `critical:${index}` })),
    );
    response = await request("/health");
    body = await json(response);
    expect(body.data).toMatchObject({
      status: "critical",
    });
    expect(body.data?.issues).toContain("Many keys expiring soon (101)");
  });

  it("invalidates tags and returns the audit details", async () => {
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    const response = await request("/invalidate", "POST", {
      tags: ["menu", "restaurant"],
      reason: "menu import",
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.service.invalidateByTags).toHaveBeenCalledWith([
      "menu",
      "restaurant",
    ]);
    expect(consoleLog).toHaveBeenCalledWith(
      "Manual cache invalidation: 3 keys invalidated for tags: menu, restaurant (Reason: menu import)",
    );
    expect(body.data).toEqual({
      invalidatedCount: 3,
      tags: ["menu", "restaurant"],
      reason: "menu import",
      timestamp: 1710000000000,
    });
    consoleLog.mockRestore();
  });

  it("validates invalidation payloads", async () => {
    const response = await request("/invalidate", "POST", {
      tags: [],
    });
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(mocks.service.invalidateByTags).not.toHaveBeenCalled();
  });

  it("invalidates tags without an optional reason", async () => {
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    const response = await request("/invalidate", "POST", {
      tags: ["menu"],
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(consoleLog).toHaveBeenCalledWith(
      "Manual cache invalidation: 3 keys invalidated for tags: menu",
    );
    expect(body.data).toEqual({
      invalidatedCount: 3,
      tags: ["menu"],
      timestamp: 1710000000000,
    });
    consoleLog.mockRestore();
  });

  it("supports dry-run and live cleanup", async () => {
    let response = await request("/cleanup", "POST", {
      maxAge: 600,
      dryRun: true,
    });
    let body = await json(response);

    expect(body.data).toEqual({
      dryRun: true,
      wouldCleanCount: 2,
      previewKeys: [
        { key: "menu:1", expiresAt: 1710000001000 },
        { key: "table:1:2", expiresAt: 1710000002000 },
      ],
      maxAge: 600,
      timestamp: 1710000000000,
    });
    expect(mocks.service.getExpiringKeys).toHaveBeenCalledWith(10);

    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    response = await request("/cleanup", "POST", {
      maxAge: 600,
      dryRun: false,
    });
    body = await json(response);

    expect(mocks.service.cleanup).toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalledWith(
      "Cache cleanup completed: 4 expired keys removed",
    );
    expect(body.data).toEqual({
      cleanedCount: 4,
      maxAge: 600,
      timestamp: 1710000000000,
    });
    consoleLog.mockRestore();
  });

  it("warms requested keys with configured strategies", async () => {
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    const response = await request("/warmup", "POST", {
      keys: [
        { key: "menu:1", strategy: "MENU" },
        { key: "session:1", strategy: "SESSION" },
      ],
    });
    const body = await json(response);

    expect(mocks.service.warmup).toHaveBeenCalledWith([
      {
        key: "menu:1",
        value: { prewarmed: true, timestamp: 1710000000000 },
        config: {
          ttl: 300,
          tags: ["menu"],
          priority: "high",
          staleWhileRevalidate: 60,
        },
      },
      {
        key: "session:1",
        value: { prewarmed: true, timestamp: 1710000000000 },
        config: {
          ttl: 3600,
          tags: ["session", "auth"],
          priority: "high",
        },
      },
    ]);
    expect(consoleLog).toHaveBeenCalledWith(
      "Cache warmup completed: 1/2 keys warmed",
    );
    expect(body.data).toEqual({
      requestedCount: 2,
      successCount: 1,
      failedCount: 1,
      timestamp: 1710000000000,
    });
    consoleLog.mockRestore();
  });

  it("resets stats and returns cache configuration", async () => {
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);
    let response = await request("/stats", "DELETE");
    let body = await json(response);

    expect(mocks.service.resetStats).toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalledWith("Cache statistics reset by admin");
    expect(body.data).toEqual({
      message: "Cache statistics reset successfully",
      timestamp: 1710000000000,
    });

    response = await request("/config");
    body = await json(response);
    expect(body.data).toMatchObject({
      totalStrategies: 3,
      timestamp: 1710000000000,
    });
    expect(body.data?.strategies).toContainEqual({
      name: "MENU",
      ttl: 300,
      ttlMinutes: 5,
      tags: ["menu"],
      priority: "high",
      staleWhileRevalidate: 60,
    });
    expect(body.data?.strategies).toContainEqual({
      name: "SESSION",
      ttl: 3600,
      ttlMinutes: 60,
      tags: ["session", "auth"],
      priority: "high",
      staleWhileRevalidate: undefined,
    });
    consoleLog.mockRestore();
  });

  it("runs the cache self-test endpoint", async () => {
    const expectedData = {
      message: "Cache test",
      timestamp: 1710000000000,
      randomValue: 0.25,
    };
    mocks.service.get.mockResolvedValueOnce(expectedData);

    const response = await request("/test", "POST");
    const body = await json(response);

    expect(mocks.service.set).toHaveBeenCalledWith(
      "test:1710000000000",
      expectedData,
      {
        ttl: 60,
        tags: ["test"],
        priority: "normal",
      },
    );
    expect(mocks.service.get).toHaveBeenCalledWith("test:1710000000000");
    expect(mocks.service.delete).toHaveBeenCalledWith("test:1710000000000");
    expect(body.data).toEqual({
      setSuccess: true,
      getSuccess: true,
      dataIntegrity: true,
      deleteSuccess: true,
      testKey: "test:1710000000000",
      timestamp: 1710000000000,
    });
  });

  it("reports a failed cache self-test read", async () => {
    mocks.service.get.mockResolvedValueOnce(null);

    const response = await request("/test", "POST");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      setSuccess: true,
      getSuccess: false,
      dataIntegrity: false,
      deleteSuccess: true,
      testKey: "test:1710000000000",
      timestamp: 1710000000000,
    });
  });
});
