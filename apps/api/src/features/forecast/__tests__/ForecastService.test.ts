// apps/api/src/features/forecast/__tests__/ForecastService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForecastService } from "../services/ForecastService";

function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }),
    batch: vi.fn().mockResolvedValue([]),
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

describe("ForecastService", () => {
  let service: ForecastService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockKV = createMockKV();
    service = new ForecastService(mockDb as any, mockKV as any);
  });

  describe("generateForecast", () => {
    it("should return empty forecast when no historical data exists", async () => {
      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
        type: "item_level",
      });
      expect(results).toHaveLength(1);
      expect(results[0].items).toHaveLength(0);
      expect(results[0].generatedBy).toBe("statistical");
    });

    it("should calculate weighted moving average from historical orders", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 50,
                order_date: "2026-03-08",
              },
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 40,
                order_date: "2026-03-01",
              },
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 45,
                order_date: "2026-02-22",
              },
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 35,
                order_date: "2026-02-15",
              },
            ],
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
        type: "item_level",
      });

      expect(results).toHaveLength(1);
      expect(results[0].items).toHaveLength(1);
      const item = results[0].items[0];
      expect(item.menuItemId).toBe(1);
      // WMA base: 50*0.4 + 40*0.3 + 45*0.2 + 35*0.1 = 44.5
      // Trend: recentAvg=(50+40)/2=45, olderAvg=(45+35)/2=40
      //   trendPercent = ((45-40)/40)*100 = 12.5%
      //   adjusted = 44.5 * (1 + 0.125 * 0.5) = 44.5 * 1.0625 = 47.28
      //   rounded to 1 decimal = 47.3
      expect(item.predicted).toBeCloseTo(47.3, 0);
      expect(item.confidence).toBeGreaterThan(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
    });

    it("should write forecast to KV cache", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(mockKV.put).toHaveBeenCalled();
      const kvKey = mockKV.put.mock.calls[0][0];
      expect(kvKey).toContain("forecast:restaurant-1:2026-03-15");
    });
  });

  describe("getForecast", () => {
    it("should return KV cached result when available", async () => {
      const cachedData = JSON.stringify([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [
            {
              menuItemId: 1,
              menuItemName: "雞排",
              predicted: 45,
              confidence: 0.8,
              trend: "up",
              trendPercent: 5,
              historicalAvg: 42,
            },
          ],
          generatedBy: "statistical",
          metadata: {
            dataSourceDays: 28,
            model: "wma",
            weights: {},
            generatedAt: "2026-03-14T02:00:00Z",
          },
        },
      ]);
      mockKV.get.mockResolvedValue(cachedData);

      const results = await service.getForecast(
        "restaurant-1",
        "2026-03-15",
        "2026-03-15",
      );
      expect(results).toHaveLength(1);
      expect(results[0].items[0].menuItemName).toBe("雞排");
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });
  });

  describe("getAlerts", () => {
    it("should skip low_stock alert when inventoryCount is null", async () => {
      mockKV.get.mockResolvedValue(
        JSON.stringify([
          {
            date: "2026-03-15",
            type: "item_level",
            items: [
              {
                menuItemId: 1,
                menuItemName: "雞排",
                predicted: 100,
                confidence: 0.9,
                trend: "stable",
                trendPercent: 0,
                historicalAvg: 50,
              },
            ],
            generatedBy: "statistical",
            metadata: {
              dataSourceDays: 28,
              model: "wma",
              weights: {},
              generatedAt: "2026-03-14T02:00:00Z",
            },
          },
        ]),
      );

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [{ id: 1, name: "雞排", inventory_count: null }],
          }),
        }),
      });

      const alerts = await service.getAlerts("restaurant-1");
      const lowStockAlerts = alerts.filter((a) => a.type === "low_stock");
      expect(lowStockAlerts).toHaveLength(0);
    });
  });

  describe("generateForecast — partial data", () => {
    it("should re-normalize weights when only 1 week of data exists", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 30,
                order_date: "2026-03-08",
              },
            ],
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      const item = results[0].items[0];
      expect(item.predicted).toBeCloseTo(30, 0);
    });
  });

  describe("getForecast — D1 fallback", () => {
    it("should reconstruct items array from D1 dictionary format", async () => {
      mockKV.get.mockResolvedValue(null);
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            data: JSON.stringify({
              "1": { predicted: 45, confidence: 0.8, trend: "up" },
            }),
            metadata: JSON.stringify({
              dataSourceDays: 28,
              model: "wma",
              weights: {},
              generatedAt: "2026-03-14T02:00:00Z",
            }),
            generated_by: "statistical",
            expires_at_ms: Date.now() + 86400000,
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const results = await service.getForecast(
        "restaurant-1",
        "2026-03-15",
        "2026-03-15",
      );
      expect(results).toHaveLength(1);
      expect(Array.isArray(results[0].items)).toBe(true);
      expect(results[0].items[0].menuItemId).toBe(1);
      expect(results[0].items[0].predicted).toBe(45);
    });
  });
});
