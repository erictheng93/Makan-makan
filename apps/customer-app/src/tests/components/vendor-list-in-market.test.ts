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
        deliveryOnly: false,
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
        deliveryOnly: false,
        hasMore: false,
      },
    });

    expect(wrapper.find('[data-testid="vendor-list-load-more"]').exists()).toBe(
      false,
    );
  });

  it("emits delivery filter changes for market vendors", async () => {
    const wrapper = mount(VendorListInMarket, {
      props: {
        vendors: [vendor({ supportsDelivery: true })],
        loading: false,
        query: "",
        takeawayOnly: false,
        deliveryOnly: false,
      },
    });

    await wrapper.get('[data-testid="vendor-delivery-filter"]').setValue(true);

    expect(wrapper.emitted("update:deliveryOnly")).toEqual([[true]]);
  });

  it("shows stall numbers and exposes a direct menu and service entry point", async () => {
    const wrapper = mount(VendorListInMarket, {
      props: {
        vendors: [vendor()],
        loading: false,
        query: "",
        takeawayOnly: false,
        deliveryOnly: false,
      },
    });

    expect(wrapper.text()).toContain("攤位 A-01");

    await wrapper
      .get('[data-testid="open-vendor-menu-restaurant-1"]')
      .trigger("click");

    expect(wrapper.emitted("selectVendor")?.[0]).toEqual([vendor()]);
  });
});
