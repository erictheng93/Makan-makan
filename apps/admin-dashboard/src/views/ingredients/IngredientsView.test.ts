// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IngredientsView from "./IngredientsView.vue";
import type { IngredientDefinitionResponse } from "@makanmasak/shared-types";

const ingredientApi = vi.hoisted(() => ({
  list: vi.fn(),
  listAll: vi.fn(),
  getCategories: vi.fn(),
  listMenuItems: vi.fn(),
  getMissingRecipes: vi.fn(),
  getRecipe: vi.fn(),
  setRecipe: vi.fn(),
}));

vi.mock("@/services/ingredientApi", () => ({ ingredientApi }));
vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: "restaurant-1" }),
}));
vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({ confirm: vi.fn() }),
}));
vi.mock("@makanmasak/shared/utils/user-facing-error", () => ({
  resolveUserFacingError: () => ({ message: "recipe load failed" }),
}));

function ingredient(id: number, name: string): IngredientDefinitionResponse {
  return {
    id,
    name,
    unit: "kg",
    category: null,
    costPerUnit: null,
    supplier: null,
    minStockLevel: null,
    currentStock: 10,
    isActive: true,
  };
}

function mountView() {
  return mount(IngredientsView, {
    global: {
      stubs: {
        IngredientTable: true,
        IngredientForm: true,
        BulkImportDialog: true,
        StockAdjustDialog: true,
        RecipeEditor: {
          name: "RecipeEditor",
          props: [
            "menuItemId",
            "menuItemName",
            "initialEntries",
            "availableIngredients",
          ],
          template: '<div data-testid="recipe-editor" />',
        },
      },
    },
  });
}

async function openDish(wrapper: ReturnType<typeof mountView>) {
  await wrapper.get('[data-testid="open-recipes"]').trigger("click");
  await flushPromises();
  await wrapper.get('[data-testid="edit-recipe-10"]').trigger("click");
  await flushPromises();
}

describe("IngredientsView recipe editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ingredientApi.list.mockResolvedValue({
      items: [ingredient(1, "Visible ingredient")],
      total: 1,
    });
    ingredientApi.listAll.mockResolvedValue([
      ingredient(1, "Visible ingredient"),
      ingredient(101, "Ingredient from another page"),
    ]);
    ingredientApi.getCategories.mockResolvedValue([]);
    ingredientApi.listMenuItems.mockResolvedValue([
      { id: 10, name: "Unavailable dish" },
    ]);
    ingredientApi.getMissingRecipes.mockResolvedValue([]);
    ingredientApi.getRecipe.mockResolvedValue([]);
  });

  it("keeps the editor closed and surfaces an error when recipe loading fails", async () => {
    ingredientApi.getRecipe.mockRejectedValueOnce(new Error("network error"));
    const wrapper = mountView();
    await flushPromises();

    await openDish(wrapper);

    expect(wrapper.find('[data-testid="recipe-editor"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="recipe-error"]').text()).toBe(
      "recipe load failed",
    );
    expect(wrapper.find('[data-testid="edit-recipe-10"]').exists()).toBe(true);
  });

  it("uses the complete unfiltered ingredient list in the recipe editor", async () => {
    const wrapper = mountView();
    await flushPromises();

    await openDish(wrapper);

    expect(ingredientApi.listAll).toHaveBeenCalledWith("restaurant-1");
    expect(
      wrapper.getComponent({ name: "RecipeEditor" }).props(),
    ).toMatchObject({
      availableIngredients: [
        ingredient(1, "Visible ingredient"),
        ingredient(101, "Ingredient from another page"),
      ],
    });
  });
});
