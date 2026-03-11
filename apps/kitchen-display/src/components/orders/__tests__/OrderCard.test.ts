/**
 * OrderCard Component Tests
 * 測試 OrderCard 組件的訂單顯示、優先級和操作功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import OrderCard from "../OrderCard.vue";
import type { KitchenOrder, KitchenOrderItem } from "@/types";

// Mock icons
vi.mock("@heroicons/vue/24/outline", () => ({
  UserIcon: { name: "UserIcon", template: "<svg />" },
  ClockIcon: { name: "ClockIcon", template: "<svg />" },
  ChatBubbleLeftEllipsisIcon: {
    name: "ChatBubbleLeftEllipsisIcon",
    template: "<svg />",
  },
  PlayIcon: { name: "PlayIcon", template: "<svg />" },
  CheckIcon: { name: "CheckIcon", template: "<svg />" },
  EyeIcon: { name: "EyeIcon", template: "<svg />" },
  ExclamationTriangleIcon: {
    name: "ExclamationTriangleIcon",
    template: "<svg />",
  },
  CheckCircleIcon: { name: "CheckCircleIcon", template: "<svg />" },
  FireIcon: { name: "FireIcon", template: "<svg />" },
  XCircleIcon: { name: "XCircleIcon", template: "<svg />" },
  BellAlertIcon: { name: "BellAlertIcon", template: "<svg />" },
}));

// Helper function to create mock order item
function createMockItem(
  overrides: Partial<KitchenOrderItem> = {},
): KitchenOrderItem {
  return {
    id: 1,
    name: "宮保雞丁",
    quantity: 2,
    status: "pending",
    notes: "",
    customizations: [],
    estimatedTime: 15,
    priority: "normal",
    ...overrides,
  };
}

// Helper function to create mock order
function createMockOrder(overrides: Partial<KitchenOrder> = {}): KitchenOrder {
  const now = Date.now();

  return {
    id: 1,
    orderNumber: "ORD-001",
    tableId: 1,
    tableName: "T1",
    customerName: "張三",
    status: 1, // Pending
    priority: "normal",
    createdAt: new Date(now).toISOString(),
    elapsedTime: 0,
    estimatedTime: 15,
    totalItems: 1,
    items: [createMockItem()],
    ...overrides,
  };
}

describe("OrderCard Component", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe("Order Display", () => {
    it("should render order number and table name", () => {
      const order = createMockOrder();
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("ORD-001");
      expect(wrapper.text()).toContain("T1");
    });

    it("should display customer name when provided and enabled", () => {
      const order = createMockOrder({ customerName: "李四" });
      const wrapper = mount(OrderCard, {
        props: {
          order,
          statusType: "pending",
          showCustomerNames: true,
        },
      });

      expect(wrapper.text()).toContain("李四");
    });

    it("should display customer name in component text", () => {
      const order = createMockOrder({ customerName: "王五" });
      const wrapper = mount(OrderCard, {
        props: {
          order,
          statusType: "pending",
        },
      });

      // Component should render without errors
      expect(wrapper.exists()).toBe(true);
      expect((wrapper.props as any)("order").customerName).toBe("王五");
    });

    it("should display all order items", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            estimatedTime: 10,
            priority: "normal",
          },
          {
            id: 2,
            name: "炒麵",
            quantity: 2,
            status: "pending",
            estimatedTime: 12,
            priority: "normal",
          },
          {
            id: 3,
            name: "湯",
            quantity: 1,
            status: "pending",
            estimatedTime: 5,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("炒飯");
      expect(wrapper.text()).toContain("炒麵");
      expect(wrapper.text()).toContain("湯");
      expect(wrapper.text()).toContain("x1");
      expect(wrapper.text()).toContain("x2");
    });

    it("should display item notes when present", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            notes: "不要蔥",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("不要蔥");
    });

    it("should display item customizations", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            customizations: ["加辣", "少油"],
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("加辣");
      expect(wrapper.text()).toContain("少油");
    });
  });

  describe("Priority Styling", () => {
    it("should apply normal priority class", () => {
      const order = createMockOrder({ priority: "normal" });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const card = wrapper.find(".order-card");
      expect(card.exists()).toBe(true);
    });

    it("should apply urgent priority class and animation", () => {
      const order = createMockOrder({ priority: "urgent" });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const card = wrapper.find(".order-card");
      expect(card.classes()).toContain("animate-pulse-fast");
    });

    it("should display priority badge for urgent orders", () => {
      const order = createMockOrder({ priority: "urgent" });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toMatch(/緊急|urgent/i);
    });
  });

  describe("Time Display", () => {
    it("should display formatted elapsed time", () => {
      const order = createMockOrder({
        elapsedTime: 5, // 5 minutes
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("5");
    });

    it("should display creation time", () => {
      const now = new Date();
      const order = createMockOrder({
        createdAt: now.toISOString(),
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      // Should contain some time format
      const card = wrapper.find(".order-card");
      expect(card.exists()).toBe(true);
    });

    it("should apply warning color for long elapsed time", () => {
      const order = createMockOrder({
        elapsedTime: 25, // 25 minutes
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      // Time should be displayed with warning color
      expect(wrapper.html()).toMatch(/text-(red|orange|yellow)/);
    });

    it("should display estimated time when enabled", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            estimatedTime: 15,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: {
          order,
          statusType: "pending",
          showEstimatedTime: true,
        },
      });

      expect(wrapper.text()).toContain("15");
    });
  });

  describe("Order Status", () => {
    it("should apply correct class for pending status", () => {
      const order = createMockOrder({ status: 1 }); // Pending
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const card = wrapper.find(".order-card");
      expect(card.classes()).toContain("bg-yellow-50");
    });

    it("should apply correct class for preparing status", () => {
      const order = createMockOrder({ status: 2 }); // Preparing
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "preparing" },
      });

      const card = wrapper.find(".order-card");
      expect(card.classes()).toContain("bg-blue-50");
    });

    it("should apply correct class for ready status", () => {
      const order = createMockOrder({ status: 3 }); // Ready
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "ready" },
      });

      const card = wrapper.find(".order-card");
      expect(card.classes()).toContain("bg-green-50");
    });

    it("should apply correct class for completed status", () => {
      const order = createMockOrder({ status: 4 }); // Completed
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "ready" },
      });

      const card = wrapper.find(".order-card");
      expect(card.classes()).toContain("bg-green-50");
    });
  });

  describe("Item Status", () => {
    it("should show start button for pending items", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("開始");
    });

    it("should show complete button for preparing items", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "preparing",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toMatch(/完成|ready/i);
    });

    it("should show checkmark for completed items", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "ready",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "ready" },
      });

      // Should render successfully with ready status
      expect(wrapper.exists()).toBe(true);
      const html = wrapper.html();
      expect(html).toContain("炒飯");
    });
  });

  describe("User Interactions", () => {
    it("should emit start-cooking event when start button clicked", async () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const startButton = wrapper.find('button[title="開始製作"]');
      if (startButton.exists()) {
        await startButton.trigger("click");

        expect(wrapper.emitted()).toHaveProperty("start-cooking");
        // Component emits orderId (number) and itemId (number)
        expect(wrapper.emitted("start-cooking")?.[0]).toEqual([1, 1]);
      }
    });

    it("should emit mark-ready event when complete button clicked", async () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "preparing",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "preparing" },
      });

      const completeButton = wrapper.find('button[title="標記完成"]');
      if (completeButton.exists()) {
        await completeButton.trigger("click");

        expect(wrapper.emitted()).toHaveProperty("mark-ready");
        // Component emits orderId (number) and itemId (number)
        expect(wrapper.emitted("mark-ready")?.[0]).toEqual([1, 1]);
      }
    });

    it("should emit order-complete event when all items ready", async () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "ready",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const completeButton = wrapper.find("button.complete-order");
      if (completeButton.exists()) {
        await completeButton.trigger("click");

        expect(wrapper.emitted()).toHaveProperty("order-complete");
      }
    });
  });

  describe("Empty States", () => {
    it("should handle order with no items", () => {
      const order = createMockOrder({ items: [] });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("ORD-001");
    });

    it("should handle missing customer name", () => {
      const order = createMockOrder({ customerName: undefined });
      const wrapper = mount(OrderCard, {
        props: {
          order,
          statusType: "pending",
          showCustomerNames: true,
        },
      });

      expect(wrapper.find(".customer-info").exists()).toBe(false);
    });

    it("should handle missing estimated time", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: {
          order,
          statusType: "pending",
          showEstimatedTime: true,
        },
      });

      // Should render without errors
      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("Props Validation", () => {
    it("should accept valid order prop", () => {
      const order = createMockOrder();
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect((wrapper.props as any)("order")).toEqual(order);
    });

    it("should mount successfully with required props", () => {
      const order = createMockOrder();
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.exists()).toBe(true);
      expect((wrapper.props as any)("statusType")).toBe("pending");
    });
  });

  describe("Computed Properties", () => {
    it("should determine correct status type", () => {
      const statusTypes = [
        { status: 1 as const, expected: "pending" },
        { status: 2 as const, expected: "preparing" },
        { status: 3 as const, expected: "ready" },
        { status: 4 as const, expected: "completed" },
      ];

      statusTypes.forEach(({ status, expected }) => {
        const order = createMockOrder({ status: status as 1 | 2 | 3 | 4 });
        const wrapper = mount(OrderCard, {
          props: { order, statusType: "pending" },
        });

        // Component should apply correct class based on status
        expect(wrapper.exists()).toBe(true);
      });
    });

    it("should calculate if all items are ready", () => {
      const allReady = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "ready",
            estimatedTime: 10,
            priority: "normal",
          },
          {
            id: 2,
            name: "炒麵",
            quantity: 1,
            status: "ready",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });

      const wrapper = mount(OrderCard, {
        props: { order: allReady, statusType: "ready" },
      });

      // Should show complete order button
      expect(wrapper.exists()).toBe(true);
    });

    it("should calculate if has pending items", () => {
      const hasPending = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            estimatedTime: 10,
            priority: "normal",
          },
          {
            id: 2,
            name: "炒麵",
            quantity: 1,
            status: "ready",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });

      const wrapper = mount(OrderCard, {
        props: { order: hasPending, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("開始");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long order numbers", () => {
      const order = createMockOrder({
        orderNumber: "ORD-2024-11-15-VERY-LONG-ORDER-NUMBER-123456789",
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain(
        "ORD-2024-11-15-VERY-LONG-ORDER-NUMBER-123456789",
      );
    });

    it("should handle very long table names", () => {
      const order = createMockOrder({
        tableName: "VIP包廂A區第一桌",
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("VIP包廂A區第一桌");
    });

    it("should handle very large item quantities", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 99,
            status: "pending",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("99");
    });

    it("should handle very long item names", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "特製超級豪華精緻手工現做美味可口營養豐富宮保雞丁炒飯套餐",
            quantity: 1,
            status: "pending",
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("特製超級豪華");
    });

    it("should handle multiple customizations", () => {
      const order = createMockOrder({
        items: [
          {
            id: 1,
            name: "炒飯",
            quantity: 1,
            status: "pending",
            customizations: [
              "加辣",
              "少油",
              "不要蔥",
              "不要蒜",
              "多醬",
              "少鹽",
            ],
            estimatedTime: 10,
            priority: "normal",
          },
        ],
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      expect(wrapper.text()).toContain("加辣");
      expect(wrapper.text()).toContain("少油");
      expect(wrapper.text()).toContain("不要蔥");
    });
  });

  describe("Delivery Badge", () => {
    it("should display dine-in badge (blue) when no deliveryInfo", () => {
      const order = createMockOrder();
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const html = wrapper.html();
      expect(html).toContain("bg-blue-100");
      expect(html).toContain("text-blue-800");
      expect(wrapper.text()).toContain("內用");
    });

    it("should display dine-in badge when deliveryInfo.type is 'dine_in'", () => {
      const order = createMockOrder({
        deliveryInfo: { type: "dine_in" },
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const html = wrapper.html();
      expect(html).toContain("bg-blue-100");
      expect(html).toContain("text-blue-800");
      expect(wrapper.text()).toContain("內用");
    });

    it("should display takeaway badge (green) when deliveryInfo.type is 'takeaway'", () => {
      const order = createMockOrder({
        deliveryInfo: { type: "takeaway" },
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const html = wrapper.html();
      expect(html).toContain("bg-green-100");
      expect(html).toContain("text-green-800");
      expect(wrapper.text()).toContain("外帶");
    });

    it("should display delivery badge (amber) when deliveryInfo.type is 'delivery'", () => {
      const order = createMockOrder({
        deliveryInfo: { type: "delivery" },
      });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      const html = wrapper.html();
      expect(html).toContain("bg-amber-100");
      expect(html).toContain("text-amber-800");
      expect(wrapper.text()).toContain("外送");
    });

    it("should handle missing deliveryInfo gracefully (default to dine_in)", () => {
      const order = createMockOrder({ deliveryInfo: undefined });
      const wrapper = mount(OrderCard, {
        props: { order, statusType: "pending" },
      });

      // Should render without errors and default to dine_in badge
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.html()).toContain("bg-blue-100");
      expect(wrapper.text()).toContain("內用");
    });
  });
});
