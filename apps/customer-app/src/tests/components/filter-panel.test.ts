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
});
