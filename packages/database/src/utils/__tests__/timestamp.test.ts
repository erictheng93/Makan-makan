import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getCurrentTimestamp,
  getUnixTimestamp,
  getUnixTimestampMs,
  isoToUnix,
  unixToIso,
  getTimestampOffset,
  isExpired,
  formatTimestamp,
  getTimeDifference,
  TIME_OFFSET,
  TIME_OFFSET_SECONDS,
} from "../timestamp";

describe("database timestamp utilities", () => {
  describe("getCurrentTimestamp", () => {
    it("should return ISO 8601 formatted string", () => {
      const ts = getCurrentTimestamp();
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should return a recent timestamp", () => {
      const before = Date.now();
      const ts = getCurrentTimestamp();
      const after = Date.now();
      const tsMs = new Date(ts).getTime();
      expect(tsMs).toBeGreaterThanOrEqual(before);
      expect(tsMs).toBeLessThanOrEqual(after);
    });
  });

  describe("getUnixTimestamp", () => {
    it("should return seconds since epoch", () => {
      const expected = Math.floor(Date.now() / 1000);
      const result = getUnixTimestamp();
      expect(Math.abs(result - expected)).toBeLessThanOrEqual(1);
    });
  });

  describe("getUnixTimestampMs", () => {
    it("should return milliseconds since epoch", () => {
      const before = Date.now();
      const result = getUnixTimestampMs();
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe("isoToUnix / unixToIso roundtrip", () => {
    it("should convert ISO to unix seconds", () => {
      expect(isoToUnix("2021-01-01T00:00:00.000Z")).toBe(1609459200);
    });

    it("should convert unix seconds to ISO", () => {
      expect(unixToIso(1609459200)).toBe("2021-01-01T00:00:00.000Z");
    });

    it("should roundtrip correctly", () => {
      const iso = "2025-06-15T12:30:00.000Z";
      const unix = isoToUnix(iso);
      expect(unixToIso(unix)).toBe(iso);
    });
  });

  describe("getTimestampOffset", () => {
    it("should return a future timestamp with positive offset", () => {
      const now = Date.now();
      const result = new Date(getTimestampOffset(60000)).getTime();
      expect(result).toBeGreaterThan(now);
      expect(result - now).toBeLessThanOrEqual(61000);
    });

    it("should return a past timestamp with negative offset", () => {
      const now = Date.now();
      const result = new Date(getTimestampOffset(-60000)).getTime();
      expect(result).toBeLessThan(now);
    });
  });

  describe("isExpired", () => {
    it("should return true for past ISO timestamp", () => {
      expect(isExpired("2020-01-01T00:00:00.000Z")).toBe(true);
    });

    it("should return false for future ISO timestamp", () => {
      expect(isExpired("2099-01-01T00:00:00.000Z")).toBe(false);
    });

    it("should return true for past unix seconds", () => {
      expect(isExpired(1609459200)).toBe(true); // 2021-01-01
    });

    it("should return false for future unix seconds", () => {
      const futureUnix = Math.floor(Date.now() / 1000) + 3600;
      expect(isExpired(futureUnix)).toBe(false);
    });
  });

  describe("formatTimestamp", () => {
    it("should format with default en-US locale", () => {
      const result = formatTimestamp("2025-06-15T12:30:00.000Z");
      // Output depends on locale, but should contain date parts
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should format with zh-TW locale", () => {
      const result = formatTimestamp("2025-06-15T12:30:00.000Z", "zh-TW");
      expect(result).toBeDefined();
      expect(result).toContain("2025");
    });
  });

  describe("getTimeDifference", () => {
    it("should calculate difference between two ISO timestamps", () => {
      const start = "2025-01-01T00:00:00.000Z";
      const end = "2025-01-01T00:30:00.000Z";
      expect(getTimeDifference(start, end)).toBe(1800); // 30 min
    });

    it("should calculate difference between two unix timestamps", () => {
      const start = 1609459200; // 2021-01-01T00:00:00Z
      const end = 1609462800; // 2021-01-01T01:00:00Z
      expect(getTimeDifference(start, end)).toBe(3600); // 1 hour
    });

    it("should default end to now when not provided", () => {
      const pastIso = "2020-01-01T00:00:00.000Z";
      const diff = getTimeDifference(pastIso);
      expect(diff).toBeGreaterThan(0);
    });
  });

  describe("TIME_OFFSET constants", () => {
    it("should have correct millisecond values", () => {
      expect(TIME_OFFSET.ONE_SECOND).toBe(1000);
      expect(TIME_OFFSET.ONE_MINUTE).toBe(60000);
      expect(TIME_OFFSET.ONE_HOUR).toBe(3600000);
      expect(TIME_OFFSET.ONE_DAY).toBe(86400000);
      expect(TIME_OFFSET.ONE_WEEK).toBe(604800000);
    });
  });

  describe("TIME_OFFSET_SECONDS constants", () => {
    it("should have correct second values", () => {
      expect(TIME_OFFSET_SECONDS.ONE_SECOND).toBe(1);
      expect(TIME_OFFSET_SECONDS.ONE_MINUTE).toBe(60);
      expect(TIME_OFFSET_SECONDS.ONE_HOUR).toBe(3600);
      expect(TIME_OFFSET_SECONDS.ONE_DAY).toBe(86400);
    });
  });
});
