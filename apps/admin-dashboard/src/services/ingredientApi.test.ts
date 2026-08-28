import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { ingredientApi } from "./ingredientApi";
import type { IngredientDefinitionResponse } from "@makanmasak/shared-types";

vi.mock("./api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function ingredient(id: number): IngredientDefinitionResponse {
  return {
    id,
    name: `Ingredient ${id}`,
    unit: "kg",
    category: null,
    costPerUnit: null,
    supplier: null,
    minStockLevel: null,
    currentStock: null,
    isActive: true,
  };
}

describe("ingredientApi recipe sources", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests unavailable menu items for recipe editing", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: { menuItems: [{ id: 10, name: "Paused dish" }] } },
    } as never);

    await expect(ingredientApi.listMenuItems("restaurant-1")).resolves.toEqual([
      { id: 10, name: "Paused dish" },
    ]);
    expect(api.get).toHaveBeenCalledWith("/menu/restaurant-1", {
      includeAll: "true",
    });
  });

  it("loads every ingredient page without table filters", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        data: { data: { items: [ingredient(1)], total: 2 } },
      } as never)
      .mockResolvedValueOnce({
        data: { data: { items: [ingredient(2)], total: 2 } },
      } as never);

    await expect(ingredientApi.listAll("restaurant-1", 1)).resolves.toEqual([
      ingredient(1),
      ingredient(2),
    ]);
    expect(api.get).toHaveBeenNthCalledWith(1, "/ingredients/restaurant-1", {
      page: "1",
      limit: "1",
    });
    expect(api.get).toHaveBeenNthCalledWith(2, "/ingredients/restaurant-1", {
      page: "2",
      limit: "1",
    });
  });
});
