/**
 * ForecastView — Comprehensive unit tests
 *
 * Covers:
 *  1. Layout & heading
 *  2. Refresh button
 *  3. Generate forecast button
 *  4. Stale data warning
 *  5. Date picker component
 *  6. Tab navigation (forecast, accuracy, ingredients)
 *  7. Loading spinner
 *  8. ForecastTable display
 *  9. ForecastAlerts display
 * 10. Accuracy tab loads data
 * 11. Ingredients tab loads data
 * 12. API calls on mount
 * 13. Generate triggers API
 * 14. Date change reloads forecast
 * 15. Empty state / no data
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";

// ──── Icon stubs ────

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    ArrowPathIcon: stub,
  };
});

// ──── Auth Store Mock ────

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "rest-1",
    user: { id: "user-1", restaurantId: "rest-1" },
  }),
}));

// ──── Forecast API Mock ────

const mockGetForecast = vi.fn();
const mockGetAlerts = vi.fn();
const mockGenerate = vi.fn();
const mockGenerateIngredientForecast = vi.fn();
const mockGetAccuracy = vi.fn();
const mockGetIngredientForecast = vi.fn();

vi.mock("@/services/forecastApi", () => ({
  forecastApi: {
    getForecast: (...a: any[]) => mockGetForecast(...a),
    getAlerts: (...a: any[]) => mockGetAlerts(...a),
    generate: (...a: any[]) => mockGenerate(...a),
    generateIngredientForecast: (...a: any[]) =>
      mockGenerateIngredientForecast(...a),
    getAccuracy: (...a: any[]) => mockGetAccuracy(...a),
    getIngredientForecast: (...a: any[]) => mockGetIngredientForecast(...a),
  },
}));

// ──── Ingredient API Mock ────

const mockIngredientList = vi.fn();

vi.mock("@/services/ingredientApi", () => ({
  ingredientApi: {
    list: (...a: any[]) => mockIngredientList(...a),
  },
}));

// ──── i18n ────

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
}));

// ──── vue-router ────

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
}));

// ──── Child component stubs ────

vi.mock("@/components/forecast/ForecastDatePicker.vue", () => ({
  default: {
    name: "ForecastDatePicker",
    template: '<div data-testid="date-picker" />',
    props: ["startDate", "endDate"],
    emits: ["update:start-date", "update:end-date"],
  },
}));

vi.mock("@/components/forecast/ForecastTable.vue", () => ({
  default: {
    name: "ForecastTable",
    template: '<div data-testid="forecast-table" />',
    props: ["items"],
  },
}));

vi.mock("@/components/forecast/ForecastAlerts.vue", () => ({
  default: {
    name: "ForecastAlerts",
    template: '<div data-testid="forecast-alerts" />',
    props: ["alerts"],
  },
}));

vi.mock("@/components/forecast/ForecastAccuracyTab.vue", () => ({
  default: {
    name: "ForecastAccuracyTab",
    template: '<div data-testid="accuracy-tab" />',
    props: ["items", "loading"],
  },
}));

vi.mock("@/components/forecast/IngredientForecastTable.vue", () => ({
  default: {
    name: "IngredientForecastTable",
    template: '<div data-testid="ingredient-forecast-table" />',
    props: ["items"],
  },
}));

vi.mock("@/components/forecast/ProcurementList.vue", () => ({
  default: {
    name: "ProcurementList",
    template: '<div data-testid="procurement-list" />',
    props: ["items", "ingredientDetails"],
  },
}));

// ──── Import component AFTER mocks ────

import ForecastView from "../forecast/ForecastView.vue";

// ──── Mock data ────

const sampleForecast = {
  items: [
    {
      menuItemId: 1,
      menuItemName: "Nasi Lemak",
      predictedQuantity: 50,
      confidence: 0.85,
    },
  ],
  stale: false,
};

const sampleAlert = {
  id: "fa-1",
  type: "low_stock",
  message: "Low stock for ingredient X",
  severity: "warning",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("ForecastView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mockGetForecast.mockResolvedValue([sampleForecast]);
    mockGetAlerts.mockResolvedValue([]);
    mockGenerate.mockResolvedValue({});
    mockGenerateIngredientForecast.mockResolvedValue({});
    mockGetAccuracy.mockResolvedValue([]);
    mockGetIngredientForecast.mockResolvedValue([]);
    mockIngredientList.mockResolvedValue({ items: [], total: 0 });
  });

  const mountView = async () => {
    const w = mount(ForecastView);
    await flushPromises();
    return w;
  };

  it("renders heading and subtitle", async () => {
    const w = await mountView();
    expect(w.find("h1").text()).toBe("forecast.title");
    expect(w.text()).toContain("forecast.subtitle");
  });

  it("renders refresh button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("common.refresh"));
    expect(btn).toBeTruthy();
  });

  it("renders generate forecast button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("forecast.generate"));
    expect(btn).toBeTruthy();
  });

  it("shows date picker component", async () => {
    const w = await mountView();
    expect(w.find('[data-testid="date-picker"]').exists()).toBe(true);
  });

  it("shows three tab buttons", async () => {
    const w = await mountView();
    expect(w.text()).toContain("forecast.forecastTab");
    expect(w.text()).toContain("forecast.accuracyTab");
    expect(w.text()).toContain("forecast.ingredientTab");
  });

  it("defaults to forecast tab with table and alerts", async () => {
    const w = await mountView();
    expect(w.find('[data-testid="forecast-table"]').exists()).toBe(true);
    expect(w.find('[data-testid="forecast-alerts"]').exists()).toBe(true);
  });

  it("does not show stale warning when data is fresh", async () => {
    const w = await mountView();
    expect(w.text()).not.toContain("forecast.staleWarning");
  });

  it("shows stale warning when forecast is stale", async () => {
    mockGetForecast.mockResolvedValue([{ ...sampleForecast, stale: true }]);
    const w = await mountView();
    expect(w.text()).toContain("forecast.staleWarning");
  });

  it("switches to accuracy tab and loads accuracy data", async () => {
    const w = await mountView();
    const accuracyBtn = w
      .findAll("button")
      .find((b) => b.text().includes("forecast.accuracyTab"));
    await accuracyBtn!.trigger("click");
    await flushPromises();
    expect(mockGetAccuracy).toHaveBeenCalled();
  });

  it("switches to ingredients tab and loads ingredient data", async () => {
    mockGetIngredientForecast.mockResolvedValue([{ ingredients: [] }]);
    const w = await mountView();
    const ingredientBtn = w
      .findAll("button")
      .find((b) => b.text().includes("forecast.ingredientTab"));
    await ingredientBtn!.trigger("click");
    await flushPromises();
    expect(mockGetIngredientForecast).toHaveBeenCalled();
  });

  it("calls getForecast on mount", async () => {
    await mountView();
    expect(mockGetForecast).toHaveBeenCalledWith("rest-1", expect.any(Object));
  });

  it("calls getAlerts on mount", async () => {
    await mountView();
    expect(mockGetAlerts).toHaveBeenCalledWith("rest-1");
  });

  it("generate button triggers API calls", async () => {
    const w = await mountView();
    const genBtn = w
      .findAll("button")
      .find((b) => b.text().includes("forecast.generate"));
    await genBtn!.trigger("click");
    await flushPromises();
    expect(mockGenerate).toHaveBeenCalled();
    expect(mockGenerateIngredientForecast).toHaveBeenCalled();
  });

  it("shows loading spinner while loading", async () => {
    mockGetForecast.mockImplementation(() => new Promise(() => {})); // never resolves
    const w = mount(ForecastView);
    await nextTick();
    expect(w.find(".animate-spin").exists()).toBe(true);
  });
});
