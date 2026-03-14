import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscoveryService } from "../services/DiscoveryService";

function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
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
  });
});
