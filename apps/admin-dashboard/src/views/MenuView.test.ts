// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuView from "./MenuView.vue";

const importMenuItems = vi.fn();
const fetchMenu = vi.fn();
const routeQuery = {} as Record<string, unknown>;
const categories = ref([
  { id: 1, name: "主食", sortOrder: 0 },
  { id: 2, name: "飲料", sortOrder: 1 },
]);
const menuItems = ref([]);
const selectedCategoryId = ref<number | null>(null);

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.count ? `${key} ${params.count}` : key,
  }),
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: routeQuery }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => `$${value}`,
  }),
}));

vi.mock("@/composables/useMenuManagement", () => ({
  useMenuManagement: () => ({
    categories,
    menuItems,
    isLoading: ref(false),
    selectedCategoryId,
    filteredItemsByCategory: computed(() => menuItems.value),
    getCategoryName: (id: number) =>
      categories.value.find((category) => category.id === id)?.name ?? "",
    fetchMenu,
    saveCategory: vi.fn(),
    deleteCategory: vi.fn(),
    reorderCategories: vi.fn(),
    saveMenuItem: vi.fn(),
    importMenuItems,
    deleteMenuItem: vi.fn(),
    toggleMenuItemStatus: vi.fn(),
  }),
}));

describe("MenuView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key]);
    selectedCategoryId.value = null;
    menuItems.value = [];
  });

  it("shows market search context when opened from a product gap", () => {
    routeQuery.source = "market-gap";
    routeQuery.gap = "products";
    routeQuery.marketName = "逢甲夜市";

    const wrapper = mount(MenuView, {
      global: {
        stubs: {
          CategoryPanel: true,
          CategoryEditForm: true,
          MenuItemCard: true,
          VirtualMenuGrid: true,
        },
      },
    });

    expect(
      wrapper.get('[data-testid="market-product-gap-context"]').text(),
    ).toContain("市場搜尋缺商品");
    expect(
      wrapper.get('[data-testid="market-product-gap-context"]').text(),
    ).toContain("逢甲夜市");
  });

  it("includes market context in the product gap import example", async () => {
    routeQuery.source = "market-gap";
    routeQuery.gap = "products";
    routeQuery.marketName = "逢甲夜市";
    const wrapper = mount(MenuView, {
      global: {
        stubs: {
          CategoryPanel: true,
          CategoryEditForm: true,
          MenuItemCard: true,
          VirtualMenuGrid: true,
        },
      },
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "載入範例")!
      .trigger("click");

    expect(
      wrapper.get<HTMLTextAreaElement>('[data-testid="menu-item-import-csv"]')
        .element.value,
    ).toContain("逢甲夜市");
  });

  it("imports menu items from CSV with a preview", async () => {
    const wrapper = mount(MenuView, {
      global: {
        stubs: {
          CategoryPanel: true,
          CategoryEditForm: true,
          MenuItemCard: true,
          VirtualMenuGrid: true,
        },
      },
    });

    await wrapper
      .get('[data-testid="menu-item-import-csv"]')
      .setValue(
        [
          "name,category,price,description,isFeatured,isAvailable,sortOrder,tags",
          '"蚵仔煎","主食",7000,"招牌小吃",true,true,1,"小吃;招牌"',
        ].join("\n"),
      );

    expect(wrapper.text()).toContain("已解析 1 筆商品");

    await wrapper
      .get('[data-testid="menu-item-import-submit"]')
      .trigger("click");
    await flushPromises();

    expect(importMenuItems).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "蚵仔煎",
        categoryId: 1,
        catalogType: "menu_item",
        price: 7000,
        description: "招牌小吃",
        isFeatured: true,
        isAvailable: true,
        sortOrder: 1,
        tags: ["小吃", "招牌"],
        keywords: "小吃 招牌",
      }),
    ]);
    expect(wrapper.text()).toContain("已成功匯入 1 筆商品");
  });

  it("shows a market search reindex next step after importing product gap items", async () => {
    routeQuery.source = "market-gap";
    routeQuery.gap = "products";
    routeQuery.marketName = "逢甲夜市";
    const wrapper = mount(MenuView, {
      global: {
        stubs: {
          CategoryPanel: true,
          CategoryEditForm: true,
          MenuItemCard: true,
          VirtualMenuGrid: true,
        },
      },
    });

    await wrapper
      .get('[data-testid="menu-item-import-csv"]')
      .setValue(
        [
          "name,category,price,description,isAvailable,keywords",
          '"蚵仔煎","主食",7000,"招牌小吃",true,"蚵仔煎 夜市 逢甲夜市"',
        ].join("\n"),
      );

    await wrapper
      .get('[data-testid="menu-item-import-submit"]')
      .trigger("click");
    await flushPromises();

    expect(
      wrapper.get('[data-testid="market-product-gap-next-step"]').text(),
    ).toContain("重建搜尋索引");
    expect(
      wrapper.get('[data-testid="market-product-gap-next-step"]').text(),
    ).toContain("逢甲夜市");
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
