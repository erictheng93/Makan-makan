import { ref } from "vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketsView from "@/views/MarketsView.vue";
import { customerIdentityApi } from "@/services/customerIdentityApi";
import { marketsApi } from "@/services/marketsApi";
import { useMarketsStore } from "@/stores/markets";
import {
  clearCustomerAccessToken,
  setCustomerAccessToken,
} from "@/services/customerAccessToken";

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

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${Object.values(params).join(",")}`,
    currentLanguage: ref("zh-TW"),
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

vi.mock("@/services/customerIdentityApi", () => ({
  customerIdentityApi: {
    listFavorites: vi.fn(),
    listRecentMarkets: vi.fn(),
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
    localStorage.clear();
    clearCustomerAccessToken();
    routerPush.mockReset();
    routerReplace.mockReset();
    for (const key of Object.keys(routeQuery)) {
      delete routeQuery[key];
    }
    vi.mocked(marketsApi.listAreas).mockResolvedValue({
      areas: [],
    } as never);
    vi.mocked(customerIdentityApi.listFavorites).mockReset();
    vi.mocked(customerIdentityApi.listFavorites).mockResolvedValue([]);
    vi.mocked(customerIdentityApi.listRecentMarkets).mockReset();
    vi.mocked(customerIdentityApi.listRecentMarkets).mockResolvedValue([]);
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
        returnPath: "/markets",
        returnLabel: "markets.directory.title",
      },
    });
  });

  it("shows favorite and recent markets before the full directory", async () => {
    localStorage.setItem(
      "makanmakan_favorite_markets",
      JSON.stringify([
        {
          id: "favorite-market",
          slug: "fengjia",
          name: "逢甲夜市",
          city: "台中市",
          district: "西屯區",
          updatedAt: Date.now(),
        },
      ]),
    );
    localStorage.setItem(
      "makanmakan_recent_markets",
      JSON.stringify([
        {
          id: "recent-market",
          slug: "ximen",
          name: "西門町商圈",
          city: "台北市",
          district: "萬華區",
          updatedAt: Date.now(),
        },
      ]),
    );
    const store = marketsStore({
      hasMarkets: true,
      markets: [{ id: "m1", slug: "jingming", name: "精明商圈" }],
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("markets.directory.favorites");
    });
    expect(wrapper.text()).toContain("markets.directory.favorites");
    expect(wrapper.text()).toContain("逢甲夜市");
    expect(wrapper.text()).toContain("markets.directory.recentVisits");
    expect(wrapper.text()).toContain("西門町商圈");
  });

  it("hydrates authenticated market favorites from customer identity", async () => {
    setCustomerAccessToken("customer-token");
    vi.mocked(customerIdentityApi.listFavorites).mockResolvedValueOnce([
      {
        id: 42,
        targetType: "market",
        targetId: "m1",
        createdAtMs: Date.now(),
      },
    ]);
    const store = marketsStore({
      hasMarkets: true,
      markets: [{ id: "m1", slug: "fengjia", name: "逢甲夜市" }],
      loadMarkets: vi.fn(async () => undefined),
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    await vi.waitFor(() => {
      expect(customerIdentityApi.listFavorites).toHaveBeenCalledWith("market");
      expect(wrapper.text()).toContain("markets.directory.favorites");
    });
    expect(wrapper.text()).toContain("逢甲夜市");
    expect(localStorage.getItem("makanmakan_favorite_markets")).toContain(
      "fengjia",
    );
  });

  it("hydrates authenticated recent markets from customer identity", async () => {
    setCustomerAccessToken("customer-token");
    vi.mocked(customerIdentityApi.listRecentMarkets).mockResolvedValueOnce([
      {
        marketId: "m1",
        visitedAtMs: Date.now(),
      },
    ]);
    const store = marketsStore({
      hasMarkets: true,
      markets: [{ id: "m1", slug: "fengjia", name: "逢甲夜市" }],
      loadMarkets: vi.fn(async () => undefined),
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    await vi.waitFor(() => {
      expect(customerIdentityApi.listRecentMarkets).toHaveBeenCalledWith(8);
      expect(wrapper.text()).toContain("markets.directory.recentVisits");
    });
    expect(wrapper.text()).toContain("逢甲夜市");
    expect(localStorage.getItem("makanmakan_recent_markets")).toContain(
      "fengjia",
    );
  });

  it("opens recently submitted market checkouts", async () => {
    localStorage.setItem(
      "makanmakan_recent_market_checkouts",
      JSON.stringify([
        {
          id: "checkout-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          childOrderCount: 2,
          totalAmount: 240,
          paymentStatus: "partial_paid",
          createdAt: "2026-06-01T10:00:00.000Z",
          updatedAt: Date.now(),
        },
      ]),
    );
    const store = marketsStore({
      hasMarkets: true,
      markets: [{ id: "m1", slug: "jingming", name: "精明商圈" }],
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("markets.directory.recentOrders");
    });
    expect(
      wrapper.get('[data-testid="recent-market-checkout"]').text(),
    ).toContain("markets.checkoutStatus.partial_paid");

    await wrapper
      .get('[data-testid="recent-market-checkout"]')
      .trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "MarketCheckoutTracking",
      params: {
        slug: "fengjia",
        checkoutId: "checkout-1",
      },
    });
  });

  it("keeps active directory filters in the market detail return path", async () => {
    routeQuery.q = "餐車";
    routeQuery.city = "台中市";
    routeQuery.district = "西屯區";
    routeQuery.type = "commercial_district";
    const store = marketsStore({
      hasMarkets: true,
      markets: [{ id: "m1", slug: "jingming", name: "精明商圈" }],
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    await wrapper.get('[data-testid="market-card"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "MarketDetail",
      params: { slug: "jingming" },
      query: {
        returnPath:
          "/markets?q=%E9%A4%90%E8%BB%8A&city=%E5%8F%B0%E4%B8%AD%E5%B8%82&district=%E8%A5%BF%E5%B1%AF%E5%8D%80&type=commercial_district",
        returnLabel: "markets.directory.title",
      },
    });
  });

  it("restores nearby market searches from the URL", async () => {
    routeQuery.nearbyLat = "24.1763";
    routeQuery.nearbyLng = "120.6465";
    routeQuery.nearbyRadiusKm = "2";
    const store = marketsStore({
      hasMarkets: true,
      nearbyMarkets: [
        { id: "m1", slug: "fengjia", name: "逢甲夜市", distanceKm: 0.2 },
      ],
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();

    expect(store.loadNearby).toHaveBeenCalledWith({
      lat: 24.1763,
      lng: 120.6465,
      radiusKm: 2,
    });

    await wrapper.get('[data-testid="market-card"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "MarketDetail",
      params: { slug: "fengjia" },
      query: {
        returnPath:
          "/markets?nearbyLat=24.1763&nearbyLng=120.6465&nearbyRadiusKm=2",
        returnLabel: "markets.directory.title",
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
      "markets.directory.emptyNoData",
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
      "markets.directory.emptyFiltered",
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
