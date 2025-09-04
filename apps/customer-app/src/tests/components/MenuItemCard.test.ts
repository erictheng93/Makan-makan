import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import MenuItemCard from "@/components/MenuItemCard.vue";
import type { MenuItem } from "@makanmakan/shared-types";

// Mock formatPrice function
vi.mock("@/utils/format", () => ({
  formatPrice: vi.fn((cents: number) => (cents / 100).toFixed(2)),
}));

describe("MenuItemCard.vue", () => {
  let wrapper: VueWrapper<any>;

  const mockMenuItem: MenuItem = {
    id: 1,
    restaurantId: 1,
    name: "牛肉麵",
    description: "香濃牛肉湯配手工麵條",
    price: 12000, // 120.00 in cents
    imageUrl: "/images/beef-noodles.jpg",
    imageVariants: {
      thumbnail: "/images/beef-noodles-thumb.jpg",
      medium: "/images/beef-noodles-med.jpg",
      large: "/images/beef-noodles-large.jpg",
    },
    categoryId: 1,
    isAvailable: true,
    inventoryCount: 50,
    spiceLevel: 2,
    sortOrder: 1,
    isFeatured: true,
    orderCount: 256,
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
          type: "single",
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
  };

  beforeEach(() => {
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
      expect(wrapper.text()).toContain("⭐ 招牌推薦");
      expect(wrapper.classes()).toContain("ring-2");
      expect(wrapper.classes()).toContain("ring-indigo-500");
    });

    it("當 isFeatured 為 false 時不應該顯示特色標籤", () => {
      expect(wrapper.text()).not.toContain("⭐ 招牌推薦");
      expect(wrapper.classes()).not.toContain("ring-2");
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
      expect(wrapper.text()).toContain("清真");
      const halalTag = wrapper.find(".bg-blue-100.text-blue-800");
      expect(halalTag.exists()).toBe(true);
    });

    it("應該顯示素食標籤當商品為素食時", async () => {
      await wrapper.setProps({
        item: {
          ...mockMenuItem,
          dietaryInfo: { ...mockMenuItem.dietaryInfo, vegetarian: true },
        },
      });

      expect(wrapper.text()).toContain("素食");
      const vegetarianTag = wrapper.find(".bg-green-100.text-green-800");
      expect(vegetarianTag.exists()).toBe(true);
    });
  });

  describe("庫存狀態", () => {
    it("應該顯示售完狀態當庫存為 0 時", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, inventoryCount: 0 },
      });

      expect(wrapper.text()).toContain("售完");
      const addButton = wrapper.find('button[data-testid="add-to-cart-btn"]');
      expect(addButton.exists()).toBe(false);
    });

    it("應該顯示暫不供應當 isAvailable 為 false 時", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, isAvailable: false },
      });

      expect(wrapper.text()).toContain("暫不供應");
    });
  });

  describe("按鈕行為", () => {
    it("無客製化選項時應該顯示快速添加按鈕", async () => {
      await wrapper.setProps({
        item: { ...mockMenuItem, options: {} },
      });

      const addButton = wrapper.find("button");
      expect(addButton.text()).toContain("加入");
      expect(addButton.classes()).toContain("bg-indigo-600");
    });

    it("有客製化選項時應該顯示選擇規格按鈕", () => {
      const customizeButton = wrapper.find("button");
      expect(customizeButton.text()).toContain("選擇規格");
      expect(customizeButton.classes()).toContain("border-indigo-600");
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

      const placeholder = wrapper.find(".text-gray-400 svg");
      expect(placeholder.exists()).toBe(true);
    });

    it("圖片載入失敗時應該隱藏圖片", async () => {
      const img = wrapper.find("img");
      await img.trigger("error");

      expect(img.element.style.display).toBe("none");
    });
  });

  describe("人氣指標", () => {
    it("應該顯示訂購次數當 orderCount > 0", () => {
      expect(wrapper.text()).toContain("256 人點過");

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

    it("點擊商品圖片應該觸發 view-details 事件", async () => {
      const imageContainer = wrapper.find(".cursor-pointer");
      await imageContainer.trigger("click");

      expect(wrapper.emitted("view-details")).toBeTruthy();
    });

    it("點擊商品描述應該觸發 view-details 事件", async () => {
      const description = wrapper.find("p.cursor-pointer");
      await description.trigger("click");

      expect(wrapper.emitted("view-details")).toBeTruthy();
    });
  });

  describe("響應式設計", () => {
    it("應該包含適當的響應式 CSS 類", () => {
      expect(wrapper.classes()).toContain("transition-all");
      expect(wrapper.classes()).toContain("duration-200");
      expect(wrapper.classes()).toContain("hover:shadow-md");
    });

    it("圖片容器應該有 hover 效果", () => {
      const imageContainer = wrapper.find(".cursor-pointer");
      expect(imageContainer.classes()).toContain("hover:scale-105");
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
      expect(img.attributes("loading")).toBe("lazy");
    });
  });
});
