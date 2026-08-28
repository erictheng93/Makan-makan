import { describe, expect, it } from "vitest";
import {
  bulkImportSchema,
  ingredientIdParamSchema,
  ingredientListQuerySchema,
  setRecipeSchema,
  updateIngredientSchema,
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

  it("rejects clearing tracked stock because the ledger requires a balance", () => {
    expect(() =>
      updateIngredientSchema.parse({ currentStock: null }),
    ).toThrow();
    expect(updateIngredientSchema.parse({ currentStock: 0 })).toEqual({
      currentStock: 0,
    });
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
      lowStock: false,
    });

    // Both flags are "true"-or-nothing strings on the wire; parsing has to
    // turn an absent one into false rather than undefined, or the service
    // would treat it as unset and skip the condition entirely.
    expect(ingredientListQuerySchema.parse({ lowStock: "true" })).toMatchObject(
      { lowStock: true, includeInactive: false },
    );
  });

  it("accepts an empty recipe, which is the only way to clear one", () => {
    // PUT is the sole writer — there is no DELETE route for a recipe — so a
    // `.min(1)` here left the owner unable to remove the last row, and unable
    // to delete the ingredient it referenced either (#287). setRecipe is
    // DELETE-then-conditionally-INSERT, so the empty array is a real clear.
    expect(setRecipeSchema.parse({ ingredients: [] })).toEqual({
      ingredients: [],
    });

    // bulkImportSchema keeps its own `.min(1)` on purpose: an import of nothing
    // is a malformed request, not an instruction to empty anything.
    expect(() => bulkImportSchema.parse({ ingredients: [] })).toThrow(
      "At least one ingredient is required",
    );
  });
});
