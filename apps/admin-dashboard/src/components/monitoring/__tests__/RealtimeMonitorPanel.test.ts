/**
 * RealtimeMonitorPanel Component Tests
 * 測試即時監控面板組件的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import RealtimeMonitorPanel from "../RealtimeMonitorPanel.vue";

// Hoist the mock response before vi.mock
const mockApiResponse = vi.hoisted(() => ({
  data: {
    success: true,
    data: {
      totalConnections: 15,
      roomStats: [
        { roomType: "kitchen", connectionCount: 5, status: "active" },
        { roomType: "admin", connectionCount: 3, status: "active" },
        { roomType: "customer", connectionCount: 7, status: "active" },
      ],
      health: {
        status: "healthy",
        uptime: 3600000,
        lastCheck: Date.now(),
      },
    },
  },
}));

// Mock i18n
vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

// Mock API
vi.mock("@/services/api", () => {
  const unwrapApiPayload = (payload: unknown) =>
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  return {
    api: {
      get: vi.fn().mockResolvedValue(mockApiResponse),
    },
    unwrapApiPayload,
    unwrapApiData: (response: { data: unknown }) =>
      unwrapApiPayload(response.data),
    unwrapApiList: (payload: unknown) => {
      const data = unwrapApiPayload(payload);
      return Array.isArray(data) ? data : [];
    },
  };
});

describe("RealtimeMonitorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createWrapper = (props = {}) => {
    return mount(RealtimeMonitorPanel, {
      props: {
        restaurantId: "rest_123",
        refreshInterval: 10,
        ...props,
      },
      global: {
        stubs: {
          // Stub any child components if needed
        },
      },
    });
  };

  describe("渲染", () => {
    it("應該正確渲染組件", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.find(".realtime-monitor-panel").exists()).toBe(true);
      expect(wrapper.find("h3").text()).toContain("即時連接監控");
    });

    it("應該顯示總連接數", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const totalDisplay = wrapper.find(".text-4xl");
      expect(totalDisplay.exists()).toBe(true);
      expect(totalDisplay.text()).toBe("15");
    });

    it("應該顯示各房間的連接統計", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const roomStats = wrapper.findAll(".grid > div");
      expect(roomStats.length).toBe(3);
    });

    it("應該顯示健康狀態標籤", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      // Use more specific selector for health badge (px-2 py-1 classes distinguish it from indicator dots)
      const healthBadge = wrapper.find(".px-2.py-1.rounded-full");
      expect(healthBadge.exists()).toBe(true);
      expect(healthBadge.text()).toContain("healthy");
    });
  });

  describe("資料獲取", () => {
    it("掛載時應該獲取資料", async () => {
      const { api } = await import("@/services/api");
      createWrapper();
      await flushPromises();

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/realtime/stats/overview"),
      );
    });

    it("應該在請求參數中包含 restaurantId", async () => {
      const { api } = await import("@/services/api");
      createWrapper({ restaurantId: "test_rest" });
      await flushPromises();

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("restaurantId=test_rest"),
      );
    });
  });

  describe("自動刷新", () => {
    it("應該按照設定的間隔自動刷新", async () => {
      const { api } = await import("@/services/api");
      createWrapper({ refreshInterval: 5 });
      await flushPromises();

      // 初始調用
      expect(api.get).toHaveBeenCalledTimes(1);

      // 5秒後再次調用
      vi.advanceTimersByTime(5000);
      await flushPromises();
      expect(api.get).toHaveBeenCalledTimes(2);

      // 再 5 秒
      vi.advanceTimersByTime(5000);
      await flushPromises();
      expect(api.get).toHaveBeenCalledTimes(3);
    });

    it("卸載時應該停止自動刷新", async () => {
      const { api } = await import("@/services/api");
      const wrapper = createWrapper({ refreshInterval: 5 });
      await flushPromises();

      wrapper.unmount();

      vi.advanceTimersByTime(10000);
      await flushPromises();

      // 只應該有初始的一次調用
      expect(api.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("事件發射", () => {
    it("刷新成功時應該發射 refresh 事件", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.emitted("refresh")).toBeTruthy();
    });

    it("發生錯誤時應該發射 error 事件", async () => {
      const { api } = await import("@/services/api");
      vi.mocked(api.get).mockRejectedValueOnce(new Error("Network error"));

      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.emitted("error")).toBeTruthy();
      expect((wrapper.emitted("error")![0][0] as Error).message).toBe(
        "Network error",
      );
    });
  });

  describe("錯誤處理", () => {
    it("應該顯示錯誤訊息", async () => {
      const { api } = await import("@/services/api");
      vi.mocked(api.get).mockRejectedValueOnce(new Error("Connection failed"));

      const wrapper = createWrapper();
      await flushPromises();

      const errorDisplay = wrapper.find(".bg-red-50");
      expect(errorDisplay.exists()).toBe(true);
      expect(errorDisplay.text()).toContain("Connection failed");
    });
  });

  describe("刷新按鈕", () => {
    it("點擊刷新按鈕應該重新獲取資料", async () => {
      const { api } = await import("@/services/api");
      const wrapper = createWrapper();
      await flushPromises();

      const refreshBtn = wrapper.find("button");
      await refreshBtn.trigger("click");
      await flushPromises();

      expect(api.get).toHaveBeenCalledTimes(2);
    });

    it("載入中時刷新按鈕應該被禁用", async () => {
      const { api } = await import("@/services/api");
      let resolvePromise: (value: any) => void;
      vi.mocked(api.get).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );

      const wrapper = createWrapper();
      // Wait for component to update and start loading
      await wrapper.vm.$nextTick();

      // 在請求進行中 - check that button element has disabled property set
      const refreshBtn = wrapper.find("button");
      const buttonElement = refreshBtn.element as HTMLButtonElement;
      // Check the actual disabled property on the DOM element
      expect(buttonElement.disabled).toBe(true);

      // 完成請求
      resolvePromise!(mockApiResponse);
      await flushPromises();
    });
  });

  describe("健康狀態樣式", () => {
    const testCases = [
      { status: "healthy", expectedClass: "bg-green-100" },
      { status: "idle", expectedClass: "bg-gray-100" },
      { status: "degraded", expectedClass: "bg-yellow-100" },
      { status: "unhealthy", expectedClass: "bg-red-100" },
    ];

    testCases.forEach(({ status, expectedClass }) => {
      it(`健康狀態 "${status}" 應該有正確的樣式`, async () => {
        const { api } = await import("@/services/api");
        vi.mocked(api.get).mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              totalConnections: 5,
              roomStats: [],
              health: { status },
            },
          },
        });

        const wrapper = createWrapper();
        await flushPromises();

        // Use more specific selector for health badge (px-2 py-1 classes distinguish it from indicator dots)
        const badge = wrapper.find(".px-2.py-1.rounded-full");
        expect(badge.classes()).toContain(expectedClass.split(" ")[0]);
      });
    });
  });

  describe("房間狀態顯示", () => {
    it("應該按順序顯示房間：廚房、管理後台、顧客", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const roomLabels = wrapper.findAll(".grid > div .text-sm");
      expect(roomLabels[0].text()).toContain("廚房");
      expect(roomLabels[1].text()).toContain("管理後台");
      expect(roomLabels[2].text()).toContain("顧客");
    });

    it("活躍房間應該顯示綠色指示燈", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      const statusDots = wrapper.findAll(".grid > div .rounded-full");
      statusDots.forEach((dot) => {
        expect(dot.classes()).toContain("bg-green-500");
      });
    });

    it("非活躍房間應該顯示灰色指示燈", async () => {
      const { api } = await import("@/services/api");
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            totalConnections: 0,
            roomStats: [
              { roomType: "kitchen", connectionCount: 0, status: "inactive" },
            ],
            health: { status: "idle" },
          },
        },
      });

      const wrapper = createWrapper();
      await flushPromises();

      const kitchenDot = wrapper.find(".grid > div .rounded-full");
      expect(kitchenDot.classes()).toContain("bg-gray-400");
    });
  });

  describe("Props", () => {
    it("應該接受自訂的 refreshInterval", async () => {
      const wrapper = createWrapper({ refreshInterval: 30 });
      await flushPromises();

      expect(wrapper.text()).toContain("30s");
    });

    it("沒有 restaurantId 時不應該發送請求", async () => {
      const { api } = await import("@/services/api");
      vi.mocked(api.get).mockClear();

      createWrapper({ restaurantId: "" });
      await flushPromises();

      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe("最後更新時間", () => {
    it("成功刷新後應該顯示最後更新時間", async () => {
      const wrapper = createWrapper();
      await flushPromises();

      expect(wrapper.text()).toContain("最後更新");
    });
  });
});
