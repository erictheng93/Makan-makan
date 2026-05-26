import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MarketProductSearch from "@/components/markets/MarketProductSearch.vue";
import { discoveryApi } from "@/services/discoveryApi";

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => `$${value}`,
  }),
}));

vi.mock("@/services/discoveryApi", () => ({
  discoveryApi: {
    searchDishes: vi.fn(),
  },
}));

describe("MarketProductSearch", () => {
  it("searches products within the selected market", async () => {
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [
        {
          menuItemId: 1,
          dishName: "章魚燒",
          price: 80,
          categoryName: "小吃",
          restaurantId: "r1",
          restaurantName: "一中章魚燒",
          district: "北區",
          isOpen: true,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: ["熱門"],
        },
      ],
      total: 1,
    } as never);

    const wrapper = mount(MarketProductSearch, {
      props: {
        marketId: "market-1",
      },
    });

    await wrapper
      .get('[data-testid="market-product-search-input"]')
      .setValue("章魚燒");
    await wrapper.get("form").trigger("submit.prevent");

    expect(discoveryApi.searchDishes).toHaveBeenCalledWith({
      q: "章魚燒",
      marketId: "market-1",
      takeaway: undefined,
      page: 1,
      limit: 20,
    });
    expect(wrapper.text()).toContain("章魚燒");
    expect(wrapper.text()).toContain("一中章魚燒");
  });

  it("emits takeaway from a market-scoped product result", async () => {
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [
        {
          menuItemId: 2,
          dishName: "地瓜球",
          price: 50,
          categoryName: null,
          restaurantId: "r2",
          restaurantName: "甜點攤",
          district: "西屯區",
          isOpen: true,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: [],
        },
      ],
      total: 1,
    } as never);

    const wrapper = mount(MarketProductSearch, {
      props: {
        marketId: "market-1",
      },
    });

    await wrapper
      .get('[data-testid="market-product-search-input"]')
      .setValue("地瓜球");
    await wrapper.get("form").trigger("submit.prevent");
    await wrapper.get('[data-testid="dish-takeaway-button"]').trigger("click");

    expect(wrapper.emitted("takeaway")?.[0][0]).toMatchObject({
      restaurantId: "r2",
      dishName: "地瓜球",
    });
  });
});
