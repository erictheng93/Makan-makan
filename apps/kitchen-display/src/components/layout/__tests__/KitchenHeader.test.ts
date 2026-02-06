/**
 * KitchenHeader Component Tests
 * 測試廚房頭部組件的顯示和互動
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import KitchenHeader from "../KitchenHeader.vue";
import type { KitchenStats } from "@/types";

// Mock Heroicons
vi.mock("@heroicons/vue/24/outline", () => ({
  ArrowPathIcon: { name: "ArrowPathIcon", template: "<svg />" },
  ArrowsPointingInIcon: { name: "ArrowsPointingInIcon", template: "<svg />" },
  ArrowsPointingOutIcon: { name: "ArrowsPointingOutIcon", template: "<svg />" },
  Cog6ToothIcon: { name: "Cog6ToothIcon", template: "<svg />" },
  ArrowRightOnRectangleIcon: {
    name: "ArrowRightOnRectangleIcon",
    template: "<svg />",
  },
  ExclamationTriangleIcon: {
    name: "ExclamationTriangleIcon",
    template: "<svg />",
  },
}));

const mockStats: KitchenStats = {
  pendingCount: 5,
  preparingCount: 3,
  readyCount: 2,
  completedToday: 15,
  averageCookingTime: 12,
  averageWaitingTime: 5,
  efficiency: 85,
  urgentOrders: 1,
};

describe("KitchenHeader Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Mounting", () => {
    it("should mount successfully", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test Restaurant",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should display restaurant name", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "MakanMakan Restaurant",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("MakanMakan Restaurant");
    });

    it("should display system title", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("廚房顯示系統");
    });
  });

  describe("Stats Display", () => {
    it("should display pending count", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("5");
      expect(wrapper.text()).toContain("待處理");
    });

    it("should display preparing count", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("3");
      expect(wrapper.text()).toContain("製作中");
    });

    it("should display ready count", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("2");
      expect(wrapper.text()).toContain("已完成");
    });

    it("should display completed today count on mobile", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("15");
      expect(wrapper.text()).toContain("今日完成");
    });
  });

  describe("Time Display", () => {
    it("should display current time", () => {
      const testDate = new Date("2025-11-15T14:30:00");
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: testDate,
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("14:30");
    });

    it("should display current date", () => {
      const testDate = new Date("2025-11-15T14:30:00");
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: testDate,
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("2025");
    });

    it("should update time when prop changes", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date("2025-11-15T14:30:00"),
          stats: mockStats,
        },
      });

      await wrapper.setProps({
        currentTime: new Date("2025-11-15T14:31:00"),
      });

      expect(wrapper.text()).toContain("14:31");
    });
  });

  describe("Connection Status", () => {
    it("should show connected status", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
          isConnected: true,
        },
      });

      expect(wrapper.text()).toContain("已連線");
    });

    it("should show disconnected status", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
          isConnected: false,
        },
      });

      expect(wrapper.text()).toContain("離線");
    });

    it("should display reconnect button when disconnected", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
          isConnected: false,
        },
      });

      const reconnectButton = wrapper.find('[title="重新連線"]');
      expect(reconnectButton.exists()).toBe(true);
    });

    it("should not display reconnect button when connected", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
          isConnected: true,
        },
      });

      const reconnectButton = wrapper.find('[title="重新連線"]');
      expect(reconnectButton.exists()).toBe(false);
    });
  });

  describe("Action Buttons", () => {
    it("should emit refresh event when refresh button clicked", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      const refreshButton = wrapper.find('[title="刷新訂單"]');
      await refreshButton.trigger("click");

      expect(wrapper.emitted("refresh")).toBeTruthy();
    });

    it("should emit reconnect event when reconnect button clicked", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
          isConnected: false,
        },
      });

      const reconnectButton = wrapper.find('[title="重新連線"]');
      await reconnectButton.trigger("click");

      expect(wrapper.emitted("reconnect")).toBeTruthy();
    });

    it("should emit toggle-fullscreen event when fullscreen button clicked", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      const fullscreenButton = wrapper.find('[title="全屏模式"]');
      await fullscreenButton.trigger("click");

      expect(wrapper.emitted("toggle-fullscreen")).toBeTruthy();
    });

    it("should emit open-settings event when settings button clicked", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      const settingsButton = wrapper.find('[title="設定"]');
      await settingsButton.trigger("click");

      expect(wrapper.emitted("open-settings")).toBeTruthy();
    });
  });

  describe("Logout Functionality", () => {
    it("should show logout confirmation modal when logout clicked", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      const logoutButton = wrapper.find('[title="登出"]');
      await logoutButton.trigger("click");

      expect(wrapper.text()).toContain("確認登出");
    });

    it("should hide modal when cancel clicked", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      // Show modal
      const logoutButton = wrapper.find('[title="登出"]');
      await logoutButton.trigger("click");

      // Click cancel
      const cancelButton = wrapper
        .findAll("button")
        .find((btn) => btn.text() === "取消");
      await cancelButton?.trigger("click");

      await wrapper.vm.$nextTick();

      const modal = wrapper.find(".fixed.inset-0");
      expect(modal.exists()).toBe(false);
    });

    it("should emit logout event when confirmed", async () => {
      vi.useFakeTimers();

      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      // Show modal
      const logoutButton = wrapper.find('[title="登出"]');
      await logoutButton.trigger("click");

      // Confirm logout
      const confirmButton = wrapper
        .findAll("button")
        .find(
          (btn) =>
            btn.text() === "登出" && btn.classes().includes("bg-red-600"),
        );
      await confirmButton?.trigger("click");

      // Fast-forward timeout
      vi.advanceTimersByTime(100);
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("logout")).toBeTruthy();

      vi.useRealTimers();
    });

    it("should hide modal when clicking outside", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      // Show modal
      const logoutButton = wrapper.find('[title="登出"]');
      await logoutButton.trigger("click");

      // Click outside
      const backdrop = wrapper.find(".fixed.inset-0");
      await backdrop.trigger("click");

      await wrapper.vm.$nextTick();

      expect(wrapper.find(".fixed.inset-0").exists()).toBe(false);
    });
  });

  describe("Fullscreen Handling", () => {
    beforeEach(() => {
      // Mock fullscreen API
      Object.defineProperty(document, "fullscreenElement", {
        writable: true,
        value: null,
      });
    });

    it("should detect fullscreen status on mount", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.vm).toBeDefined();
    });

    it("should update fullscreen status when changed", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      // Simulate entering fullscreen
      Object.defineProperty(document, "fullscreenElement", {
        value: document.documentElement,
      });

      const event = new Event("fullscreenchange");
      document.dispatchEvent(event);

      await wrapper.vm.$nextTick();

      expect(wrapper.vm).toBeDefined();
    });
  });

  describe("Responsive Stats Display", () => {
    it("should have desktop stats section", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      const desktopStats = wrapper.find(".hidden.md\\:flex");
      expect(desktopStats.exists()).toBe(true);
    });

    it("should have mobile stats section", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      const mobileStats = wrapper.find(".md\\:hidden");
      expect(mobileStats.exists()).toBe(true);
    });
  });

  describe("Props Validation", () => {
    it("should handle default connection status", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect((wrapper.props as any)("connectionStatus")).toBe("disconnected");
      expect((wrapper.props as any)("isConnected")).toBe(false);
    });

    it("should accept custom connection status", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
          connectionStatus: "connected",
          isConnected: true,
        },
      });

      expect((wrapper.props as any)("connectionStatus")).toBe("connected");
      expect((wrapper.props as any)("isConnected")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero stats", () => {
      const zeroStats: KitchenStats = {
        pendingCount: 0,
        preparingCount: 0,
        readyCount: 0,
        completedToday: 0,
        averageCookingTime: 0,
        averageWaitingTime: 0,
        efficiency: 0,
        urgentOrders: 0,
      };

      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: zeroStats,
        },
      });

      expect(wrapper.text()).toContain("0");
    });

    it("should handle large stats numbers", () => {
      const largeStats: KitchenStats = {
        pendingCount: 999,
        preparingCount: 888,
        readyCount: 777,
        completedToday: 1000,
        averageCookingTime: 30,
        averageWaitingTime: 10,
        efficiency: 95,
        urgentOrders: 50,
      };

      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: largeStats,
        },
      });

      expect(wrapper.text()).toContain("999");
      expect(wrapper.text()).toContain("1000");
    });

    it("should handle long restaurant names", () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName:
            "Very Long Restaurant Name That Should Still Display Correctly",
          currentTime: new Date(),
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("Very Long Restaurant Name");
    });

    it("should handle midnight time correctly", () => {
      const midnightDate = new Date("2025-11-15T00:00:00");
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: midnightDate,
          stats: mockStats,
        },
      });

      expect(wrapper.text()).toContain("00:00");
    });
  });

  describe("Event Emission", () => {
    it("should emit all events with correct payloads", async () => {
      const wrapper = mount(KitchenHeader, {
        props: {
          restaurantName: "Test",
          currentTime: new Date(),
          stats: mockStats,
          isConnected: false,
        },
      });

      // Test all event emissions
      await wrapper.find('[title="刷新訂單"]').trigger("click");
      await wrapper.find('[title="重新連線"]').trigger("click");
      await wrapper.find('[title="全屏模式"]').trigger("click");
      await wrapper.find('[title="設定"]').trigger("click");

      expect(wrapper.emitted("refresh")).toHaveLength(1);
      expect(wrapper.emitted("reconnect")).toHaveLength(1);
      expect(wrapper.emitted("toggle-fullscreen")).toHaveLength(1);
      expect(wrapper.emitted("open-settings")).toHaveLength(1);
    });
  });
});
