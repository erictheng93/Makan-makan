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
    imageUrl: "https://images.example.com/original.jpg",
    imageVariants: {
      thumbnail: "https://images.example.com/thumbnail.jpg",
      small: "https://images.example.com/small.jpg",
      medium: "https://images.example.com/medium.jpg",
      large: "https://images.example.com/large.jpg",
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
  // The standard list thumbnail sits in a 70px box: DPR 2 needs ~140 device px
  // and DPR 3 needs ~210, so a single hardcoded size is wrong on one of them
  // (#65). The candidates below let the browser resolve it per device.
  //
  // sizes must stay in px. The preload scanner resolves rem against the default
  // 16px root, before this app's 14px root applies, so "5rem" reads as 80px and
  // silently costs DPR 2 the smaller candidate.
  it("offers thumbnail and small candidates for the standard list image", () => {
    const wrapper = mount(MenuItemCard, {
      props: {
        item: menuItem(),
      },
    });

    const img = wrapper.get("img");

    expect(img.attributes("srcset")).toBe(
      "https://images.example.com/thumbnail.jpg 150w, https://images.example.com/small.jpg 300w",
    );
    expect(img.attributes("sizes")).toBe("70px");
  });

  it("keeps a thumbnail src so srcset-less clients never load medium", () => {
    const wrapper = mount(MenuItemCard, {
      props: {
        item: menuItem(),
      },
    });

    expect(wrapper.get("img").attributes("src")).toBe(
      "https://images.example.com/thumbnail.jpg",
    );
  });

  it("falls back to medium for old standard list items without thumbnail", () => {
    const wrapper = mount(MenuItemCard, {
      props: {
        item: menuItem({
          imageVariants: {
            medium: "https://images.example.com/medium.jpg",
          },
        }),
      },
    });

    const img = wrapper.get("img");

    expect(img.attributes("src")).toBe("https://images.example.com/medium.jpg");
    // No candidates exist, so the attribute must be absent rather than empty —
    // an empty srcset would suppress the src in some browsers.
    expect(img.attributes("srcset")).toBeUndefined();
  });

  it("still builds a candidate list when only one variant size exists", () => {
    const wrapper = mount(MenuItemCard, {
      props: {
        item: menuItem({
          imageVariants: {
            small: "https://images.example.com/small.jpg",
            medium: "https://images.example.com/medium.jpg",
          },
        }),
      },
    });

    expect(wrapper.get("img").attributes("srcset")).toBe(
      "https://images.example.com/small.jpg 300w",
    );
  });

  it("keeps the medium variant for the featured large image", () => {
    const wrapper = mount(MenuItemCard, {
      props: {
        item: menuItem(),
        isFeatured: true,
      },
    });

    const img = wrapper.get("img");

    expect(img.attributes("src")).toBe("https://images.example.com/medium.jpg");
    expect(img.attributes("srcset")).toBeUndefined();
  });
});
