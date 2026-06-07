import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KVUsageService,
  createKVUsageService,
  type KVUsageMetrics,
} from "./KVUsageService";

function createKV(initial: Record<string, KVUsageMetrics> = {}) {
  const values = new Map<string, string>(
    Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]),
  );

  return {
    values,
    kv: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(
        async (
          key: string,
          value: string,
          _options?: { expirationTtl?: number },
        ) => {
          values.set(key, value);
        },
      ),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
      list: vi.fn(async ({ prefix }: { prefix?: string } = {}) => ({
        keys: Array.from(values.keys())
          .filter((name) => (prefix ? name.startsWith(prefix) : true))
          .map((name) => ({ name })),
      })),
    } as any,
  };
}

describe("KVUsageService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
    vi.useRealTimers();
  });

  it("tracks reads, writes, deletes, key counts, and size deltas", async () => {
    const { kv, values } = createKV();
    const service = new KVUsageService(kv);

    await service.trackOperation("restaurant-1", "cache", "write", 128);
    await service.trackOperation("restaurant-1", "cache", "read");
    await service.trackOperation("restaurant-1", "cache", "delete", 32);

    const usage = JSON.parse(
      values.get("_kv_usage:restaurant-1:cache") ?? "{}",
    );
    expect(usage).toMatchObject({
      restaurantId: "restaurant-1",
      namespace: "cache",
      keyCount: 0,
      totalSizeBytes: 96,
      operationCount: { reads: 1, writes: 1, deletes: 1 },
      lastUpdated: Date.now(),
    });
  });

  it("aggregates restaurant usage across namespaces", async () => {
    const { kv } = createKV({
      "_kv_usage:restaurant-1:cache": {
        restaurantId: "restaurant-1",
        namespace: "cache",
        keyCount: 2,
        totalSizeBytes: 200,
        operationCount: { reads: 1, writes: 2, deletes: 0 },
        lastUpdated: Date.now(),
      },
      "_kv_usage:restaurant-1:backup": {
        restaurantId: "restaurant-1",
        namespace: "backup",
        keyCount: 1,
        totalSizeBytes: 100,
        operationCount: { reads: 0, writes: 1, deletes: 0 },
        lastUpdated: Date.now(),
      },
    });
    const service = new KVUsageService(kv);

    await expect(
      service.getAllUsageForRestaurant("restaurant-1"),
    ).resolves.toHaveLength(2);
  });

  it("reports warning, critical, and exceeded quota states", async () => {
    const { kv } = createKV({
      "_kv_usage:restaurant-1:cache": {
        restaurantId: "restaurant-1",
        namespace: "cache",
        keyCount: 8,
        totalSizeBytes: 80,
        operationCount: { reads: 0, writes: 8, deletes: 0 },
        lastUpdated: Date.now(),
      },
    });
    const service = new KVUsageService(kv, {
      maxKeysPerRestaurant: 10,
      maxSizeBytesPerRestaurant: 100,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    });

    await expect(service.checkQuota("restaurant-1")).resolves.toMatchObject({
      withinQuota: true,
      keyUsagePercent: 80,
      sizeUsagePercent: 80,
      status: "warning",
    });

    await service.trackOperation("restaurant-1", "cache", "write", 25);
    await service.trackOperation("restaurant-1", "cache", "write", 25);

    await expect(service.checkQuota("restaurant-1")).resolves.toMatchObject({
      withinQuota: false,
      status: "exceeded",
    });
  });

  it("builds a system overview and sorts top consumers", async () => {
    const { kv } = createKV({
      "_kv_usage:restaurant-1:cache": {
        restaurantId: "restaurant-1",
        namespace: "cache",
        keyCount: 3,
        totalSizeBytes: 300,
        operationCount: { reads: 0, writes: 3, deletes: 0 },
        lastUpdated: Date.now(),
      },
      "_kv_usage:restaurant-2:cache": {
        restaurantId: "restaurant-2",
        namespace: "cache",
        keyCount: 12,
        totalSizeBytes: 1200,
        operationCount: { reads: 0, writes: 12, deletes: 0 },
        lastUpdated: Date.now(),
      },
    });
    const service = new KVUsageService(kv, {
      maxKeysPerRestaurant: 10,
      maxSizeBytesPerRestaurant: 1000,
    });

    await expect(service.getSystemOverview()).resolves.toMatchObject({
      totalRestaurants: 2,
      totalKeys: 15,
      totalSizeBytes: 1500,
      topConsumers: [
        { restaurantId: "restaurant-2", keyCount: 12, sizeBytes: 1200 },
        { restaurantId: "restaurant-1", keyCount: 3, sizeBytes: 300 },
      ],
      quotaViolations: expect.arrayContaining([
        expect.stringContaining("restaurant-2"),
      ]),
    });
  });

  it("resets one namespace or every namespace for a restaurant", async () => {
    const { kv } = createKV();
    const service = new KVUsageService(kv);

    await service.resetUsage("restaurant-1", "cache");
    expect(kv.delete).toHaveBeenCalledWith("_kv_usage:restaurant-1:cache");

    await service.resetUsage("restaurant-1");
    expect(kv.delete).toHaveBeenCalledWith("_kv_usage:restaurant-1:ratelimit");
    expect(kv.delete).toHaveBeenCalledWith("_kv_usage:restaurant-1:backup");
    expect(kv.delete).toHaveBeenCalledWith(
      "_kv_usage:restaurant-1:token_blacklist",
    );
  });

  it("falls back safely when stored usage or overview data is invalid", async () => {
    const { kv, values } = createKV();
    values.set("_kv_usage:restaurant-1:cache", "{bad-json");
    const service = new KVUsageService(kv);

    await expect(
      service.getUsageMetrics("restaurant-1", "cache"),
    ).resolves.toBeNull();
    await expect(service.getSystemOverview()).resolves.toMatchObject({
      totalRestaurants: 0,
      totalKeys: 0,
      totalSizeBytes: 0,
    });
  });

  it("returns a singleton from the factory", () => {
    const first = createKVUsageService(createKV().kv);
    const second = createKVUsageService(createKV().kv);

    expect(second).toBe(first);
  });
});
