/**
 * OrderStats Component Tests
 * 測試 OrderStats 組件的統計數據顯示
 */

import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import OrderStats from "../OrderStats.vue";
import type { KitchenStats } from "@/types";

vi.mock("@heroicons/vue/24/outline", () => ({
  ArrowPathIcon: { name: "ArrowPathIcon", template: "<svg />" },
}));

function createMockStats(overrides: Partial<KitchenStats> = {}): KitchenStats {
  return {
    pendingCount: 5,
    preparingCount: 10,
    readyCount: 3,
    completedToday: 45,
    averageCookingTime: 15,
    averageWaitingTime: 8,
    efficiency: 92,
    urgentOrders: 2,
    ...overrides,
  };
}

describe("OrderStats Component", () => {
  describe("Stats Display", () => {
    it("should display completed today count", () => {
      const stats = createMockStats({ completedToday: 50 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("50");
      expect(wrapper.text()).toContain("今日完成");
    });

    it("should display average cooking time", () => {
      const stats = createMockStats({ averageCookingTime: 18 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("18分");
      expect(wrapper.text()).toContain("平均製作");
    });

    it("should display efficiency percentage", () => {
      const stats = createMockStats({ efficiency: 95 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("95%");
      expect(wrapper.text()).toContain("完成率");
    });

    it("should display urgent orders count", () => {
      const stats = createMockStats({ urgentOrders: 7 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("7");
      expect(wrapper.text()).toContain("緊急訂單");
    });
  });

  describe("Refresh Functionality", () => {
    it("should emit refresh event when button clicked", async () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, { props: { stats } });

      const refreshButton = wrapper.find('button[title="刷新統計"]');
      await refreshButton.trigger("click");

      expect(wrapper.emitted()).toHaveProperty("refresh");
    });

    it("should accept loading prop", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, {
        props: { stats, loading: true },
      });

      // Component should mount successfully with loading prop
      expect(wrapper.exists()).toBe(true);
    });

    it("should disable refresh button when loading", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, {
        props: { stats, loading: true },
      });

      const refreshButton = wrapper.find("button");
      expect(refreshButton.attributes("disabled")).toBeDefined();
    });
  });

  describe("Zero Values", () => {
    it("should handle zero completed orders", () => {
      const stats = createMockStats({ completedToday: 0 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("0");
    });

    it("should handle zero urgent orders", () => {
      const stats = createMockStats({ urgentOrders: 0 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("0");
    });

    it("should handle zero efficiency", () => {
      const stats = createMockStats({ efficiency: 0 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("0%");
    });
  });

  describe("Large Values", () => {
    it("should display large completed count", () => {
      const stats = createMockStats({ completedToday: 999 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("999");
    });

    it("should display large cooking time", () => {
      const stats = createMockStats({ averageCookingTime: 120 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("120分");
    });

    it("should handle 100% efficiency", () => {
      const stats = createMockStats({ efficiency: 100 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("100%");
    });
  });

  describe("Component Structure", () => {
    it("should have 4 stat cards in grid", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, { props: { stats } });

      // The component should display all 4 stat labels
      expect(wrapper.text()).toContain("待處理");
      expect(wrapper.text()).toContain("製作中");
      expect(wrapper.text()).toContain("已完成");
      expect(wrapper.text()).toContain("緊急訂單");
    });

    it("should have header with title", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("廚房統計");
    });

    it("should display all stat values correctly", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, { props: { stats } });

      // Verify all stat values are rendered
      expect(wrapper.text()).toContain("5"); // pendingCount
      expect(wrapper.text()).toContain("10"); // preparingCount
      expect(wrapper.text()).toContain("3"); // readyCount
      expect(wrapper.text()).toContain("2"); // urgentOrders
    });
  });
});
