import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketDetailView from "@/views/MarketDetailView.vue";
import { discoveryApi } from "@/services/discoveryApi";
import { useMarketsStore } from "@/stores/markets";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: { slug: "fengjia" },
    fullPath: "/markets/fengjia",
  }),
  useRouter: () => ({
    push: routerPush,
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
    loading: false,
    vendorsLoading: false,
    error: null,
    loadMarketDetail: vi.fn().mockResolvedValue(undefined),
    loadVendors: vi.fn().mockResolvedValue(undefined),
    resetSelectedMarket: vi.fn(),
    ...overrides,
  };
}

function mountView() {
  return mount(MarketDetailView, {
    global: {
      stubs: {
        MarketDetailHero: true,
        VendorListInMarket: true,
        MarketProductSearch: {
          props: ["marketId"],
          emits: ["select", "takeaway"],
          template: `
            <section data-testid="market-product-search">
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
    vi.mocked(useMarketsStore).mockReturnValue(marketStore() as never);
  });

  it("opens a market dish result in the shop menu with a stable item deep link", async () => {
    const wrapper = mountView();

    await wrapper.get('[data-testid="select-dish"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "ShopMenu",
      params: { restaurantId: "restaurant-1" },
      query: { itemId: "42", categoryName: "小吃" },
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
});
