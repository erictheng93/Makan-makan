import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketDetailView from "@/views/MarketDetailView.vue";
import { discoveryApi } from "@/services/discoveryApi";
import { useMarketsStore } from "@/stores/markets";

const routerPush = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());
const routerBack = vi.hoisted(() => vi.fn());
const routeQuery = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: { slug: "fengjia" },
    fullPath: "/markets/fengjia",
    query: routeQuery,
  }),
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
    back: routerBack,
  }),
}));

vi.mock("@/stores/markets", () => ({
  useMarketsStore: vi.fn(),
}));

vi.mock("@/services/discoveryApi", () => ({
  discoveryApi: {
    getTakeawayEligibility: vi.fn(),
  },
}));

vi.mock("@/services/restaurantContactApi", () => ({
  restaurantContactApi: {
    getContactProfile: vi.fn(),
  },
}));

vi.mock("@/utils/seoMeta", () => ({
  applyMarketSeoMeta: vi.fn(),
}));

function marketStore(overrides: Record<string, unknown> = {}) {
  return {
    selectedMarket: {
      id: "market-1",
      slug: "fengjia",
      name: "逢甲夜市",
    },
    vendors: [],
    vendorCount: 0,
    explorationSummary: {
      dishSearchUrl: "/api/v1/discovery/search?marketSlug=fengjia",
      serviceSearchUrl: "/api/v1/discovery/services?marketSlug=fengjia",
      dishCategories: [
        {
          categoryName: "炸物",
          count: 3,
          searchUrl:
            "/api/v1/discovery/search?marketSlug=fengjia&categoryName=%E7%82%B8%E7%89%A9",
        },
      ],
      serviceTypes: [
        {
          serviceType: "pickup",
          count: 2,
          searchUrl:
            "/api/v1/discovery/services?marketSlug=fengjia&serviceType=pickup",
        },
      ],
    },
    loading: false,
    vendorsLoading: false,
    hasMoreVendors: false,
    error: null,
    loadMarketDetail: vi.fn().mockResolvedValue(undefined),
    loadVendors: vi.fn().mockResolvedValue(undefined),
    loadMoreVendors: vi.fn().mockResolvedValue(undefined),
    resetSelectedMarket: vi.fn(),
    ...overrides,
  };
}

function mountView() {
  return mount(MarketDetailView, {
    global: {
      stubs: {
        MarketDetailHero: true,
        VendorListInMarket: {
          props: [
            "vendors",
            "loading",
            "query",
            "takeawayOnly",
            "deliveryOnly",
            "hasMore",
          ],
          emits: [
            "update:query",
            "update:takeawayOnly",
            "update:deliveryOnly",
            "selectVendor",
            "takeaway",
            "contactVendor",
            "loadMore",
          ],
          template: `
            <section data-testid="vendor-list">
              <div data-testid="vendor-list-has-more">{{ hasMore }}</div>
              <button
                data-testid="open-market-vendor"
                @click="$emit('selectVendor', {
                  restaurantId: 'restaurant-1',
                  name: '雞排攤',
                  type: 'market_stall',
                  district: '西屯區',
                  priceRange: null,
                  rating: null,
                  isOpen: true,
                  supportsTakeaway: true,
                  supportsDelivery: false,
                  imageUrl: null,
                  stallNumber: 'A-01',
                  isPrimary: true
                })"
              >
                open vendor
              </button>
              <button
                data-testid="vendor-list-load-more"
                @click="$emit('loadMore')"
              >
                load more vendors
              </button>
              <button
                data-testid="vendor-list-delivery"
                @click="$emit('update:deliveryOnly', true)"
              >
                delivery
              </button>
            </section>
          `,
        },
        MarketProductSearch: {
          props: [
            "marketId",
            "initialQuery",
            "initialCategory",
            "initialServiceType",
            "initialTakeaway",
            "initialDelivery",
            "initialSortBy",
          ],
          emits: ["select", "takeaway", "selectService", "searchStateChange"],
          template: `
            <section data-testid="market-product-search">
              <div data-testid="market-product-search-props">
                {{ initialQuery }}|{{ initialCategory }}|{{ initialServiceType }}|{{ initialTakeaway }}|{{ initialDelivery }}|{{ initialSortBy }}
              </div>
              <button
                data-testid="select-dish"
                @click="$emit('select', {
                  menuItemId: 42,
                  dishName: '章魚燒',
                  price: 80,
                  categoryName: '小吃',
                  restaurantId: 'restaurant-1',
                  restaurantName: '章魚燒攤',
                  district: '西屯區',
                  isOpen: true,
                  supportsTakeaway: true,
                  supportsDelivery: false,
                  tags: []
                })"
              >
                open dish
              </button>
              <button
                data-testid="takeaway-dish"
                @click="$emit('takeaway', {
                  menuItemId: 42,
                  dishName: '章魚燒',
                  price: 80,
                  categoryName: '小吃',
                  restaurantId: 'restaurant-1',
                  restaurantName: '章魚燒攤',
                  district: '西屯區',
                  isOpen: true,
                  supportsTakeaway: true,
                  supportsDelivery: false,
                  tags: []
                })"
              >
                takeaway dish
              </button>
              <button
                data-testid="select-service"
                @click="$emit('selectService', {
                  serviceItemId: 7,
                  name: '代客切水果',
                  description: '現場代切並分裝',
                  serviceType: 'general',
                  priceCents: 3000,
                  priceLabel: null,
                  durationMinutes: null,
                  requiresBooking: false,
                  bookingUrl: null,
                  tags: [],
                  restaurantId: 'service-restaurant-1',
                  restaurantName: '水果攤',
                  district: '西屯區',
                  city: '台中市',
                  isOpen: true
                })"
              >
                open service
              </button>
              <button
                data-testid="sync-market-search"
                @click="$emit('searchStateChange', {
                  q: '雞排',
                  categoryName: '小吃',
                  serviceType: 'delivery',
                  takeaway: true,
                  delivery: true,
                  sortBy: 'popular'
                })"
              >
                sync search
              </button>
            </section>
          `,
        },
      },
    },
  });
}

describe("MarketDetailView", () => {
  beforeEach(() => {
    routerPush.mockReset();
    routerReplace.mockReset();
    routerBack.mockReset();
    for (const key of Object.keys(routeQuery)) {
      delete routeQuery[key];
    }
    vi.mocked(useMarketsStore).mockReturnValue(marketStore() as never);
  });

  it("passes shareable query state into market product search", () => {
    routeQuery.q = "雞排";
    routeQuery.categoryName = "小吃";
    routeQuery.serviceType = "delivery";
    routeQuery.takeaway = "true";
    routeQuery.delivery = "true";
    routeQuery.sortBy = "popular";

    const wrapper = mountView();

    expect(
      wrapper.get('[data-testid="market-product-search-props"]').text(),
    ).toContain("雞排|小吃|delivery|true|true|popular");
  });

  it("syncs market product search state into the URL", async () => {
    const wrapper = mountView();

    await wrapper.get('[data-testid="sync-market-search"]').trigger("click");

    expect(routerReplace).toHaveBeenCalledWith({
      query: {
        q: "雞排",
        categoryName: "小吃",
        serviceType: "delivery",
        takeaway: "true",
        delivery: "true",
        sortBy: "popular",
      },
    });
  });

  it("renders market exploration shortcuts and applies them to product search", async () => {
    const wrapper = mountView();

    expect(
      wrapper.get('[data-testid="market-dish-facet-炸物"]').text(),
    ).toContain("炸物");
    expect(
      wrapper.get('[data-testid="market-service-facet-pickup"]').text(),
    ).toContain("自取");

    await wrapper
      .get('[data-testid="market-dish-facet-炸物"]')
      .trigger("click");

    expect(
      wrapper.get('[data-testid="market-product-search-props"]').text(),
    ).toContain("|炸物||false|false|price_asc");
    expect(routerReplace).toHaveBeenLastCalledWith({
      query: {
        categoryName: "炸物",
      },
    });

    await wrapper
      .get('[data-testid="market-service-facet-pickup"]')
      .trigger("click");

    expect(
      wrapper.get('[data-testid="market-product-search-props"]').text(),
    ).toContain("||pickup|false|false|price_asc");
    expect(routerReplace).toHaveBeenLastCalledWith({
      query: {
        serviceType: "pickup",
      },
    });
  });

  it("preserves directory return context while syncing market search state", async () => {
    routeQuery.returnPath = "/markets?q=夜市&city=台中市";
    routeQuery.returnLabel = "夜市與商圈";
    const wrapper = mountView();

    await wrapper.get('[data-testid="sync-market-search"]').trigger("click");

    expect(routerReplace).toHaveBeenCalledWith({
      query: {
        q: "雞排",
        categoryName: "小吃",
        serviceType: "delivery",
        takeaway: "true",
        delivery: "true",
        sortBy: "popular",
        returnPath: "/markets?q=夜市&city=台中市",
        returnLabel: "夜市與商圈",
      },
    });
  });

  it("opens a market dish result in the shop menu with a stable item deep link", async () => {
    const wrapper = mountView();

    await wrapper.get('[data-testid="select-dish"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "ShopMenu",
      params: { restaurantId: "restaurant-1" },
      query: {
        itemId: "42",
        categoryName: "小吃",
        returnPath: "/markets/fengjia",
        returnLabel: "逢甲夜市",
      },
    });
  });

  it("opens a market vendor in the shop menu with market return context", async () => {
    const wrapper = mountView();

    await wrapper.get('[data-testid="open-market-vendor"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "ShopMenu",
      params: { restaurantId: "restaurant-1" },
      query: {
        returnPath: "/markets/fengjia",
        returnLabel: "逢甲夜市",
      },
    });
  });

  it("starts takeaway for a market dish result through the shop QR entry point", async () => {
    vi.mocked(discoveryApi.getTakeawayEligibility).mockResolvedValueOnce({
      eligible: true,
      shopQrCode: "SHOP-restaurant-1",
    });
    const wrapper = mountView();

    await wrapper.get('[data-testid="takeaway-dish"]').trigger("click");

    expect(discoveryApi.getTakeawayEligibility).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(routerPush).toHaveBeenCalledWith({
      name: "OrderTypeLanding",
      params: { restaurantId: "restaurant-1" },
      query: { qr: "SHOP-restaurant-1", itemId: "42", categoryName: "小吃" },
    });
  });

  it("opens a market service result in the shop menu", async () => {
    const wrapper = mountView();

    await wrapper.get('[data-testid="select-service"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "ShopMenu",
      params: { restaurantId: "service-restaurant-1" },
      query: {
        serviceItemId: "7",
        returnPath: "/markets/fengjia",
        returnLabel: "逢甲夜市",
      },
    });
  });

  it("loads more market vendors without losing the active filters", async () => {
    const store = marketStore({
      hasMoreVendors: true,
      loadMoreVendors: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(useMarketsStore).mockReturnValue(store as never);
    const wrapper = mountView();

    await wrapper.get('[data-testid="vendor-list-load-more"]').trigger("click");

    expect(store.loadMoreVendors).toHaveBeenCalledWith("fengjia", {
      q: undefined,
      takeaway: undefined,
      delivery: undefined,
    });
    expect(wrapper.get('[data-testid="vendor-list-has-more"]').text()).toBe(
      "true",
    );
  });

  it("filters market vendors by delivery support", async () => {
    const store = marketStore();
    vi.mocked(useMarketsStore).mockReturnValue(store as never);
    const wrapper = mountView();

    await wrapper.get('[data-testid="vendor-list-delivery"]').trigger("click");

    expect(store.loadVendors).toHaveBeenCalledWith("fengjia", {
      q: undefined,
      takeaway: undefined,
      delivery: true,
    });
  });

  it("returns to the market directory context when provided", async () => {
    routeQuery.returnPath = "/markets?q=夜市&city=台中市";
    routeQuery.returnLabel = "夜市與商圈";
    const wrapper = mountView();

    await wrapper.get('[data-testid="market-detail-back"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith("/markets?q=夜市&city=台中市");
    expect(routerBack).not.toHaveBeenCalled();
  });

  it("ignores unsafe external return paths", async () => {
    routeQuery.returnPath = "https://example.com/phishing";
    routeQuery.returnLabel = "外部網站";
    const wrapper = mountView();

    await wrapper.get('[data-testid="market-detail-back"]').trigger("click");

    expect(routerPush).not.toHaveBeenCalled();
    expect(routerBack).toHaveBeenCalledTimes(1);
  });
});
