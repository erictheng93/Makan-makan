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
    // saveMenuItem reports "saved" | "failed" | "conflict" — a plain boolean
    // could not distinguish a lost-update refusal from any other failure (#85).
    saveMenuItem.mockResolvedValue("saved");
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
    // The outcome is reported through t() now, not a hardcoded literal (#85);
    // the t() stub here renders "<key> <count>".
    expect(wrapper.get('[data-testid="menu-item-import-success"]').text()).toBe(
      "menu.import.successBanner 1",
    );
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
    saveMenuItem.mockResolvedValue("failed");
    const wrapper = mountMenuView();
    const item = menuItem({ imageId: "previous-image-id" });

    await editItem(wrapper, item);
    wrapper.vm.menuItemForm.imageId = "next-image-id";
    await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
  });

  // Issue #85: the API refuses a save whose version is stale (409
  // MENU_ITEM_MODIFIED). A generic error toast would leave the owner with no
  // idea what happened or what to do about it.
  describe("concurrent edit prompt (#85)", () => {
    it("offers to reload the item instead of reporting a generic failure", async () => {
      saveMenuItem.mockResolvedValue("conflict");
      const wrapper = mountMenuView();

      await editItem(wrapper, menuItem({ name: "牛肉麵" }));
      await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
      await flushPromises();

      const prompt = wrapper.get('[data-testid="menu-item-conflict"]');
      expect(prompt.text()).toContain("menu.conflict.title");
      expect(prompt.attributes("role")).toBe("alert");
      expect(
        wrapper.find('[data-testid="menu-item-conflict-reload"]').exists(),
      ).toBe(true);
      // The modal stays open so the owner still has their edits in front of them.
      expect(wrapper.find('[data-testid="item-modal"]').exists()).toBe(true);
      // Nothing was written, so the old image must not be deleted either.
      expect(fetch).not.toHaveBeenCalled();
    });

    it("reloads the menu and repopulates the form from the fresh item", async () => {
      saveMenuItem.mockResolvedValue("conflict");
      const wrapper = mountMenuView();
      const stale = menuItem({ name: "牛肉麵", price: 7000 });
      menuItems.value = [stale] as never;

      await editItem(wrapper, stale);
      await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
      await flushPromises();

      // Someone else's version is what fetchMenu brings back.
      fetchMenu.mockImplementation(async () => {
        menuItems.value = [
          menuItem({ name: "牛肉麵", price: 9000, isAvailable: false }),
        ] as never;
      });
      // onMounted already fetched once; the reload has to fetch again.
      const fetchesBeforeReload = fetchMenu.mock.calls.length;
      await wrapper
        .get('[data-testid="menu-item-conflict-reload"]')
        .trigger("click");
      await flushPromises();

      expect(fetchMenu.mock.calls.length).toBe(fetchesBeforeReload + 1);
      expect(wrapper.vm.menuItemForm.price).toBe(9000);
      expect(wrapper.vm.menuItemForm.isAvailable).toBe(false);
      expect(wrapper.find('[data-testid="menu-item-conflict"]').exists()).toBe(
        false,
      );
    });

    it("clears the prompt when the owner chooses to keep editing", async () => {
      saveMenuItem.mockResolvedValue("conflict");
      const wrapper = mountMenuView();

      await editItem(wrapper, menuItem());
      await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
      await flushPromises();
      // onMounted already fetched once; dismissing must not fetch again.
      const fetchesBeforeDismiss = fetchMenu.mock.calls.length;
      await wrapper
        .get('[data-testid="menu-item-conflict-dismiss"]')
        .trigger("click");

      expect(wrapper.find('[data-testid="menu-item-conflict"]').exists()).toBe(
        false,
      );
      expect(fetchMenu.mock.calls.length).toBe(fetchesBeforeDismiss);
    });

    // A blanket "take theirs" on reload throws away work the owner may have
    // spent minutes on; a blanket "keep mine" is the overwrite the 409 exists
    // to prevent. Only the baseline the form was opened with can tell the two
    // apart.
    it("keeps the fields the owner edited and adopts the rest from the fresh row", async () => {
      saveMenuItem.mockResolvedValue("conflict");
      const wrapper = mountMenuView();
      const stale = menuItem({ name: "牛肉麵", price: 7000 });
      menuItems.value = [stale] as never;

      await editItem(wrapper, stale);
      // The owner renamed it and never touched the price.
      wrapper.vm.menuItemForm.name = "紅燒牛肉麵";
      await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
      await flushPromises();

      // Someone else repriced it in the meantime.
      fetchMenu.mockImplementation(async () => {
        menuItems.value = [menuItem({ name: "牛肉麵", price: 9000 })] as never;
      });
      await wrapper
        .get('[data-testid="menu-item-conflict-reload"]')
        .trigger("click");
      await flushPromises();

      expect(wrapper.vm.menuItemForm.name).toBe("紅燒牛肉麵");
      expect(wrapper.vm.menuItemForm.price).toBe(9000);

      const summary = wrapper.get('[data-testid="menu-item-merge-summary"]');
      expect(
        summary.find('[data-testid="menu-item-merge-kept"]').exists(),
      ).toBe(true);
      expect(
        summary.find('[data-testid="menu-item-merge-applied"]').exists(),
      ).toBe(true);
      expect(
        summary.find('[data-testid="menu-item-merge-overridden"]').exists(),
      ).toBe(false);
    });

    it("flags a field both sides changed and shows the owner's value", async () => {
      saveMenuItem.mockResolvedValue("conflict");
      const wrapper = mountMenuView();
      const stale = menuItem({ price: 7000 });
      menuItems.value = [stale] as never;

      await editItem(wrapper, stale);
      wrapper.vm.menuItemForm.price = 7500;
      await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
      await flushPromises();

      fetchMenu.mockImplementation(async () => {
        menuItems.value = [menuItem({ price: 9000 })] as never;
      });
      await wrapper
        .get('[data-testid="menu-item-conflict-reload"]')
        .trigger("click");
      await flushPromises();

      // The owner is looking at their own number, so it stays — but they are
      // told the other value existed rather than losing it silently.
      expect(wrapper.vm.menuItemForm.price).toBe(7500);
      expect(
        wrapper.find('[data-testid="menu-item-merge-overridden"]').exists(),
      ).toBe(true);
    });

    it("says the item was deleted rather than closing the modal from under the owner", async () => {
      saveMenuItem.mockResolvedValue("conflict");
      const wrapper = mountMenuView();
      const stale = menuItem();
      menuItems.value = [stale] as never;

      await editItem(wrapper, stale);
      await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
      await flushPromises();

      fetchMenu.mockImplementation(async () => {
        menuItems.value = [] as never;
      });
      await wrapper
        .get('[data-testid="menu-item-conflict-reload"]')
        .trigger("click");
      await flushPromises();

      const prompt = wrapper.get('[data-testid="menu-item-conflict"]');
      expect(prompt.text()).toContain("menu.conflict.removed");
      // Nothing left to merge into, so the reload affordance goes away.
      expect(
        wrapper.find('[data-testid="menu-item-conflict-reload"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[data-testid="item-modal"]').exists()).toBe(true);
    });

    it("sends the version the form was loaded with", async () => {
      const wrapper = mountMenuView();

      await editItem(
        wrapper,
        menuItem({ updatedAt: "2026-07-30T08:15:30.250Z" }),
      );
      await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
      await flushPromises();

      expect(saveMenuItem).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: "2026-07-30T08:15:30.250Z" }),
        1,
      );
    });
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

  it("sends null for cleared optional fields and omits an empty preparation time", async () => {
    const wrapper = mountMenuView();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("menu.addItem"))!
      .trigger("click");

    await wrapper.get('[data-testid="menu-item-name-input"]').setValue("Curry");
    await wrapper.get('[data-testid="menu-item-price-input"]').setValue(1200);
    await wrapper.get('[data-testid="menu-item-category-select"]').setValue(1);
    wrapper.vm.menuItemForm.preparationTime = "";

    await wrapper.get('[data-testid="item-modal"] form').trigger("submit");
    await flushPromises();

    expect(saveMenuItem).toHaveBeenCalledWith(
      expect.objectContaining({
        originalPrice: null,
        calories: null,
        ingredients: null,
        keywords: null,
        options: null,
        preparationTime: undefined,
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
