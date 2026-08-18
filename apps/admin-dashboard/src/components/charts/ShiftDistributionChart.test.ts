// @vitest-environment jsdom

import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import ShiftDistributionChart from "./ShiftDistributionChart.vue";
import { schedulingService } from "@/services/schedulingService";
import type { ShiftTemplate } from "@/types/scheduling";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref("zh-TW"),
  }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: "rest-1" }),
}));

vi.mock("@/services/schedulingService", () => ({
  schedulingService: {
    getShiftTemplates: vi.fn(),
  },
}));

// Regression for issue #209: the chart used to read `assignedCount` /
// `employeeCount` fields the API never returned, so every slice was 0.
describe("ShiftDistributionChart", () => {
  it("renders the assignedCount returned by the templates API, not all zeros", async () => {
    vi.mocked(schedulingService.getShiftTemplates).mockResolvedValue([
      { id: 1, name: "早班", assignedCount: 3 },
      { id: 2, name: "晚班", assignedCount: 5 },
    ] as unknown as ShiftTemplate[]);

    const wrapper = mount(ShiftDistributionChart, {
      props: { autoFetch: true },
      global: { stubs: { BaseChart: true } },
    });
    await flushPromises();

    expect(schedulingService.getShiftTemplates).toHaveBeenCalledOnce();
    expect(schedulingService.getShiftTemplates).toHaveBeenCalledWith("rest-1");

    const text = wrapper.text();
    expect(text).toContain("3 charts.shiftDistribution.people");
    expect(text).toContain("5 charts.shiftDistribution.people");
    // 3 of 8 → 37.5%; would be 0% if counts were dropped
    expect(text).toContain("37.5");
  });
});
