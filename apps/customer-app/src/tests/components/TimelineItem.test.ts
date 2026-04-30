import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import TimelineItem from "@/components/TimelineItem.vue";

// Mock the formatDateTime function
vi.mock("@/utils/format", () => ({
  formatDateTime: vi.fn((date: string | Date, format: string) => {
    if (format === "HH:mm") {
      return "10:30";
    }
    return "2024-01-15 10:30";
  }),
}));

describe("TimelineItem.vue", () => {
  let wrapper: VueWrapper<any>;

  const mockData = {
    title: "訂單已確認",
    description: "餐廳已確認您的訂單，正在準備中",
    status: "completed" as const,
    timestamp: "2024-01-15T10:30:00Z",
    estimatedTime: "15-20 分鐘",
  };

  beforeEach(() => {
    wrapper = mount(TimelineItem, {
      props: {
        title: mockData.title,
        description: mockData.description,
        status: mockData.status,
        timestamp: mockData.timestamp,
        isLast: false,
      },
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("基本渲染", () => {
    it("應該正確渲染標題", () => {
      expect(wrapper.text()).toContain("訂單已確認");
    });

    it("應該正確渲染描述", () => {
      expect(wrapper.text()).toContain("餐廳已確認您的訂單，正在準備中");
    });

    it("應該正確渲染時間戳記", () => {
      expect(wrapper.text()).toContain("10:30");
    });

    it("應該顯示狀態圖標", () => {
      const svg = wrapper.find("svg");
      expect(svg.exists()).toBe(true);
    });
  });

  describe("狀態樣式", () => {
    it("已完成狀態應該有 data-status=completed", () => {
      expect(wrapper.attributes("data-status")).toBe("completed");
    });

    it("進行中狀態應該有 data-status=current", async () => {
      await wrapper.setProps({ status: "current" });

      expect(wrapper.attributes("data-status")).toBe("current");
    });

    it("等待中狀態應該有 data-status=pending", async () => {
      await wrapper.setProps({ status: "pending" });

      expect(wrapper.attributes("data-status")).toBe("pending");
    });
  });

  describe("時間線連接線", () => {
    it("非最後一個項目應該顯示連接線", () => {
      const connector = wrapper.find('[data-testid="connector"]');
      expect(connector.exists()).toBe(true);
    });

    it("最後一個項目不應該顯示連接線", async () => {
      await wrapper.setProps({ isLast: true });

      const connector = wrapper.find('[data-testid="connector"]');
      expect(connector.exists()).toBe(false);
    });
  });

  describe("狀態圖標", () => {
    it("已完成狀態應該顯示勾選圖標", () => {
      const svg = wrapper.find("svg");
      expect(svg.exists()).toBe(true);
    });

    it("進行中狀態應該顯示脈動動畫元素", async () => {
      await wrapper.setProps({ status: "current" });

      // The current status shows a pulsing dot inside the status dot
      const statusDot = wrapper.find('[data-testid="status-dot"]');
      expect(statusDot.exists()).toBe(true);
    });

    it("等待中狀態不應該在狀態圓點中顯示勾選圖標", async () => {
      await wrapper.setProps({ status: "pending" });

      // Pending status shows a small gray circle inside the status dot, not a checkmark SVG
      const statusDot = wrapper.find('[data-testid="status-dot"]');
      const checkmarkSvg = statusDot.find("svg");
      expect(checkmarkSvg.exists()).toBe(false);
    });
  });

  describe("時間顯示", () => {
    it("應該格式化並顯示時間", () => {
      expect(wrapper.text()).toContain("10:30");
    });

    it("沒有時間戳記時不應該顯示時間", async () => {
      await wrapper.setProps({ timestamp: null });

      expect(wrapper.text()).not.toContain("10:30");
    });

    it("應該有時間圖標", () => {
      // The timestamp section contains an SVG clock icon
      const svgs = wrapper.findAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe("預估時間", () => {
    it("進行��狀態且有預估時間時應該顯示預估時間", async () => {
      await wrapper.setProps({
        status: "current",
        estimatedTime: "15-20 分鐘",
      });

      expect(wrapper.text()).toContain("estimated 15-20 分鐘");
    });

    it("非進行中狀態不應該顯示預估時間", async () => {
      await wrapper.setProps({
        status: "completed",
        estimatedTime: "15-20 分鐘",
      });

      expect(wrapper.text()).not.toContain("estimated 15-20 分鐘");
    });

    it("沒有預估時間時不應該顯示", () => {
      expect(wrapper.text()).not.toContain("estimated");
    });
  });

  describe("插槽內容", () => {
    it("應該支援預設插槽", async () => {
      const wrapperWithSlot = mount(TimelineItem, {
        props: {
          title: mockData.title,
          status: mockData.status,
        },
        slots: {
          default: '<div class="test-slot">額外內容</div>',
        },
      });

      expect(wrapperWithSlot.html()).toContain("test-slot");
      expect(wrapperWithSlot.text()).toContain("額外內容");

      wrapperWithSlot.unmount();
    });
  });

  describe("結構", () => {
    it("應該渲染標題和描述", () => {
      expect(wrapper.text()).toContain("訂單已確認");
      expect(wrapper.text()).toContain("餐廳已確認您的訂單，正在準備中");
    });
  });

  describe("邊界情況", () => {
    it("應該處理空的描述", async () => {
      await wrapper.setProps({ description: "" });

      const descriptionElement = wrapper.find("p");
      expect(descriptionElement.exists()).toBe(false);
    });

    it("應該處理無效的狀態值", async () => {
      const invalidStatus = "invalid" as unknown as "completed";
      await wrapper.setProps({ status: invalidStatus });

      // Should still render without crashing
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.attributes("data-status")).toBe("invalid");
    });

    it("應該處理空的時間戳記", async () => {
      await wrapper.setProps({ timestamp: "" });

      expect(wrapper.text()).not.toContain("10:30");
    });
  });

  describe("內容渲染", () => {
    it("標題應該渲染為 h4 元素", () => {
      const title = wrapper.find("h4");
      expect(title.exists()).toBe(true);
      expect(title.text()).toBe("訂單已確認");
    });

    it("描述應該渲染為 p 元素", () => {
      const description = wrapper.find("p");
      expect(description.exists()).toBe(true);
      expect(description.text()).toBe("餐廳已確認您的訂單，正在準備中");
    });
  });
});
