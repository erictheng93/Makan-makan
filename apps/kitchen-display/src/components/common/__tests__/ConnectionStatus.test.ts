/**
 * ConnectionStatus Component Tests
 * 測試連線狀態組件的顯示和功能
 *
 * The ConnectionStatus component is a minimal dot + label widget.
 * It renders:
 *   - a coloured dot  (bg-ios-green / bg-ios-orange / bg-ios-red)
 *   - a short label   ("已連線" / "連線中..." / "已斷線")
 * It tracks connectionHistory internally and exposes it via defineExpose.
 * It does NOT have a details panel, showDetails state, or heartbeat display.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ConnectionStatus from "../ConnectionStatus.vue";
import type { ComponentPublicInstance } from "vue";
import type { ConnectionStatus as ConnectionStatusType } from "@/types";

interface ConnectionHistoryEntry {
  status: ConnectionStatusType;
  timestamp: Date;
}

type ConnectionStatusExpose = ComponentPublicInstance & {
  connectionHistory: ConnectionHistoryEntry[];
  formatLastHeartbeat: () => string;
  formatTime: (date: Date) => string;
};

// Mock Heroicons (not used by this component, but kept for safety)
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
    it("should display connected status", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      expect(wrapper.text()).toContain("已連線");
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

      expect(wrapper.text()).toContain("連線中");
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

      expect(wrapper.text()).toContain("已斷線");
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

      // error maps to "已斷線" label (same as disconnected)
      expect(wrapper.text()).toContain("已斷線");
    });
  });

  describe("Status Descriptions", () => {
    it("should show connected label", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      expect(wrapper.text()).toContain("已連線");
    });

    it("should show connecting label", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connecting",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.text()).toContain("連線中");
    });

    it("should show disconnected label", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.text()).toContain("已斷線");
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

      expect(wrapper.html()).toContain("bg-ios-green");
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

      expect(wrapper.html()).toContain("bg-ios-orange");
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

      expect(wrapper.html()).toContain("bg-ios-red");
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

      expect(wrapper.html()).toContain("bg-ios-red");
      expect(wrapper.text()).toContain("已斷線");
    });
  });

  describe("Details Panel", () => {
    // The component does not have a details panel — these tests verify
    // that connection history is tracked internally via defineExpose.

    it("should track connection history", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 2,
          lastHeartbeat: null,
        },
      });

      const vm = wrapper.vm as ConnectionStatusExpose;
      expect(vm.connectionHistory.length).toBeGreaterThan(0);
      expect(vm.connectionHistory[0].status).toBe("disconnected");
    });

    it("should render reconnect attempts prop without error", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 5,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should render with lastHeartbeat date", () => {
      const lastHeartbeat = new Date();
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("Connection Actions", () => {
    it("should track connection history for reconnect scenarios", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 2,
          lastHeartbeat: null,
        },
      });

      const vm = wrapper.vm as ConnectionStatusExpose;
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

      expect(wrapper.text()).toContain("已連線");
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

      expect(wrapper.text()).toContain("已斷線");
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

      await wrapper.setProps({
        connectionStatus: "disconnected",
        isConnected: false,
      });
      await wrapper.vm.$nextTick();

      // History should include both entries
      const vm = wrapper.vm as ConnectionStatusExpose;
      const statuses = vm.connectionHistory.map((h) => h.status);
      expect(statuses).toContain("disconnected");
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

      for (let i = 0; i < 25; i++) {
        const status: ConnectionStatusType =
          i % 2 === 0 ? "connected" : "disconnected";
        await wrapper.setProps({ connectionStatus: status });
      }

      const vm = wrapper.vm as ConnectionStatusExpose;
      expect(vm.connectionHistory.length).toBeLessThanOrEqual(20);
    });

    it("should record initial status on mount", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      const vm = wrapper.vm as ConnectionStatusExpose;
      // onMounted pushes an entry
      expect(vm.connectionHistory.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Heartbeat Display", () => {
    it("should expose formatLastHeartbeat returning '無' when no heartbeat", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      const vm = wrapper.vm as ConnectionStatusExpose;
      expect(vm.formatLastHeartbeat()).toBe("無");
    });

    it("should expose formatLastHeartbeat returning seconds ago for recent heartbeat", () => {
      const recentHeartbeat = new Date(Date.now() - 30000);
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: recentHeartbeat,
        },
      });

      const vm = wrapper.vm as ConnectionStatusExpose;
      expect(vm.formatLastHeartbeat()).toMatch(/\d+秒前/);
    });

    it("should expose formatLastHeartbeat returning minutes ago for older heartbeat", () => {
      const oldHeartbeat = new Date(Date.now() - 120000);
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: oldHeartbeat,
        },
      });

      const vm = wrapper.vm as ConnectionStatusExpose;
      expect(vm.formatLastHeartbeat()).toMatch(/\d+分前/);
    });

    it("should expose formatLastHeartbeat returning time for very old heartbeat", () => {
      const veryOldHeartbeat = new Date(Date.now() - 7200000);
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: veryOldHeartbeat,
        },
      });

      const vm = wrapper.vm as ConnectionStatusExpose;
      expect(vm.formatLastHeartbeat()).toMatch(/\d{2}:\d{2}/);
    });
  });

  describe("Auto-hide Behavior", () => {
    // The component does not implement auto-hide or showDetails state.
    // These tests verify the component remains stable across status changes.

    it("should remain stable after status changes", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      await wrapper.setProps({
        connectionStatus: "connected",
        isConnected: true,
      });
      await wrapper.vm.$nextTick();

      expect(wrapper.exists()).toBe(true);
    });

    it("should update label when status changes to disconnected", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      await wrapper.setProps({
        connectionStatus: "disconnected",
        isConnected: false,
      });
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("已斷線");
    });

    it("should update label when status changes to error", async () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      await wrapper.setProps({ connectionStatus: "error", isConnected: false });
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("已斷線");
    });
  });

  describe("Minimized State", () => {
    // The component renders as a simple inline dot + label (no minimized/expanded panel).

    it("should render a dot element", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      // The component always renders a coloured dot
      expect(wrapper.find(".rounded-full").exists()).toBe(true);
    });

    it("should render the label span", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      expect(wrapper.find("span").exists()).toBe(true);
    });

    it("should not show minimized indicator (no .w-12.h-12 element)", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "disconnected",
          isConnected: false,
          reconnectAttempts: 0,
          lastHeartbeat: null,
        },
      });

      // The component is always the full dot+label — no large circular button
      expect(wrapper.find(".w-12.h-12").exists()).toBe(false);
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

      expect(wrapper.text()).toContain("已連線");
      expect(wrapper.html()).toContain("bg-ios-green");
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero reconnect attempts", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "connected",
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: new Date(),
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should handle many reconnect attempts", () => {
      const wrapper = mount(ConnectionStatus, {
        props: {
          connectionStatus: "error",
          isConnected: false,
          reconnectAttempts: 999,
          lastHeartbeat: null,
        },
      });

      expect(wrapper.exists()).toBe(true);
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

      await wrapper.setProps({ connectionStatus: "disconnected" });
      await wrapper.setProps({ connectionStatus: "connecting" });
      await wrapper.setProps({ connectionStatus: "connected" });

      expect(wrapper.exists()).toBe(true);
    });
  });
});
