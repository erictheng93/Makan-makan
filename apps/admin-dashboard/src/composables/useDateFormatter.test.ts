import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useDateFormatter } from "./useDateFormatter";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    locale: ref("zh-TW"),
    t: (key: string) => key,
  }),
}));

describe("useDateFormatter", () => {
  it("accepts Unix-millisecond timestamps in date formatters", () => {
    const formatter = useDateFormatter();
    const date = new Date(2026, 7, 3, 10, 15, 30);
    const timestamp = date.getTime();

    expect(formatter.formatDate(timestamp)).toBe(formatter.formatDate(date));
    expect(formatter.formatShortDate(timestamp)).toBe(
      formatter.formatShortDate(date),
    );
    expect(formatter.formatTime(timestamp)).toBe(formatter.formatTime(date));
    expect(formatter.formatDateTime(timestamp)).toBe(
      formatter.formatDateTime(date),
    );
    expect(formatter.formatShortDateTime(timestamp)).toBe(
      formatter.formatShortDateTime(date),
    );
    expect(formatter.formatTimeWithSeconds(timestamp)).toBe(
      formatter.formatTimeWithSeconds(date),
    );
    expect(formatter.formatRelativeTime(timestamp)).toBe(
      formatter.formatRelativeTime(date),
    );
    expect(formatter.formatDateRange(timestamp, timestamp)).toBe(
      formatter.formatDateRange(date, date),
    );
    expect(formatter.formatMonthYear(timestamp)).toBe(
      formatter.formatMonthYear(date),
    );
    expect(formatter.toISOString(timestamp)).toBe(formatter.toISOString(date));
    expect(formatter.isToday(timestamp)).toBe(formatter.isToday(date));
    expect(formatter.isThisWeek(timestamp)).toBe(formatter.isThisWeek(date));
    expect(formatter.startOfDay(timestamp)).toEqual(formatter.startOfDay(date));
    expect(formatter.endOfDay(timestamp)).toEqual(formatter.endOfDay(date));
    expect(formatter.addDays(timestamp, 1)).toEqual(formatter.addDays(date, 1));
    expect(formatter.toInputDate(timestamp)).toBe(formatter.toInputDate(date));
  });
});
