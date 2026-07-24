import { describe, expect, it } from "vitest";
import { cronMatches, normalizeCronExpression } from "./cron";

describe("cronMatches", () => {
  it("treats numeric and named Sunday triggers as equivalent", () => {
    expect(cronMatches("0 3 * * 0", "0 3 * * SUN")).toBe(true);
    expect(cronMatches("0 3 * * 7", "0 3 * * SUN")).toBe(true);
  });

  it("normalizes month and day names without changing schedule timing", () => {
    expect(normalizeCronExpression("0 9 * JAN MON")).toBe("0 9 * 1 1");
  });

  it("does not rewrite numeric July in the month field", () => {
    expect(normalizeCronExpression("0 9 * 7 *")).toBe("0 9 * 7 *");
  });

  it("does not match different schedules", () => {
    expect(cronMatches("0 3 * * SUN", "0 2 * * SUN")).toBe(false);
  });
});
