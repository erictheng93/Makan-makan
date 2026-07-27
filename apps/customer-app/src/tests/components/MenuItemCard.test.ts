import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MenuItemCard from "@/components/MenuItemCard.vue";
import type { MenuItem } from "@makanmakan/shared-types";

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${params.count}`,
  }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (price: number) => `$${price}`,
  }),
}));

function menuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 1,
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    restaurantId: "restaurant-1",
    categoryId: 1,
    catalogType: "menu_item",
    name: "滷肉飯",
    description: "招牌餐點",
    price: 5000,
    imageUrl: "/images/original.jpg",
    imageVariants: {
      thumbnail: "/images/thumbnail.jpg",
      medium: "/images/medium.jpg",
      large: "/images/large.jpg",
    },
    spiceLevel: 0,
    sortOrder: 0,
    isAvailable: true,
    isFeatured: false,
    inventoryCount: -1,
    orderCount: 0,
    ...overrides,
  };
}

describe("MenuItemCard", () => {
  it("uses the thumbnail variant for the standard list image", () => {
    const wrapper = mount(MenuItemCard, {
      props: {
        item: menuItem(),
      },
    });

    expect(wrapper.get("img").attributes("src")).toBe("/images/thumbnail.jpg");
  });

  it("falls back to medium for old standard list items without thumbnail", () => {
    const wrapper = mount(MenuItemCard, {
      props: {
        item: menuItem({
          imageVariants: {
            medium: "/images/medium.jpg",
          },
        }),
      },
    });

    expect(wrapper.get("img").attributes("src")).toBe("/images/medium.jpg");
  });

  it("keeps the medium variant for the featured large image", () => {
    const wrapper = mount(MenuItemCard, {
      props: {
        item: menuItem(),
        isFeatured: true,
      },
    });

    expect(wrapper.get("img").attributes("src")).toBe("/images/medium.jpg");
  });
});
