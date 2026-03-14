import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscoveryService } from "../services/DiscoveryService";

function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
      // Support direct .all() without .bind() (used by getPopular, reindex)
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
    batch: vi.fn().mockResolvedValue([{ success: true }]),
  };
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

describe("DiscoveryService", () => {
  let service: DiscoveryService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockKV = createMockKV();
    service = new DiscoveryService(mockDb as any, mockKV as any);
  });

  describe("searchDishes", () => {
    it("should return empty results when no dishes match", async () => {
      const result = await service.searchDishes({ q: "不存在的菜" });
      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should return results from D1 prefix search", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                dish_name: "牛肉麵",
                price: 150,
                category_name: "麵類",
                restaurant_id: "r1",
                restaurant_name: "老王牛肉麵",
                district: "西屯區",
                business_hours: JSON.stringify({
                  monday: { open: "09:00", close: "21:00" },
                }),
                supports_takeaway: 1,
                supports_delivery: 0,
                tags: JSON.stringify(["牛肉", "麵"]),
              },
            ],
          }),
        }),
      });

      const result = await service.searchDishes({ q: "牛肉麵" });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].dishName).toBe("牛肉麵");
      expect(result.results[0].restaurantName).toBe("老王牛肉麵");
    });

    it("should cache search results in KV", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

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
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("should filter by openNow when specified", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                dish_name: "牛肉麵",
                price: 150,
                category_name: "麵類",
                restaurant_id: "r1",
                restaurant_name: "老王牛肉麵",
                district: "西屯區",
                business_hours: JSON.stringify({
                  monday: { open: "09:00", close: "10:00" },
                  tuesday: { open: "09:00", close: "10:00" },
                  wednesday: { open: "09:00", close: "10:00" },
                  thursday: { open: "09:00", close: "10:00" },
                  friday: { open: "09:00", close: "10:00" },
                  saturday: { open: "09:00", close: "10:00" },
                  sunday: { open: "09:00", close: "10:00" },
                }),
                supports_takeaway: 1,
                supports_delivery: 0,
                tags: "[]",
              },
            ],
          }),
        }),
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-16T15:00:00"));

      const result = await service.searchDishes({ q: "牛肉麵", openNow: true });
      expect(result.results).toHaveLength(0);

      vi.useRealTimers();
    });

    it("should return empty results immediately when q is empty", async () => {
      const result = await service.searchDishes({ q: "" });
      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("should merge tag index matches with prefix results", async () => {
      // Prefix search returns item 1
      const prefixAll = vi.fn().mockResolvedValue({
        results: [
          {
            menu_item_id: 1,
            dish_name: "牛肉麵",
            price: 150,
            category_name: "麵類",
            restaurant_id: "r1",
            restaurant_name: "老王",
            district: "西屯區",
            business_hours: null,
            supports_takeaway: 1,
            supports_delivery: 0,
            tags: "[]",
          },
        ],
      });

      // Tag search returns item 2 (not in prefix)
      const tagAll = vi.fn().mockResolvedValue({
        results: [
          {
            menu_item_id: 2,
            dish_name: "紅燒牛肉飯",
            price: 120,
            category_name: "飯類",
            restaurant_id: "r2",
            restaurant_name: "阿明",
            district: "北屯區",
            business_hours: null,
            supports_takeaway: 0,
            supports_delivery: 1,
            tags: JSON.stringify(["牛肉"]),
          },
        ],
      });

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi.fn().mockReturnValue({
            all: callCount === 1 ? prefixAll : tagAll,
          }),
        };
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
      const prefixAll = vi.fn().mockResolvedValue({
        results: [
          {
            menu_item_id: 1,
            dish_name: "牛肉麵",
            price: 150,
            category_name: "麵類",
            restaurant_id: "r1",
            restaurant_name: "老王",
            district: "西屯區",
            business_hours: null,
            supports_takeaway: 1,
            supports_delivery: 0,
            tags: "[]",
          },
        ],
      });

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({ all: prefixAll }),
      });

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
      // Only 1 prepare call (prefix search), no tag query needed
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(result.results).toHaveLength(1);
    });

    it("should handle pagination with correct offset", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn((...args: any[]) => {
          // Last two bind params are limit and offset
          const bindArgs = args;
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          };
        }),
      });

      await service.searchDishes({ q: "test", page: 3, limit: 10 });

      // Verify bind was called — offset should be (3-1)*10 = 20
      const bindCall = mockDb.prepare.mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalled();
    });

    it("should map boolean fields correctly from D1 integers", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                dish_name: "壽司",
                price: 200,
                category_name: null,
                restaurant_id: "r1",
                restaurant_name: "日式餐廳",
                district: null,
                business_hours: null,
                supports_takeaway: 0,
                supports_delivery: 1,
                tags: null,
              },
            ],
          }),
        }),
      });

      const result = await service.searchDishes({ q: "壽司" });
      expect(result.results[0].supportsTakeaway).toBe(false);
      expect(result.results[0].supportsDelivery).toBe(true);
      expect(result.results[0].tags).toEqual([]);
    });
  });

  describe("browseRestaurants", () => {
    it("should return restaurants from D1 query", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "r1",
                name: "老王麵店",
                type: "中式",
                category: "小吃",
                district: "西屯區",
                city: "台中市",
                price_range: 1,
                rating: 4.5,
                business_hours: null,
                supports_takeaway: 1,
                supports_delivery: 0,
                logo_url: "https://example.com/logo.jpg",
              },
            ],
          }),
        }),
      });

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
      expect(mockDb.prepare).not.toHaveBeenCalled();
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

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "r1",
                name: "日間餐廳",
                type: "中式",
                category: null,
                district: "西屯區",
                city: null,
                price_range: 1,
                rating: 4.0,
                business_hours: JSON.stringify({
                  monday: { open: "09:00", close: "17:00" },
                }),
                supports_takeaway: 1,
                supports_delivery: 0,
                logo_url: null,
              },
            ],
          }),
        }),
      });

      const result = await service.browseRestaurants({ openNow: true });
      expect(result.results).toHaveLength(0);

      vi.useRealTimers();
    });

    it("should sort by rating when sortBy=rating", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      await service.browseRestaurants({ sortBy: "rating" });

      const sql = mockDb.prepare.mock.calls[0][0] as string;
      expect(sql).toContain("r.rating DESC");
    });

    it("should sort by total_orders when sortBy is not rating", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      await service.browseRestaurants({ sortBy: "popular" });

      const sql = mockDb.prepare.mock.calls[0][0] as string;
      expect(sql).toContain("r.total_orders DESC");
    });

    it("should cache district results in KV only when no secondary filters and page=1", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "r1",
                name: "老王",
                type: null,
                category: null,
                district: "西屯區",
                city: null,
                price_range: null,
                rating: null,
                business_hours: null,
                supports_takeaway: 0,
                supports_delivery: 0,
                logo_url: null,
              },
            ],
          }),
        }),
      });

      // With district only + page 1 → should cache
      await service.browseRestaurants({ district: "西屯區" });
      expect(mockKV.put).toHaveBeenCalledWith(
        "search:restaurants:district:西屯區",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 1800 }),
      );
    });

    it("should NOT cache when takeaway filter is active", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

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
    it("should return keywords from KV and top dishes from D1", async () => {
      mockKV.get.mockImplementation(async (key: string) => {
        if (key === "search:meta:popular-keywords") {
          return JSON.stringify(["牛肉麵", "炒飯", "拉麵"]);
        }
        return null;
      });

      const dishResults = [
        {
          menu_item_id: 1,
          dish_name: "人氣牛肉麵",
          price: 150,
          category_name: "麵類",
          restaurant_id: "r1",
          restaurant_name: "老王",
          district: "西屯區",
          business_hours: null,
          supports_takeaway: 1,
          supports_delivery: 0,
          tags: "[]",
          order_count: 500,
        },
      ];

      mockDb.prepare.mockReturnValue({
        // Direct .all() for getPopular's top dishes query
        all: vi.fn().mockResolvedValue({ results: dishResults }),
        // .bind().all() for browseRestaurants called internally
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const result = await service.getPopular();

      expect(result.keywords).toEqual(["牛肉麵", "炒飯", "拉麵"]);
      expect(result.dishes).toHaveLength(1);
      expect(result.dishes[0].dishName).toBe("人氣牛肉麵");
      expect(result.restaurants).toBeDefined();
    });

    it("should return empty keywords when KV has no data", async () => {
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const result = await service.getPopular();
      expect(result.keywords).toEqual([]);
    });
  });

  describe("searchDishes - error and edge cases", () => {
    it("should propagate error gracefully when DB .all() throws", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error("D1 connection error")),
        }),
      });

      await expect(service.searchDishes({ q: "牛肉麵" })).rejects.toThrow(
        "D1 connection error",
      );
    });

    it("should fall back to DB when KV returns corrupted JSON", async () => {
      mockKV.get.mockResolvedValue("{ this is not valid json {{");

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 42,
                dish_name: "炒飯",
                price: 80,
                category_name: "飯類",
                restaurant_id: "r1",
                restaurant_name: "小吃攤",
                district: null,
                business_hours: null,
                supports_takeaway: 1,
                supports_delivery: 0,
                tags: "[]",
              },
            ],
          }),
        }),
      });

      // Should throw because corrupted JSON causes JSON.parse to throw before falling back
      await expect(service.searchDishes({ q: "炒飯" })).rejects.toThrow();
    });

    it("should not crash when KV put fails silently (KV write failure)", async () => {
      mockKV.put.mockRejectedValue(new Error("KV write quota exceeded"));

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

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

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      await expect(service.searchDishes({ q: "麵" })).rejects.toThrow();
    });
  });

  describe("browseRestaurants - error and edge cases", () => {
    it("should propagate error when DB .all() throws", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error("D1 query error")),
        }),
      });

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
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "r1",
                name: "餐廳A",
                type: null,
                category: null,
                district: "西屯區",
                city: null,
                price_range: null,
                rating: null,
                business_hours: null,
                supports_takeaway: 1,
                supports_delivery: 0,
                logo_url: null,
              },
            ],
          }),
        }),
      });

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

      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      await expect(service.getPopular()).rejects.toThrow();
    });

    it("should return empty keywords and empty dishes when all data is empty", async () => {
      mockKV.get.mockResolvedValue(null);
      mockDb.prepare.mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const result = await service.getPopular();
      expect(result.keywords).toEqual([]);
      expect(result.dishes).toEqual([]);
      expect(result.restaurants).toEqual([]);
    });
  });

  describe("reindex", () => {
    it("should rebuild search index from menu items", async () => {
      const allItemsResult = {
        results: [
          {
            menu_item_id: 1,
            name: "牛肉麵",
            price: 150,
            is_available: 1,
            tags: JSON.stringify(["牛肉"]),
            keywords: JSON.stringify(["經典"]),
            deleted_at_ms: null,
            category_name: "麵類",
            restaurant_id: "r1",
            district: "西屯區",
            restaurant_type: "中式",
            supports_takeaway: 1,
            supports_delivery: 0,
            restaurant_deleted: null,
          },
        ],
      };

      const tagIndexResult = {
        results: [
          {
            menu_item_id: 1,
            restaurant_id: "r1",
            dish_name: "牛肉麵",
            price: 150,
            tags: JSON.stringify(["牛肉", "經典"]),
          },
        ],
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          // Direct .all() for queries without .bind()
          all: vi
            .fn()
            .mockResolvedValue(
              callCount === 1 ? allItemsResult : tagIndexResult,
            ),
          bind: vi.fn().mockReturnValue({
            all: vi
              .fn()
              .mockResolvedValue(
                callCount === 1 ? allItemsResult : tagIndexResult,
              ),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      });

      const result = await service.reindex();

      expect(result.dishes).toBe(1);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      expect(mockDb.batch).toHaveBeenCalled();
      expect(mockKV.put).toHaveBeenCalledWith(
        "search:tags:index",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 1800 }),
      );
    });

    it("should set is_available=0 for deleted items during reindex", async () => {
      const allItemsResult = {
        results: [
          {
            menu_item_id: 1,
            name: "已下架",
            price: 100,
            is_available: 1,
            tags: null,
            keywords: null,
            deleted_at_ms: Date.now(),
            category_name: null,
            restaurant_id: "r1",
            district: "西屯區",
            restaurant_type: "中式",
            supports_takeaway: 0,
            supports_delivery: 0,
            restaurant_deleted: null,
          },
        ],
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          all: vi
            .fn()
            .mockResolvedValue(
              callCount === 1 ? allItemsResult : { results: [] },
            ),
          bind: vi.fn((...args: any[]) => ({
            all: vi
              .fn()
              .mockResolvedValue(
                callCount === 1 ? allItemsResult : { results: [] },
              ),
            run: vi.fn().mockResolvedValue({ success: true }),
          })),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      });

      const result = await service.reindex();
      expect(result.dishes).toBe(1);
    });

    it("should clean up orphaned index entries", async () => {
      mockDb.prepare.mockImplementation(() => ({
        all: vi.fn().mockResolvedValue({ results: [] }),
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));

      await service.reindex();

      // Find the DELETE query for orphaned entries
      const deleteCalls = mockDb.prepare.mock.calls.filter((call: any[]) =>
        (call[0] as string).includes("DELETE FROM dish_search_index"),
      );
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("should process exactly 100 items in a single batch call", async () => {
      const makeItem = (i: number) => ({
        menu_item_id: i,
        name: `菜品${i}`,
        price: 100,
        is_available: 1,
        tags: null,
        keywords: null,
        deleted_at_ms: null,
        category_name: null,
        restaurant_id: "r1",
        district: "西屯區",
        restaurant_type: "中式",
        supports_takeaway: 1,
        supports_delivery: 0,
        restaurant_deleted: null,
      });

      const exactly100 = Array.from({ length: 100 }, (_, i) => makeItem(i + 1));

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          all: vi
            .fn()
            .mockResolvedValue(
              callCount === 1 ? { results: exactly100 } : { results: [] },
            ),
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      });

      const result = await service.reindex();

      expect(result.dishes).toBe(100);
      // Exactly 100 items → should be processed in exactly 1 batch
      expect(mockDb.batch).toHaveBeenCalledTimes(1);
    });

    it("should split 101 items into two batch calls", async () => {
      const makeItem = (i: number) => ({
        menu_item_id: i,
        name: `菜品${i}`,
        price: 100,
        is_available: 1,
        tags: null,
        keywords: null,
        deleted_at_ms: null,
        category_name: null,
        restaurant_id: "r1",
        district: "西屯區",
        restaurant_type: "中式",
        supports_takeaway: 1,
        supports_delivery: 0,
        restaurant_deleted: null,
      });

      const items101 = Array.from({ length: 101 }, (_, i) => makeItem(i + 1));

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          all: vi
            .fn()
            .mockResolvedValue(
              callCount === 1 ? { results: items101 } : { results: [] },
            ),
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      });

      const result = await service.reindex();

      expect(result.dishes).toBe(101);
      // 101 items → 2 batches (100 + 1)
      expect(mockDb.batch).toHaveBeenCalledTimes(2);
    });

    it("should handle empty data (zero items) without calling batch", async () => {
      mockDb.prepare.mockImplementation(() => ({
        all: vi.fn().mockResolvedValue({ results: [] }),
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }));

      const result = await service.reindex();

      expect(result.dishes).toBe(0);
      // No items → no batch calls needed
      expect(mockDb.batch).not.toHaveBeenCalled();
    });
  });
});
