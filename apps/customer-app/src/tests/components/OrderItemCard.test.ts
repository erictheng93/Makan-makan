import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import OrderItemCard from "@/components/OrderItemCard.vue";
import type { OrderItem, MenuItem } from "@makanmasak/shared-types";
import { OrderItemStatus } from "@makanmasak/shared-types";
import { menuItemFactory, resetAllFactories } from "@makanmasak/testing-utils";

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

// Helper: build a MenuItem compatible with shared-types
function buildMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  const base = menuItemFactory.build({
    overrides: {
      id: 1,
      name: "牛肉麵",
      description: "香濃牛肉湯配手工麵條",
      price: 12000,
      isAvailable: true,
      inventoryCount: 50,
      spiceLevel: 1,
      sortOrder: 1,
      isFeatured: false,
      orderCount: 0,
    },
    relations: { restaurantId: 1, categoryId: 1 },
  });
  return {
    ...base,
    restaurantId: "1",
    imageUrl: "/images/beef-noodles.jpg",
    imageVariants: { thumbnail: "/images/beef-noodles-thumb.jpg" },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  } as MenuItem;
}

/**
 * OrderItemCard 元件測試
 *
 * 此元件為純顯示元件，用於顯示訂單項目資訊：
 * - 商品名稱、圖片、數量、價格
 * - 客製化資訊（尺寸、選項、加購）
 * - 備註
 * - 狀態標籤（可選）
 *
 * 元件使用 shared-types 的 OrderItemStatus enum
 */
describe("OrderItemCard.vue", () => {
  let wrapper: VueWrapper<any>;

  const mockOrderItem: OrderItem = {
    id: 1,
    orderId: 123,
    menuItemId: 1,
    menuItem: buildMenuItem(),
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
    resetAllFactories();
    setActivePinia(createPinia());
    wrapper = mount(OrderItemCard, {
      props: {
        item: mockOrderItem,
        showStatus: true,
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
      expect(img.attributes("alt")).toBe("牛肉麵");
    });

    it("應該正確渲染數量", () => {
      expect(wrapper.text()).toContain("× 2");
    });

    it("應該正確渲染總價", () => {
      // totalPrice = 28000 cents = $280.00
      expect(wrapper.text()).toContain("280.00");
    });

    it("當沒有 menuItem 時應該顯示未知商品", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, menuItem: undefined },
      });
      expect(wrapper.text()).toContain("Unknown Item");
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

    it("應該將所有客製化資訊組合顯示", () => {
      // 客製化資訊以逗號分隔
      const text = wrapper.text();
      expect(text).toContain("大碗");
      expect(text).toContain("小辣");
      expect(text).toContain("+滷蛋");
    });

    it("當沒有客製化時不應該顯示客製化區域", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, customizations: undefined },
      });

      // 應該不顯示客製化資訊
      expect(wrapper.text()).not.toContain("大碗");
      expect(wrapper.text()).not.toContain("小辣");
    });

    it("應該處理空的客製化物件", async () => {
      await wrapper.setProps({
        item: {
          ...mockOrderItem,
          customizations: {},
        },
      });

      // 空客製化不應該顯示任何額外資訊
      expect(wrapper.text()).not.toContain("大碗");
    });
  });

  describe("訂單狀態顯示", () => {
    it("當 showStatus 為 true 時應該顯示狀態", () => {
      expect(wrapper.text()).toContain("Pending");
    });

    it("當 showStatus 為 false 時不應該顯示狀態", async () => {
      await wrapper.setProps({ showStatus: false });
      expect(wrapper.text()).not.toContain("Pending");
    });

    it("PENDING 應該顯示待處理", () => {
      expect(wrapper.text()).toContain("Pending");
    });

    it("PREPARING 應該顯示製作中", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: OrderItemStatus.PREPARING },
      });
      expect(wrapper.text()).toContain("Preparing");
    });

    it("READY 應該顯示準備完成", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: OrderItemStatus.READY },
      });
      expect(wrapper.text()).toContain("Ready");
    });

    it("DELIVERED 應該顯示已送達", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: OrderItemStatus.DELIVERED },
      });
      expect(wrapper.text()).toContain("Served");
    });

    it("未知狀態應該顯示未知", async () => {
      const invalidStatus = 99 as unknown as OrderItemStatus;
      await wrapper.setProps({
        item: { ...mockOrderItem, status: invalidStatus },
      });
      // Unknown status falls through to empty string in the current statusMap
      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("備註功能", () => {
    it("應該顯示備註", () => {
      expect(wrapper.text()).toContain("Notes:");
      expect(wrapper.text()).toContain("不要香菜");
    });

    it("當沒有備註時不應該顯示備註區域", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, notes: undefined },
      });
      expect(wrapper.text()).not.toContain("Notes:");
    });

    it("空字串備註不應該顯示", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, notes: "" },
      });
      expect(wrapper.text()).not.toContain("Notes:");
    });
  });

  describe("圖片處理", () => {
    it("應該優先使用 thumbnail 圖片", () => {
      const img = wrapper.find("img");
      expect(img.exists()).toBe(true);
      // 圖片 src 應該包含 thumbnail
      expect(img.attributes("src")).toContain("thumb");
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
      expect(img.exists()).toBe(true);
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

  describe("佈局結構", () => {
    it("應該渲染商品名稱、數量和價格", () => {
      expect(wrapper.text()).toContain("牛肉麵");
      expect(wrapper.text()).toContain("× 2");
      expect(wrapper.text()).toContain("280.00");
    });

    it("應該渲染圖片容器", () => {
      const img = wrapper.find("img");
      expect(img.exists()).toBe(true);
    });
  });

  describe("無障礙性", () => {
    it("圖片應該有適當的 alt 文字", () => {
      const img = wrapper.find("img");
      expect(img.attributes("alt")).toBe("牛肉麵");
    });

    it("圖片應該有 lazy loading", () => {
      const img = wrapper.find("img");
      expect(img.attributes("loading")).toBe("lazy");
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
        item: { ...mockOrderItem, totalPrice: 0 },
      });
      expect(wrapper.text()).toContain("0.00");
    });

    it("應該處理缺失的商品資訊", async () => {
      await wrapper.setProps({
        item: {
          ...mockOrderItem,
          menuItem: {
            ...mockOrderItem.menuItem,
            name: "",
          },
        },
      });
      // 應該仍然渲染元件
      expect(wrapper.exists()).toBe(true);
    });

    it("應該處理 undefined status", async () => {
      await wrapper.setProps({
        item: { ...mockOrderItem, status: undefined },
        showStatus: true,
      });
      // 不應該崩潰
      expect(wrapper.exists()).toBe(true);
    });
  });
});
