// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import ForecastDatePicker from "./ForecastDatePicker.vue";

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

// The bug this pins — `toISOString()` on a locally-built date — is invisible at
// UTC+0, and GitHub Actions runs in UTC (see packages/database/src/utils/
// sql-time.ts). Without forcing a positive offset the assertion below passes
// against the buggy code too. Node re-reads process.env.TZ on the next Date
// operation, so setting it here is enough; restore it so the worker's other
// test files are unaffected.
const originalTZ = process.env.TZ;

describe("ForecastDatePicker", () => {
  beforeAll(() => {
    process.env.TZ = "Asia/Taipei";
  });
  afterAll(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });
  afterEach(() => vi.useRealTimers());

  it("uses local tomorrow before 08:00, stable week bounds, and localized labels", async () => {
    vi.useFakeTimers();
    // 2026-01-03 01:00 Taipei = 2026-01-02T17:00Z. The old code formatted the
    // locally-incremented date through toISOString and landed on 2026-01-03 —
    // today, labelled 明日.
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
