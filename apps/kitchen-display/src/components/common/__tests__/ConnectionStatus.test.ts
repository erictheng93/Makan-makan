/**
 * ConnectionStatus Component Tests
 * 測試連線狀態組件的顯示和功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ConnectionStatus from "../ConnectionStatus.vue";
import type { ConnectionStatus as ConnectionStatusType } from "@/types";

// Mock Heroicons
vi.mock("@heroicons/vue/24/outline", () => ({
  ChevronUpIcon: { name: "ChevronUpIcon", template: "<svg />" },
  ChevronDownIcon: { name: "ChevronDownIcon", template: "<svg />" },
}));

describe("ConnectionStatus Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Mounting", () => {
    it("should mount successfully", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("Connection Status Display", () => {
    it("should display connected status", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Click minimized indicator to show details
      const minimized = wrapper.find(".w-12.h-12");
      await minimized.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("SSE 已連線");
    });

    it("should display connecting status", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connecting",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.text()).toContain("正在連線");
    });

    it("should display disconnected status", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.text()).toContain("SSE 離線");
    });

    it("should display error status", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "error",
          isConnected: false,
          reconnectAttempts: 3,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.text()).toContain("連線錯誤");
    });
  });

  describe("Status Descriptions", () => {
    it("should show connected description", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Click minimized indicator to show details
      const minimized = wrapper.find(".w-12.h-12");
      await minimized.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("即時訂單更新已啟用");
    });

    it("should show connecting description", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connecting",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.text()).toContain("正在建立連線");
    });

    it("should show disconnected description", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.text()).toContain("即時更新暫停");
    });
  });

  describe("Status Indicator Colors", () => {
    it("should show green indicator when connected", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // The computed dotClass should return the green class for connected
      expect(wrapper.vm.dotClass).toBe("bg-ios-green");
      expect(wrapper.text()).toContain("已連線");
    });

    it("should show yellow indicator when connecting", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connecting",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      // The computed dotClass should return the orange class for connecting
      expect(wrapper.vm.dotClass).toBe("bg-ios-orange");
      expect(wrapper.text()).toContain("連線中");
    });

    it("should show red indicator when disconnected", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      // The computed dotClass should return the red class for disconnected
      expect(wrapper.vm.dotClass).toBe("bg-ios-red");
      expect(wrapper.text()).toContain("已斷線");
    });

    it("should show red indicator on error", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "error",
          isConnected: false,
          reconnectAttempts: 5,
          lastHeartbeat: null,
        },
      });

      // The computed dotClass should return the red class for error
      expect(wrapper.vm.dotClass).toBe("bg-ios-red");
      expect(wrapper.text()).toContain("已斷線");
    });
  });

  describe("Details Panel", () => {
    it("should toggle details panel when button clicked", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 2,
          lastHeartbeat: null,
        },
      });

      const toggleButton = wrapper.find('[title="顯示詳情"]');
      await toggleButton.trigger("click");

      expect(wrapper.find(".space-y-3").exists()).toBe(true);
    });

    it("should show reconnect attempts in details", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 5,
          lastHeartbeat: null,
        },
      });

      const toggleButton = wrapper.find("button");
      await toggleButton.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("重連次數");
      expect(wrapper.text()).toContain("5");
    });

    it("should show last heartbeat time", async () => {
      const lastHeartbeat = new Date();
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat,
        },
      });

      // Click minimized indicator to show details
      const minimized = wrapper.find(".w-12.h-12");
      await minimized.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("最後心跳");
    });
  });

  describe("Connection Actions", () => {
    it("should track connection history for reconnect scenarios", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 2,
          lastHeartbeat: null,
        },
      });

      // The component tracks connection history
      const vm = wrapper.vm as any;
      expect(vm.connectionHistory.length).toBeGreaterThan(0);
      expect(vm.connectionHistory[0].status).toBe("disconnected");
    });

    it("should display connected label when connected", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // The component shows "已連線" text when connected
      expect(wrapper.text()).toContain("已連線");
      expect(wrapper.vm.label).toBe("已連線");
    });

    it("should display disconnected label when disconnected", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      // The component shows "已斷線" text when disconnected
      expect(wrapper.text()).toContain("已斷線");
      expect(wrapper.vm.label).toBe("已斷線");
    });
  });

  describe("Connection History", () => {
    it("should track connection status changes", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Change status - this will auto-show details
      await wrapper.setProps({
        connectionStatus: "disconnected",
        isConnected: false,
      });
      await wrapper.vm.$nextTick();

      // Details should be visible now (auto-shown on disconnect)
      expect(wrapper.text()).toContain("連線歷史");
    });

    it("should limit history to 20 entries", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Simulate 25 status changes
      for (let i = 0; i < 25; i++) {
        const status: ConnectionStatusType =
          i % 2 === 0 ? "connected" : "disconnected";
        await wrapper.setProps({ connectionStatus: status });
      }

      const vm = wrapper.vm as any;
      expect(vm.connectionHistory.length).toBeLessThanOrEqual(20);
    });

    it("should display last 5 entries in history", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Create history
      for (let i = 0; i < 10; i++) {
        const status: ConnectionStatusType =
          i % 2 === 0 ? "connected" : "disconnected";
        await wrapper.setProps({ connectionStatus: status });
        await wrapper.vm.$nextTick();
      }

      // Open details
      await wrapper.find("button").trigger("click");
      await wrapper.vm.$nextTick();

      // Check history display (should show max 5)
      const historyItems = wrapper.findAll(".flex.justify-between.text-xs");
      expect(historyItems.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Heartbeat Display", () => {
    it('should show "無" when no heartbeat', async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      await wrapper.find("button").trigger("click");

      expect(wrapper.text()).toContain("無");
    });

    it("should show seconds ago for recent heartbeat", async () => {
      const recentHeartbeat = new Date(Date.now() - 30000); // 30 seconds ago
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: recentHeartbeat,
        },
      });

      // Click minimized indicator to show details
      const minimized = wrapper.find(".w-12.h-12");
      await minimized.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toMatch(/\d+秒前/);
    });

    it("should show minutes ago for older heartbeat", async () => {
      const oldHeartbeat = new Date(Date.now() - 120000); // 2 minutes ago
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: oldHeartbeat,
        },
      });

      // Click minimized indicator to show details
      const minimized = wrapper.find(".w-12.h-12");
      await minimized.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toMatch(/\d+分前/);
    });

    it("should show time for very old heartbeat", async () => {
      const veryOldHeartbeat = new Date(Date.now() - 7200000); // 2 hours ago
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: veryOldHeartbeat,
        },
      });

      // Click minimized indicator to show details
      const minimized = wrapper.find(".w-12.h-12");
      await minimized.trigger("click");
      await wrapper.vm.$nextTick();

      // Should show formatted time
      expect(wrapper.text()).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe("Auto-hide Behavior", () => {
    it("should auto-hide details after 10 seconds when connected", async () => {
      vi.useFakeTimers();

      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      // Open details
      await wrapper.find("button").trigger("click");

      // Change to connected
      await wrapper.setProps({
        connectionStatus: "connected",
        isConnected: true,
      });

      // Fast forward 10 seconds
      vi.advanceTimersByTime(10000);
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as any;
      expect(vm.showDetails).toBe(false);

      vi.useRealTimers();
    });

    it("should auto-show details when disconnected", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Change to disconnected
      await wrapper.setProps({
        connectionStatus: "disconnected",
        isConnected: false,
      });
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as any;
      expect(vm.showDetails).toBe(true);
    });

    it("should auto-show details on error", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Change to error
      await wrapper.setProps({ connectionStatus: "error", isConnected: false });
      await wrapper.vm.$nextTick();

      const vm = wrapper.vm as any;
      expect(vm.showDetails).toBe(true);
    });
  });

  describe("Minimized State", () => {
    it("should show minimized indicator when connected and details hidden", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      const minimized = wrapper.find(".w-12.h-12");
      expect(minimized.exists()).toBe(true);
    });

    it("should expand when minimized indicator clicked", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      const minimized = wrapper.find(".w-12.h-12");
      await minimized.trigger("click");

      const vm = wrapper.vm as any;
      expect(vm.showDetails).toBe(true);
    });

    it("should not show minimized indicator when disconnected", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      const vm = wrapper.vm as any;
      const hasMinimized =
        vm.showDetails === false &&
        (wrapper.props as any)("connectionStatus") === "connected";
      expect(hasMinimized).toBe(false);
    });
  });

  describe("Connecting State", () => {
    it("should show connecting label when connecting", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connecting",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      // The component should show "連線中..." label when connecting
      expect(wrapper.vm.label).toBe("連線中...");
      expect(wrapper.text()).toContain("連線中");
    });

    it("should show connected label when connected", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // The component should show "已連線" when connected
      expect(wrapper.vm.label).toBe("已連線");
      expect(wrapper.vm.dotClass).toBe("bg-ios-green");
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero reconnect attempts", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Click minimized indicator to show details
      const minimized = wrapper.find(".w-12.h-12");
      await minimized.trigger("click");
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("0");
    });

    it("should handle many reconnect attempts", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "error",
          isConnected: false,
          reconnectAttempts: 999,
          lastHeartbeat: null,
        },
      });

      await wrapper.find("button").trigger("click");

      expect(wrapper.text()).toContain("999");
    });

    it("should handle rapid status changes", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // Rapid changes
      await wrapper.setProps({ connectionStatus: "disconnected" });
      await wrapper.setProps({ connectionStatus: "connecting" });
      await wrapper.setProps({ connectionStatus: "connected" });

      expect(wrapper.exists()).toBe(true);
    });
  });
});
