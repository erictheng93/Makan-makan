// apps/api/src/features/ingredients/__tests__/RecipeService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecipeService } from "../services/RecipeService";

function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({
          success: true,
          meta: { changes: 1, last_row_id: 1 },
        }),
      }),
    }),
    batch: vi.fn().mockResolvedValue([]),
  };
}

describe("RecipeService", () => {
  let service: RecipeService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new RecipeService(mockDb as any);
  });

  // ─── getRecipe ────────────────────────────────────────────────────

  describe("getRecipe", () => {
    it("should return recipe entries with ingredient names", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 1,
                menu_item_id: 10,
                ingredient_id: 100,
                quantity_per_serving: 0.2,
                unit: "kg",
                is_optional: 0,
                ingredient_name: "Chicken",
              },
              {
                id: 2,
                menu_item_id: 10,
                ingredient_id: 101,
                quantity_per_serving: 0.05,
                unit: "ml",
                is_optional: 1,
                ingredient_name: "Soy Sauce",
              },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await service.getRecipe(10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ingredientId: 100,
        ingredientName: "Chicken",
        quantityPerServing: 0.2,
        unit: "kg",
        isOptional: false,
      });
      expect(result[1]).toEqual({
        ingredientId: 101,
        ingredientName: "Soy Sauce",
        quantityPerServing: 0.05,
        unit: "ml",
        isOptional: true,
      });
    });

    it("should return empty array when no recipe exists", async () => {
      const result = await service.getRecipe(999);

      expect(result).toEqual([]);
    });
  });

  // ─── setRecipe ────────────────────────────────────────────────────

  describe("setRecipe", () => {
    it("should delete old entries and insert new ones via db.batch", async () => {
      const entries = [
        { ingredientId: 100, quantityPerServing: 0.3, unit: "kg" },
        {
          ingredientId: 101,
          quantityPerServing: 0.05,
          unit: "ml",
          isOptional: true,
        },
      ];

      mockDb.batch.mockResolvedValue([
        { success: true },
        { success: true },
        { success: true },
      ]);

      await service.setRecipe(10, entries);

      expect(mockDb.batch).toHaveBeenCalledTimes(1);
      // batch receives: 1 DELETE + 2 INSERTs = 3 statements
      const batchArgs = mockDb.batch.mock.calls[0][0];
      expect(batchArgs).toHaveLength(3);
    });

    it("should handle empty entries (delete only)", async () => {
      mockDb.batch.mockResolvedValue([{ success: true }]);

      await service.setRecipe(10, []);

      expect(mockDb.batch).toHaveBeenCalledTimes(1);
      const batchArgs = mockDb.batch.mock.calls[0][0];
      // Only the DELETE statement
      expect(batchArgs).toHaveLength(1);
    });
  });

  // ─── validateRecipe ───────────────────────────────────────────────

  describe("validateRecipe", () => {
    it("should return valid for a correct recipe", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                ingredient_id: 100,
                name: "Chicken",
                is_active: 1,
                deleted_at_ms: null,
              },
              {
                ingredient_id: 101,
                name: "Rice",
                is_active: 1,
                deleted_at_ms: null,
              },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await service.validateRecipe(10);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing ingredient", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                ingredient_id: 100,
                name: null,
                is_active: null,
                deleted_at_ms: null,
              },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await service.validateRecipe(10);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("does not exist");
    });

    it("should detect inactive ingredient", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                ingredient_id: 100,
                name: "Chicken",
                is_active: 0,
                deleted_at_ms: null,
              },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await service.validateRecipe(10);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("inactive");
    });

    it("should return invalid when no recipe entries exist", async () => {
      // Default mock returns empty results
      const result = await service.validateRecipe(999);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("No recipe entries found");
    });
  });

  // ─── getMenuItemsWithoutRecipes ───────────────────────────────────

  describe("getMenuItemsWithoutRecipes", () => {
    it("should return menu items that have no recipe entries", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { id: 5, name: "Fried Rice" },
              { id: 8, name: "Noodle Soup" },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await service.getMenuItemsWithoutRecipes("r-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 5, name: "Fried Rice" });
      expect(result[1]).toEqual({ id: 8, name: "Noodle Soup" });
    });

    it("should return empty array when all menu items have recipes", async () => {
      const result = await service.getMenuItemsWithoutRecipes("r-1");

      expect(result).toEqual([]);
    });
  });

  // ─── getIngredientUsage ───────────────────────────────────────────

  describe("getIngredientUsage", () => {
    it("should return menu items using an ingredient", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { menu_item_id: 10, menu_item_name: "Chicken Rice" },
              { menu_item_id: 15, menu_item_name: "Chicken Noodle" },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await service.getIngredientUsage(100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        menuItemId: 10,
        menuItemName: "Chicken Rice",
      });
      expect(result[1]).toEqual({
        menuItemId: 15,
        menuItemName: "Chicken Noodle",
      });
    });

    it("should return empty array when ingredient is unused", async () => {
      const result = await service.getIngredientUsage(999);

      expect(result).toEqual([]);
    });
  });
});
