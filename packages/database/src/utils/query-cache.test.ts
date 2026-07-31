import { describe, it, expect, vi, beforeEach } from "vitest";
import type { KVNamespace } from "@cloudflare/workers-types";
import { QueryCache, buildCacheKey } from "./query-cache";

/**
 * In-memory KV double that records every write, so the tests can assert not
 * just what a read returns but that reads perform NO writes at all — the root
 * cause of #82 was a kv.put() issued on every cache hit.
 */
function createMockKv() {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (key: string, _opts?: unknown) => {
      const raw = store.get(key);
      return raw === undefined ? null : JSON.parse(raw);
    }),
    put: vi.fn(async (key: string, value: string, _opts?: unknown) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  return { kv: kv as unknown as KVNamespace, store, spies: kv };
}

describe("QueryCache", () => {
  let mock: ReturnType<typeof createMockKv>;
  let cache: QueryCache;

  beforeEach(() => {
    mock = createMockKv();
    cache = new QueryCache(mock.kv);
  });

  it("executes and caches on miss, serves from cache on hit", async () => {
    const queryFn = vi.fn(async () => ({ menu: "v1" }));

    const first = await cache.getOrExecute("query:menu:1", queryFn, {
      ttl: 300,
      tags: ["menu:1"],
    });
    const second = await cache.getOrExecute("query:menu:1", queryFn, {
      ttl: 300,
      tags: ["menu:1"],
    });

    expect(first).toEqual({ menu: "v1" });
    expect(second).toEqual({ menu: "v1" });
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it("does not write to KV on a cache hit (#82)", async () => {
    await cache.getOrExecute("query:menu:1", async () => "menu-v1", {
      ttl: 300,
      tags: ["menu:1"],
    });

    const writesAfterFill = mock.spies.put.mock.calls.length;

    // Several hits in a row — a read must stay a read. The old
    // incrementHitCount() fired an un-awaited put() here, which could land
    // after an invalidation and resurrect the deleted entry.
    await cache.getOrExecute("query:menu:1", async () => "never", { ttl: 300 });
    await cache.getOrExecute("query:menu:1", async () => "never", { ttl: 300 });
    await cache.getOrExecute("query:menu:1", async () => "never", { ttl: 300 });

    expect(mock.spies.put.mock.calls.length).toBe(writesAfterFill);
  });

  it("misses after tag invalidation even when a hit was served just before (#82)", async () => {
    const staleFn = vi.fn(async () => "stale-menu");
    const freshFn = vi.fn(async () => "fresh-menu");

    await cache.getOrExecute("query:menu:1", staleFn, {
      ttl: 300,
      tags: ["menu:1"],
    });
    // A hit right before the invalidation — the #82 race window.
    await expect(
      cache.getOrExecute("query:menu:1", async () => "never", { ttl: 300 }),
    ).resolves.toBe("stale-menu");

    await cache.invalidate(["menu:1"], "tag");

    const afterInvalidate = await cache.getOrExecute("query:menu:1", freshFn, {
      ttl: 300,
      tags: ["menu:1"],
    });

    expect(afterInvalidate).toBe("fresh-menu");
    expect(freshFn).toHaveBeenCalledOnce();
    expect(mock.spies.delete).toHaveBeenCalledWith("query:menu:1");
  });

  it("treats an expired entry as a miss", async () => {
    vi.useFakeTimers();
    try {
      await cache.getOrExecute("query:menu:1", async () => "old", { ttl: 60 });

      vi.advanceTimersByTime(61_000);

      const result = await cache.getOrExecute(
        "query:menu:1",
        async () => "new",
        { ttl: 60 },
      );
      expect(result).toBe("new");
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to the query function when KV is unavailable", async () => {
    const noKv = new QueryCache(undefined);
    await expect(
      noKv.getOrExecute("query:menu:1", async () => "direct", { ttl: 300 }),
    ).resolves.toBe("direct");
  });

  it("builds namespaced cache keys", () => {
    expect(buildCacheKey("menu", 7)).toBe("query:menu:7");
    expect(buildCacheKey("menu", "7", "full")).toBe("query:menu:7:full");
  });
});
