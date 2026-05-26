import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import VendorListInMarket from "@/components/markets/VendorListInMarket.vue";
import type { MarketVendor } from "@/services/marketsApi";

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("@/utils/i18n", () => ({
  translate: (key: string) => key,
}));

function vendor(overrides: Partial<MarketVendor> = {}): MarketVendor {
  return {
    restaurantId: "restaurant-1",
    name: "雞排攤",
    type: "market_stall",
    district: "西屯區",
    priceRange: null,
    rating: null,
    isOpen: true,
    supportsTakeaway: true,
    supportsDelivery: false,
    imageUrl: null,
    stallNumber: "A-01",
    isPrimary: true,
    ...overrides,
  };
}

describe("VendorListInMarket", () => {
  it("emits loadMore when more market vendors are available", async () => {
    const wrapper = mount(VendorListInMarket, {
      props: {
        vendors: [vendor()],
        loading: false,
        query: "",
        takeawayOnly: false,
        hasMore: true,
      },
    });

    await wrapper.get('[data-testid="vendor-list-load-more"]').trigger("click");

    expect(wrapper.emitted("loadMore")).toHaveLength(1);
  });

  it("hides load more when all market vendors are loaded", () => {
    const wrapper = mount(VendorListInMarket, {
      props: {
        vendors: [vendor()],
        loading: false,
        query: "",
        takeawayOnly: false,
        hasMore: false,
      },
    });

    expect(wrapper.find('[data-testid="vendor-list-load-more"]').exists()).toBe(
      false,
    );
  });
});
