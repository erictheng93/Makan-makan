import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketsView from "@/views/MarketsView.vue";
import { marketsApi } from "@/services/marketsApi";
import { useMarketsStore } from "@/stores/markets";

const routerPush = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());
const routeQuery = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock("vue-router", () => ({
  useRoute: () => ({
    fullPath: "/markets?q=夜市&city=台中市&district=西屯區",
    query: routeQuery,
  }),
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
}));

vi.mock("@/stores/markets", () => ({
  useMarketsStore: vi.fn(),
}));

vi.mock("@/services/marketsApi", () => ({
  marketsApi: {
    listAreas: vi.fn(),
  },
}));

function marketsStore(overrides: Record<string, unknown> = {}) {
  return {
    markets: [],
    nearbyMarkets: [],
    loading: false,
    error: null,
    hasMarkets: false,
    hasMoreMarkets: false,
    loadMarkets: vi.fn(),
    loadMoreMarkets: vi.fn(),
    loadNearby: vi.fn(),
    ...overrides,
  };
}

function mountView() {
  return mount(MarketsView, {
    global: {
      stubs: {
        MarketCard: {
          props: ["market"],
          emits: ["select"],
          template: `
            <button
              type="button"
              data-testid="market-card"
              @click="$emit('select', market)"
            >
              {{ market.name }}
            </button>
          `,
        },
      },
    },
  });
}

describe("MarketsView", () => {
  beforeEach(() => {
    routerPush.mockReset();
    routerReplace.mockReset();
    for (const key of Object.keys(routeQuery)) {
      delete routeQuery[key];
    }
    vi.mocked(marketsApi.listAreas).mockResolvedValue({
      areas: [],
    } as never);
    vi.mocked(useMarketsStore).mockReturnValue(marketsStore() as never);
  });

  it("loads city and district filter options from market areas", async () => {
    vi.mocked(marketsApi.listAreas).mockResolvedValueOnce({
      areas: [
        { city: "台中市", districts: ["西屯區"] },
        { city: "台北市", districts: ["萬華區"] },
      ],
    } as never);
    const store = marketsStore();
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("台北市");
    });

    await wrapper.get('[data-testid="markets-city-select"]').setValue("台北市");

    expect(wrapper.text()).toContain("萬華區");
    expect(store.loadMarkets).toHaveBeenLastCalledWith({
      city: "台北市",
      district: undefined,
    });
  });

  it("reloads the market list with a keyword filter", async () => {
    const store = marketsStore();
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    await wrapper.get('[data-testid="markets-search-input"]').setValue("逢甲");
    await wrapper.get('[data-testid="markets-search-form"]').trigger("submit");

    expect(store.loadMarkets).toHaveBeenLastCalledWith({
      q: "逢甲",
      city: undefined,
      district: undefined,
    });
  });

  it("loads more markets with the active keyword and area filters", async () => {
    vi.mocked(marketsApi.listAreas).mockResolvedValueOnce({
      areas: [{ city: "台中市", districts: ["西屯區"] }],
    } as never);
    const store = marketsStore({
      hasMarkets: true,
      hasMoreMarkets: true,
      loadMoreMarkets: vi.fn(),
      markets: [{ id: "m1", slug: "fengjia", name: "逢甲夜市" }],
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("台中市");
    });

    await wrapper.get('[data-testid="markets-search-input"]').setValue("夜市");
    await wrapper.get('[data-testid="markets-city-select"]').setValue("台中市");
    await wrapper
      .get('[data-testid="markets-district-select"]')
      .setValue("西屯區");
    await wrapper.get('[data-testid="markets-load-more"]').trigger("click");

    expect(store.loadMoreMarkets).toHaveBeenCalledWith({
      q: "夜市",
      city: "台中市",
      district: "西屯區",
    });
  });

  it("initializes and syncs market directory filters through the URL", async () => {
    routeQuery.q = "夜市";
    routeQuery.city = "台中市";
    routeQuery.district = "西屯區";
    vi.mocked(marketsApi.listAreas).mockResolvedValueOnce({
      areas: [{ city: "台中市", districts: ["西屯區", "北區"] }],
    } as never);
    const store = marketsStore();
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    expect(store.loadMarkets).toHaveBeenCalledWith({
      q: "夜市",
      city: "台中市",
      district: "西屯區",
    });
    expect(
      (
        wrapper.get('[data-testid="markets-search-input"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("夜市");

    await wrapper.get('[data-testid="markets-search-input"]').setValue("雞排");
    await wrapper.get('[data-testid="markets-city-select"]').setValue("台中市");
    await wrapper
      .get('[data-testid="markets-district-select"]')
      .setValue("北區");
    await wrapper.get('[data-testid="markets-search-form"]').trigger("submit");

    expect(routerReplace).toHaveBeenLastCalledWith({
      query: {
        q: "雞排",
        city: "台中市",
        district: "北區",
      },
    });
  });

  it("filters market directories by venue type through the URL", async () => {
    routeQuery.type = "commercial_district";
    const store = marketsStore();
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    expect(store.loadMarkets).toHaveBeenCalledWith({
      type: "commercial_district",
    });
    expect(
      (
        wrapper.get('[data-testid="markets-type-select"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe("commercial_district");

    await wrapper
      .get('[data-testid="markets-type-select"]')
      .setValue("night_market");

    expect(store.loadMarkets).toHaveBeenLastCalledWith({
      q: undefined,
      city: undefined,
      district: undefined,
      type: "night_market",
    });
    expect(routerReplace).toHaveBeenLastCalledWith({
      query: { type: "night_market" },
    });
  });

  it("opens a market detail with directory return context", async () => {
    const store = marketsStore({
      hasMarkets: true,
      markets: [{ id: "m1", slug: "fengjia", name: "逢甲夜市" }],
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);
    const wrapper = mountView();

    await wrapper.get('[data-testid="market-card"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "MarketDetail",
      params: { slug: "fengjia" },
      query: {
        returnPath: "/markets?q=夜市&city=台中市&district=西屯區",
        returnLabel: "夜市與商圈",
      },
    });
  });

  it("explains empty market directories before any filters are applied", () => {
    const store = marketsStore({
      hasMarkets: false,
      markets: [],
      nearbyMarkets: [],
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    expect(wrapper.get('[data-testid="markets-empty-state"]').text()).toContain(
      "尚未收錄可瀏覽的夜市或商圈",
    );
    expect(wrapper.find('[data-testid="markets-clear-filters"]').exists()).toBe(
      false,
    );
  });

  it("explains filtered empty market directories and clears filters", async () => {
    routeQuery.q = "不存在";
    routeQuery.city = "台中市";
    vi.mocked(marketsApi.listAreas).mockResolvedValueOnce({
      areas: [{ city: "台中市", districts: ["西屯區"] }],
    } as never);
    const store = marketsStore({
      hasMarkets: false,
      markets: [],
      nearbyMarkets: [],
      loadMarkets: vi.fn(),
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    expect(wrapper.get('[data-testid="markets-empty-state"]').text()).toContain(
      "沒有符合目前條件的夜市或商圈",
    );

    await wrapper.get('[data-testid="markets-clear-filters"]').trigger("click");

    expect(store.loadMarkets).toHaveBeenLastCalledWith({
      q: undefined,
      city: undefined,
      district: undefined,
    });
    expect(routerReplace).toHaveBeenLastCalledWith({ query: {} });
  });
});
