// TZ is pinned before the module under test computes anything. These
// boundaries are built from local-time getters, so a UTC runner would put
// "start of this month" on a different instant than a Taipei one and the
// assertions below would describe whichever machine ran them last (#312).
process.env.TZ = "Asia/Taipei";

import { describe, expect, it } from "vitest";
import {
  analyticsDateRange,
  analyticsPeriodStart,
  type AnalyticsPeriod,
} from "./analyticsPeriod";

// Wednesday 2026-08-19, 14:30 Taipei.
const now = new Date("2026-08-19T14:30:00+08:00");

describe("analyticsPeriodStart", () => {
  it.each([
    ["today", "2026-08-19T00:00:00+08:00"],
    ["week", "2026-08-17T00:00:00+08:00"], // the Monday of that week
    ["month", "2026-08-01T00:00:00+08:00"],
    ["quarter", "2026-07-01T00:00:00+08:00"], // Q3 begins in July
    ["year", "2026-01-01T00:00:00+08:00"],
  ] as const)("starts %s at a calendar boundary", (period, expected) => {
    expect(analyticsPeriodStart(period as AnalyticsPeriod, now).getTime()).toBe(
      new Date(expected).getTime(),
    );
  });

  it("puts Sunday in the week that began the previous Monday", () => {
    // getDay() calls Sunday 0, so the naive `now.getDate() - now.getDay()`
    // would start the week on Sunday itself and report a one-day week.
    const sunday = new Date("2026-08-23T09:00:00+08:00");

    expect(analyticsPeriodStart("week", sunday).getTime()).toBe(
      new Date("2026-08-17T00:00:00+08:00").getTime(),
    );
  });

  it("does not return a rolling window", () => {
    // The regression this replaced: "month" subtracted 30 days, so early in a
    // month it reported mostly the previous month. On the 3rd, a 30-day window
    // would reach back into the previous month; a calendar month cannot.
    const thirdOfMonth = new Date("2026-08-03T09:00:00+08:00");
    const start = analyticsPeriodStart("month", thirdOfMonth);

    expect(start.getMonth()).toBe(thirdOfMonth.getMonth());
    expect(start.getDate()).toBe(1);
  });
});

describe("analyticsDateRange", () => {
  it("sends UTC instants on the wire while measuring local calendar days", () => {
    const { dateFrom, dateTo } = analyticsDateRange("month", now);

    // 2026-08-01 00:00 Taipei is 2026-07-31 16:00 UTC. The wire value looking
    // like the previous month is correct, not a bug to "fix" by using UTC
    // getters — that would move the boundary for every shop in the region.
    expect(dateFrom).toBe("2026-07-31T16:00:00.000Z");
    expect(dateTo).toBe(now.toISOString());
  });
});
