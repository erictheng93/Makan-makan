// apps/api/src/features/ingredients/__tests__/RecipeService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecipeService } from "../services/RecipeService";

// ─── Mock Drizzle ──────────────────────────────────────────────────────────

const mockDb = {
  select: vi.fn(),
  selectDistinct: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  notInArray: vi.fn(),
}));

vi.mock("@makanmasak/database", () => ({
  menuItemIngredients: { menuItemId: "menuItemId" },
  ingredientDefinitions: { name: "name" },
  menuItems: { name: "name" },
}));

// ─── Tests ────────────────────────────────────────────────────────────────

describe("RecipeService", () => {
  let service: RecipeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RecipeService({} as never);
  });

  // ─── getRecipe ────────────────────────────────────────────────────

  describe("getRecipe", () => {
    it("should return recipe entries with ingredient names", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            ingredientId: 100,
            ingredientName: "Chicken",
            quantityPerServing: 0.2,
            unit: "kg",
            isOptional: false,
          },
          {
            ingredientId: 101,
            ingredientName: "Soy Sauce",
            quantityPerServing: 0.05,
            unit: "ml",
            isOptional: true,
          },
        ]),
      };
      mockDb.select.mockReturnValue(chain);

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
      const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.getRecipe(999);

      expect(result).toEqual([]);
    });
  });

  // ─── setRecipe ────────────────────────────────────────────────────

  describe("setRecipe", () => {
    it("should delete old entries and insert new ones via transaction", async () => {
      const entries = [
        { ingredientId: 100, quantityPerServing: 0.3, unit: "kg" },
        {
          ingredientId: 101,
          quantityPerServing: 0.05,
          unit: "ml",
          isOptional: true,
        },
      ];

      const mockTx = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockDb.transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.setRecipe(10, entries);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.delete).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
      // Insert should receive array of 2 entries
      const valuesArg =
        mockTx.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(valuesArg).toHaveLength(2);
    });

    it("should handle empty entries (delete only)", async () => {
      const mockTx = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
        insert: vi.fn(),
      };
      mockDb.transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.setRecipe(10, []);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.delete).toHaveBeenCalledTimes(1);
      // No insert call for empty entries
      expect(mockTx.insert).not.toHaveBeenCalled();
    });
  });

  // ─── validateRecipe ───────────────────────────────────────────────

  describe("validateRecipe", () => {
    it("should return valid for a correct recipe", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            ingredientId: 100,
            name: "Chicken",
            isActive: true,
            deletedAt: null,
          },
          {
            ingredientId: 101,
            name: "Rice",
            isActive: true,
            deletedAt: null,
          },
        ]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.validateRecipe(10);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing ingredient", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            ingredientId: 100,
            name: null,
            isActive: null,
            deletedAt: null,
          },
        ]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.validateRecipe(10);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("does not exist");
    });

    it("should detect inactive ingredient", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            ingredientId: 100,
            name: "Chicken",
            isActive: false,
            deletedAt: null,
          },
        ]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.validateRecipe(10);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("inactive");
    });

    it("should return invalid when no recipe entries exist", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.validateRecipe(999);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("No recipe entries found");
    });
  });

  // ─── getMenuItemsWithoutRecipes ───────────────────────────────────

  describe("getMenuItemsWithoutRecipes", () => {
    it("should return menu items that have no recipe entries", async () => {
      // Mock for the subquery (selectDistinct)
      mockDb.selectDistinct.mockReturnValue({
        from: vi.fn().mockReturnValue("subquery"),
      });
      // Mock for the main query
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { id: 5, name: "Fried Rice" },
          { id: 8, name: "Noodle Soup" },
        ]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.getMenuItemsWithoutRecipes("r-1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 5, name: "Fried Rice" });
      expect(result[1]).toEqual({ id: 8, name: "Noodle Soup" });
    });

    it("should return empty array when all menu items have recipes", async () => {
      mockDb.selectDistinct.mockReturnValue({
        from: vi.fn().mockReturnValue("subquery"),
      });
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.getMenuItemsWithoutRecipes("r-1");

      expect(result).toEqual([]);
    });
  });

  // ─── getIngredientUsage ───────────────────────────────────────────

  describe("getIngredientUsage", () => {
    it("should return menu items using an ingredient", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          { menuItemId: 10, menuItemName: "Chicken Rice" },
          { menuItemId: 15, menuItemName: "Chicken Noodle" },
        ]),
      };
      mockDb.select.mockReturnValue(chain);

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
      const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.getIngredientUsage(999);

      expect(result).toEqual([]);
    });
  });
});
