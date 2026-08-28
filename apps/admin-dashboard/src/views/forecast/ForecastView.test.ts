// @vitest-environment jsdom
import { flushPromises, mount } from "@vue/test-utils";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const api = vi.hoisted(() => ({
  generate: vi.fn(),
  getForecast: vi.fn(),
  getAlerts: vi.fn(),
  generateIngredientForecast: vi.fn(),
  getIngredientForecast: vi.fn(),
  getAccuracy: vi.fn(),
  list: vi.fn(),
}));
const modules = vi.hoisted(() => ({ inventory: false }));

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: "r1" }),
}));
vi.mock("@makanmasak/shared/stores/moduleAccess", () => ({
  useModuleAccessStore: () => ({
    get effectiveModules() {
      return modules;
    },
  }),
}));
vi.mock("@/services/forecastApi", () => ({ forecastApi: api }));
vi.mock("@/services/ingredientApi", () => ({
  ingredientApi: { list: api.list },
}));
import ForecastView from "./ForecastView.vue";

const stubs = [
  "ForecastDatePicker",
  "ForecastTable",
  "ForecastAlerts",
  "ForecastAccuracyTab",
  "IngredientForecastTable",
  "ProcurementList",
];
function mountView() {
  return mount(ForecastView, { global: { stubs } });
}
function forecast(items: unknown[] = []) {
  return [{ date: "2026-01-02", items }];
}

// The default range is built from local time, so the bug it guards against is
// invisible at UTC+0 — and CI runs in UTC. Force a positive offset, then put it
// back so the worker's other test files are unaffected.
const originalTZ = process.env.TZ;

describe("ForecastView", () => {
  beforeAll(() => {
    process.env.TZ = "Asia/Taipei";
  });
  afterAll(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.clearAllMocks();
    modules.inventory = false;
    api.getForecast.mockResolvedValue(forecast());
    api.getAlerts.mockResolvedValue([]);
    api.generate.mockResolvedValue([]);
    api.generateIngredientForecast.mockResolvedValue([]);
    api.getIngredientForecast.mockResolvedValue(forecast());
    api.list.mockResolvedValue({ items: [], total: 0 });
  });

  it("defaults the range to the local next day before 08:00", async () => {
    // shouldAdvanceTime keeps flushPromises (a setTimeout) resolving.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 2026-01-03 01:00 Taipei. Incrementing the local date and then formatting
    // through toISOString lands on 2026-01-03 — today, labelled 明日.
    vi.setSystemTime(new Date("2026-01-02T17:00:00.000Z"));

    mountView();
    await flushPromises();

    expect(api.getForecast).toHaveBeenCalledWith("r1", {
      startDate: "2026-01-04",
      endDate: "2026-01-04",
    });
  });

  it("uses one ingredient request for inventory and suppresses rapid duplicate generates", async () => {
    modules.inventory = true;
    let release!: () => void;
    api.generateIngredientForecast.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const wrapper = mountView();
    await flushPromises();
    const button = wrapper.findAll("button").at(1)!;
    void button.trigger("click");
    void button.trigger("click");
    await flushPromises();
    expect(api.generateIngredientForecast).toHaveBeenCalledTimes(1);
    expect(api.generate).not.toHaveBeenCalled();
    release();
    await flushPromises();
  });

  it("uses one item request without inventory", async () => {
    const wrapper = mountView();
    await flushPromises();
    await wrapper.findAll("button").at(1)!.trigger("click");
    await flushPromises();
    expect(api.generate).toHaveBeenCalledTimes(1);
    expect(api.generateIngredientForecast).not.toHaveBeenCalled();
  });

  it("renders insufficient-history empty state separately from a load failure", async () => {
    const wrapper = mountView();
    await flushPromises();
    expect(wrapper.text()).toContain("forecast.emptyForecastHistory");
    api.getForecast.mockRejectedValueOnce(new Error("offline"));
    await wrapper.findAll("button").at(0)!.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("forecast.loadFailed");
  });

  it("paginates ingredient details at 100 and shows a visible failure", async () => {
    modules.inventory = true;
    const wrapper = mountView();
    await flushPromises();
    await wrapper
      .get('[data-testid="forecast-ingredient-tab"]')
      .trigger("click");
    await flushPromises();
    api.list
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, id) => ({
          id,
          supplier: null,
          costPerUnit: null,
        })),
        total: 101,
      })
      .mockResolvedValueOnce({
        items: [{ id: 100, supplier: null, costPerUnit: null }],
        total: 101,
      });
    await wrapper
      .get('[data-testid="forecast-ingredient-tab"]')
      .trigger("click");
    await flushPromises();
    expect(api.list).toHaveBeenLastCalledWith("r1", { page: 2, limit: 100 });
    api.list.mockRejectedValueOnce(new Error("offline"));
    await wrapper
      .get('[data-testid="forecast-ingredient-tab"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("forecast.ingredientLoadFailed");
  });
});
