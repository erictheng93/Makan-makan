import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DiscoveryView from "@/views/DiscoveryView.vue";
import { discoveryApi } from "@/services/discoveryApi";
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
        FilterPanel: true,
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
});
