// apps/api/src/features/forecast/__tests__/IngredientForecastService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IngredientForecastService } from "../services/IngredientForecastService";

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
    deletedAt: {},
  },
  menuItemIngredients: {
    menuItemId: {},
    ingredientId: {},
    quantityPerServing: {},
    unit: {},
  },
  ingredientDefinitions: {
    id: {},
    name: {},
    currentStock: {},
    isActive: {},
    deletedAt: {},
  },
}));

// ─── Chain helpers ──────────────────────────────────────────────────────────

function makeSelectChain(returnValue: unknown[]) {
  const chain: any = {};
  const thenFn = (resolve: any) => resolve(returnValue);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockImplementation(() => {
    return { then: thenFn, catch: vi.fn() };
  });
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

function createMockForecastService() {
  return {
    generateForecast: vi.fn().mockResolvedValue([]),
  };
}

describe("IngredientForecastService", () => {
  let service: IngredientForecastService;
  let mockKV: ReturnType<typeof createMockKV>;
  let mockForecastService: ReturnType<typeof createMockForecastService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKV = createMockKV();
    mockForecastService = createMockForecastService();
    service = new IngredientForecastService(
      {} as never,
      mockKV as never,
      mockForecastService as never,
    );
  });

  describe("generateIngredientForecast", () => {
    it("generates ingredient forecast from item forecasts and BOM", async () => {
      // Mock ForecastService to return item-level forecasts
      mockForecastService.generateForecast.mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [
            {
              menuItemId: 1,
              menuItemName: "Chicken Rice",
              predicted: 50,
              confidence: 0.85,
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

      // Mock DB: loadBOM returns BOM data, saveForecastToDb inserts
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            ingredientId: 100,
            quantityPerServing: 0.2,
            unit: "kg",
            ingredientName: "Chicken",
            currentStock: 15,
          },
          {
            menuItemId: 1,
            ingredientId: 101,
            quantityPerServing: 0.15,
            unit: "kg",
            ingredientName: "Rice",
            currentStock: 20,
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateIngredientForecast("rest-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe("2026-03-15");
      expect(results[0].generatedBy).toBe("statistical");
      expect(results[0].ingredients).toHaveLength(2);

      // Chicken: 50 * 0.2 = 10 kg
      const chicken = results[0].ingredients.find(
        (i) => i.ingredientName === "Chicken",
      );
      expect(chicken).toBeDefined();
      expect(chicken!.predictedQuantity).toBe(10);
      expect(chicken!.unit).toBe("kg");

      // Rice: 50 * 0.15 = 7.5 kg
      const rice = results[0].ingredients.find(
        (i) => i.ingredientName === "Rice",
      );
      expect(rice).toBeDefined();
      expect(rice!.predictedQuantity).toBe(7.5);
    });

    it("correctly sums shared ingredients across multiple dishes", async () => {
      mockForecastService.generateForecast.mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [
            {
              menuItemId: 1,
              menuItemName: "Chicken Rice",
              predicted: 50,
              confidence: 0.9,
            },
            {
              menuItemId: 2,
              menuItemName: "Chicken Soup",
              predicted: 30,
              confidence: 0.8,
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

      // BOM: both dishes use chicken (ingredient_id=100)
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            ingredientId: 100,
            quantityPerServing: 0.2,
            unit: "kg",
            ingredientName: "Chicken",
            currentStock: 5,
          },
          {
            menuItemId: 2,
            ingredientId: 100,
            quantityPerServing: 0.3,
            unit: "kg",
            ingredientName: "Chicken",
            currentStock: 5,
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateIngredientForecast("rest-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(results[0].ingredients).toHaveLength(1);
      const chicken = results[0].ingredients[0];
      expect(chicken.ingredientName).toBe("Chicken");
      expect(chicken.predictedQuantity).toBe(19); // 0.2*50 + 0.3*30
      expect(chicken.contributingItems).toHaveLength(2);
      // Gap: 19 - 5 = 14
      expect(chicken.gap).toBe(14);
    });

    it("calculates weighted confidence based on contribution amounts", async () => {
      mockForecastService.generateForecast.mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [
            {
              menuItemId: 1,
              menuItemName: "Chicken Rice",
              predicted: 50,
              confidence: 0.9,
            },
            {
              menuItemId: 2,
              menuItemName: "Chicken Soup",
              predicted: 30,
              confidence: 0.8,
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

      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            ingredientId: 100,
            quantityPerServing: 0.2,
            unit: "kg",
            ingredientName: "Chicken",
            currentStock: null,
          },
          {
            menuItemId: 2,
            ingredientId: 100,
            quantityPerServing: 0.3,
            unit: "kg",
            ingredientName: "Chicken",
            currentStock: null,
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateIngredientForecast("rest-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      const chicken = results[0].ingredients[0];
      // (0.9*10 + 0.8*9) / 19 = 16.2/19 = 0.852631... rounded to 0.85
      expect(chicken.confidence).toBe(0.85);
    });

    it("returns empty ingredients when no recipes exist", async () => {
      mockForecastService.generateForecast.mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [
            {
              menuItemId: 1,
              menuItemName: "Chicken Rice",
              predicted: 50,
              confidence: 0.85,
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

      // BOM returns empty — no recipes
      mockDb.select.mockReturnValue(makeSelectChain([]));
      mockDb.insert.mockReturnValue(makeInsertChain());

      const results = await service.generateIngredientForecast("rest-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(results).toHaveLength(1);
      expect(results[0].ingredients).toHaveLength(0);
    });

    it("caches results in KV and DB", async () => {
      mockForecastService.generateForecast.mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [
            {
              menuItemId: 1,
              menuItemName: "Chicken Rice",
              predicted: 50,
              confidence: 0.85,
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

      // BOM with one ingredient
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            menuItemId: 1,
            ingredientId: 100,
            quantityPerServing: 0.2,
            unit: "kg",
            ingredientName: "Chicken",
            currentStock: 10,
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeInsertChain());

      await service.generateIngredientForecast("rest-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      // Verify KV.put was called with the forecast key
      expect(mockKV.put).toHaveBeenCalledWith(
        "forecast:ingredient:rest-1:2026-03-15",
        expect.any(String),
        expect.objectContaining({ expirationTtl: 21600 }),
      );

      // Verify DB save was called (insert called for saveForecastToDb)
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
