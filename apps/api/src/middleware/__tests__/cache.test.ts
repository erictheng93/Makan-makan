/**
 * Cache Middleware Tests
 * 快取中間件測試
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  cacheMiddleware,
  cacheInvalidationMiddleware,
  menuCache,
  restaurantCache,
  analyticsCache,
  tableCache,
  invalidateMenuCache,
  invalidateRestaurantCache,
} from "../cache";
import { mockEnv } from "../../__tests__/setup";

// Mock CacheService
vi.mock("../../features/cache/services/CacheService", () => ({
  createCacheService: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    invalidateByTags: vi.fn(),
    warmup: vi.fn(),
    getStats: vi.fn(),
    getExpiringKeys: vi.fn(),
  })),
  CACHE_STRATEGIES: {
    MENU: { ttl: 300, tags: ["menu"], priority: "high" },
    RESTAURANT: { ttl: 600, tags: ["restaurant"], priority: "normal" },
    ANALYTICS: { ttl: 900, tags: ["analytics"], priority: "low" },
    TABLE: { ttl: 60, tags: ["table"], priority: "high" },
  },
  CacheKeys: {
    menu: (id: number) => `menu:${id}`,
    restaurant: (id: number) => `restaurant:${id}`,
    analytics: (id: number, period: string) => `analytics:${id}:${period}`,
    table: (restaurantId: number, tableId: number) =>
      `table:${restaurantId}:${tableId}`,
  },
}));

import { createCacheService } from "../../features/cache/services/CacheService";

describe("Cache Middleware", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;
  let mockCacheService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      invalidateByTags: vi.fn(),
      warmup: vi.fn(),
      getStats: vi.fn(),
      getExpiringKeys: vi.fn(),
    };
    vi.mocked(createCacheService).mockReturnValue(mockCacheService);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    // Inject env into context properly
    app.use("*", async (c, next) => {
      // @ts-ignore - Inject env for testing
      c.env = mockEnv;
      await next();
    });
  });

  describe("Basic Caching", () => {
    it("should return cached response on cache hit", async () => {
      const cachedData = {
        data: { id: 1, name: "Test" },
        status: 200,
        headers: { "Content-Type": "application/json" },
        timestamp: Date.now(),
      };
      mockCacheService.get.mockResolvedValue(cachedData);

      app.use("*", cacheMiddleware());
      app.get("/test", (c) => c.json({ id: 2, name: "Fresh" }));

      const req = new Request("http://localhost/test");
      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.headers.get("X-Cache")).toBe("HIT");
    });

    it("should fetch fresh data on cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);

      app.use("*", cacheMiddleware());
      app.get("/test", (c) => c.json({ id: 1, name: "Fresh" }));

      const req = new Request("http://localhost/test");
      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);
      const result = (await res.json()) as ApiTestResponse;

      expect(res.headers.get("X-Cache")).toBe("MISS");
      expect(result.id).toBe(1);
    });

    it("should cache successful responses", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);

      app.use("*", cacheMiddleware());
      app.get("/test", (c) => c.json({ success: true, data: { id: 1 } }));

      const req = new Request("http://localhost/test");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("should not cache error responses", async () => {
      mockCacheService.get.mockResolvedValue(null);

      app.use("*", cacheMiddleware());
      app.get("/test", (c) => c.json({ error: "Not found" }, 404));

      const req = new Request("http://localhost/test");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate default cache key from request", async () => {
      mockCacheService.get.mockResolvedValue(null);

      app.use("*", cacheMiddleware());
      app.get("/api/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/api/test?page=1");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.get).toHaveBeenCalledWith(
        expect.stringContaining("route:GET:/api/test"),
      );
    });

    it("should use custom key generator", async () => {
      mockCacheService.get.mockResolvedValue(null);

      app.use(
        "*",
        cacheMiddleware({
          keyGenerator: (c) => `custom:${c.req.path}`,
        }),
      );
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      // Check that get was called with the custom key
      expect(mockCacheService.get).toHaveBeenCalledWith("custom:/test");
    });
  });

  describe("Conditional Caching", () => {
    it("should skip caching when condition returns false", async () => {
      app.use(
        "*",
        cacheMiddleware({
          condition: (c) => c.req.method === "GET",
        }),
      );
      app.post("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", { method: "POST" });
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.get).not.toHaveBeenCalled();
    });

    it("should cache when condition returns true", async () => {
      mockCacheService.get.mockResolvedValue(null);

      app.use(
        "*",
        cacheMiddleware({
          condition: (c) => c.req.method === "GET",
        }),
      );
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.get).toHaveBeenCalled();
    });
  });

  describe("Cache Strategies", () => {
    it("should use specified strategy", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);

      app.use("*", cacheMiddleware({ strategy: "MENU" }));
      app.get("/test", (c) => c.json({ success: true, data: {} }));

      const req = new Request("http://localhost/test");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ ttl: 300, tags: ["menu"] }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle cache get errors gracefully", async () => {
      mockCacheService.get.mockRejectedValue(new Error("Cache error"));

      app.use("*", cacheMiddleware({ skipOnError: true }));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      expect(res.status).toBe(200);
    });

    it("should return 500 on cache error when skipOnError is false", async () => {
      mockCacheService.get.mockRejectedValue(new Error("Cache error"));

      app.use("*", cacheMiddleware({ skipOnError: false }));
      app.get("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test");
      const res = await app.request(req, {
        env: mockEnv,
      } as ApiTestRequestInit);

      // Hono returns 500 response instead of throwing
      expect(res.status).toBe(500);
    });
  });
});

describe("Cache Invalidation Middleware", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;
  let mockCacheService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      invalidateByTags: vi.fn().mockResolvedValue(5),
    };
    vi.mocked(createCacheService).mockReturnValue(mockCacheService);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    // Inject env into context properly
    app.use("*", async (c, next) => {
      // @ts-ignore - Inject env for testing
      c.env = mockEnv;
      await next();
    });
  });

  it("should invalidate cache on successful POST", async () => {
    app.use("*", cacheInvalidationMiddleware(["menu", "restaurant"]));
    app.post("/test", (c) => c.json({ success: true }));

    const req = new Request("http://localhost/test", { method: "POST" });
    const res = await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    expect(mockCacheService.invalidateByTags).toHaveBeenCalledWith([
      "menu",
      "restaurant",
    ]);
    expect(res.headers.get("X-Cache-Invalidated")).toBe("5");
  });

  it("should invalidate cache on successful PUT", async () => {
    app.use("*", cacheInvalidationMiddleware(["menu"]));
    app.put("/test", (c) => c.json({ success: true }));

    const req = new Request("http://localhost/test", { method: "PUT" });
    await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    expect(mockCacheService.invalidateByTags).toHaveBeenCalled();
  });

  it("should invalidate cache on successful DELETE", async () => {
    app.use("*", cacheInvalidationMiddleware(["menu"]));
    app.delete("/test", (c) => c.json({ success: true }));

    const req = new Request("http://localhost/test", { method: "DELETE" });
    await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    expect(mockCacheService.invalidateByTags).toHaveBeenCalled();
  });

  it("should not invalidate on GET requests", async () => {
    app.use("*", cacheInvalidationMiddleware(["menu"]));
    app.get("/test", (c) => c.json({ success: true }));

    const req = new Request("http://localhost/test");
    await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    expect(mockCacheService.invalidateByTags).not.toHaveBeenCalled();
  });

  it("should not invalidate on failed requests", async () => {
    app.use("*", cacheInvalidationMiddleware(["menu"]));
    app.post("/test", (c) => c.json({ error: "Failed" }, 400));

    const req = new Request("http://localhost/test", { method: "POST" });
    await app.request(req, { env: mockEnv } as ApiTestRequestInit);

    expect(mockCacheService.invalidateByTags).not.toHaveBeenCalled();
  });
});

describe("Cache Decorators", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;
  let mockCacheService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      invalidateByTags: vi.fn().mockResolvedValue(1),
    };
    vi.mocked(createCacheService).mockReturnValue(mockCacheService);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    // Inject env into context properly
    app.use("*", async (c, next) => {
      // @ts-ignore - Inject env for testing
      c.env = mockEnv;
      await next();
    });
  });

  describe("menuCache", () => {
    it("should cache menu requests", async () => {
      app.use("/restaurants/:restaurantId/menu", menuCache());
      app.get("/restaurants/:restaurantId/menu", (c) =>
        c.json({ success: true, data: {} }),
      );

      const req = new Request("http://localhost/restaurants/1/menu");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.get).toHaveBeenCalled();
    });

    it("should only cache GET requests", async () => {
      app.use("/restaurants/:restaurantId/menu", menuCache());
      app.post("/restaurants/:restaurantId/menu", (c) =>
        c.json({ success: true }),
      );

      const req = new Request("http://localhost/restaurants/1/menu", {
        method: "POST",
      });
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.get).not.toHaveBeenCalled();
    });
  });

  describe("restaurantCache", () => {
    it("should cache restaurant requests", async () => {
      app.use("/restaurants/:id", restaurantCache());
      app.get("/restaurants/:id", (c) => c.json({ success: true, data: {} }));

      const req = new Request("http://localhost/restaurants/1");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.get).toHaveBeenCalled();
    });
  });

  describe("analyticsCache", () => {
    it("should cache analytics requests", async () => {
      app.use("/restaurants/:restaurantId/analytics", analyticsCache("daily"));
      app.get("/restaurants/:restaurantId/analytics", (c) =>
        c.json({ success: true, data: {} }),
      );

      const req = new Request("http://localhost/restaurants/1/analytics");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.get).toHaveBeenCalled();
    });
  });

  describe("tableCache", () => {
    it("should cache table requests", async () => {
      app.use("/restaurants/:restaurantId/tables/:tableId", tableCache());
      app.get("/restaurants/:restaurantId/tables/:tableId", (c) =>
        c.json({ success: true, data: {} }),
      );

      const req = new Request("http://localhost/restaurants/1/tables/5");
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.get).toHaveBeenCalled();
    });
  });

  describe("Invalidation Decorators", () => {
    it("invalidateMenuCache should invalidate menu tags", async () => {
      app.use("*", invalidateMenuCache);
      app.post("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", { method: "POST" });
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.invalidateByTags).toHaveBeenCalledWith(["menu"]);
    });

    it("invalidateRestaurantCache should invalidate restaurant tags", async () => {
      app.use("*", invalidateRestaurantCache);
      app.post("/test", (c) => c.json({ success: true }));

      const req = new Request("http://localhost/test", { method: "POST" });
      await app.request(req, { env: mockEnv } as ApiTestRequestInit);

      expect(mockCacheService.invalidateByTags).toHaveBeenCalledWith([
        "restaurant",
      ]);
    });
  });
});
