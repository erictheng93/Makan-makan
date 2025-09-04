import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import OrderItemCard from "@/components/OrderItemCard.vue";
import type { OrderItem } from "@makanmakan/shared-types";
import { OrderItemStatus } from "@makanmakan/shared-types";

// Mock formatPrice function
vi.mock("@/utils/format", () => ({
  formatPrice: vi.fn((cents: number) => (cents / 100).toFixed(2)),
}));

describe("OrderItemCard.vue", () => {
  let wrapper: VueWrapper<any>;

  const mockOrderItem: OrderItem = {
    id: 1,
    orderId: 123,
    menuItemId: 1,
    menuItem: {
      id: 1,
      restaurantId: 1,
      name: "牛肉麵",
      description: "香濃牛肉湯配手工麵條",
      price: 12000,
      imageUrl: "/images/beef-noodles.jpg",
      imageVariants: {
        thumbnail: "/images/beef-noodles-thumb.jpg",
      },
      categoryId: 1,
      isAvailable: true,
      inventoryCount: 50,
      spiceLevel: 1,
      sortOrder: 1,
      isFeatured: false,
      orderCount: 0,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    quantity: 2,
    unitPrice: 14000,
    totalPrice: 28000,
    customizations: {
      size: { id: "2", name: "大碗", priceAdjustment: 2000 },
      options: [
        {
          id: "1",
          optionName: "辣度",
          choiceId: "mild",
          choiceName: "小辣",
          priceAdjustment: 0,
        },
      ],
      addOns: [
        {
          id: "1",
          name: "滷蛋",
          unitPrice: 1000,
          quantity: 1,
          totalPrice: 1000,
        },
      ],
    },
    notes: "不要香菜",
    status: OrderItemStatus.PENDING,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    wrapper = mount(OrderItemCard, {
      props: {
        item: mockOrderItem,
        showStatus: true,
        readonly: false,
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

    it("應該正確渲染商品圖片", () => {
      const img = wrapper.find("img");
      expect(img.exists()).toBe(true);
      expect(img.attributes("src")).toBe("/images/beef-noodles-thumb.jpg");
      expect(img.attributes("alt")).toBe("牛肉麵");
    });

    it("應該正確渲染數量", () => {
      expect(wrapper.text()).toContain("× 2");
    });

    it("應該正確渲染總價", () => {
      // 14000 * 2 = 28000 cents = $280.00
      expect(wrapper.text()).toContain("$280.00");
    });
  });

  describe("客製化資訊顯示", () => {
    it("應該顯示尺寸資訊", () => {
      expect(wrapper.text()).toContain("大碗");
    });

    it("應該顯示選項資訊", () => {
      expect(wrapper.text()).toContain("小辣");
    });

    it("應該顯示加購項目", () => {
      expect(wrapper.text()).toContain("+滷蛋");
    });

    it("應該將所有客製化資訊用逗號分隔", () => {
      const customizationText = wrapper.find('[data-testid="customizations"]');
      expect(customizationText.text()).toBe("大碗, 小辣, +滷蛋");
    });

    it("當沒有客製化時不應該顯示客製化區域", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, customizations: undefined },
      });

      const customizationArea = wrapper.find('[data-testid="customizations"]');
      expect(customizationArea.exists()).toBe(false);
    });
  });

  describe("訂單狀態顯示", () => {
    it("當 showStatus 為 true 時應該顯示狀態", () => {
      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.exists()).toBe(true);
    });

    it("當 showStatus 為 false 時不應該顯示狀態", async () => {
      await wrapper.setProps({ showStatus: false });

      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.exists()).toBe(false);
    });

    it("pending 狀態應該顯示等待中", () => {
      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.text()).toContain("等待中");
      expect(statusElement.classes()).toContain("bg-yellow-100");
      expect(statusElement.classes()).toContain("text-yellow-800");
    });

    it("preparing 狀態應該顯示製作中", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: "preparing" },
      });

      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.text()).toContain("製作中");
      expect(statusElement.classes()).toContain("bg-blue-100");
      expect(statusElement.classes()).toContain("text-blue-800");
    });

    it("ready 狀態應該顯示已完成", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: "ready" },
      });

      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.text()).toContain("已完成");
      expect(statusElement.classes()).toContain("bg-green-100");
      expect(statusElement.classes()).toContain("text-green-800");
    });

    it("cancelled 狀態應該顯示已取消", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: "cancelled" },
      });

      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.text()).toContain("已取消");
      expect(statusElement.classes()).toContain("bg-red-100");
      expect(statusElement.classes()).toContain("text-red-800");
    });
  });

  describe("準備時間顯示", () => {
    it("應該顯示預計準備時間", () => {
      const prepTimeElement = wrapper.find('[data-testid="preparation-time"]');
      expect(prepTimeElement.text()).toContain("約 15 分鐘");
    });

    it("當沒有準備時間時不應該顯示", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, preparationTime: undefined },
      });

      const prepTimeElement = wrapper.find('[data-testid="preparation-time"]');
      expect(prepTimeElement.exists()).toBe(false);
    });

    it("應該根據狀態調整準備時間顯示", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: "ready" },
      });

      const prepTimeElement = wrapper.find('[data-testid="preparation-time"]');
      expect(prepTimeElement.exists()).toBe(false); // 已完成不顯示準備時間
    });
  });

  describe("備註功能", () => {
    it("應該顯示備註", () => {
      const notesElement = wrapper.find('[data-testid="item-notes"]');
      expect(notesElement.text()).toContain("不要香菜");
    });

    it("當沒有備註時不應該顯示備註區域", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, notes: undefined },
      });

      const notesElement = wrapper.find('[data-testid="item-notes"]');
      expect(notesElement.exists()).toBe(false);
    });

    it("備註應該有適當的樣式", () => {
      const notesElement = wrapper.find('[data-testid="item-notes"]');
      expect(notesElement.classes()).toContain("text-sm");
      expect(notesElement.classes()).toContain("text-gray-600");
    });
  });

  describe("只讀模式", () => {
    it("在只讀模式下不應該有可編輯元素", async () => {
      await wrapper.setProps({ readonly: true });

      const editableElements = wrapper.findAll("input, button, textarea");
      expect(editableElements.length).toBe(0);
    });

    it("在非只讀模式下應該有操作按鈕", () => {
      const actionButtons = wrapper.findAll("button");
      expect(actionButtons.length).toBeGreaterThan(0);
    });
  });

  describe("操作按鈕", () => {
    it("應該顯示編輯按鈕", () => {
      const editButton = wrapper.find('[data-testid="edit-item-btn"]');
      expect(editButton.exists()).toBe(true);
      expect(editButton.text()).toContain("編輯");
    });

    it("應該顯示移除按鈕", () => {
      const removeButton = wrapper.find('[data-testid="remove-item-btn"]');
      expect(removeButton.exists()).toBe(true);
      expect(removeButton.text()).toContain("移除");
    });

    it("點擊編輯按鈕應該觸發事件", async () => {
      const editButton = wrapper.find('[data-testid="edit-item-btn"]');
      await editButton.trigger("click");

      expect(wrapper.emitted("edit-item")).toBeTruthy();
      expect(wrapper.emitted("edit-item")![0]).toEqual([mockOrderItem]);
    });

    it("點擊移除按鈕應該觸發事件", async () => {
      const removeButton = wrapper.find('[data-testid="remove-item-btn"]');
      await removeButton.trigger("click");

      expect(wrapper.emitted("remove-item")).toBeTruthy();
      expect(wrapper.emitted("remove-item")![0]).toEqual([mockOrderItem.id]);
    });
  });

  describe("價格顯示", () => {
    it("應該顯示項目總價", () => {
      expect(wrapper.text()).toContain("$280.00");
    });

    it("當數量大於 1 時應該顯示單價分解", () => {
      expect(wrapper.text()).toContain("($140.00 × 2)");
    });

    it("當數量為 1 時不應該顯示單價分解", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, quantity: 1 },
      });

      expect(wrapper.text()).not.toContain("×");
      expect(wrapper.text()).toContain("$140.00");
    });

    it("應該突出顯示客製化加價", () => {
      const priceElement = wrapper.find('[data-testid="item-price"]');
      expect(priceElement.exists()).toBe(true);
    });
  });

  describe("圖片處理", () => {
    it("應該優先使用 thumbnail 圖片", () => {
      const img = wrapper.find("img");
      expect(img.attributes("src")).toBe("/images/beef-noodles-thumb.jpg");
    });

    it("當沒有 thumbnail 時應該使用原始圖片", async () => {
      await wrapper.setProps({
        item: {
          ...mockOrderItem,
          menuItem: {
            ...mockOrderItem.menuItem,
            imageVariants: undefined,
          },
        },
      });

      const img = wrapper.find("img");
      expect(img.attributes("src")).toBe("/images/beef-noodles.jpg");
    });

    it("當沒有圖片時應該顯示預設圖標", async () => {
      await wrapper.setProps({
        item: {
          ...mockOrderItem,
          menuItem: {
            ...mockOrderItem.menuItem,
            imageUrl: "",
            imageVariants: undefined,
          },
        },
      });

      const img = wrapper.find("img");
      expect(img.exists()).toBe(false);

      const placeholder = wrapper.find(".text-gray-400 svg");
      expect(placeholder.exists()).toBe(true);
    });
  });

  describe("響應式設計", () => {
    it("應該有適當的響應式佈局", () => {
      expect(wrapper.classes()).toContain("bg-white");
      expect(wrapper.classes()).toContain("rounded-lg");
      expect(wrapper.classes()).toContain("shadow-sm");
    });

    it("應該在移動端有適當的間距", () => {
      const container = wrapper.find(".p-4.sm\\:p-6");
      expect(container.exists()).toBe(true);
    });
  });

  describe("動畫效果", () => {
    it("應該有過渡動畫", () => {
      expect(wrapper.classes()).toContain("transition-all");
      expect(wrapper.classes()).toContain("duration-200");
    });

    it("應該有 hover 效果", () => {
      expect(wrapper.classes()).toContain("hover:shadow-md");
    });

    it("狀態變化應該有動畫效果", async () => {
      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.classes()).toContain("transition-colors");
    });
  });

  describe("無障礙性", () => {
    it("圖片應該有適當的 alt 文字", () => {
      const img = wrapper.find("img");
      expect(img.attributes("alt")).toBe("牛肉麵");
    });

    it("按鈕應該有適當的標籤", () => {
      const buttons = wrapper.findAll("button");
      buttons.forEach((button) => {
        expect(
          button.attributes("aria-label") || button.text().length > 0,
        ).toBeTruthy();
      });
    });

    it("狀態應該有適當的 ARIA 屬性", () => {
      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.attributes("role")).toBe("status");
      expect(statusElement.attributes("aria-label")).toBeTruthy();
    });
  });

  describe("邊界情況", () => {
    it("應該處理極大的數量", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, quantity: 999 },
      });

      expect(wrapper.text()).toContain("× 999");
    });

    it("應該處理零價格商品", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, price: 0 },
      });

      expect(wrapper.text()).toContain("$0.00");
    });

    it("應該處理極長的商品名稱", async () => {
      await wrapper.setProps({
        item: {
          ...mockOrderItem,
          menuItem: {
            ...mockOrderItem.menuItem,
            name: "超級無敵美味香濃濃郁牛肉麵加上特製手工麵條和獨家秘製湯頭",
          },
        },
      });

      const nameElement = wrapper.find("h3");
      expect(nameElement.classes()).toContain("truncate");
    });

    it("應該處理空的客製化物件", async () => {
      await wrapper.setProps({
        item: {
          ...mockOrderItem,
          customizations: {},
        },
      });

      const customizationText = wrapper.find('[data-testid="customizations"]');
      expect(customizationText.exists()).toBe(false);
    });
  });

  describe("特殊狀態處理", () => {
    it("應該處理未知狀態", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: "unknown" as any },
      });

      const statusElement = wrapper.find('[data-testid="item-status"]');
      expect(statusElement.text()).toContain("未知");
      expect(statusElement.classes()).toContain("bg-gray-100");
    });

    it("應該處理缺失的商品資訊", async () => {
      await wrapper.setProps({
        item: {
          ...mockOrderItem,
          menuItem: {
            ...mockOrderItem.menuItem,
            name: "",
            description: "",
          },
        },
      });

      const itemCard = wrapper.find('[data-testid="order-item-card"]');
      expect(itemCard.exists()).toBe(true);
    });
  });
});
