// apps/api/src/features/forecast/__tests__/ForecastService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForecastService } from "../services/ForecastService";

// ─── Mock drizzle-orm/d1 ──────────────────────────────────────────────────

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock("@makanmakan/database", () => ({
  forecastCache: {
    restaurantId: {},
    forecastDate: {},
    forecastType: {},
    data: {},
    metadata: {},
    generatedBy: {},
    expiresAt: {},
    createdAt: {},
  },
  menuItems: {
    id: {},
    restaurantId: {},
    name: {},
    inventoryCount: {},
    isAvailable: {},
    deletedAt: {},
  },
  orders: {
    id: {},
    restaurantId: {},
    status: {},
    createdAt: {},
  },
  orderItems: {
    id: {},
    orderId: {},
    menuItemId: {},
    quantity: {},
    status: {},
  },
}));

// ─── Chain helpers ──────────────────────────────────────────────────────────

/**
 * Creates a full select chain that resolves to `returnValue`.
 * The chain supports all methods used by the service:
 * select().from().innerJoin().where().groupBy().orderBy().limit()
 * Any terminal call (no further chaining expected) resolves to returnValue.
 * For select chains we use a Promise-like approach: the chain itself is thenable.
 */
function makeSelectChain(returnValue: unknown[]) {
  const chain: any = {};
  const thenFn = (resolve: any) => resolve(returnValue);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockImplementation(() => {
    // limit() returns a thenable that resolves to returnValue
    return { then: thenFn, catch: vi.fn() };
  });
  // Make the chain itself thenable (for cases without .limit())
  chain.then = thenFn;
  chain.catch = vi.fn();
  return chain;
}

function makeInsertChain() {
  const chain: any = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  chain.then = (resolve: any) => resolve(undefined);
  chain.catch = vi.fn();
  return chain;
}

// ─── KV mock ───────────────────────────────────────────────────────────────

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

// Helper: build a forecast KV cache string for getAlerts / getForecast tests
function buildForecastCache(
  items: Array<{
    menuItemId: number;
    menuItemName: string;
    predicted: number;
    confidence: number;
    trend: string;
    trendPercent: number;
    historicalAvg: number;
  }>,
  date = "2026-03-15",
) {
  return JSON.stringify([
    {
      date,
      type: "item_level",
      items,
      generatedBy: "statistical",
      metadata: {
        dataSourceDays: 28,
        model: "wma",
        weights: {},
        generatedAt: "2026-03-14T02:00:00Z",
      },
    },
  ]);
}

describe("ForecastService", () => {
  let service: ForecastService;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKV = createMockKV();
    service = new ForecastService({} as any, mockKV as any);
  });

  // ─── generateForecast ───────────────────────────────────────────

  describe("generateForecast", () => {
    it("should return empty forecast when no historical data exists", async () => {
      // getHistoricalSales → empty, saveForecastToDb → insert
      mockDb.select.mockReturnValue(makeSelectChain([]));
      mockDb.insert.mockReturnValue(makeInsertChain());

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
      // getHistoricalSales returns 4 weeks of data
      const selectChain = makeSelectChain([
        {
          menuItemId: 1,
          itemName: "雞排",
          quantitySum: 50,
          orderDate: "2026-03-08",
        },
        {
          menuItemId: 1,
          itemName: "雞排",
          quantitySum: 40,
          orderDate: "2026-03-01",
        },
        {
          menuItemId: 1,
          itemName: "雞排",
          quantitySum: 45,
          orderDate: "2026-02-22",
        },
        {
          menuItemId: 1,
          itemName: "雞排",
          quantitySum: 35,
          orderDate: "2026-02-15",
        },
      ]);
      mockDb.select.mockReturnValue(selectChain);
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
        type: "item_level",
      });

      expect(results).toHaveLength(1);
      expect(results[0].items).toHaveLength(1);
      const item = results[0].items[0];
      expect(item.menuItemId).toBe(1);
      expect(item.predicted).toBeCloseTo(47.3, 0);
      expect(item.confidence).toBeGreaterThan(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
    });

    it("should write forecast to KV cache", async () => {
      mockDb.select.mockReturnValue(makeSelectChain([]));
      mockDb.insert.mockReturnValue(makeInsertChain());

      await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(mockKV.put).toHaveBeenCalled();
      const kvKey = mockKV.put.mock.calls[0][0];
      expect(kvKey).toContain("forecast:restaurant-1:2026-03-15");
    });

    it("should generate forecasts for multiple dates in a range", async () => {
      mockDb.select.mockReturnValue(makeSelectChain([]));
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-17",
      });

      expect(results).toHaveLength(3);
      expect(results[0].date).toBe("2026-03-15");
      expect(results[1].date).toBe("2026-03-16");
      expect(results[2].date).toBe("2026-03-17");
      // Should write KV cache for each date
      expect(mockKV.put).toHaveBeenCalledTimes(3);
    });

    it("should handle multiple menu items simultaneously", async () => {
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 50,
            orderDate: "2026-03-08",
          },
          {
            menuItemId: 2,
            itemName: "滷肉飯",
            quantitySum: 80,
            orderDate: "2026-03-08",
          },
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 45,
            orderDate: "2026-03-01",
          },
          {
            menuItemId: 2,
            itemName: "滷肉飯",
            quantitySum: 75,
            orderDate: "2026-03-01",
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(results[0].items).toHaveLength(2);
      const names = results[0].items.map((i) => i.menuItemName);
      expect(names).toContain("雞排");
      expect(names).toContain("滷肉飯");
    });

    it("should re-normalize weights when only 2 weeks of data exists", async () => {
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 60,
            orderDate: "2026-03-08",
          },
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 40,
            orderDate: "2026-03-01",
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      const item = results[0].items[0];
      expect(item.predicted).toBeGreaterThan(50);
      expect(item.confidence).toBeGreaterThan(0);
    });

    it("should re-normalize weights when only 1 week of data exists", async () => {
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 30,
            orderDate: "2026-03-08",
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      const item = results[0].items[0];
      expect(item.predicted).toBeCloseTo(30, 0);
    });

    it("should fall back to stale cache when generation fails", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // getHistoricalSales → throw error
          const chain = makeSelectChain([]);
          chain.then = (_resolve: any, reject: any) => {
            if (reject) return reject(new Error("D1 unavailable"));
            throw new Error("D1 unavailable");
          };
          chain.catch = (handler: any) => handler(new Error("D1 unavailable"));
          // Override groupBy/orderBy to still throw
          chain.groupBy = vi.fn().mockReturnValue(chain);
          chain.orderBy = vi.fn().mockReturnValue(chain);
          return chain;
        }
        // getStaleCache → return stale D1 record
        return makeSelectChain([
          {
            data: {
              "1": {
                predicted: 40,
                confidence: 0.7,
                trend: "stable",
                menuItemName: "雞排",
              },
            },
            metadata: {
              dataSourceDays: 28,
              model: "wma",
              weights: {},
              generatedAt: "2026-03-13T02:00:00Z",
            },
            generatedBy: "statistical",
          },
        ]);
      });

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(results).toHaveLength(1);
      expect(results[0].stale).toBe(true);
      expect(results[0].items[0].predicted).toBe(40);
    });

    it("should throw when generation fails and no stale cache exists", async () => {
      mockDb.select.mockImplementation(() => {
        const chain = makeSelectChain([]);
        chain.then = (_resolve: any, reject: any) => {
          if (reject) return reject(new Error("D1 unavailable"));
          throw new Error("D1 unavailable");
        };
        chain.catch = (handler: any) => handler(new Error("D1 unavailable"));
        chain.groupBy = vi.fn().mockReturnValue(chain);
        chain.orderBy = vi.fn().mockReturnValue(chain);
        // For getStaleCache (limit call)
        chain.limit = vi.fn().mockImplementation(() => {
          const limitChain: any = {};
          limitChain.then = (_resolve: any, reject: any) => {
            if (reject) return reject(new Error("D1 unavailable"));
            throw new Error("D1 unavailable");
          };
          limitChain.catch = (handler: any) =>
            handler(new Error("D1 unavailable"));
          return limitChain;
        });
        return chain;
      });

      await expect(
        service.generateForecast("restaurant-1", {
          startDate: "2026-03-15",
          endDate: "2026-03-15",
        }),
      ).rejects.toThrow("D1 unavailable");
    });

    it("should persist forecast to D1 via saveForecastToDb", async () => {
      mockDb.select.mockReturnValue(makeSelectChain([]));
      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      // Should have called insert for the forecast save
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should include metadata with model and weights info", async () => {
      mockDb.select.mockReturnValue(makeSelectChain([]));
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(results[0].metadata).toEqual(
        expect.objectContaining({
          dataSourceDays: 28,
          model: "weighted_moving_average",
          weights: { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 },
        }),
      );
      expect(results[0].metadata.generatedAt).toBeDefined();
    });

    it("should detect upward trend when recent sales exceed older sales", async () => {
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 100,
            orderDate: "2026-03-08",
          },
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 90,
            orderDate: "2026-03-01",
          },
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 30,
            orderDate: "2026-02-22",
          },
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 20,
            orderDate: "2026-02-15",
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      const item = results[0].items[0];
      expect(item.trend).toBe("up");
      expect(item.trendPercent).toBeGreaterThan(5);
    });

    it("should detect downward trend when recent sales are lower", async () => {
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 20,
            orderDate: "2026-03-08",
          },
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 25,
            orderDate: "2026-03-01",
          },
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 80,
            orderDate: "2026-02-22",
          },
          {
            menuItemId: 1,
            itemName: "雞排",
            quantitySum: 90,
            orderDate: "2026-02-15",
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      const item = results[0].items[0];
      expect(item.trend).toBe("down");
      expect(item.trendPercent).toBeLessThan(-5);
    });
  });

  // ─── getForecast ────────────────────────────────────────────────

  describe("getForecast", () => {
    it("should return KV cached result when available", async () => {
      const cachedData = buildForecastCache([
        {
          menuItemId: 1,
          menuItemName: "雞排",
          predicted: 45,
          confidence: 0.8,
          trend: "up",
          trendPercent: 5,
          historicalAvg: 42,
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
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("should reconstruct items array from D1 dictionary format", async () => {
      mockKV.get.mockResolvedValue(null);
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            data: {
              "1": { predicted: 45, confidence: 0.8, trend: "up" },
            },
            metadata: {
              dataSourceDays: 28,
              model: "wma",
              weights: {},
              generatedAt: "2026-03-14T02:00:00Z",
            },
            generatedBy: "statistical",
            expiresAt: new Date(Date.now() + 86400000),
          },
        ]),
      );

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

    it("should skip expired D1 record and trigger on-demand generation", async () => {
      mockKV.get.mockResolvedValue(null);

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // getForecast D1 lookup → expired record
          return makeSelectChain([
            {
              data: {
                "1": { predicted: 30, confidence: 0.5, trend: "stable" },
              },
              metadata: {
                dataSourceDays: 28,
                model: "wma",
                weights: {},
                generatedAt: "2026-03-10T02:00:00Z",
              },
              generatedBy: "statistical",
              expiresAt: new Date(Date.now() - 86400000), // expired yesterday
            },
          ]);
        }
        // Subsequent calls: on-demand generateForecast (getHistoricalSales)
        return makeSelectChain([]);
      });
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.getForecast(
        "restaurant-1",
        "2026-03-15",
        "2026-03-15",
      );

      // Should have triggered generateForecast (since D1 was expired)
      expect(results).toHaveLength(1);
      expect(results[0].generatedBy).toBe("statistical");
    });

    it("should write D1 result back to KV cache on fallback hit", async () => {
      mockKV.get.mockResolvedValue(null);
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            data: {
              "1": { predicted: 45, confidence: 0.8, trend: "up" },
            },
            metadata: {
              dataSourceDays: 28,
              model: "wma",
              weights: {},
              generatedAt: "2026-03-14T02:00:00Z",
            },
            generatedBy: "statistical",
            expiresAt: new Date(Date.now() + 86400000),
          },
        ]),
      );

      await service.getForecast("restaurant-1", "2026-03-15", "2026-03-15");

      // Should have written back to KV
      expect(mockKV.put).toHaveBeenCalled();
      const kvKey = mockKV.put.mock.calls[0][0];
      expect(kvKey).toContain("forecast:restaurant-1:2026-03-15");
    });

    it("should handle multi-date range by fetching each date", async () => {
      const cache15 = buildForecastCache(
        [
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
        "2026-03-15",
      );
      const cache16 = buildForecastCache(
        [
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 50,
            confidence: 0.85,
            trend: "up",
            trendPercent: 8,
            historicalAvg: 42,
          },
        ],
        "2026-03-16",
      );
      mockKV.get.mockResolvedValueOnce(cache15).mockResolvedValueOnce(cache16);

      const results = await service.getForecast(
        "restaurant-1",
        "2026-03-15",
        "2026-03-16",
      );

      expect(results).toHaveLength(2);
      expect(results[0].date).toBe("2026-03-15");
      expect(results[1].date).toBe("2026-03-16");
    });
  });

  // ─── getAccuracy ────────────────────────────────────────────────

  describe("getAccuracy", () => {
    it("should return empty array when no forecast records exist", async () => {
      mockDb.select.mockReturnValue(makeSelectChain([]));

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-01",
        "2026-03-14",
      );
      expect(accuracy).toEqual([]);
    });

    it("should calculate deviation between predicted and actual sales", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // forecast_cache query
          return makeSelectChain([
            {
              forecastDate: "2026-03-10",
              data: {
                "1": { predicted: 50 },
                "2": { predicted: 30 },
              },
            },
          ]);
        }
        if (selectCallCount === 2) {
          // menu_items name lookup
          return makeSelectChain([
            { id: 1, name: "雞排" },
            { id: 2, name: "滷肉飯" },
          ]);
        }
        // actuals query
        return makeSelectChain([
          {
            menuItemId: 1,
            itemName: "雞排",
            actualQuantity: 45,
            orderDate: "2026-03-10",
          },
          {
            menuItemId: 2,
            itemName: "滷肉飯",
            actualQuantity: 36,
            orderDate: "2026-03-10",
          },
        ]);
      });

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-10",
        "2026-03-10",
      );

      expect(accuracy).toHaveLength(2);

      const chickenItem = accuracy.find((a) => a.menuItemId === 1)!;
      expect(chickenItem.predicted).toBe(50);
      expect(chickenItem.actual).toBe(45);
      expect(chickenItem.deviation).toBe(10);
      expect(chickenItem.menuItemName).toBe("雞排");

      const riceItem = accuracy.find((a) => a.menuItemId === 2)!;
      expect(riceItem.predicted).toBe(30);
      expect(riceItem.actual).toBe(36);
      expect(riceItem.deviation).toBe(20);
    });

    it("should return deviation 0 when predicted is 0", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            {
              forecastDate: "2026-03-10",
              data: { "1": { predicted: 0 } },
            },
          ]);
        }
        if (selectCallCount === 2) {
          return makeSelectChain([{ id: 1, name: "雞排" }]);
        }
        return makeSelectChain([
          {
            menuItemId: 1,
            itemName: "雞排",
            actualQuantity: 10,
            orderDate: "2026-03-10",
          },
        ]);
      });

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-10",
        "2026-03-10",
      );

      expect(accuracy[0].deviation).toBe(0);
    });

    it("should default actual to 0 when no actual sales exist for an item", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            {
              forecastDate: "2026-03-10",
              data: { "1": { predicted: 50 } },
            },
          ]);
        }
        if (selectCallCount === 2) {
          return makeSelectChain([{ id: 1, name: "雞排" }]);
        }
        // No actuals
        return makeSelectChain([]);
      });

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-10",
        "2026-03-10",
      );

      expect(accuracy[0].actual).toBe(0);
      expect(accuracy[0].deviation).toBe(100);
    });

    it("should use fallback name when menu item name not found", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            {
              forecastDate: "2026-03-10",
              data: { "999": { predicted: 50 } },
            },
          ]);
        }
        if (selectCallCount === 2) {
          // Name lookup returns nothing for id 999
          return makeSelectChain([]);
        }
        return makeSelectChain([]);
      });

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-10",
        "2026-03-10",
      );

      expect(accuracy[0].menuItemName).toBe("Item #999");
    });
  });

  // ─── getAlerts ──────────────────────────────────────────────────

  describe("getAlerts", () => {
    it("should skip low_stock alert when inventoryCount is null", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 100,
            confidence: 0.9,
            trend: "stable",
            trendPercent: 0,
            historicalAvg: 50,
          },
        ]),
      );

      mockDb.select.mockReturnValue(
        makeSelectChain([{ id: 1, name: "雞排", inventoryCount: null }]),
      );

      const alerts = await service.getAlerts("restaurant-1");
      const lowStockAlerts = alerts.filter((a) => a.type === "low_stock");
      expect(lowStockAlerts).toHaveLength(0);
    });

    it("should generate high_demand alert when predicted > 30 and confidence >= 0.7", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 40,
            confidence: 0.8,
            trend: "up",
            trendPercent: 10,
            historicalAvg: 35,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // menuItems query
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 100 },
          ]);
        }
        // ingredient forecast query (returns empty)
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const highDemand = alerts.filter((a) => a.type === "high_demand");

      expect(highDemand).toHaveLength(1);
      expect(highDemand[0].severity).toBe("info"); // 40 <= 50
      expect(highDemand[0].menuItemName).toBe("雞排");
    });

    it("should set high_demand severity to warning when predicted > 50", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 60,
            confidence: 0.9,
            trend: "up",
            trendPercent: 15,
            historicalAvg: 35,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 100 },
          ]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const highDemand = alerts.find((a) => a.type === "high_demand")!;

      expect(highDemand.severity).toBe("warning");
    });

    it("should not generate high_demand alert when confidence < 0.7", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 40,
            confidence: 0.5, // below threshold
            trend: "up",
            trendPercent: 10,
            historicalAvg: 35,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 100 },
          ]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const highDemand = alerts.filter((a) => a.type === "high_demand");
      expect(highDemand).toHaveLength(0);
    });

    it("should generate low_stock alert when predicted exceeds inventory", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 25,
            confidence: 0.5,
            trend: "stable",
            trendPercent: 0,
            historicalAvg: 20,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([{ id: 1, name: "雞排", inventoryCount: 10 }]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const lowStock = alerts.find((a) => a.type === "low_stock")!;

      expect(lowStock).toBeDefined();
      expect(lowStock.severity).toBe("critical"); // 25 > 10 * 2
    });

    it("should set low_stock severity to warning when predicted <= 2x inventory", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 15,
            confidence: 0.5,
            trend: "stable",
            trendPercent: 0,
            historicalAvg: 12,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([{ id: 1, name: "雞排", inventoryCount: 10 }]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const lowStock = alerts.find((a) => a.type === "low_stock")!;

      expect(lowStock).toBeDefined();
      expect(lowStock.severity).toBe("warning"); // 15 <= 10 * 2
    });

    it("should generate unusual_spike alert when predicted > 1.5x historicalAvg", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 80,
            confidence: 0.5,
            trend: "up",
            trendPercent: 60,
            historicalAvg: 40,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 200 },
          ]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const spike = alerts.find((a) => a.type === "unusual_spike")!;

      expect(spike).toBeDefined();
      // 80 <= 40 * 2, so severity = "info"
      expect(spike.severity).toBe("info");
    });

    it("should set unusual_spike severity to warning when predicted > 2x historicalAvg", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 100,
            confidence: 0.5,
            trend: "up",
            trendPercent: 100,
            historicalAvg: 40,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 200 },
          ]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const spike = alerts.find((a) => a.type === "unusual_spike")!;

      expect(spike).toBeDefined();
      expect(spike.severity).toBe("warning"); // 100 > 40 * 2
    });

    it("should sort alerts by severity: critical > warning > info", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 60,
            confidence: 0.9,
            trend: "up",
            trendPercent: 50,
            historicalAvg: 35,
          },
          {
            menuItemId: 2,
            menuItemName: "滷肉飯",
            predicted: 50,
            confidence: 0.8,
            trend: "up",
            trendPercent: 10,
            historicalAvg: 45,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 5 }, // low_stock critical (60 > 5*2)
            { id: 2, name: "滷肉飯", inventoryCount: 200 },
          ]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");

      // Verify sort order
      for (let i = 1; i < alerts.length; i++) {
        const severityOrder: Record<string, number> = {
          critical: 0,
          warning: 1,
          info: 2,
        };
        expect(severityOrder[alerts[i - 1].severity]).toBeLessThanOrEqual(
          severityOrder[alerts[i].severity],
        );
      }
    });

    it("should return empty alerts when no forecast data exists", async () => {
      mockKV.get.mockResolvedValue(null);
      // getForecast: KV miss → D1 miss → generateForecast (no historical data)
      mockDb.select.mockReturnValue(makeSelectChain([]));
      mockDb.insert.mockReturnValue(makeInsertChain());

      const alerts = await service.getAlerts("restaurant-1");
      expect(alerts).toEqual([]);
    });

    it("should skip items not found in menu_items inventory lookup", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 999,
            menuItemName: "已下架品項",
            predicted: 100,
            confidence: 0.9,
            trend: "up",
            trendPercent: 50,
            historicalAvg: 40,
          },
        ]),
      );

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([]); // no menu items match
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      expect(alerts).toEqual([]);
    });

    // ─── Alert threshold boundary tests ────────────────────────────

    it("should NOT generate high_demand alert when predicted equals exactly 30 (boundary: must be > 30)", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 30,
            confidence: 0.8,
            trend: "stable",
            trendPercent: 0,
            historicalAvg: 28,
          },
        ]),
      );
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 100 },
          ]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const highDemand = alerts.filter((a) => a.type === "high_demand");
      // predicted === 30 is NOT > 30, so no alert
      expect(highDemand).toHaveLength(0);
    });

    it("should generate high_demand alert when predicted is 31 (one above boundary)", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 31,
            confidence: 0.8,
            trend: "up",
            trendPercent: 5,
            historicalAvg: 28,
          },
        ]),
      );
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 100 },
          ]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const highDemand = alerts.filter((a) => a.type === "high_demand");
      expect(highDemand).toHaveLength(1);
      expect(highDemand[0].severity).toBe("info"); // 31 <= 50
    });

    it("should set high_demand severity to info when predicted equals exactly 50 (boundary: must be > 50 for warning)", async () => {
      mockKV.get.mockResolvedValue(
        buildForecastCache([
          {
            menuItemId: 1,
            menuItemName: "雞排",
            predicted: 50,
            confidence: 0.9,
            trend: "up",
            trendPercent: 10,
            historicalAvg: 40,
          },
        ]),
      );
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            { id: 1, name: "雞排", inventoryCount: 100 },
          ]);
        }
        return makeSelectChain([]);
      });

      const alerts = await service.getAlerts("restaurant-1");
      const highDemand = alerts.find((a) => a.type === "high_demand")!;
      expect(highDemand).toBeDefined();
      // predicted === 50 is NOT > 50, so severity is "info"
      expect(highDemand.severity).toBe("info");
    });
  });

  // ─── KV cache failure fallback ───────────────────────────────────

  describe("KV cache failure fallback", () => {
    it("getForecast propagates error when KV.get throws (no silent fallback)", async () => {
      mockKV.get.mockRejectedValue(new Error("KV unavailable"));

      await expect(
        service.getForecast("restaurant-1", "2026-03-15", "2026-03-15"),
      ).rejects.toThrow("KV unavailable");
    });

    it("generateForecast falls back to stale cache when KV.put throws", async () => {
      mockKV.put.mockRejectedValue(new Error("KV write failed"));

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // getHistoricalSales → no data
          return makeSelectChain([]);
        }
        // getStaleCache → return a stale DB record
        return makeSelectChain([
          {
            data: {
              "1": {
                predicted: 25,
                confidence: 0.6,
                trend: "stable",
                menuItemName: "雞排",
              },
            },
            metadata: {
              dataSourceDays: 28,
              model: "wma",
              weights: {},
              generatedAt: "2026-03-13T02:00:00Z",
            },
            generatedBy: "statistical",
          },
        ]);
      });
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      const staleResults = results.filter((r) => r.stale === true);
      expect(staleResults.length).toBeGreaterThan(0);
      expect(staleResults[0].items[0].predicted).toBe(25);
    });
  });

  // ─── DB chunking boundary tests ──────────────────────────────────

  describe("getAccuracy DB chunking", () => {
    it("should chunk IDs when there are exactly 90 items (single chunk)", async () => {
      // Build 90 distinct item IDs in forecast data
      const forecastData: Record<string, { predicted: number }> = {};
      for (let i = 1; i <= 90; i++) {
        forecastData[String(i)] = { predicted: 10 };
      }

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // forecast_cache query
          return makeSelectChain([
            {
              forecastDate: "2026-03-10",
              data: forecastData,
            },
          ]);
        }
        // name lookup chunk queries + actuals query (all return empty)
        return makeSelectChain([]);
      });

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-10",
        "2026-03-10",
      );

      // 90 items → 1 chunk query + 1 actuals query + 1 forecast query = 3 total
      expect(selectCallCount).toBe(3);
      expect(accuracy).toHaveLength(90);
    });

    it("should make 2 chunk queries when there are 91 items (crosses chunk boundary)", async () => {
      // Build 91 distinct item IDs in forecast data
      const forecastData: Record<string, { predicted: number }> = {};
      for (let i = 1; i <= 91; i++) {
        forecastData[String(i)] = { predicted: 10 };
      }

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            {
              forecastDate: "2026-03-10",
              data: forecastData,
            },
          ]);
        }
        // chunk queries (2 chunks) + actuals query (all return empty)
        return makeSelectChain([]);
      });

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-10",
        "2026-03-10",
      );

      // 91 items → 2 chunk queries + 1 actuals query + 1 forecast query = 4 total
      expect(selectCallCount).toBe(4);
      expect(accuracy).toHaveLength(91);
    });

    it("should return empty array when forecast data has no items (empty dataset)", async () => {
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            forecastDate: "2026-03-10",
            data: {}, // empty data dict
          },
        ]),
      );

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-10",
        "2026-03-10",
      );

      expect(accuracy).toHaveLength(0);
    });

    it("should handle single-item forecast data correctly", async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return makeSelectChain([
            {
              forecastDate: "2026-03-10",
              data: { "42": { predicted: 20 } },
            },
          ]);
        }
        if (selectCallCount === 2) {
          // name lookup for single item
          return makeSelectChain([{ id: 42, name: "單品" }]);
        }
        // actuals
        return makeSelectChain([
          {
            menuItemId: 42,
            itemName: "單品",
            actualQuantity: 18,
            orderDate: "2026-03-10",
          },
        ]);
      });

      const accuracy = await service.getAccuracy(
        "restaurant-1",
        "2026-03-10",
        "2026-03-10",
      );

      expect(accuracy).toHaveLength(1);
      expect(accuracy[0].menuItemId).toBe(42);
      expect(accuracy[0].menuItemName).toBe("單品");
      expect(accuracy[0].predicted).toBe(20);
      expect(accuracy[0].actual).toBe(18);
      expect(accuracy[0].deviation).toBe(10);
    });
  });
});
