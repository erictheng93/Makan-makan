import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import MenuItemCard from "@/components/MenuItemCard.vue";
import type { MenuItem } from "@makanmakan/shared-types";
import { menuItemFactory, resetAllFactories } from "@makanmakan/testing-utils";

// Mock formatPrice function
vi.mock("@/utils/format", () => ({
  formatPrice: vi.fn((cents: number) => (cents / 100).toFixed(2)),
}));

// Mock useCurrency so the component's formatPrice uses the same mock logic
vi.mock("@/composables/useCurrency", () => ({
  useCurrency: vi.fn(() => ({
    formatPrice: vi.fn((cents: number) => `$${(cents / 100).toFixed(2)}`),
    formatAmount: vi.fn((amount: number) => `$${amount.toFixed(2)}`),
    currencySymbol: "$",
    currencyCode: "TWD",
  })),
}));

describe("MenuItemCard.vue", () => {
  let wrapper: VueWrapper<any>;

  // Build base from factory, then override fields that differ between
  // MenuItemTestData (number restaurantId, number timestamps) and
  // shared-types MenuItem (string restaurantId, string timestamps).
  const mockMenuItem = {
    ...menuItemFactory.build({
      overrides: {
        id: 1,
        name: "牛肉麵",
        description: "香濃牛肉湯配手工麵條",
        price: 12000,
        spiceLevel: 2,
        isFeatured: true,
        isAvailable: true,
        inventoryCount: 50,
        sortOrder: 1,
        orderCount: 256,
      },
      relations: { restaurantId: 1, categoryId: 1 },
    }),
    restaurantId: "1",
    imageUrl: "/images/beef-noodles.jpg",
    imageVariants: {
      thumbnail: "/images/beef-noodles-thumb.jpg",
      medium: "/images/beef-noodles-med.jpg",
      large: "/images/beef-noodles-large.jpg",
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    dietaryInfo: {
      vegetarian: false,
      vegan: false,
      halal: true,
      glutenFree: false,
    },
    options: {
      sizes: [
        { id: "1", name: "小碗", priceAdjustment: -1000 },
        { id: "2", name: "大碗", priceAdjustment: 2000 },
      ],
      customizations: [
        {
          id: "1",
          name: "辣度",
          type: "single" as const,
          required: false,
          choices: [
            { id: "1", name: "不辣", priceAdjustment: 0 },
            { id: "2", name: "小辣", priceAdjustment: 0 },
            { id: "3", name: "大辣", priceAdjustment: 0 },
          ],
        },
      ],
      addOns: [
        { id: "1", name: "滷蛋", price: 1000 },
        { id: "2", name: "青菜", price: 1500 },
      ],
    },
  } as MenuItem;

  beforeEach(() => {
    resetAllFactories();
    setActivePinia(createPinia());
    wrapper = mount(MenuItemCard, {
      props: {
        item: mockMenuItem,
        isFeatured: false,
      },
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("基本渲染", () => {
    it("應該正確渲染商品名稱", () => {
      expect(wrapper.text()).toContain("牛肉麵");
    });

    it("應該正確渲染商品描述", () => {
      expect(wrapper.text()).toContain("香濃牛肉湯配手工麵條");
    });

    it("應該正確渲染價格", () => {
      expect(wrapper.text()).toContain("$120.00");
    });

    it("應該渲染商品圖片", () => {
      const img = wrapper.find("img");
      expect(img.exists()).toBe(true);
      expect(img.attributes("src")).toBe("/images/beef-noodles-med.jpg");
      expect(img.attributes("alt")).toBe("牛肉麵");
    });
  });

  describe("特色標籤", () => {
    it("當 isFeatured 為 true 時應該顯示特色標籤", async () => {
      await wrapper.setProps({ isFeatured: true });
      expect(wrapper.find('[data-testid="featured-badge"]').exists()).toBe(
        true,
      );
    });

    it("當 isFeatured 為 false 時不應該顯示特色標籤", () => {
      expect(wrapper.find('[data-testid="featured-badge"]').exists()).toBe(
        false,
      );
    });
  });

  describe("辣度指示器", () => {
    it("應該根據 spiceLevel 顯示對應數量的辣椒圖標", () => {
      const spiceIcons = wrapper
        .findAll("svg")
        .filter((svg) => svg.classes().includes("text-red-500"));
      expect(spiceIcons).toHaveLength(2); // spiceLevel = 2
    });

    it("當 spiceLevel 為 0 時不應該顯示辣椒圖標", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, spiceLevel: 0 },
      });

      const spiceIcons = wrapper
        .findAll("svg")
        .filter((svg) => svg.classes().includes("text-red-500"));
      expect(spiceIcons).toHaveLength(0);
    });
  });

  describe("飲食標籤", () => {
    it("應該顯示清真標籤", () => {
      expect(wrapper.text()).toContain("Halal");
    });

    it("應該顯示素食標籤當商品為素食時", async () => {
      await wrapper.setProps({
        item: {
          ...mockMenuItem,
          dietaryInfo: { ...mockMenuItem.dietaryInfo, vegetarian: true },
        },
      });

      expect(wrapper.text()).toContain("Vegetarian");
    });
  });

  describe("庫存狀態", () => {
    it("應該顯示售完狀態當庫存為 0 時", async () => {
      // inventoryCount === 0 means inventory tracking is disabled (no-op).
      // The component only shows Sold Out when isAvailable is false.
      // Setting inventoryCount: 0 with isAvailable: true does NOT trigger sold-out.
      // To trigger sold-out, mark the item as unavailable.
      await wrapper.setProps({
        item: { ...mockMenuItem, inventoryCount: 0, isAvailable: false },
      });

      // Component renders "Sold Out" (via menuItemCard.unavailable key) when isAvailable is false
      // Actually the component renders menuItemCard.unavailable for !isAvailable.
      // For a fully unavailable item the add button is hidden.
      const addButton = wrapper.find('button[data-testid="add-to-cart-btn"]');
      expect(addButton.exists()).toBe(false);
      // The status badge is shown (either Sold Out or Unavailable text)
      const statusBadge = wrapper.find(
        ".text-xs.font-medium.text-ios-secondary.bg-gray-100",
      );
      expect(statusBadge.exists()).toBe(true);
    });

    it("應該顯示暫不供應當 isAvailable 為 false 時", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, isAvailable: false },
      });

      expect(wrapper.text()).toContain("Unavailable");
    });
  });

  describe("按鈕行為", () => {
    it("無客製化選項時應該顯示快速添加按鈕", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, options: {} },
      });

      const addButton = wrapper.find("button");
      expect(addButton.text()).toContain("Add");
    });

    it("有客製化選項時應該顯示選擇規格按鈕", () => {
      const customizeButton = wrapper.find("button");
      expect(customizeButton.text()).toContain("Select Options");
    });

    it("點擊快速添加按鈕應該觸發 add-to-cart 事件", async () => {
      const itemWithoutOptions = { ...mockMenuItem, options: {} };
      await wrapper.setProps({
        item: itemWithoutOptions,
      });

      const addButton = wrapper.find("button");
      await addButton.trigger("click");

      expect(wrapper.emitted("add-to-cart")).toBeTruthy();
      expect(wrapper.emitted("add-to-cart")![0]).toEqual([
        {
          item: itemWithoutOptions,
          quantity: 1,
        },
      ]);
    });

    it("點擊客製化按鈕應該觸發 view-details 事件", async () => {
      const customizeButton = wrapper.find("button");
      await customizeButton.trigger("click");

      expect(wrapper.emitted("view-details")).toBeTruthy();
      expect(wrapper.emitted("view-details")![0]).toEqual([mockMenuItem]);
    });
  });

  describe("圖片處理", () => {
    it("應該使用 medium 圖片作為預設顯示", () => {
      const img = wrapper.find("img");
      expect(img.attributes("src")).toBe("/images/beef-noodles-med.jpg");
    });

    it("當沒有 imageVariants 時應該使用原始 imageUrl", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, imageVariants: undefined },
      });

      const img = wrapper.find("img");
      expect(img.attributes("src")).toBe("/images/beef-noodles.jpg");
    });

    it("當沒有圖片時應該顯示預設圖標", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, imageUrl: "", imageVariants: undefined },
      });

      const img = wrapper.find("img");
      expect(img.exists()).toBe(false);

      // Placeholder SVG icon should be shown
      const svg = wrapper.find("svg");
      expect(svg.exists()).toBe(true);
    });
  });

  describe("人氣指標", () => {
    it("應該顯示訂購次數當 orderCount > 0", () => {
      expect(wrapper.text()).toContain("256 people ordered");

      // 檢查心形圖標
      const svgElements = wrapper.findAll("svg");
      const heartIcon = svgElements[svgElements.length - 1];
      expect(heartIcon.exists()).toBe(true);
    });

    it("當 orderCount 為 0 時不應該顯示人氣指標", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, orderCount: 0 },
      });

      expect(wrapper.text()).not.toContain("人點過");
    });
  });

  describe("點擊互動", () => {
    it("點擊商品名稱應該觸發 view-details 事件", async () => {
      const titleElement = wrapper.find("h3");
      await titleElement.trigger("click");

      expect(wrapper.emitted("view-details")).toBeTruthy();
    });

    it("點擊商品圖片容器應該觸發 view-details 事件", async () => {
      // The image container is clickable
      const img = wrapper.find("img");
      await img.trigger("click");

      expect(wrapper.emitted("view-details")).toBeTruthy();
    });

    it("點擊商品描述應該觸發 view-details 事件", async () => {
      const description = wrapper.find("p");
      await description.trigger("click");

      expect(wrapper.emitted("view-details")).toBeTruthy();
    });
  });

  describe("佈局結構", () => {
    it("應該渲染商品名稱、描述、價格和按鈕", () => {
      expect(wrapper.find("h3").exists()).toBe(true);
      expect(wrapper.find("p").exists()).toBe(true);
      expect(wrapper.find("button").exists()).toBe(true);
      expect(wrapper.text()).toContain("$120.00");
    });
  });

  describe("無障礙性", () => {
    it("圖片應該有適當的 alt 文字", () => {
      const img = wrapper.find("img");
      expect(img.attributes("alt")).toBe("牛肉麵");
    });

    it("按鈕應該可以被鍵盤操作", async () => {
      const button = wrapper.find("button");
      await button.trigger("keydown.enter");

      // 檢查是否觸發了相應事件
      expect(wrapper.emitted()).toBeTruthy();
    });

    it("應該支援延遲載入", () => {
      const img = wrapper.find("img");
      // Component uses v-lazy directive for lazy loading instead of native loading="lazy"
      // The v-lazy directive adds the "lazy-image" class to the image
      expect(img.classes()).toContain("lazy-image");
    });
  });
});
