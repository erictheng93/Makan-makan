import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CACHE_STRATEGIES,
  CacheKeys,
  CacheService,
  createCacheService,
} from "./CacheService";

function createKV() {
  const values = new Map<string, string>();
  const expirationTtls = new Map<string, number | undefined>();

  return {
    values,
    expirationTtls,
    kv: {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(
        async (
          key: string,
          value: string,
          options?: { expirationTtl?: number },
        ) => {
          values.set(key, value);
          expirationTtls.set(key, options?.expirationTtl);
        },
      ),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
        expirationTtls.delete(key);
      }),
      list: vi.fn(async () => ({
        keys: Array.from(values.keys()).map((name) => ({ name })),
      })),
    } as any,
  };
}

describe("CacheService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
    vi.useRealTimers();
  });

  it("stores values with metadata and reads unexpired cache hits", async () => {
    const { kv, values, expirationTtls } = createKV();
    const service = new CacheService(kv);

    await service.set("menu:restaurant-1", { items: 2 }, CACHE_STRATEGIES.MENU);
    const result = await service.get<{ items: number }>("menu:restaurant-1");

    expect(result).toEqual({ items: 2 });
    expect(
      JSON.parse(values.get("_meta:menu:restaurant-1") ?? "{}"),
    ).toMatchObject({
      key: "menu:restaurant-1",
      tags: ["menu"],
      priority: "high",
    });
    expect(expirationTtls.get("menu:restaurant-1")).toBe(300);
    await expect(service.getStats()).resolves.toMatchObject({
      totalKeys: 1,
      hitCount: 1,
      missCount: 0,
      averageHitRate: 1,
    });
  });

  it("deletes expired entries outside their stale window", async () => {
    const { kv } = createKV();
    const service = new CacheService(kv);

    await service.set(
      "analytics:restaurant-1:day",
      { total: 1 },
      {
        ...CACHE_STRATEGIES.ANALYTICS,
        ttl: 1,
      },
    );
    vi.advanceTimersByTime(40_000);

    await expect(service.get("analytics:restaurant-1:day")).resolves.toBeNull();
    expect(kv.delete).toHaveBeenCalledWith("analytics:restaurant-1:day");
    expect(kv.delete).toHaveBeenCalledWith("_meta:analytics:restaurant-1:day");
  });

  it("returns stale values within a strategy stale window", async () => {
    const { kv } = createKV();
    const service = new CacheService(kv);

    await service.set(
      "menu:restaurant-1",
      { stale: true },
      {
        ...CACHE_STRATEGIES.MENU,
        ttl: 1,
      },
    );
    vi.advanceTimersByTime(30_000);

    await expect(service.get("menu:restaurant-1")).resolves.toEqual({
      stale: true,
    });
    expect(kv.delete).not.toHaveBeenCalledWith("menu:restaurant-1");
  });

  it("invalidates and cleans cache entries through metadata", async () => {
    const { kv } = createKV();
    const service = new CacheService(kv);

    await service.set(
      "menu:restaurant-1",
      { items: [] },
      CACHE_STRATEGIES.MENU,
    );
    await service.set(
      "restaurant:restaurant-1",
      { name: "Shop" },
      CACHE_STRATEGIES.RESTAURANT,
    );

    await expect(service.invalidateByTags(["menu"])).resolves.toBe(1);
    await expect(service.get("menu:restaurant-1")).resolves.toBeNull();
    await expect(service.get("restaurant:restaurant-1")).resolves.toEqual({
      name: "Shop",
    });
  });

  it("flushes sampled hit counters into metadata", async () => {
    const { kv, values } = createKV();
    const service = new CacheService(kv);

    await service.set("session:1", { token: "abc" }, CACHE_STRATEGIES.SESSION);
    for (let i = 0; i < 3; i++) {
      await service.get("session:1");
    }

    await expect(service.flushHitCounters()).resolves.toBe(1);
    expect(JSON.parse(values.get("_meta:session:1") ?? "{}")).toMatchObject({
      hitCount: 3,
    });
  });

  it("persists sampled hit counters once the threshold is reached", async () => {
    const { kv, values } = createKV();
    const service = new CacheService(kv);

    await service.set(
      "session:2",
      { token: "sampled" },
      CACHE_STRATEGIES.SESSION,
    );
    for (let i = 0; i < 10; i++) {
      await service.get("session:2");
    }

    expect(JSON.parse(values.get("_meta:session:2") ?? "{}")).toMatchObject({
      hitCount: 10,
    });
    await expect(service.flushHitCounters()).resolves.toBe(0);
  });

  it("cleans expired keys and ignores metadata-only entries", async () => {
    const { kv, values } = createKV();
    const service = new CacheService(kv);

    await service.set("custom:expired", { stale: false }, { ttl: 1 });
    await service.set(
      "custom:fresh",
      { stale: false },
      { ttl: 600, tags: ["custom"] },
    );
    values.set("_meta:orphan", JSON.stringify({ key: "orphan" }));
    vi.advanceTimersByTime(2_000);

    await expect(service.cleanup()).resolves.toBe(1);
    expect(kv.delete).toHaveBeenCalledWith("custom:expired");
    expect(kv.delete).toHaveBeenCalledWith("_meta:custom:expired");
    expect(kv.delete).not.toHaveBeenCalledWith("_meta:orphan");
    await expect(service.get("custom:fresh")).resolves.toEqual({
      stale: false,
    });
  });

  it("returns safe fallbacks for malformed values and KV failures", async () => {
    const { kv, values } = createKV();
    const service = new CacheService(kv);
    const future = Date.now() + 60_000;

    values.set("bad-json", "{bad");
    values.set(
      "_meta:bad-json",
      JSON.stringify({
        key: "bad-json",
        createdAt: Date.now(),
        expiresAt: future,
        tags: [],
        hitCount: 0,
        size: 4,
        priority: "normal",
      }),
    );
    values.set("_cache_stats", "{bad");

    await expect(service.get("bad-json")).resolves.toBeNull();
    await expect(service.getStats()).resolves.toMatchObject({
      totalKeys: 0,
      missCount: 1,
    });

    kv.put.mockRejectedValueOnce(new Error("put unavailable"));
    await expect(
      service.set("write-fail", { ok: true }, { ttl: 30 }),
    ).rejects.toThrow("put unavailable");

    kv.delete.mockRejectedValueOnce(new Error("delete unavailable"));
    await expect(service.delete("bad-json")).resolves.toBe(false);

    kv.list.mockRejectedValueOnce(new Error("list unavailable"));
    await expect(service.invalidateByTags(["missing"])).resolves.toBe(0);
  });

  it("counts successful warmup entries when other entries fail", async () => {
    const { kv, values } = createKV();
    const service = new CacheService(kv);
    kv.put.mockImplementationOnce(async () => {
      throw new Error("warmup put failed");
    });

    await expect(
      service.warmup([
        { key: "warmup:fail", value: { ok: false }, config: { ttl: 30 } },
        { key: "warmup:ok", value: { ok: true }, config: { ttl: 30 } },
      ]),
    ).resolves.toBe(1);
    expect(values.get("warmup:ok")).toBe(JSON.stringify({ ok: true }));
    expect(console.error).toHaveBeenCalledWith(
      "Warmup failed for key warmup:fail:",
      expect.any(Error),
    );
  });

  it("reports expiring keys, warms caches, resets stats, and exposes key helpers", async () => {
    const { kv } = createKV();
    const service = new CacheService(kv);

    await expect(
      service.warmup([
        {
          key: "table:restaurant-1:1",
          value: { table: 1 },
          config: CACHE_STRATEGIES.TABLE,
        },
      ]),
    ).resolves.toBe(1);

    await expect(service.getExpiringKeys(11)).resolves.toEqual([
      { key: "table:restaurant-1:1", expiresAt: Date.now() + 600_000 },
    ]);

    await service.resetStats();
    await expect(service.getStats()).resolves.toMatchObject({
      totalKeys: 0,
      hitCount: 0,
      missCount: 0,
    });
    expect(CacheKeys.table("restaurant-1", 4)).toBe("table:restaurant-1:4");
  });

  it("returns a singleton from the factory", () => {
    const first = createCacheService(createKV().kv);
    const second = createCacheService(createKV().kv);

    expect(second).toBe(first);
  });
});
