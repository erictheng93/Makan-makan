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
        MarketCard: true,
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
});
