// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { computed, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuView from "./MenuView.vue";

const importMenuItems = vi.fn();
const saveMenuItem = vi.fn();
const fetchMenu = vi.fn();
const push = vi.fn();
const imageUploadMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  reset: vi.fn(),
}));
const routeQuery = {} as Record<string, unknown>;
const MANAGED_RESTAURANT_ID = "019f9373-397c-7202-99d6-24c61976f3ff";
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
  useRouter: () => ({ push }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => `$${value}`,
  }),
}));

vi.mock("@/composables/useImageUpload", () => ({
  useImageUpload: () => ({
    upload: imageUploadMocks.upload,
    reset: imageUploadMocks.reset,
    state: ref("idle"),
    errorMessage: ref(""),
    result: ref(null),
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
    saveMenuItem,
    importMenuItems,
    deleteMenuItem: vi.fn(),
    toggleMenuItemStatus: vi.fn(),
    restaurantId: computed(() => MANAGED_RESTAURANT_ID),
  }),
}));

vi.mock("@/utils/authTokenProvider", () => ({
  setAuthTokenProvider: vi.fn(),
  getAuthToken: () => "test-token",
}));

describe("MenuView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key]);
    selectedCategoryId.value = null;
    menuItems.value = [];
    saveMenuItem.mockResolvedValue(true);
    imageUploadMocks.upload.mockResolvedValue(null);
    vi.stubEnv("VITE_IMAGE_API_URL", "https://images.example.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null)));
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

  it("shows a market search reindex next step after manually adding a product gap item", async () => {
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
      .find((button) => button.text().includes("menu.addItem"))!
      .trigger("click");
    await wrapper
      .get('[data-testid="menu-item-name-input"]')
      .setValue("蚵仔煎");
    await wrapper.get('[data-testid="menu-item-price-input"]').setValue(7000);
    await wrapper.get('[data-testid="menu-item-category-select"]').setValue(1);
    await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
    await flushPromises();

    expect(saveMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "蚵仔煎",
        categoryId: 1,
        isAvailable: true,
      }),
      undefined,
    );
    expect(
      wrapper.get('[data-testid="market-product-gap-next-step"]').text(),
    ).toContain("重建搜尋索引");
  });

  it("writes uploaded image fields to the form and save payload", async () => {
    const wrapper = mountMenuView();
    const file = new File(["jpeg bytes"], "menu.jpg", {
      type: "image/jpeg",
    });
    const imageVariants = {
      thumbnail: "https://cdn.example.test/thumb.webp",
      small: "https://cdn.example.test/small.webp",
      medium: "https://cdn.example.test/medium.webp",
      large: "https://cdn.example.test/large.webp",
    };
    imageUploadMocks.upload.mockResolvedValue({
      imageId: "uploaded-image-id",
      imageUrl: imageVariants.medium,
      imageVariants,
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("menu.addItem"))!
      .trigger("click");
    await wrapper
      .get('[data-testid="menu-item-name-input"]')
      .setValue("蚵仔煎");
    await wrapper.get('[data-testid="menu-item-price-input"]').setValue(7000);
    await wrapper.get('[data-testid="menu-item-category-select"]').setValue(1);
    await wrapper.vm.handleImageFileSelected({
      target: { files: [file], value: "" },
    } as unknown as Event);

    // The managed restaurant must ride along: a platform admin's token has
    // restaurantId: null, so image-processor 403s without this.
    expect(imageUploadMocks.upload).toHaveBeenCalledWith(file, {
      restaurantId: MANAGED_RESTAURANT_ID,
    });
    expect(wrapper.vm.menuItemForm.imageUrl).toBe(imageVariants.medium);
    expect(wrapper.vm.menuItemForm.imageId).toBe("uploaded-image-id");
    expect(wrapper.vm.menuItemForm.imageVariants).toEqual(imageVariants);

    await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
    await flushPromises();

    expect(saveMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: imageVariants.medium,
        imageId: "uploaded-image-id",
        imageVariants,
      }),
      undefined,
    );
  });

  it("returns to the filtered market workbench after fixing product gaps", async () => {
    routeQuery.source = "market-gap";
    routeQuery.gap = "products";
    routeQuery.marketName = "逢甲夜市";
    routeQuery.marketSlug = "fengjia";
    routeQuery.areaCity = "台中市";
    routeQuery.areaDistrict = "西屯區";
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
    await wrapper
      .get('[data-testid="market-product-gap-return"]')
      .trigger("click");

    expect(push).toHaveBeenCalledWith({
      name: "PlatformMarkets",
      query: {
        marketSlug: "fengjia",
        areaCity: "台中市",
        areaDistrict: "西屯區",
      },
    });
  });

  it("deletes the previous image once after changing imageId and saving successfully", async () => {
    const wrapper = mountMenuView();
    const item = menuItem({
      imageId: "previous-image-id",
      imageUrl: "https://cdn.example.test/previous.jpg",
    });

    await editItem(wrapper, item);
    wrapper.vm.menuItemForm.imageId = "next-image-id";
    await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
    await flushPromises();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "https://images.example.test/images/previous-image-id",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("does not delete the previous image when saving fails", async () => {
    saveMenuItem.mockResolvedValue(false);
    const wrapper = mountMenuView();
    const item = menuItem({ imageId: "previous-image-id" });

    await editItem(wrapper, item);
    wrapper.vm.menuItemForm.imageId = "next-image-id";
    await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not delete an image when imageId is unchanged", async () => {
    const wrapper = mountMenuView();
    const item = menuItem({ imageId: "same-image-id" });

    await editItem(wrapper, item);
    wrapper.vm.menuItemForm.imageId = "same-image-id";
    await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("persists advanced product fields from the edit form", async () => {
    const wrapper = mountMenuView();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("menu.addItem"))!
      .trigger("click");

    await wrapper.get('[data-testid="menu-item-name-input"]').setValue("Curry");
    await wrapper.get('[data-testid="menu-item-price-input"]').setValue(1200);
    await wrapper.get('[data-testid="menu-item-category-select"]').setValue(1);
    wrapper.vm.menuItemForm.originalPrice = 1500;
    wrapper.vm.menuItemForm.spiceLevel = 3;
    wrapper.vm.menuItemForm.preparationTime = 20;
    wrapper.vm.menuItemForm.calories = 650;
    wrapper.vm.menuItemForm.ingredients = "chicken, coconut milk";
    wrapper.vm.menuItemForm.tagsText = "spicy, curry";
    wrapper.vm.menuItemForm.allergensText = "peanuts, dairy";
    wrapper.vm.menuItemForm.dietaryInfo.glutenFree = true;
    wrapper.vm.menuItemForm.optionsText = JSON.stringify({
      sizes: [{ id: "regular", name: "Regular", priceAdjustment: 0 }],
    });

    await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
    await flushPromises();

    expect(saveMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        originalPrice: 1500,
        spiceLevel: 3,
        preparationTime: 20,
        calories: 650,
        ingredients: "chicken, coconut milk",
        tags: ["spicy", "curry"],
        allergens: ["peanuts", "dairy"],
        dietaryInfo: { glutenFree: true },
        options: {
          sizes: [{ id: "regular", name: "Regular", priceAdjustment: 0 }],
        },
      }),
      undefined,
    );
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function mountMenuView() {
  return mount(MenuView, {
    global: {
      stubs: {
        CategoryPanel: true,
        CategoryEditForm: true,
        MenuItemCard: true,
        VirtualMenuGrid: true,
      },
    },
  });
}

function menuItem(overrides: Partial<(typeof menuItems.value)[number]> = {}) {
  return {
    id: 1,
    categoryId: 1,
    catalogType: "menu_item",
    name: "蚵仔煎",
    price: 7000,
    imageUrl: null,
    imageId: null,
    isFeatured: false,
    isAvailable: true,
    sortOrder: 0,
    ...overrides,
  };
}

async function editItem(
  wrapper: ReturnType<typeof mountMenuView>,
  item: ReturnType<typeof menuItem>,
) {
  wrapper.vm.editMenuItem(item);
  await nextTick();
}
