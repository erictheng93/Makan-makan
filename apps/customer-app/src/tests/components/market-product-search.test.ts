import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MarketProductSearch from "@/components/markets/MarketProductSearch.vue";
import {
  discoveryApi,
  type DishSearchResult,
  type ServiceSearchResult,
} from "@/services/discoveryApi";

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
    searchServices: vi.fn(),
    listCategories: vi.fn(),
  },
}));

describe("MarketProductSearch", () => {
  beforeEach(() => {
    vi.mocked(discoveryApi.listCategories).mockResolvedValue({
      categories: [],
    } as never);
    vi.mocked(discoveryApi.searchServices).mockResolvedValue({
      results: [],
      total: 0,
    } as never);
  });

  function dish(overrides: Partial<DishSearchResult> = {}): DishSearchResult {
    return {
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
      ...overrides,
    };
  }

  function service(
    overrides: Partial<ServiceSearchResult> = {},
  ): ServiceSearchResult {
    return {
      serviceItemId: 10,
      name: "代客切水果",
      description: "現場代切並分裝",
      serviceType: "general",
      priceCents: 3000,
      priceLabel: null,
      durationMinutes: null,
      requiresBooking: false,
      bookingUrl: null,
      tags: ["水果"],
      restaurantId: "service-r1",
      restaurantName: "水果攤",
      district: "西屯區",
      city: "台中市",
      isOpen: true,
      ...overrides,
    };
  }

  it("searches products within the selected market", async () => {
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [dish()],
      total: 1,
    } as never);

    const wrapper = mount(MarketProductSearch, {
      props: {
        marketId: "market-1",
        categories: ["小吃", "飲品"],
      },
    });

    await wrapper
      .get('[data-testid="market-product-search-input"]')
      .setValue("章魚燒");
    await wrapper
      .get('[data-testid="market-product-category-select"]')
      .setValue("小吃");
    await wrapper
      .get('[data-testid="market-product-sort-select"]')
      .setValue("popular");
    await wrapper.get("form").trigger("submit.prevent");

    expect(discoveryApi.searchDishes).toHaveBeenCalledWith({
      q: "章魚燒",
      marketId: "market-1",
      categoryName: "小吃",
      sortBy: "popular",
      takeaway: undefined,
      page: 1,
      limit: 20,
    });
    expect(wrapper.text()).toContain("章魚燒");
    expect(wrapper.text()).toContain("一中章魚燒");
  });

  it("searches and renders service items within the selected market", async () => {
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [dish()],
      total: 1,
    } as never);
    vi.mocked(discoveryApi.searchServices).mockResolvedValueOnce({
      results: [service()],
      total: 1,
    } as never);

    const wrapper = mount(MarketProductSearch, {
      props: {
        marketId: "market-1",
      },
    });

    await wrapper
      .get('[data-testid="market-product-search-input"]')
      .setValue("切水果");
    await wrapper.get("form").trigger("submit.prevent");

    expect(discoveryApi.searchServices).toHaveBeenCalledWith({
      q: "切水果",
      marketId: "market-1",
      page: 1,
      limit: 20,
    });
    expect(wrapper.text()).toContain("代客切水果");
    expect(wrapper.text()).toContain("水果攤");
    expect(wrapper.text()).toContain("$30");

    await wrapper.get('[data-testid="service-result-open"]').trigger("click");

    expect(wrapper.emitted("selectService")?.[0][0]).toMatchObject({
      restaurantId: "service-r1",
      name: "代客切水果",
    });
  });

  it("loads additional market-scoped product results", async () => {
    vi.mocked(discoveryApi.searchDishes)
      .mockResolvedValueOnce({
        results: Array.from({ length: 20 }, (_, index) =>
          dish({
            menuItemId: index + 1,
            dishName: `章魚燒 ${index + 1}`,
          }),
        ),
        total: 25,
      } as never)
      .mockResolvedValueOnce({
        results: [
          dish({
            menuItemId: 21,
            dishName: "章魚燒 21",
          }),
        ],
        total: 25,
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

    await wrapper
      .get('[data-testid="market-product-load-more"]')
      .trigger("click");

    expect(discoveryApi.searchDishes).toHaveBeenLastCalledWith({
      q: "章魚燒",
      marketId: "market-1",
      categoryName: undefined,
      sortBy: "price_asc",
      takeaway: undefined,
      page: 2,
      limit: 20,
    });
    expect(wrapper.text()).toContain("章魚燒 1");
    expect(wrapper.text()).toContain("章魚燒 21");
  });

  it("browses products by category without a keyword", async () => {
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [
        dish({
          dishName: "珍珠奶茶",
          categoryName: "飲品",
        }),
      ],
      total: 1,
    } as never);

    const wrapper = mount(MarketProductSearch, {
      props: {
        marketId: "market-1",
        categories: ["小吃", "飲品"],
      },
    });

    await wrapper
      .get('[data-testid="market-product-category-select"]')
      .setValue("飲品");
    await wrapper.get("form").trigger("submit.prevent");

    expect(discoveryApi.searchDishes).toHaveBeenCalledWith({
      q: undefined,
      marketId: "market-1",
      categoryName: "飲品",
      sortBy: "price_asc",
      takeaway: undefined,
      page: 1,
      limit: 20,
    });
    expect(wrapper.text()).toContain("珍珠奶茶");
  });

  it("emits takeaway from a market-scoped product result", async () => {
    vi.mocked(discoveryApi.searchDishes).mockResolvedValueOnce({
      results: [
        dish({
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
        }),
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
