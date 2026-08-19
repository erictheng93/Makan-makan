// @vitest-environment jsdom

import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import TrendChart from "./TrendChart.vue";
import { schedulingService } from "@/services/schedulingService";
import type { DailyStats } from "@/types/scheduling";

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
    getDailyStats: vi.fn(),
  },
}));

const dayStats = {
  date: "2026-08-18",
  totalSchedules: 4,
  totalEmployees: 2,
  totalHours: 16,
} as unknown as DailyStats;

// Regression for issue #209: the "average" metric used to read a
// `stats.averageHours` field the daily-stats API never returned, so the
// average line was flat 0 since launch. Average is defined as hours per
// employee (totalHours / totalEmployees).
describe("TrendChart", () => {
  it("derives the average metric from totalHours / totalEmployees", async () => {
    vi.mocked(schedulingService.getDailyStats).mockResolvedValue(dayStats);

    const wrapper = mount(TrendChart, {
      props: { autoFetch: true },
      global: { stubs: { BaseChart: true } },
    });
    await flushPromises();

    expect(schedulingService.getDailyStats).toHaveBeenCalledWith(
      "rest-1",
      expect.any(String),
    );

    // first <select> is the metric picker
    await wrapper.find("select").setValue("average");
    await flushPromises();

    // 16 hours / 2 employees = 8.0 per person; was stuck at 0.0
    expect(wrapper.text()).toContain("8.0charts.workHours.hoursUnit");
  });

  it("keeps the schedules metric on totalSchedules", async () => {
    vi.mocked(schedulingService.getDailyStats).mockResolvedValue(dayStats);

    const wrapper = mount(TrendChart, {
      props: { autoFetch: true },
      global: { stubs: { BaseChart: true } },
    });
    await flushPromises();

    await wrapper.find("select").setValue("schedules");
    await flushPromises();

    expect(wrapper.text()).toContain("4 charts.trend.items");
  });
});
