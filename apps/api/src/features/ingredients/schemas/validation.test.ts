import { describe, expect, it } from "vitest";
import {
  bulkImportSchema,
  ingredientIdParamSchema,
  ingredientListQuerySchema,
  setRecipeSchema,
  updateStockSchema,
} from "./validation";

describe("ingredient validation schemas", () => {
  it("transforms numeric route params", () => {
    expect(
      ingredientIdParamSchema.parse({ restaurantId: "restaurant-1", id: "42" }),
    ).toEqual({
      restaurantId: "restaurant-1",
      id: 42,
    });

    expect(() =>
      ingredientIdParamSchema.parse({ restaurantId: "restaurant-1", id: "x" }),
    ).toThrow("id must be numeric");
  });

  it("validates bulk imports and stock updates", () => {
    expect(
      bulkImportSchema.parse({
        ingredients: [
          {
            name: "Rice",
            unit: "kg",
            costPerUnit: 50,
            currentStock: 10,
          },
        ],
      }),
    ).toMatchObject({
      ingredients: [{ name: "Rice", unit: "kg" }],
    });

    expect(updateStockSchema.parse({ quantity: 0 })).toEqual({ quantity: 0 });
    expect(() => updateStockSchema.parse({ quantity: -1 })).toThrow(
      "Quantity must be non-negative",
    );
  });

  it("defaults optional recipe flags and list filters", () => {
    expect(
      setRecipeSchema.parse({
        ingredients: [
          { ingredientId: 1, quantityPerServing: 0.25, unit: "kg" },
        ],
      }),
    ).toEqual({
      ingredients: [
        {
          ingredientId: 1,
          quantityPerServing: 0.25,
          unit: "kg",
          isOptional: false,
        },
      ],
    });

    expect(
      ingredientListQuerySchema.parse({ includeInactive: "true" }),
    ).toEqual({
      page: 1,
      limit: 50,
      includeInactive: true,
    });
  });
});
