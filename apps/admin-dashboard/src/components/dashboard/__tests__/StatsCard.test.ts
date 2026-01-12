/**
 * StatsCard Component Tests
 * 測試統計卡片組件
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import StatsCard from "../StatsCard.vue";

// Mock lucide icons
vi.mock("lucide-vue-next", () => ({
  ShoppingCart: { name: "ShoppingCart", template: "<svg />" },
  DollarSign: { name: "DollarSign", template: "<svg />" },
  TrendingUp: { name: "TrendingUp", template: "<svg />" },
  TrendingDown: { name: "TrendingDown", template: "<svg />" },
  CheckCircle: { name: "CheckCircle", template: "<svg />" },
  Users: { name: "Users", template: "<svg />" },
  Clock: { name: "Clock", template: "<svg />" },
  Package: { name: "Package", template: "<svg />" },
}));

describe("StatsCard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render with required props", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Total Orders",
          value: 150,
          icon: "shopping-cart",
          color: "blue",
        },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain("Total Orders");
    });

    it("should display title correctly", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "今日訂單",
          value: 45,
          icon: "shopping-cart",
          color: "green",
        },
      });

      expect(wrapper.text()).toContain("今日訂單");
    });

    it("should display numeric value", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Revenue",
          value: 12500,
          icon: "dollar-sign",
          color: "green",
        },
      });

      // Component formats numbers with commas
      expect(wrapper.text()).toContain("12,500");
    });

    it("should display string value", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Status",
          value: "運作中",
          icon: "check-circle",
          color: "blue",
        },
      });

      expect(wrapper.text()).toContain("運作中");
    });
  });

  describe("Loading State", () => {
    it("should show loading placeholder when loading", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
          loading: true,
        },
      });

      expect(wrapper.find(".animate-pulse").exists()).toBe(true);
      expect(wrapper.text()).toContain("--");
    });

    it("should not show value when loading", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
          loading: true,
        },
      });

      expect(wrapper.text()).not.toContain("100");
    });

    it("should not show trend when loading", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
          loading: true,
          trend: { value: 15, period: "vs last month" },
        },
      });

      const trendElements = wrapper.findAll(".text-sm");
      const hasTrendText = trendElements.some((el) => el.text().includes("15"));
      expect(hasTrendText).toBe(false);
    });
  });

  describe("Trend Display", () => {
    it("should show positive trend with up arrow", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Revenue",
          value: 5000,
          icon: "dollar-sign",
          color: "green",
          trend: { value: 15.5, period: "vs last month" },
        },
      });

      expect(wrapper.text()).toContain("15.5");
      expect(wrapper.text()).toContain("%");
    });

    it("should show negative trend with down arrow", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 80,
          icon: "shopping-cart",
          color: "blue",
          trend: { value: -5.2, period: "vs last week" },
        },
      });

      expect(wrapper.text()).toContain("5.2");
      expect(wrapper.text()).toContain("%");
    });

    it("should not show trend when not provided", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
        },
      });

      const hasTrendIcon =
        wrapper.html().includes("TrendingUp") ||
        wrapper.html().includes("TrendingDown");
      expect(hasTrendIcon).toBe(false);
    });
  });

  describe("Subtitle Display", () => {
    it("should display subtitle when provided", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Active Users",
          value: 245,
          icon: "users",
          color: "purple",
          subtitle: "Currently online",
        },
      });

      expect(wrapper.text()).toContain("Currently online");
    });

    it("should not display subtitle when not provided", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
        },
      });

      const subtitleElement = wrapper.find(".text-xs.text-gray-500");
      expect(subtitleElement.exists()).toBe(false);
    });

    it("should not show subtitle when loading", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
          loading: true,
          subtitle: "This month",
        },
      });

      expect(wrapper.text()).not.toContain("This month");
    });
  });

  describe("Color Variants", () => {
    const colors = [
      "blue",
      "green",
      "purple",
      "orange",
      "red",
      "indigo",
    ] as const;

    colors.forEach((color) => {
      it(`should apply ${color} color scheme`, () => {
        const wrapper = mount(StatsCard, {
          props: {
            title: "Test",
            value: 100,
            icon: "shopping-cart",
            color,
          },
        });

        expect(wrapper.exists()).toBe(true);
      });
    });
  });

  describe("Icon Display", () => {
    it("should display icon in colored background", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
        },
      });

      const iconContainer = wrapper.find(".w-12.h-12.rounded-lg");
      expect(iconContainer.exists()).toBe(true);
    });
  });

  describe("Hover Effects", () => {
    it("should have hover transition classes", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Test",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
        },
      });

      expect(wrapper.classes()).toContain("hover:shadow-lg");
      expect(wrapper.classes()).toContain("transition-shadow");
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero value", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Orders",
          value: 0,
          icon: "shopping-cart",
          color: "blue",
        },
      });

      expect(wrapper.text()).toContain("0");
    });

    it("should handle very large numbers", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Revenue",
          value: 9999999,
          icon: "dollar-sign",
          color: "green",
        },
      });

      // Component formats numbers with commas
      expect(wrapper.text()).toContain("9,999,999");
    });

    it("should handle negative values", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Balance",
          value: -500,
          icon: "dollar-sign",
          color: "red",
        },
      });

      expect(wrapper.text()).toContain("-500");
    });

    it("should handle decimal values", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Average",
          value: 123.45,
          icon: "package",
          color: "orange",
        },
      });

      expect(wrapper.text()).toContain("123.45");
    });

    it("should handle long titles", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Very Long Title That Should Still Display Correctly",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
        },
      });

      expect(wrapper.text()).toContain("Very Long Title");
    });

    it("should handle empty string value", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Status",
          value: "",
          icon: "check-circle",
          color: "blue",
        },
      });

      expect(wrapper.exists()).toBe(true);
    });
  });

  describe("Props Defaults", () => {
    it("should default loading to false", () => {
      const wrapper = mount(StatsCard, {
        props: {
          title: "Test",
          value: 100,
          icon: "shopping-cart",
          color: "blue",
        },
      });

      expect(wrapper.find(".animate-pulse").exists()).toBe(false);
    });
  });
});
