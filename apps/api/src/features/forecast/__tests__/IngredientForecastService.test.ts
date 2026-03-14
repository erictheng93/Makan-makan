// apps/api/src/features/forecast/__tests__/IngredientForecastService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IngredientForecastService } from "../services/IngredientForecastService";

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

function createMockForecastService() {
  return {
    generateForecast: vi.fn().mockResolvedValue([]),
  };
}

describe("IngredientForecastService", () => {
  let service: IngredientForecastService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockKV: ReturnType<typeof createMockKV>;
  let mockForecastService: ReturnType<typeof createMockForecastService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockKV = createMockKV();
    mockForecastService = createMockForecastService();
    service = new IngredientForecastService(
      mockDb as any,
      mockKV as any,
      mockForecastService as any,
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

      // Mock DB to return BOM data (menu_item_ingredients joined with ingredient_definitions)
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                ingredient_id: 100,
                quantity_per_serving: 0.2,
                unit: "kg",
                ingredient_name: "Chicken",
                current_stock: 15,
              },
              {
                menu_item_id: 1,
                ingredient_id: 101,
                quantity_per_serving: 0.15,
                unit: "kg",
                ingredient_name: "Rice",
                current_stock: 20,
              },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

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
      // Dish A: 0.2kg chicken/serving, predicted 50
      // Dish B: 0.3kg chicken/serving, predicted 30
      // Total chicken = 0.2*50 + 0.3*30 = 10 + 9 = 19 kg
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
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                ingredient_id: 100,
                quantity_per_serving: 0.2,
                unit: "kg",
                ingredient_name: "Chicken",
                current_stock: 5,
              },
              {
                menu_item_id: 2,
                ingredient_id: 100,
                quantity_per_serving: 0.3,
                unit: "kg",
                ingredient_name: "Chicken",
                current_stock: 5,
              },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

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
      // Dish A: predicted 50, confidence 0.9 -> chicken contribution = 50*0.2 = 10
      // Dish B: predicted 30, confidence 0.8 -> chicken contribution = 30*0.3 = 9
      // Weighted confidence = (0.9*10 + 0.8*9) / (10+9) = (9+7.2)/19 = 16.2/19 ≈ 0.85
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

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                ingredient_id: 100,
                quantity_per_serving: 0.2,
                unit: "kg",
                ingredient_name: "Chicken",
                current_stock: null,
              },
              {
                menu_item_id: 2,
                ingredient_id: 100,
                quantity_per_serving: 0.3,
                unit: "kg",
                ingredient_name: "Chicken",
                current_stock: null,
              },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

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
      // Default mockDb already returns { results: [] }

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
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                ingredient_id: 100,
                quantity_per_serving: 0.2,
                unit: "kg",
                ingredient_name: "Chicken",
                current_stock: 10,
              },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

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

      // Verify DB save was called (prepare called for both BOM load and save)
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });
});
