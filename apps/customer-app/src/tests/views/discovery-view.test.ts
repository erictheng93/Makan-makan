import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DiscoveryView from "@/views/DiscoveryView.vue";
import { discoveryApi } from "@/services/discoveryApi";
import { marketsApi } from "@/services/marketsApi";
import { useDiscoveryStore } from "@/stores/discovery";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${params.count}`,
  }),
}));

vi.mock("@/stores/discovery", () => ({
  useDiscoveryStore: vi.fn(),
}));

vi.mock("@/services/discoveryApi", () => ({
  discoveryApi: {
    getTakeawayEligibility: vi.fn(),
    listCategories: vi.fn(),
  },
}));

vi.mock("@/services/marketsApi", () => ({
  marketsApi: {
    listMarkets: vi.fn(),
    listAreas: vi.fn(),
  },
}));

function dish() {
  return {
    menuItemId: 42,
    dishName: "章魚燒",
    price: 80,
    categoryName: "小吃",
    restaurantId: "restaurant-1",
    restaurantName: "章魚燒攤",
    district: "西屯區",
    isOpen: true,
    supportsTakeaway: true,
    supportsDelivery: false,
    tags: [],
  };
}

function discoveryStore(overrides: Record<string, unknown> = {}) {
  return {
    searchQuery: "章魚燒",
    popularKeywords: [],
    filters: {},
    loading: false,
    error: null,
    isSearchMode: true,
    dishResults: [dish()],
    restaurantResults: [],
    popularDishes: [],
    popularRestaurants: [],
    hasResults: true,
    total: 1,
    searchDishes: vi.fn(),
    clearSearch: vi.fn(),
    updateFilters: vi.fn(),
    loadPopular: vi.fn(),
    browseRestaurants: vi.fn(),
    ...overrides,
  };
}

function mountView() {
  return mount(DiscoveryView, {
    global: {
      stubs: {
        SearchBar: true,
        FilterPanel: {
          props: ["cities", "districts", "categories"],
          template: `
            <div>
              <div data-testid="city-filter-options">{{ cities.join(",") }}</div>
              <div data-testid="district-filter-options">{{ districts.join(",") }}</div>
              <div data-testid="category-filter-options">{{ categories.join(",") }}</div>
            </div>
          `,
        },
        DishResultCard: {
          props: ["dish"],
          emits: ["select", "takeaway"],
          template: `
            <article>
              <button data-testid="select-dish" @click="$emit('select', dish)">
                select dish
              </button>
              <button
                data-testid="takeaway-dish"
                @click="$emit('takeaway', dish)"
              >
                takeaway dish
              </button>
            </article>
          `,
        },
        RestaurantCard: true,
      },
    },
  });
}

describe("DiscoveryView", () => {
  beforeEach(() => {
    routerPush.mockReset();
    vi.mocked(marketsApi.listMarkets).mockResolvedValue({
      markets: [],
      total: 0,
      page: 1,
      limit: 20,
    } as never);
    vi.mocked(marketsApi.listAreas).mockResolvedValue({
      areas: [],
    } as never);
    vi.mocked(discoveryApi.listCategories).mockResolvedValue({
      categories: [],
    } as never);
    vi.mocked(useDiscoveryStore).mockReturnValue(discoveryStore() as never);
  });

  it("opens a dish result in the shop menu with a stable item deep link", async () => {
    const wrapper = mountView();

    await wrapper.get('[data-testid="select-dish"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "ShopMenu",
      params: { restaurantId: "restaurant-1" },
      query: { itemId: "42" },
    });
  });

  it("starts takeaway for a dish result with the item deep link preserved", async () => {
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
      query: { qr: "SHOP-restaurant-1", itemId: "42" },
    });
  });

  it("lets customers scope discovery searches to a market", async () => {
    vi.mocked(marketsApi.listMarkets).mockResolvedValueOnce({
      markets: [
        {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    } as never);
    const store = discoveryStore({
      filters: {},
      updateFilters: vi.fn(),
    });
    vi.mocked(useDiscoveryStore).mockReturnValue(store as never);

    const wrapper = mountView();
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("逢甲夜市");
    });
    await wrapper.get('[data-testid="discovery-market-chip"]').trigger("click");

    expect(store.updateFilters).toHaveBeenCalledWith({
      marketId: "market-1",
    });
  });

  it("builds city and district filters from public market areas", async () => {
    vi.mocked(marketsApi.listAreas).mockResolvedValueOnce({
      areas: [
        { city: "台中市", districts: ["西屯區", "北區"] },
        { city: "台北市", districts: ["萬華區"] },
      ],
    } as never);

    const wrapper = mountView();

    await vi.waitFor(() => {
      expect(
        wrapper.get('[data-testid="city-filter-options"]').text(),
      ).toContain("台北市");
      expect(
        wrapper.get('[data-testid="district-filter-options"]').text(),
      ).toContain("萬華區");
    });
    expect(
      wrapper.get('[data-testid="district-filter-options"]').text(),
    ).toContain("西屯區");
  });

  it("loads category filters with the selected market scope", async () => {
    vi.mocked(discoveryApi.listCategories).mockResolvedValueOnce({
      categories: ["小吃", "飲品"],
    } as never);
    const store = discoveryStore({
      filters: { marketId: "market-1" },
    });
    vi.mocked(useDiscoveryStore).mockReturnValue(store as never);

    const wrapper = mountView();

    await vi.waitFor(() => {
      expect(
        wrapper.get('[data-testid="category-filter-options"]').text(),
      ).toContain("飲品");
    });
    expect(discoveryApi.listCategories).toHaveBeenCalledWith({
      city: undefined,
      district: undefined,
      marketId: "market-1",
      takeaway: undefined,
      delivery: undefined,
    });
  });
});
