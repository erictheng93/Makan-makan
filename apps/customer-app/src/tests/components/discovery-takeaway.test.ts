import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import DishResultCard from "@/components/discovery/DishResultCard.vue";
import RestaurantCard from "@/components/discovery/RestaurantCard.vue";

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

vi.mock("@/i18n", () => ({
  i18n: {
    global: {
      locale: { value: "zh-TW" },
      t: (key: string) => key,
    },
  },
  switchLanguage: vi.fn(),
  SUPPORTED_LANGUAGES: [],
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("discovery takeaway buttons", () => {
  it("shows immediate takeaway for open takeaway dish results", async () => {
    const wrapper = mount(DishResultCard, {
      props: {
        dish: {
          menuItemId: 1,
          dishName: "Market Bao",
          price: 60,
          categoryName: null,
          restaurantId: "r1",
          restaurantName: "包子攤",
          district: "北區",
          isOpen: true,
          supportsTakeaway: true,
          supportsDelivery: false,
          tags: [],
        },
      },
      global: {
        plugins: [createPinia()],
      },
    });

    await wrapper.get('[data-testid="dish-takeaway-button"]').trigger("click");

    expect(wrapper.emitted("takeaway")?.[0]).toBeTruthy();
  });

  it("shows available service labels on dish results", () => {
    const wrapper = mount(DishResultCard, {
      props: {
        dish: {
          menuItemId: 1,
          dishName: "Market Bao",
          price: 60,
          categoryName: null,
          restaurantId: "r1",
          restaurantName: "包子攤",
          district: "北區",
          isOpen: true,
          supportsTakeaway: true,
          supportsDelivery: true,
          tags: [],
        },
      },
      global: {
        plugins: [createPinia()],
      },
    });

    expect(wrapper.get('[data-testid="dish-service-labels"]').text()).toContain(
      "可外帶",
    );
    expect(wrapper.get('[data-testid="dish-service-labels"]').text()).toContain(
      "可外送",
    );
  });

  it("hides immediate takeaway when restaurant is closed", () => {
    const wrapper = mount(RestaurantCard, {
      props: {
        restaurant: {
          restaurantId: "r1",
          name: "雞排攤",
          type: "snack",
          district: "西屯區",
          priceRange: 1,
          rating: 4.5,
          isOpen: false,
          supportsTakeaway: true,
          supportsDelivery: false,
          imageUrl: null,
        },
      },
      global: {
        plugins: [createPinia()],
      },
    });

    expect(
      wrapper.find('[data-testid="restaurant-takeaway-button"]').exists(),
    ).toBe(false);
  });

  it("shows available service labels on restaurant results", () => {
    const wrapper = mount(RestaurantCard, {
      props: {
        restaurant: {
          restaurantId: "r1",
          name: "雞排攤",
          type: "snack",
          district: "西屯區",
          priceRange: 1,
          rating: 4.5,
          isOpen: true,
          supportsTakeaway: true,
          supportsDelivery: true,
          imageUrl: null,
        },
      },
      global: {
        plugins: [createPinia()],
      },
    });

    expect(
      wrapper.get('[data-testid="restaurant-service-labels"]').text(),
    ).toContain("可外帶");
    expect(
      wrapper.get('[data-testid="restaurant-service-labels"]').text(),
    ).toContain("可外送");
  });
});
