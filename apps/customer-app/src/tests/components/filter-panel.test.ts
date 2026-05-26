import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import FilterPanel from "@/components/discovery/FilterPanel.vue";

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

describe("FilterPanel", () => {
  function mountPanel() {
    return mount(FilterPanel, {
      props: {
        filters: { city: "台中市", district: "西屯區" },
        cities: ["台中市", "台北市"],
        districts: ["北區", "西屯區"],
        categories: ["小吃", "飲品"],
        serviceTypes: [
          { serviceType: "delivery", count: 2 },
          { serviceType: "booking", count: 1 },
        ],
      },
    });
  }

  it("emits city changes and clears the stale district", async () => {
    const wrapper = mountPanel();
    await wrapper
      .get('[data-testid="discovery-filter-toggle"]')
      .trigger("click");

    await wrapper
      .get('[data-testid="discovery-city-select"]')
      .setValue("台北市");

    expect(wrapper.emitted("update:filters")?.at(-1)?.[0]).toEqual({
      city: "台北市",
      district: undefined,
    });
  });

  it("emits category filter changes", async () => {
    const wrapper = mountPanel();
    await wrapper
      .get('[data-testid="discovery-filter-toggle"]')
      .trigger("click");

    await wrapper
      .get('[data-testid="discovery-category-select"]')
      .setValue("飲品");

    expect(wrapper.emitted("update:filters")?.at(-1)?.[0]).toEqual({
      city: "台中市",
      district: "西屯區",
      categoryName: "飲品",
    });
  });

  it("emits service type filter changes", async () => {
    const wrapper = mountPanel();
    await wrapper
      .get('[data-testid="discovery-filter-toggle"]')
      .trigger("click");

    await wrapper
      .get('[data-testid="discovery-service-type-select"]')
      .setValue("delivery");

    expect(wrapper.emitted("update:filters")?.at(-1)?.[0]).toEqual({
      city: "台中市",
      district: "西屯區",
      serviceType: "delivery",
    });
    expect(wrapper.text()).toContain("外送 2");
    expect(wrapper.text()).toContain("預約 1");
  });
});
