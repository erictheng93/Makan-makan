/**
 * OrdersChart Component Tests
 * 測試訂單圖表組件
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import OrdersChart from "../OrdersChart.vue";

// Mock Chart.js - Chart.register 必須是 Chart 的靜態方法
vi.mock("chart.js", () => {
  const mockChartInstance = {
    destroy: vi.fn(),
    update: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(),
    data: { labels: [], datasets: [] },
    options: {},
  };

  return {
    Chart: Object.assign(
      vi.fn(() => mockChartInstance),
      {
        register: vi.fn(),
        unregister: vi.fn(),
        defaults: {
          font: { family: "sans-serif" },
          color: "#666",
          plugins: {},
        },
      },
    ),
    CategoryScale: class {},
    LinearScale: class {},
    BarElement: class {},
    Title: class {},
    Tooltip: class {},
    Legend: class {},
    registerables: [],
  };
});

// Mock icons
vi.mock("lucide-vue-next", () => ({
  BarChart3: { name: "BarChart3", template: "<svg />" },
}));

describe("OrdersChart Component", () => {
  const mockData = [
    {
      label: "Mon",
      total: 45,
      completed: 40,
      pending: 3,
      cancelled: 2,
      date: "2025-11-11",
    },
    {
      label: "Tue",
      total: 52,
      completed: 48,
      pending: 2,
      cancelled: 2,
      date: "2025-11-12",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render with data", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: mockData,
          period: "daily",
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should show loading state", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: [],
          loading: true,
          period: "daily",
        },
      });

      expect(wrapper.find(".animate-pulse").exists()).toBe(true);
    });

    it("should show empty state when no data", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: [],
          period: "daily",
        },
      });

      expect(wrapper.text()).toContain("暫無訂單數據");
    });

    it("should render canvas when data exists", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: mockData,
          period: "daily",
        },
      });

      expect(wrapper.find("canvas").exists()).toBe(true);
    });
  });

  describe("Props Handling", () => {
    it("should accept daily period", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: mockData,
          period: "daily",
        },
      });

      expect(wrapper.props("period")).toBe("daily");
    });

    it("should accept weekly period", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: mockData,
          period: "weekly",
        },
      });

      expect(wrapper.props("period")).toBe("weekly");
    });

    it("should accept monthly period", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: mockData,
          period: "monthly",
        },
      });

      expect(wrapper.props("period")).toBe("monthly");
    });

    it("should handle empty data array", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: [],
          period: "daily",
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("Loading State", () => {
    it("should not show canvas when loading", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: mockData,
          loading: true,
          period: "daily",
        },
      });

      expect(wrapper.find("canvas").exists()).toBe(false);
    });

    it("should show skeleton loader when loading", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: [],
          loading: true,
          period: "daily",
        },
      });

      expect(wrapper.find(".bg-gray-300.rounded").exists()).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle single data point", () => {
      const wrapper = mount(OrdersChart, {
        props: {
          data: [mockData[0]],
          period: "daily",
        },
      });

      expect(wrapper.find("canvas").exists()).toBe(true);
    });

    it("should handle large dataset", () => {
      const largeData = Array.from({ length: 30 }, (_, i) => ({
        label: `Day ${i + 1}`,
        total: 40 + i,
        completed: 35 + i,
        pending: 3,
        cancelled: 2,
        date: `2025-11-${(i + 1).toString().padStart(2, "0")}`,
      }));

      const wrapper = mount(OrdersChart, {
        props: {
          data: largeData,
          period: "monthly",
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should handle zero values", () => {
      const zeroData = [
        {
          label: "Mon",
          total: 0,
          completed: 0,
          pending: 0,
          cancelled: 0,
          date: "2025-11-11",
        },
      ];

      const wrapper = mount(OrdersChart, {
        props: {
          data: zeroData,
          period: "daily",
        },
      });

      expect(wrapper.find("canvas").exists()).toBe(true);
    });
  });
});
