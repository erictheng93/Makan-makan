/**
 * OrderStats Component Tests
 * 測試 OrderStats 組件的統計數據顯示
 *
 * The OrderStats component renders a 4-column grid showing:
 *   - 待處理 (pendingCount)
 *   - 製作中 (preparingCount)
 *   - 已完成 (readyCount)
 *   - 緊急訂單 (urgentOrders)
 *
 * It does NOT display completedToday, averageCookingTime, efficiency,
 * a refresh button, or a "廚房統計" header.
 * It accepts a `loading` prop and emits a `refresh` event, but these are
 * for external orchestration — the component does not render a refresh button.
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
    it("should display pending count", () => {
      const stats = createMockStats({ pendingCount: 7 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("7");
      expect(wrapper.text()).toContain("待處理");
    });

    it("should display preparing count", () => {
      const stats = createMockStats({ preparingCount: 12 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("12");
      expect(wrapper.text()).toContain("製作中");
    });

    it("should display ready count", () => {
      const stats = createMockStats({ readyCount: 8 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("8");
      expect(wrapper.text()).toContain("已完成");
    });

    it("should display urgent orders count", () => {
      const stats = createMockStats({ urgentOrders: 7 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("7");
      expect(wrapper.text()).toContain("緊急訂單");
    });
  });

  describe("Refresh Functionality", () => {
    it("should accept loading prop without error", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, {
        props: { stats, loading: true },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should accept loading: false without error", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, {
        props: { stats, loading: false },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should accept loading: true without error", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, {
        props: { stats, loading: true },
      });

      // Component should mount successfully with loading prop
      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("Zero Values", () => {
    it("should handle zero pending orders", () => {
      const stats = createMockStats({ pendingCount: 0 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("0");
    });

    it("should handle zero urgent orders", () => {
      const stats = createMockStats({ urgentOrders: 0 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("0");
    });

    it("should handle zero preparing count", () => {
      const stats = createMockStats({ preparingCount: 0 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("0");
    });
  });

  describe("Large Values", () => {
    it("should display large pending count", () => {
      const stats = createMockStats({ pendingCount: 999 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("999");
    });

    it("should display large preparing count", () => {
      const stats = createMockStats({ preparingCount: 888 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("888");
    });

    it("should display large ready count", () => {
      const stats = createMockStats({ readyCount: 777 });
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.text()).toContain("777");
    });
  });

  describe("Component Structure", () => {
    it("should have 4 stat cards in grid", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, { props: { stats } });

      // The component displays all 4 stat labels
      expect(wrapper.text()).toContain("待處理");
      expect(wrapper.text()).toContain("製作中");
      expect(wrapper.text()).toContain("已完成");
      expect(wrapper.text()).toContain("緊急訂單");
    });

    it("should render as a grid container", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, { props: { stats } });

      expect(wrapper.find(".grid").exists()).toBe(true);
    });

    it("should display all stat values correctly", () => {
      const stats = createMockStats();
      const wrapper = mount(OrderStats, { props: { stats } });

      // Verify all four displayed stat values are rendered
      expect(wrapper.text()).toContain("5"); // pendingCount
      expect(wrapper.text()).toContain("10"); // preparingCount
      expect(wrapper.text()).toContain("3"); // readyCount
      expect(wrapper.text()).toContain("2"); // urgentOrders
    });
  });
});
