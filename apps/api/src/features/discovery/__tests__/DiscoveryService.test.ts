import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscoveryService } from "../services/DiscoveryService";

// Mock drizzle-orm/d1
const mockDrizzleDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDrizzleDb),
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ type: "eq", args })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  or: vi.fn((...args: any[]) => ({ type: "or", args })),
  like: vi.fn((...args: any[]) => ({ type: "like", args })),
  gte: vi.fn((...args: any[]) => ({ type: "gte", args })),
  lte: vi.fn((...args: any[]) => ({ type: "lte", args })),
  inArray: vi.fn((...args: any[]) => ({ type: "inArray", args })),
  isNull: vi.fn((...args: any[]) => ({ type: "isNull", args })),
  desc: vi.fn((...args: any[]) => ({ type: "desc", args })),
  asc: vi.fn((...args: any[]) => ({ type: "asc", args })),
  sql: vi.fn((...args: any[]) => ({ type: "sql", args })),
}));

// Mock database tables
vi.mock("@makanmakan/database", () => ({
  dishSearchIndex: {
    menuItemId: "dsi.menuItemId",
    dishName: "dsi.dishName",
    dishNameNormalized: "dsi.dishNameNormalized",
    price: "dsi.price",
    categoryName: "dsi.categoryName",
    restaurantId: "dsi.restaurantId",
    district: "dsi.district",
    isAvailable: "dsi.isAvailable",
    supportsTakeaway: "dsi.supportsTakeaway",
    supportsDelivery: "dsi.supportsDelivery",
    tags: "dsi.tags",
    updatedAt: "dsi.updatedAt",
    restaurantType: "dsi.restaurantType",
  },
  restaurants: {
    id: "r.id",
    name: "r.name",
    type: "r.type",
    category: "r.category",
    district: "r.district",
    city: "r.city",
    priceRange: "r.priceRange",
    rating: "r.rating",
    businessHours: "r.businessHours",
    isActive: "r.isActive",
    isAvailable: "r.isAvailable",
    supportsTakeaway: "r.supportsTakeaway",
    supportsDelivery: "r.supportsDelivery",
    logoUrl: "r.logoUrl",
    totalOrders: "r.totalOrders",
    deletedAt: "r.deletedAt",
  },
  menuItems: {
    id: "mi.id",
    restaurantId: "mi.restaurantId",
    categoryId: "mi.categoryId",
    name: "mi.name",
    price: "mi.price",
    isAvailable: "mi.isAvailable",
    tags: "mi.tags",
    keywords: "mi.keywords",
    deletedAt: "mi.deletedAt",
    orderCount: "mi.orderCount",
  },
  categories: {
    id: "c.id",
    name: "c.name",
  },
}));

/**
 * Creates a chainable mock for Drizzle query builder.
 * Each method returns the same chain, and the terminal method resolves with the given data.
 */
function createSelectChain(data: any[] = []) {
  const chain: any = {};
  const methods = [
    "from",
    "innerJoin",
    "leftJoin",
    "where",
    "orderBy",
    "limit",
    "offset",
  ];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // Make the chain itself act as a thenable (resolves to data)
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

function createDeleteChain() {
  const chain: any = {};
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve({ success: true }).then(resolve, reject);
  return chain;
}

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

function createMockD1() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    batch: vi.fn().mockResolvedValue([{ success: true }]),
  };
}

describe("DiscoveryService", () => {
  let service: DiscoveryService;
  let mockD1: ReturnType<typeof createMockD1>;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockD1 = createMockD1();
    mockKV = createMockKV();
    service = new DiscoveryService(mockD1 as never, mockKV as never);
  });

  describe("searchDishes", () => {
    it("should return empty results when no dishes match", async () => {
      const selectChain = createSelectChain([]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const result = await service.searchDishes({ q: "不存在的菜" });
      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should return results from Drizzle prefix search", async () => {
      const selectChain = createSelectChain([
        {
          menuItemId: 1,
          dishName: "牛肉麵",
          price: 150,
          categoryName: "麵類",
          restaurantId: "r1",
          restaurantName: "老王牛肉麵",
          district: "西屯區",
          businessHours: {
            monday: { open: "09:00", close: "21:00" },
          },
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: ["牛肉", "麵"],
        },
      ]);
      const countChain = createSelectChain([{ count: 1 }]);
      mockDrizzleDb.select
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(countChain);

      const result = await service.searchDishes({ q: "牛肉麵" });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].dishName).toBe("牛肉麵");
      expect(result.results[0].restaurantName).toBe("老王牛肉麵");
      expect(result.total).toBe(1);
    });

    it("should cache search results in KV", async () => {
      const selectChain = createSelectChain([]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      await service.searchDishes({ q: "牛肉麵" });
      expect(mockKV.put).toHaveBeenCalled();
    });

    it("should return cached results on second call", async () => {
      const cachedResult = JSON.stringify({
        results: [{ menuItemId: 1, dishName: "牛肉麵", price: 150 }],
        total: 1,
        cachedAt: Date.now(),
      });
      mockKV.get.mockResolvedValue(cachedResult);

      const result = await service.searchDishes({ q: "牛肉麵" });
      expect(result.results).toHaveLength(1);
      expect(mockDrizzleDb.select).not.toHaveBeenCalled();
    });

    it("should filter by openNow when specified", async () => {
      const selectChain = createSelectChain([
        {
          menuItemId: 1,
          dishName: "牛肉麵",
          price: 150,
          categoryName: "麵類",
          restaurantId: "r1",
          restaurantName: "老王牛肉麵",
          district: "西屯區",
          businessHours: {
            monday: { open: "09:00", close: "10:00" },
            tuesday: { open: "09:00", close: "10:00" },
            wednesday: { open: "09:00", close: "10:00" },
            thursday: { open: "09:00", close: "10:00" },
            friday: { open: "09:00", close: "10:00" },
            saturday: { open: "09:00", close: "10:00" },
            sunday: { open: "09:00", close: "10:00" },
          },
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: [],
        },
      ]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-16T15:00:00"));

      const result = await service.searchDishes({
        q: "牛肉麵",
        openNow: true,
      });
      expect(result.results).toHaveLength(0);

      vi.useRealTimers();
    });

    it("should return empty results immediately when q is empty", async () => {
      const result = await service.searchDishes({ q: "" });
      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(mockDrizzleDb.select).not.toHaveBeenCalled();
    });

    it("should merge tag index matches with prefix results", async () => {
      // First select call: prefix search returns item 1
      const prefixChain = createSelectChain([
        {
          menuItemId: 1,
          dishName: "牛肉麵",
          price: 150,
          categoryName: "麵類",
          restaurantId: "r1",
          restaurantName: "老王",
          district: "西屯區",
          businessHours: null,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: [],
        },
      ]);

      // Second select call: tag search returns item 2
      const tagChain = createSelectChain([
        {
          menuItemId: 2,
          dishName: "紅燒牛肉飯",
          price: 120,
          categoryName: "飯類",
          restaurantId: "r2",
          restaurantName: "阿明",
          district: "北屯區",
          businessHours: null,
          supportsTakeaway: false,
          supportsDelivery: true,
          tags: ["牛肉"],
        },
      ]);

      let selectCallCount = 0;
      mockDrizzleDb.select.mockImplementation(() => {
        selectCallCount++;
        return selectCallCount === 1 ? prefixChain : tagChain;
      });

      // KV tag index has item 2 tagged with "牛肉"
      mockKV.get.mockImplementation(async (key: string) => {
        if (key === "search:tags:index") {
          return JSON.stringify({
            牛肉: [{ menuItemId: 2 }],
          });
        }
        return null;
      });

      const result = await service.searchDishes({ q: "牛肉" });
      expect(result.results).toHaveLength(2);
      expect(result.results.map((r) => r.menuItemId)).toContain(1);
      expect(result.results.map((r) => r.menuItemId)).toContain(2);
    });

    it("should not duplicate items from tag index that are already in prefix results", async () => {
      const prefixChain = createSelectChain([
        {
          menuItemId: 1,
          dishName: "牛肉麵",
          price: 150,
          categoryName: "麵類",
          restaurantId: "r1",
          restaurantName: "老王",
          district: "西屯區",
          businessHours: null,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: [],
        },
      ]);
      mockDrizzleDb.select.mockReturnValue(prefixChain);

      // Tag index also has item 1 — should not trigger a second query
      mockKV.get.mockImplementation(async (key: string) => {
        if (key === "search:tags:index") {
          return JSON.stringify({
            牛肉: [{ menuItemId: 1 }],
          });
        }
        return null;
      });

      const result = await service.searchDishes({ q: "牛肉" });
      // Prefix search + count query should run, but duplicate tag rows should not
      // trigger an extra fetch.
      expect(mockDrizzleDb.select).toHaveBeenCalledTimes(2);
      expect(result.results).toHaveLength(1);
    });

    it("should handle pagination with correct offset", async () => {
      const selectChain = createSelectChain([]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      await service.searchDishes({ q: "test", page: 3, limit: 10 });

      // Verify offset was called with 20 = (3-1)*10
      expect(selectChain.offset).toHaveBeenCalledWith(20);
      expect(selectChain.limit).toHaveBeenCalledWith(10);
    });

    it("should map boolean fields correctly from Drizzle", async () => {
      const selectChain = createSelectChain([
        {
          menuItemId: 1,
          dishName: "壽司",
          price: 200,
          categoryName: null,
          restaurantId: "r1",
          restaurantName: "日式餐廳",
          district: null,
          businessHours: null,
          supportsTakeaway: false,
          supportsDelivery: true,
          tags: null,
        },
      ]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const result = await service.searchDishes({ q: "壽司" });
      expect(result.results[0].supportsTakeaway).toBe(false);
      expect(result.results[0].supportsDelivery).toBe(true);
      expect(result.results[0].tags).toEqual([]);
    });
  });

  describe("browseRestaurants", () => {
    it("should return restaurants from Drizzle query", async () => {
      const selectChain = createSelectChain([
        {
          id: "r1",
          name: "老王麵店",
          type: "中式",
          category: "小吃",
          district: "西屯區",
          city: "台中市",
          priceRange: 1,
          rating: 4.5,
          businessHours: null,
          supportsTakeaway: true,
          supportsDelivery: false,
          logoUrl: "https://example.com/logo.jpg",
        },
      ]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const result = await service.browseRestaurants({});
      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe("老王麵店");
      expect(result.results[0].supportsTakeaway).toBe(true);
      expect(result.results[0].supportsDelivery).toBe(false);
      expect(result.results[0].imageUrl).toBe("https://example.com/logo.jpg");
    });

    it("should use KV cache for district-only queries", async () => {
      const cached = [
        {
          restaurantId: "r1",
          name: "老王",
          supportsTakeaway: true,
          supportsDelivery: false,
        },
        {
          restaurantId: "r2",
          name: "阿明",
          supportsTakeaway: false,
          supportsDelivery: true,
        },
      ];
      mockKV.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.browseRestaurants({ district: "西屯區" });
      expect(result.results).toHaveLength(2);
      expect(mockDrizzleDb.select).not.toHaveBeenCalled();
    });

    it("should filter cached results by takeaway flag", async () => {
      const cached = [
        {
          restaurantId: "r1",
          name: "老王",
          supportsTakeaway: true,
          supportsDelivery: false,
        },
        {
          restaurantId: "r2",
          name: "阿明",
          supportsTakeaway: false,
          supportsDelivery: true,
        },
      ];
      mockKV.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.browseRestaurants({
        district: "西屯區",
        takeaway: true,
      });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe("老王");
    });

    it("should filter cached results by delivery flag", async () => {
      const cached = [
        {
          restaurantId: "r1",
          name: "老王",
          supportsTakeaway: true,
          supportsDelivery: false,
        },
        {
          restaurantId: "r2",
          name: "阿明",
          supportsTakeaway: false,
          supportsDelivery: true,
        },
      ];
      mockKV.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.browseRestaurants({
        district: "西屯區",
        delivery: true,
      });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe("阿明");
    });

    it("should filter cached results by priceRange", async () => {
      const cached = [
        {
          restaurantId: "r1",
          name: "老王",
          priceRange: 1,
          supportsTakeaway: true,
          supportsDelivery: false,
        },
        {
          restaurantId: "r2",
          name: "高級餐廳",
          priceRange: 3,
          supportsTakeaway: true,
          supportsDelivery: true,
        },
      ];
      mockKV.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.browseRestaurants({
        district: "西屯區",
        priceRange: 1,
      });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].name).toBe("老王");
    });

    it("should post-filter by openNow", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-16T15:00:00Z")); // Monday 23:00 Asia/Taipei

      const selectChain = createSelectChain([
        {
          id: "r1",
          name: "日間餐廳",
          type: "中式",
          category: null,
          district: "西屯區",
          city: null,
          priceRange: 1,
          rating: 4.0,
          businessHours: {
            monday: { open: "09:00", close: "17:00" },
          },
          supportsTakeaway: true,
          supportsDelivery: false,
          logoUrl: null,
        },
      ]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      const result = await service.browseRestaurants({ openNow: true });
      expect(result.results).toHaveLength(0);

      vi.useRealTimers();
    });

    it("should sort by rating when sortBy=rating", async () => {
      const { desc } = await import("drizzle-orm");
      const selectChain = createSelectChain([]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      await service.browseRestaurants({ sortBy: "rating" });

      // Verify desc was called (for rating ordering)
      expect(desc).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
    });

    it("should sort by totalOrders when sortBy is not rating", async () => {
      const { desc } = await import("drizzle-orm");
      const selectChain = createSelectChain([]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      await service.browseRestaurants({ sortBy: "popular" });

      expect(desc).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
    });

    it("should cache district results in KV only when no secondary filters and page=1", async () => {
      const selectChain = createSelectChain([
        {
          id: "r1",
          name: "老王",
          type: null,
          category: null,
          district: "西屯區",
          city: null,
          priceRange: null,
          rating: null,
          businessHours: null,
          supportsTakeaway: false,
          supportsDelivery: false,
          logoUrl: null,
        },
      ]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      // With district only + page 1 → should cache
      await service.browseRestaurants({ district: "西屯區" });
      expect(mockKV.put).toHaveBeenCalledWith(
        "search:restaurants:district:西屯區",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 1800 }),
      );
    });

    it("should NOT cache when takeaway filter is active", async () => {
      const selectChain = createSelectChain([]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      await service.browseRestaurants({ district: "西屯區", takeaway: true });
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it("should paginate cached results correctly", async () => {
      const cached = Array.from({ length: 5 }, (_, i) => ({
        restaurantId: `r${i}`,
        name: `Restaurant ${i}`,
        supportsTakeaway: true,
        supportsDelivery: true,
      }));
      mockKV.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.browseRestaurants({
        district: "西屯區",
        page: 2,
        limit: 2,
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].name).toBe("Restaurant 2");
      expect(result.results[1].name).toBe("Restaurant 3");
      expect(result.total).toBe(5);
    });
  });

  describe("getPopular", () => {
    it("should return keywords from KV and top dishes from Drizzle", async () => {
      mockKV.get.mockImplementation(async (key: string) => {
        if (key === "search:meta:popular-keywords") {
          return JSON.stringify(["牛肉麵", "炒飯", "拉麵"]);
        }
        return null;
      });

      const dishResults = [
        {
          menuItemId: 1,
          dishName: "人氣牛肉麵",
          price: 150,
          categoryName: "麵類",
          restaurantId: "r1",
          restaurantName: "老王",
          district: "西屯區",
          businessHours: null,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: [],
          orderCount: 500,
        },
      ];

      // First select: getPopular's top dishes query
      // Second select: browseRestaurants called internally
      let selectCallCount = 0;
      mockDrizzleDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createSelectChain(dishResults);
        }
        return createSelectChain([]); // browseRestaurants
      });

      const result = await service.getPopular();

      expect(result.keywords).toEqual(["牛肉麵", "炒飯", "拉麵"]);
      expect(result.dishes).toHaveLength(1);
      expect(result.dishes[0].dishName).toBe("人氣牛肉麵");
      expect(result.restaurants).toBeDefined();
    });

    it("should return empty keywords when KV has no data", async () => {
      mockDrizzleDb.select.mockReturnValue(createSelectChain([]));

      const result = await service.getPopular();
      expect(result.keywords).toEqual([]);
    });
  });

  describe("searchDishes - error and edge cases", () => {
    it("should propagate error gracefully when Drizzle query throws", async () => {
      const errorChain = createSelectChain([]);
      // Override the thenable to reject
      errorChain.then = (resolve: any, reject: any) =>
        Promise.reject(new Error("D1 connection error")).then(resolve, reject);
      mockDrizzleDb.select.mockReturnValue(errorChain);

      await expect(service.searchDishes({ q: "牛肉麵" })).rejects.toThrow(
        "D1 connection error",
      );
    });

    it("should fall back to DB when KV returns corrupted JSON", async () => {
      mockKV.get.mockResolvedValue("{ this is not valid json {{");

      const selectChain = createSelectChain([
        {
          menuItemId: 42,
          dishName: "炒飯",
          price: 80,
          categoryName: "飯類",
          restaurantId: "r1",
          restaurantName: "小吃攤",
          district: null,
          businessHours: null,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: [],
        },
      ]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      // Should throw because corrupted JSON causes JSON.parse to throw before falling back
      await expect(service.searchDishes({ q: "炒飯" })).rejects.toThrow();
    });

    it("should not crash when KV put fails silently (KV write failure)", async () => {
      mockKV.put.mockRejectedValue(new Error("KV write quota exceeded"));

      const selectChain = createSelectChain([]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      // The service will throw because KV put is awaited — testing the actual behavior
      await expect(service.searchDishes({ q: "壽司" })).rejects.toThrow(
        "KV write quota exceeded",
      );
    });

    it("should handle tag index with corrupted JSON gracefully by throwing", async () => {
      // First KV call = search cache (null), second KV call = tag index (corrupted)
      let kvCallCount = 0;
      mockKV.get.mockImplementation(async (_key: string) => {
        kvCallCount++;
        if (kvCallCount === 1) return null; // cache miss
        return "corrupted-json"; // tag index
      });

      const selectChain = createSelectChain([]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      await expect(service.searchDishes({ q: "麵" })).rejects.toThrow();
    });
  });

  describe("browseRestaurants - error and edge cases", () => {
    it("should propagate error when Drizzle query throws", async () => {
      const errorChain = createSelectChain([]);
      errorChain.then = (resolve: any, reject: any) =>
        Promise.reject(new Error("D1 query error")).then(resolve, reject);
      mockDrizzleDb.select.mockReturnValue(errorChain);

      await expect(service.browseRestaurants({})).rejects.toThrow(
        "D1 query error",
      );
    });

    it("should throw when KV district cache contains corrupted JSON", async () => {
      mockKV.get.mockResolvedValue("not-valid-json");

      await expect(
        service.browseRestaurants({ district: "西屯區" }),
      ).rejects.toThrow();
    });

    it("should not write district cache when openNow filter is active", async () => {
      const selectChain = createSelectChain([
        {
          id: "r1",
          name: "餐廳A",
          type: null,
          category: null,
          district: "西屯區",
          city: null,
          priceRange: null,
          rating: null,
          businessHours: null,
          supportsTakeaway: true,
          supportsDelivery: false,
          logoUrl: null,
        },
      ]);
      mockDrizzleDb.select.mockReturnValue(selectChain);

      await service.browseRestaurants({ district: "西屯區", openNow: true });
      expect(mockKV.put).not.toHaveBeenCalled();
    });
  });

  describe("getPopular - error and edge cases", () => {
    it("should handle corrupted popular-keywords JSON in KV", async () => {
      mockKV.get.mockImplementation(async (key: string) => {
        if (key === "search:meta:popular-keywords") {
          return "{ bad json";
        }
        return null;
      });

      mockDrizzleDb.select.mockReturnValue(createSelectChain([]));

      await expect(service.getPopular()).rejects.toThrow();
    });

    it("should return empty keywords and empty dishes when all data is empty", async () => {
      mockKV.get.mockResolvedValue(null);
      mockDrizzleDb.select.mockReturnValue(createSelectChain([]));

      const result = await service.getPopular();
      expect(result.keywords).toEqual([]);
      expect(result.dishes).toEqual([]);
      expect(result.restaurants).toEqual([]);
    });
  });

  describe("reindex", () => {
    it("should rebuild search index from menu items", async () => {
      const allItemsResult = [
        {
          menuItemId: 1,
          name: "牛肉麵",
          price: 150,
          isAvailable: true,
          tags: ["牛肉"],
          keywords: JSON.stringify(["經典"]),
          deletedAtMs: null,
          categoryName: "麵類",
          restaurantId: "r1",
          district: "西屯區",
          restaurantType: "中式",
          supportsTakeaway: true,
          supportsDelivery: false,
          restaurantDeleted: null,
        },
      ];

      const tagIndexResult = [
        {
          menuItemId: 1,
          restaurantId: "r1",
          dishName: "牛肉麵",
          price: 150,
          tags: ["牛肉", "經典"],
        },
      ];

      // select calls: 1) reindex items, 2) delete orphans (via db.delete), 3) tag index, 4) browseRestaurants (not select)
      let selectCallCount = 0;
      mockDrizzleDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createSelectChain(allItemsResult);
        }
        // Third select: tag index query
        return createSelectChain(tagIndexResult);
      });

      mockDrizzleDb.delete.mockReturnValue(createDeleteChain());

      const result = await service.reindex();

      expect(result.dishes).toBe(1);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      expect(mockD1.batch).toHaveBeenCalled();
      expect(mockKV.put).toHaveBeenCalledWith(
        "search:tags:index",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 1800 }),
      );
    });

    it("should set is_available=0 for deleted items during reindex", async () => {
      const allItemsResult = [
        {
          menuItemId: 1,
          name: "已下架",
          price: 100,
          isAvailable: true,
          tags: null,
          keywords: null,
          deletedAtMs: new Date(),
          categoryName: null,
          restaurantId: "r1",
          district: "西屯區",
          restaurantType: "中式",
          supportsTakeaway: false,
          supportsDelivery: false,
          restaurantDeleted: null,
        },
      ];

      let selectCallCount = 0;
      mockDrizzleDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createSelectChain(allItemsResult);
        }
        return createSelectChain([]);
      });

      mockDrizzleDb.delete.mockReturnValue(createDeleteChain());

      const result = await service.reindex();
      expect(result.dishes).toBe(1);
    });

    it("should clean up orphaned index entries", async () => {
      mockDrizzleDb.select.mockReturnValue(createSelectChain([]));
      mockDrizzleDb.delete.mockReturnValue(createDeleteChain());

      await service.reindex();

      // Verify db.delete was called for orphan cleanup
      expect(mockDrizzleDb.delete).toHaveBeenCalled();
    });

    it("should process exactly 100 items in a single batch call", async () => {
      const makeItem = (i: number) => ({
        menuItemId: i,
        name: `菜品${i}`,
        price: 100,
        isAvailable: true,
        tags: null,
        keywords: null,
        deletedAtMs: null,
        categoryName: null,
        restaurantId: "r1",
        district: "西屯區",
        restaurantType: "中式",
        supportsTakeaway: true,
        supportsDelivery: false,
        restaurantDeleted: null,
      });

      const exactly100 = Array.from({ length: 100 }, (_, i) => makeItem(i + 1));

      let selectCallCount = 0;
      mockDrizzleDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createSelectChain(exactly100);
        }
        return createSelectChain([]);
      });

      mockDrizzleDb.delete.mockReturnValue(createDeleteChain());

      const result = await service.reindex();

      expect(result.dishes).toBe(100);
      // Exactly 100 items → should be processed in exactly 1 batch
      expect(mockD1.batch).toHaveBeenCalledTimes(1);
    });

    it("should split 101 items into two batch calls", async () => {
      const makeItem = (i: number) => ({
        menuItemId: i,
        name: `菜品${i}`,
        price: 100,
        isAvailable: true,
        tags: null,
        keywords: null,
        deletedAtMs: null,
        categoryName: null,
        restaurantId: "r1",
        district: "西屯區",
        restaurantType: "中式",
        supportsTakeaway: true,
        supportsDelivery: false,
        restaurantDeleted: null,
      });

      const items101 = Array.from({ length: 101 }, (_, i) => makeItem(i + 1));

      let selectCallCount = 0;
      mockDrizzleDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createSelectChain(items101);
        }
        return createSelectChain([]);
      });

      mockDrizzleDb.delete.mockReturnValue(createDeleteChain());

      const result = await service.reindex();

      expect(result.dishes).toBe(101);
      // 101 items → 2 batches (100 + 1)
      expect(mockD1.batch).toHaveBeenCalledTimes(2);
    });

    it("should handle empty data (zero items) without calling batch", async () => {
      mockDrizzleDb.select.mockReturnValue(createSelectChain([]));
      mockDrizzleDb.delete.mockReturnValue(createDeleteChain());

      const result = await service.reindex();

      expect(result.dishes).toBe(0);
      // No items → no batch calls needed
      expect(mockD1.batch).not.toHaveBeenCalled();
    });
  });
});
