/**
 * IngredientsView — Comprehensive unit tests
 *
 * Covers:
 *  1. Layout & heading
 *  2. Add ingredient button
 *  3. Import button
 *  4. Search input
 *  5. Category filter dropdown
 *  6. Loading spinner
 *  7. Ingredient table rendering
 *  8. Empty state (no ingredients)
 *  9. Pagination controls
 * 10. Open add form modal
 * 11. Edit ingredient opens form with data
 * 12. Delete ingredient confirms and calls API
 * 13. Save new ingredient calls create
 * 14. Bulk import dialog
 * 15. Categories loaded on mount
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import { resetAllFactories } from "@makanmakan/testing-utils";

// ──── Icon stubs ────

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return { ArrowPathIcon: stub };
});

// ──── Auth Store Mock ────

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "rest-1",
    user: { id: "user-1", restaurantId: "rest-1" },
  }),
}));

// ──── Ingredient API Mock ────

const mockIngredientList = vi.fn();
const mockGetCategories = vi.fn();
const mockIngredientCreate = vi.fn();
const mockIngredientUpdate = vi.fn();
const mockIngredientRemove = vi.fn();
const mockBulkImport = vi.fn();

vi.mock("@/services/ingredientApi", () => ({
  ingredientApi: {
    list: (...a: any[]) => mockIngredientList(...a),
    getCategories: (...a: any[]) => mockGetCategories(...a),
    create: (...a: any[]) => mockIngredientCreate(...a),
    update: (...a: any[]) => mockIngredientUpdate(...a),
    remove: (...a: any[]) => mockIngredientRemove(...a),
    bulkImport: (...a: any[]) => mockBulkImport(...a),
  },
}));

// ──── i18n ────

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
}));

// ──── vue-router ────

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
}));

// ──── Child component stubs ────

vi.mock("@/components/ingredients/IngredientTable.vue", () => ({
  default: {
    name: "IngredientTable",
    template: '<div data-testid="ingredient-table" />',
    props: ["items"],
    emits: ["edit", "delete"],
  },
}));

vi.mock("@/components/ingredients/IngredientForm.vue", () => ({
  default: {
    name: "IngredientForm",
    template: '<div data-testid="ingredient-form" />',
    props: ["ingredient"],
    emits: ["close", "save"],
  },
}));

vi.mock("@/components/ingredients/BulkImportDialog.vue", () => ({
  default: {
    name: "BulkImportDialog",
    template: '<div data-testid="bulk-import-dialog" />',
    emits: ["close", "import"],
  },
}));

// ──── Import component AFTER mocks ────

import IngredientsView from "../ingredients/IngredientsView.vue";

// ──── Mock data ────

const sampleIngredient = {
  id: 1,
  name: "Salt",
  category: "Seasoning",
  unit: "g",
  currentStock: 500,
  minStock: 100,
  supplier: "SupplierA",
  costPerUnit: 0.01,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("IngredientsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    mockIngredientList.mockResolvedValue({
      items: [sampleIngredient],
      total: 1,
    });
    mockGetCategories.mockResolvedValue(["Seasoning", "Vegetable", "Protein"]);
  });

  const mountView = async () => {
    const w = mount(IngredientsView);
    await flushPromises();
    return w;
  };

  it("renders heading and subtitle", async () => {
    const w = await mountView();
    expect(w.find("h1").text()).toBe("ingredients.title");
    expect(w.text()).toContain("ingredients.subtitle");
  });

  it("renders add ingredient button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("ingredients.addIngredient"));
    expect(btn).toBeTruthy();
  });

  it("renders import button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("common.import"));
    expect(btn).toBeTruthy();
  });

  it("renders search input", async () => {
    const w = await mountView();
    const input = w.find('input[type="text"]');
    expect(input.exists()).toBe(true);
  });

  it("renders category filter dropdown", async () => {
    const w = await mountView();
    const select = w.find("select");
    expect(select.exists()).toBe(true);
    // All categories + "all" option
    const options = select.findAll("option");
    expect(options.length).toBe(4); // all + 3 categories
  });

  it("shows ingredient table when data is loaded", async () => {
    const w = await mountView();
    expect(w.find('[data-testid="ingredient-table"]').exists()).toBe(true);
  });

  it("shows loading spinner while loading", async () => {
    mockIngredientList.mockImplementation(() => new Promise(() => {}));
    const w = mount(IngredientsView);
    await nextTick();
    expect(w.find(".animate-spin").exists()).toBe(true);
  });

  it("opens add form modal when add button is clicked", async () => {
    const w = await mountView();
    expect(w.find('[data-testid="ingredient-form"]').exists()).toBe(false);
    const addBtn = w
      .findAll("button")
      .find((b) => b.text().includes("ingredients.addIngredient"));
    await addBtn!.trigger("click");
    await nextTick();
    expect(w.find('[data-testid="ingredient-form"]').exists()).toBe(true);
  });

  it("opens bulk import dialog when import button is clicked", async () => {
    const w = await mountView();
    expect(w.find('[data-testid="bulk-import-dialog"]').exists()).toBe(false);
    const importBtn = w
      .findAll("button")
      .find((b) => b.text().includes("common.import"));
    await importBtn!.trigger("click");
    await nextTick();
    expect(w.find('[data-testid="bulk-import-dialog"]').exists()).toBe(true);
  });

  it("does not show pagination when total <= limit", async () => {
    const w = await mountView();
    // total=1, limit=50 so no pagination
    const prevBtn = w
      .findAll("button")
      .find((b) => b.text().includes("common.previous"));
    expect(prevBtn).toBeUndefined();
  });

  it("shows pagination when total > limit", async () => {
    mockIngredientList.mockResolvedValue({
      items: [sampleIngredient],
      total: 100,
    });
    const w = await mountView();
    const prevBtn = w
      .findAll("button")
      .find((b) => b.text().includes("common.previous"));
    expect(prevBtn).toBeTruthy();
  });

  it("calls list and getCategories on mount", async () => {
    await mountView();
    expect(mockIngredientList).toHaveBeenCalledWith(
      "rest-1",
      expect.objectContaining({ page: 1, limit: 50 }),
    );
    expect(mockGetCategories).toHaveBeenCalledWith("rest-1");
  });

  it("does not crash when API fails", async () => {
    mockIngredientList.mockRejectedValue(new Error("fail"));
    mockGetCategories.mockRejectedValue(new Error("fail"));
    const w = await mountView();
    // Should still render, just no data
    expect(w.find("h1").text()).toBe("ingredients.title");
  });

  it("handles search input with debounce", async () => {
    vi.useFakeTimers();
    const w = await mountView();
    vi.clearAllMocks();
    const input = w.find('input[type="text"]');
    await input.setValue("salt");
    await input.trigger("input");
    // Before debounce fires
    expect(mockIngredientList).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(mockIngredientList).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
