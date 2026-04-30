import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Undo the global mock set by the database package's setup.ts
vi.unmock("../../utils/query-cache");

import { QueryCache, buildCacheKey } from "../query-cache";

function createMockKV() {
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe("QueryCache", () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let cache: QueryCache;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKV = createMockKV();
    cache = new QueryCache(mockKV);
  });

  describe("getOrExecute", () => {
    const options = { ttl: 300, tags: ["menu"] };

    it("should execute queryFn on cache miss and store result", async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);
      const queryFn = vi
        .fn()
        .mockResolvedValue([{ id: 1, name: "Nasi Lemak" }]);

      const result = await cache.getOrExecute("menu:1", queryFn, options);

      expect(result).toEqual([{ id: 1, name: "Nasi Lemak" }]);
      expect(queryFn).toHaveBeenCalledOnce();
      expect(mockKV.put).toHaveBeenCalledWith(
        "menu:1",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 300 }),
      );
    });

    it("should return cached data on cache hit without calling queryFn", async () => {
      const cachedData = {
        data: [{ id: 1 }],
        cached_at: Date.now() - 1000,
        expires_at: Date.now() + 60000,
        hit_count: 3,
      };
      mockKV.get.mockResolvedValue(cachedData);
      mockKV.put.mockResolvedValue(undefined);
      const queryFn = vi.fn();

      const result = await cache.getOrExecute("menu:1", queryFn, options);

      expect(result).toEqual([{ id: 1 }]);
      expect(queryFn).not.toHaveBeenCalled();
    });

    it("should re-execute queryFn when cache is expired", async () => {
      const expiredCache = {
        data: [{ id: 1 }],
        cached_at: Date.now() - 600000,
        expires_at: Date.now() - 1000, // expired
        hit_count: 5,
      };
      mockKV.get.mockResolvedValue(expiredCache);
      mockKV.put.mockResolvedValue(undefined);
      const queryFn = vi.fn().mockResolvedValue([{ id: 2, name: "Updated" }]);

      const result = await cache.getOrExecute("menu:1", queryFn, options);

      expect(result).toEqual([{ id: 2, name: "Updated" }]);
      expect(queryFn).toHaveBeenCalledOnce();
    });

    it("should fall through to queryFn when KV throws", async () => {
      mockKV.get.mockRejectedValue(new Error("KV unavailable"));
      const queryFn = vi.fn().mockResolvedValue("fallback-data");

      const result = await cache.getOrExecute("key", queryFn, options);

      expect(result).toBe("fallback-data");
      expect(queryFn).toHaveBeenCalledOnce();
    });

    it("should store tag mappings when tags are provided", async () => {
      mockKV.get.mockResolvedValueOnce(null); // cache miss
      mockKV.get.mockResolvedValueOnce(null); // tag mapping lookup
      mockKV.put.mockResolvedValue(undefined);
      const queryFn = vi.fn().mockResolvedValue("data");

      await cache.getOrExecute("key", queryFn, {
        ttl: 60,
        tags: ["restaurant:1"],
      });

      // Should store the cache entry + tag mapping
      expect(mockKV.put).toHaveBeenCalledTimes(2);
    });
  });

  describe("getOrExecute with undefined KV", () => {
    it("should execute queryFn directly when KV is undefined", async () => {
      const cacheNoKV = new QueryCache(undefined);
      const queryFn = vi.fn().mockResolvedValue("direct-result");

      const result = await cacheNoKV.getOrExecute("key", queryFn, {
        ttl: 60,
      });

      expect(result).toBe("direct-result");
      expect(queryFn).toHaveBeenCalledOnce();
    });
  });

  describe("invalidate", () => {
    it("should delete a single key", async () => {
      mockKV.delete.mockResolvedValue(undefined);

      await cache.invalidate("menu:1", "key");

      expect(mockKV.delete).toHaveBeenCalledWith("menu:1");
    });

    it("should delete all keys for given tags", async () => {
      mockKV.get.mockResolvedValue(["menu:1", "menu:2"]);
      mockKV.delete.mockResolvedValue(undefined);

      await cache.invalidate(["restaurant:1"], "tag");

      // Should delete tagged keys + tag mapping itself
      expect(mockKV.delete).toHaveBeenCalledWith("menu:1");
      expect(mockKV.delete).toHaveBeenCalledWith("menu:2");
      expect(mockKV.delete).toHaveBeenCalledWith("cache:tag:restaurant:1");
    });

    it("should handle no tagged keys gracefully", async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.delete.mockResolvedValue(undefined);

      await cache.invalidate("nonexistent-tag", "tag");

      // Should only try to delete the tag mapping
      expect(mockKV.delete).toHaveBeenCalledWith("cache:tag:nonexistent-tag");
    });

    it("should no-op when KV is undefined", async () => {
      const cacheNoKV = new QueryCache(undefined);
      // Should not throw
      await cacheNoKV.invalidate("key");
    });
  });

  describe("getStats", () => {
    it("should return stats from KV", async () => {
      const stats = {
        total_keys: 10,
        hit_rate: 0.85,
        popular_queries: [{ key: "menu:1", hits: 50 }],
      };
      mockKV.get.mockResolvedValue(stats);

      const result = await cache.getStats();

      expect(result).toEqual(stats);
      expect(mockKV.get).toHaveBeenCalledWith("cache:stats", {
        type: "json",
      });
    });

    it("should return defaults when KV has no stats", async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await cache.getStats();

      expect(result).toEqual({
        total_keys: 0,
        hit_rate: 0,
        popular_queries: [],
      });
    });

    it("should return defaults when KV is undefined", async () => {
      const cacheNoKV = new QueryCache(undefined);

      const result = await cacheNoKV.getStats();

      expect(result).toEqual({
        total_keys: 0,
        hit_rate: 0,
        popular_queries: [],
      });
    });
  });
});

describe("buildCacheKey", () => {
  it("should build key with resource and identifier", () => {
    expect(buildCacheKey("menu", "123")).toBe("query:menu:123");
  });

  it("should build key with numeric identifier", () => {
    expect(buildCacheKey("order", 42)).toBe("query:order:42");
  });

  it("should append suffix when provided", () => {
    expect(buildCacheKey("menu", "123", "items")).toBe("query:menu:123:items");
  });

  it("should omit suffix when not provided", () => {
    expect(buildCacheKey("menu", "123")).toBe("query:menu:123");
  });
});
