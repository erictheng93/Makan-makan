// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StatCard from "./StatCard.vue";

describe("StatCard", () => {
  it("renders the metric content with the selected color classes", () => {
    const wrapper = mount(StatCard, {
      props: {
        title: "Open orders",
        value: 12,
        icon: "QueueListIcon",
        color: "green",
        subtitle: "4 need attention",
      },
    });

    expect(wrapper.text()).toContain("Open orders");
    expect(wrapper.text()).toContain("12");
    expect(wrapper.text()).toContain("4 need attention");
    expect(wrapper.classes()).toContain("border-l-green-500");
    expect(wrapper.find(".bg-green-100").exists()).toBe(true);
    expect(wrapper.find("svg.text-green-600").exists()).toBe(true);
  });

  it.each([
    ["up", ".text-green-500"],
    ["down", ".text-red-500"],
    ["stable", ".text-gray-500"],
  ] as const)("renders the %s trend indicator", (trend, iconClass) => {
    const wrapper = mount(StatCard, {
      props: {
        title: "Revenue",
        value: "$1,240",
        icon: "CurrencyDollarIcon",
        trend,
      },
    });

    expect(wrapper.find(iconClass).exists()).toBe(true);
  });

  it("caps the progress bar width while keeping the original label", () => {
    const wrapper = mount(StatCard, {
      props: {
        title: "Table usage",
        value: "Full",
        icon: "TableCellsIcon",
        color: "red",
        progress: 125,
      },
    });

    const progressBar = wrapper
      .findAll(".h-2.rounded-full")
      .find((element) => element.attributes("style")?.includes("100%"));

    expect(progressBar?.exists()).toBe(true);
    expect(progressBar?.classes()).toContain("bg-red-500");
    expect(wrapper.text()).toContain("125%");
  });

  it("falls back to the chart icon and renders extra slot content", () => {
    const wrapper = mount(StatCard, {
      props: {
        title: "Unknown metric",
        value: "N/A",
        icon: "MissingIcon",
      },
      slots: {
        extra: "<button>Review details</button>",
      },
    });

    expect(wrapper.find("svg").exists()).toBe(true);
    expect(wrapper.text()).toContain("Review details");
    expect(wrapper.find(".border-t").exists()).toBe(true);
  });
});
