// apps/api/src/features/ingredients/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import {
  createIngredientSchema,
  updateIngredientSchema,
  bulkImportSchema,
  setRecipeSchema,
  updateStockSchema,
  ingredientListQuerySchema,
} from "../schemas/validation";

describe("Ingredient Validation Schemas", () => {
  describe("createIngredientSchema", () => {
    it("accepts valid ingredient data", () => {
      const result = createIngredientSchema.safeParse({
        name: "Chicken Breast",
        unit: "kg",
        category: "Meat",
        costPerUnit: 12.5,
        supplier: "Local Farm",
        minStockLevel: 5,
        currentStock: 20,
      });
      expect(result.success).toBe(true);
    });

    it("accepts minimal valid data (name and unit only)", () => {
      const result = createIngredientSchema.safeParse({
        name: "Salt",
        unit: "g",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing name", () => {
      const result = createIngredientSchema.safeParse({
        unit: "kg",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((i) =>
          i.path.includes("name"),
        );
        expect(nameError).toBeDefined();
      }
    });

    it("rejects missing unit", () => {
      const result = createIngredientSchema.safeParse({
        name: "Chicken",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const unitError = result.error.issues.find((i) =>
          i.path.includes("unit"),
        );
        expect(unitError).toBeDefined();
      }
    });

    it("rejects empty name", () => {
      const result = createIngredientSchema.safeParse({
        name: "",
        unit: "kg",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty unit", () => {
      const result = createIngredientSchema.safeParse({
        name: "Chicken",
        unit: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateIngredientSchema", () => {
    it("accepts partial update with only name", () => {
      const result = updateIngredientSchema.safeParse({
        name: "Updated Chicken",
      });
      expect(result.success).toBe(true);
    });

    it("accepts partial update with only costPerUnit", () => {
      const result = updateIngredientSchema.safeParse({
        costPerUnit: 15.0,
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty object (all fields optional)", () => {
      const result = updateIngredientSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects invalid costPerUnit (negative)", () => {
      const result = updateIngredientSchema.safeParse({
        costPerUnit: -5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bulkImportSchema", () => {
    it("accepts valid array of ingredients", () => {
      const result = bulkImportSchema.safeParse({
        ingredients: [
          { name: "Chicken", unit: "kg" },
          { name: "Rice", unit: "kg", costPerUnit: 3.0 },
          { name: "Salt", unit: "g", category: "Seasoning" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty array", () => {
      const result = bulkImportSchema.safeParse({
        ingredients: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("At least one");
      }
    });

    it("rejects array with over 500 items", () => {
      const ingredients = Array.from({ length: 501 }, (_, i) => ({
        name: `Ingredient ${i}`,
        unit: "kg",
      }));
      const result = bulkImportSchema.safeParse({ ingredients });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("500");
      }
    });

    it("rejects when individual ingredient is invalid", () => {
      const result = bulkImportSchema.safeParse({
        ingredients: [
          { name: "Valid", unit: "kg" },
          { name: "", unit: "kg" }, // invalid: empty name
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("setRecipeSchema", () => {
    it("accepts valid recipe entries", () => {
      const result = setRecipeSchema.safeParse({
        ingredients: [
          {
            ingredientId: 1,
            quantityPerServing: 0.2,
            unit: "kg",
            isOptional: false,
          },
          {
            ingredientId: 2,
            quantityPerServing: 0.15,
            unit: "kg",
          },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // isOptional defaults to false
        expect(result.data.ingredients[1].isOptional).toBe(false);
      }
    });

    it("rejects empty ingredients array", () => {
      const result = setRecipeSchema.safeParse({
        ingredients: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("At least one");
      }
    });

    it("rejects non-positive ingredientId", () => {
      const result = setRecipeSchema.safeParse({
        ingredients: [{ ingredientId: 0, quantityPerServing: 0.2, unit: "kg" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-positive quantityPerServing", () => {
      const result = setRecipeSchema.safeParse({
        ingredients: [{ ingredientId: 1, quantityPerServing: 0, unit: "kg" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateStockSchema", () => {
    it("accepts valid non-negative quantity", () => {
      const result = updateStockSchema.safeParse({ quantity: 25.5 });
      expect(result.success).toBe(true);
    });

    it("accepts zero quantity", () => {
      const result = updateStockSchema.safeParse({ quantity: 0 });
      expect(result.success).toBe(true);
    });

    it("rejects negative quantity", () => {
      const result = updateStockSchema.safeParse({ quantity: -1 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("non-negative");
      }
    });
  });

  describe("ingredientListQuerySchema", () => {
    it("accepts valid query parameters", () => {
      const result = ingredientListQuerySchema.safeParse({
        page: "2",
        limit: "25",
        category: "Meat",
        search: "chicken",
        includeInactive: "true",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(25);
        expect(result.data.category).toBe("Meat");
        expect(result.data.search).toBe("chicken");
        expect(result.data.includeInactive).toBe(true);
      }
    });

    it("uses defaults when optional fields omitted", () => {
      const result = ingredientListQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
        expect(result.data.includeInactive).toBe(false);
      }
    });

    it("rejects non-numeric page", () => {
      const result = ingredientListQuerySchema.safeParse({
        page: "abc",
      });
      expect(result.success).toBe(false);
    });
  });
});
