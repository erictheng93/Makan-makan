import { describe, it, expect } from "vitest";
import { isOpenNow } from "../utils/isOpenNow";

describe("isOpenNow", () => {
  const businessHours = {
    monday: { open: "09:00", close: "21:00" },
    tuesday: { open: "09:00", close: "21:00" },
    wednesday: { open: "09:00", close: "21:00", closed: true },
    thursday: { open: "09:00", close: "21:00" },
    friday: { open: "09:00", close: "22:00" },
    saturday: { open: "10:00", close: "22:00" },
    sunday: { open: "10:00", close: "20:00" },
  };

  it("should return true when within business hours", () => {
    // Monday 12:00 Asia/Taipei = Monday 04:00 UTC
    const monday = new Date("2026-03-16T04:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", monday)).toBe(true);
  });

  it("should return false when outside business hours", () => {
    // Monday 22:00 Asia/Taipei = Monday 14:00 UTC
    const monday = new Date("2026-03-16T14:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", monday)).toBe(false);
  });

  it("should return false on closed days", () => {
    // Wednesday 12:00 Asia/Taipei = Wednesday 04:00 UTC
    const wednesday = new Date("2026-03-18T04:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", wednesday)).toBe(false);
  });

  it("should return false when businessHours is null", () => {
    expect(isOpenNow(null)).toBe(false);
  });

  it("should return false at exactly closing time", () => {
    // Monday 21:00 Asia/Taipei = Monday 13:00 UTC
    const monday = new Date("2026-03-16T13:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", monday)).toBe(false);
  });

  it("should return true at exactly opening time", () => {
    // Monday 09:00 Asia/Taipei = Monday 01:00 UTC
    const monday = new Date("2026-03-16T01:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", monday)).toBe(true);
  });
});
