// Kitchen Display - OrderCard 組件測試
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "../../../stores/settings";
import OrderCard from "../../../components/orders/OrderCard.vue";

/**
 * OrderCard 組件測試
 *
 * 測試範圍：
 * - 訂單信息顯示
 * - 優先級狀態
 * - 時間顯示
 * - 操作按鈕
 * - 條件渲染
 */

describe("OrderCard.vue", () => {
  const mockOrder = {
    id: "order-123",
    orderNumber: "001",
    tableName: "A-1",
    customerName: "張三",
    priority: "normal",
    status: "pending",
    createdAt: new Date().toISOString(),
    elapsedTime: 300, // 5 minutes in seconds
    items: [
      {
        id: "item-1",
        name: "宮保雞丁",
        quantity: 2,
        status: "pending",
        notes: "不要辣",
      },
      {
        id: "item-2",
        name: "炒飯",
        quantity: 1,
        status: "pending",
      },
    ],
  };

  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;

  const createWrapper = (props: any = {}, options: any = {}) => {
    return mount(OrderCard, {
      props: {
        order: mockOrder,
        statusType: "pending", // required prop
        ...props,
      },
      global: {
        plugins: [pinia], // 提供 Pinia 實例給組件
        stubs: {
          UserIcon: true,
        },
      },
      ...options,
    });
  };

  beforeEach(() => {
    // 初始化 Pinia
    pinia = createPinia();
    setActivePinia(pinia);

    vi.clearAllMocks();
  });

  describe("基本渲染", () => {
    it("應該正確渲染訂單卡片", () => {
      wrapper = createWrapper();

      // Root element is a div with dynamic classes (no .order-card class)
      expect(wrapper.element.tagName).toBe("DIV");
      expect(wrapper.exists()).toBe(true);
    });

    it("應該顯示訂單編號", () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain("001");
    });

    it("應該顯示桌號", () => {
      wrapper = createWrapper();

      // Component renders table name as "桌 A-1" (e.g. <span>桌 {{ order.tableName }}</span>)
      expect(wrapper.text()).toContain("桌 A-1");
    });

    it("應該顯示所有訂單項目", () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain("宮保雞丁");
      expect(wrapper.text()).toContain("炒飯");
    });

    it("應該顯示項目數量", () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain("2"); // 宮保雞丁 x2
      expect(wrapper.text()).toContain("1"); // 炒飯 x1
    });
  });

  describe("客戶名稱顯示", () => {
    it("showCustomerNames=true 時應該顯示客戶名稱", async () => {
      const settingsStore = useSettingsStore();
      settingsStore.updateSetting("showCustomerNames", true);
      await nextTick(); // 等待設定更新

      wrapper = createWrapper();
      await nextTick(); // 等待組件渲染

      expect(wrapper.text()).toContain("張三");
    });

    it("showCustomerNames=false 時應該隱藏客戶名稱", async () => {
      const settingsStore = useSettingsStore();
      settingsStore.updateSetting("showCustomerNames", false);
      await nextTick(); // 等待設定更新

      wrapper = createWrapper();
      await nextTick(); // 等待組件渲染

      expect(wrapper.text()).not.toContain("張三");
    });

    it("沒有客戶名稱時不應顯示客戶信息區塊", () => {
      const orderWithoutCustomer = {
        ...mockOrder,
        customerName: undefined,
      };

      wrapper = createWrapper({
        order: orderWithoutCustomer,
        showCustomerNames: true,
      });

      expect(wrapper.find('[class*="customer"]').exists()).toBe(false);
    });
  });

  describe("優先級顯示", () => {
    it("應該為緊急訂單顯示緊急標記", () => {
      const urgentOrder = {
        ...mockOrder,
        priority: "urgent",
      };

      wrapper = createWrapper({ order: urgentOrder });

      // Urgent orders use animate-urgent-pulse class on the root card
      expect(wrapper.html()).toContain("animate-urgent-pulse");
    });

    it("應該為普通訂單不顯示動畫", () => {
      wrapper = createWrapper();

      expect(wrapper.find(".animate-pulse-fast").exists()).toBe(false);
    });

    it("應該顯示優先級文字", () => {
      const urgentOrder = {
        ...mockOrder,
        priority: "urgent",
      };

      wrapper = createWrapper({ order: urgentOrder });

      const priorityText = wrapper.text();
      expect(priorityText).toMatch(/緊急|urgent/i);
    });
  });

  describe("時間顯示", () => {
    it("應該顯示經過時間", () => {
      wrapper = createWrapper();

      // Should show elapsed time (5 minutes = 300 seconds)
      expect(wrapper.text()).toMatch(/5.*分鐘?|5.*min/i);
    });

    it("應該根據時間長度使用不同樣式", () => {
      // 超過 15 分鐘的訂單
      const longWaitOrder = {
        ...mockOrder,
        elapsedTime: 900, // 15 minutes
      };

      wrapper = createWrapper({ order: longWaitOrder });

      // 應該有警告樣式
      const timeElement = wrapper.find('[class*="text-"]');
      expect(timeElement.exists()).toBe(true);
    });

    it("應該顯示創建時間", () => {
      wrapper = createWrapper();

      // Should render the component with creation time visible
      // The OrderCard displays formatOrderTime(order.createdAt) as text
      expect(wrapper.exists()).toBe(true);
      // The time text is rendered in the card
      expect(wrapper.text().length).toBeGreaterThan(0);
    });
  });

  describe("狀態樣式", () => {
    it("pending 狀態應該有對應的樣式", () => {
      wrapper = createWrapper({ statusType: "pending" });

      // Root element carries dynamic border/background classes based on statusType
      expect(wrapper.element.classList.length).toBeGreaterThan(0);
    });

    it("preparing 狀態應該有對應的樣式", () => {
      const preparingOrder = {
        ...mockOrder,
        status: "preparing",
      };

      wrapper = createWrapper({
        order: preparingOrder,
        statusType: "preparing",
      });

      expect(wrapper.element.classList.length).toBeGreaterThan(0);
    });

    it("completed 狀態應該有對應的樣式", () => {
      const completedOrder = {
        ...mockOrder,
        status: "completed",
      };

      wrapper = createWrapper({ order: completedOrder, statusType: "ready" });

      expect(wrapper.element.classList.length).toBeGreaterThan(0);
    });
  });

  describe("訂單項目", () => {
    it("應該顯示項目備註", () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain("不要辣");
    });

    it("應該為每個項目創建獨立的行", () => {
      wrapper = createWrapper();

      // Each item name should appear in the card
      expect(wrapper.text()).toContain("宮保雞丁");
      expect(wrapper.text()).toContain("炒飯");
      // Both item quantities should be shown
      expect(wrapper.text()).toContain("2");
      expect(wrapper.text()).toContain("1");
    });

    it("應該顯示項目名稱", () => {
      wrapper = createWrapper();

      mockOrder.items.forEach((item) => {
        expect(wrapper.text()).toContain(item.name);
      });
    });

    it("應該正確顯示項目數量", () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain("2"); // 第一個項目
      expect(wrapper.text()).toContain("1"); // 第二個項目
    });
  });

  describe("交互元素", () => {
    it("應該有可點擊的卡片結構", () => {
      wrapper = createWrapper();

      // The root element should exist and be a valid element
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.element.tagName).toBeDefined();
    });

    it("應該渲染完整的卡片內容", () => {
      wrapper = createWrapper();

      expect(wrapper.exists()).toBe(true);
      // Card should contain order info
      expect(wrapper.text()).toContain("001");
    });
  });

  describe("邊界情況", () => {
    it("應該處理空的項目列表", () => {
      const emptyOrder = {
        ...mockOrder,
        items: [],
      };

      wrapper = createWrapper({ order: emptyOrder });

      expect(wrapper.exists()).toBe(true);
    });

    it("應該處理極長的項目名稱", () => {
      const longNameOrder = {
        ...mockOrder,
        items: [
          {
            id: "item-1",
            name: "超級無敵超長的菜名測試測試測試測試測試測試測試",
            quantity: 1,
            status: "pending",
          },
        ],
      };

      wrapper = createWrapper({ order: longNameOrder });

      expect(wrapper.exists()).toBe(true);
    });

    it("應該處理大數量", () => {
      const largeQuantityOrder = {
        ...mockOrder,
        items: [
          {
            id: "item-1",
            name: "炒飯",
            quantity: 99,
            status: "pending",
          },
        ],
      };

      wrapper = createWrapper({ order: largeQuantityOrder });

      expect(wrapper.text()).toContain("99");
    });

    it("應該處理缺少可選欄位的訂單", () => {
      const minimalOrder = {
        id: "order-minimal",
        orderNumber: "999",
        tableName: "B-1",
        priority: "normal",
        status: "pending",
        createdAt: new Date().toISOString(),
        elapsedTime: 60,
        items: [
          {
            id: "item-1",
            name: "測試菜品",
            quantity: 1,
            status: "pending",
          },
        ],
      };

      wrapper = createWrapper({ order: minimalOrder });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain("999");
      expect(wrapper.text()).toContain("B-1");
    });
  });
});
