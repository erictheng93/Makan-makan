import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUSINESS_TIMEZONE,
  PLATFORM_BUSINESS_TIMEZONE_OFFSET_MINUTES,
  SUPPORTED_BUSINESS_TIMEZONES,
  businessTimezoneOffsetMinutes,
  isBusinessTimezone,
  resolveBusinessTimezone,
} from "./business-timezone";

/**
 * Re-derive a zone's UTC offset from ICU rather than trusting the table under
 * test: format the instant in that zone, read the wall clock back, and diff it
 * against the instant itself.
 */
function icuOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  const wallClockAsUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    // ICU renders midnight as hour 24 in some versions of the hour12:false
    // pattern; both spellings mean the same instant.
    read("hour") % 24,
    read("minute"),
    read("second"),
  );

  return Math.round((wallClockAsUtc - at.getTime()) / 60_000);
}

/** The 1st of every month, so any DST transition falls inside the sample. */
const YEAR_OF_SAMPLES = Array.from(
  { length: 12 },
  (_, month) => new Date(Date.UTC(2026, month, 1, 12, 0, 0)),
);

describe("business timezones", () => {
  it("agrees with ICU for every supported zone, all year round", () => {
    for (const timezone of SUPPORTED_BUSINESS_TIMEZONES) {
      const expected = businessTimezoneOffsetMinutes(timezone);
      for (const at of YEAR_OF_SAMPLES) {
        expect(
          icuOffsetMinutes(timezone, at),
          `${timezone} at ${at.toISOString()}`,
        ).toBe(expected);
      }
    }
  });

  // The SQL business-day helpers can only take a constant modifier, so a zone
  // whose offset moves during the year would bucket half of it into the wrong
  // day. This is the check that stops one being added.
  it("admits no zone that observes daylight saving", () => {
    for (const timezone of SUPPORTED_BUSINESS_TIMEZONES) {
      const offsets = new Set(
        YEAR_OF_SAMPLES.map((at) => icuOffsetMinutes(timezone, at)),
      );
      expect(
        offsets,
        `${timezone} changes offset during the year`,
      ).toHaveProperty("size", 1);
    }
  });

  it("rejects zones outside the supported set", () => {
    expect(isBusinessTimezone("America/New_York")).toBe(false);
    expect(isBusinessTimezone("Asia/Taipei")).toBe(true);
    expect(isBusinessTimezone("")).toBe(false);
    expect(isBusinessTimezone(undefined)).toBe(false);
  });

  it("falls back to the default rather than throwing on unknown input", () => {
    expect(resolveBusinessTimezone("America/New_York")).toBe(
      DEFAULT_BUSINESS_TIMEZONE,
    );
    expect(resolveBusinessTimezone(null)).toBe(DEFAULT_BUSINESS_TIMEZONE);
    expect(businessTimezoneOffsetMinutes(undefined)).toBe(
      PLATFORM_BUSINESS_TIMEZONE_OFFSET_MINUTES,
    );
  });

  it("maps the three offsets the supported markets actually use", () => {
    expect(businessTimezoneOffsetMinutes("Asia/Taipei")).toBe(480);
    expect(businessTimezoneOffsetMinutes("Asia/Tokyo")).toBe(540);
    expect(businessTimezoneOffsetMinutes("Asia/Ho_Chi_Minh")).toBe(420);
  });
});
