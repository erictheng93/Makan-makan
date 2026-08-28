// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForecastDatePicker from "./ForecastDatePicker.vue";

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe("ForecastDatePicker", () => {
  afterEach(() => vi.useRealTimers());
  it("uses local tomorrow before 08:00, stable week bounds, and localized labels", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 3, 1)); // Saturday, before 08:00 local
    const wrapper = mount(ForecastDatePicker, {
      props: { startDate: "", endDate: "" },
    });
    expect(wrapper.text()).toContain("forecast.tomorrow");
    expect(wrapper.text()).toContain("forecast.nextSevenDays");
    await wrapper.findAll("button").at(0)!.trigger("click");
    expect(wrapper.emitted("update:startDate")?.[0]).toEqual(["2026-01-04"]);
    await wrapper.findAll("button").at(1)!.trigger("click");
    const events = wrapper.emitted("update:endDate")!;
    expect(events.at(-1)![0]).toBe("2026-01-10");
  });
});
