import { describe, it, expect } from "vitest";
import {
  ensureMilliseconds,
  ensureSeconds,
  nowMs,
  nowSeconds,
  toMs,
  toSeconds,
  fromMs,
  fromSeconds,
  isMilliseconds,
  isSeconds,
} from "../timestamp";

describe("timestamp", () => {
  // Known reference: 2021-01-01T00:00:00Z
  const REF_SECONDS = 1609459200;
  const REF_MS = 1609459200000;
  const REF_DATE = new Date("2021-01-01T00:00:00Z");

  describe("ensureMilliseconds", () => {
    it("should convert seconds to milliseconds", () => {
      expect(ensureMilliseconds(REF_SECONDS)).toBe(REF_MS);
    });

    it("should return milliseconds unchanged", () => {
      expect(ensureMilliseconds(REF_MS)).toBe(REF_MS);
    });

    it("should treat values below 1e12 as seconds", () => {
      expect(ensureMilliseconds(1000)).toBe(1000000);
    });

    it("should treat values at exactly 1e12 as milliseconds", () => {
      expect(ensureMilliseconds(1e12)).toBe(1e12);
    });
  });

  describe("ensureSeconds", () => {
    it("should convert milliseconds to seconds", () => {
      expect(ensureSeconds(REF_MS)).toBe(REF_SECONDS);
    });

    it("should return seconds unchanged", () => {
      expect(ensureSeconds(REF_SECONDS)).toBe(REF_SECONDS);
    });

    it("should floor when converting ms to seconds", () => {
      expect(ensureSeconds(1609459200500)).toBe(1609459200);
    });

    it("should treat values below 1e12 as already seconds", () => {
      expect(ensureSeconds(1000)).toBe(1000);
    });
  });

  describe("nowMs", () => {
    it("should return a value close to Date.now()", () => {
      const before = Date.now();
      const result = nowMs();
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });

    it("should return a milliseconds timestamp", () => {
      expect(isMilliseconds(nowMs())).toBe(true);
    });
  });

  describe("nowSeconds", () => {
    it("should return a value close to current seconds", () => {
      const expected = Math.floor(Date.now() / 1000);
      const result = nowSeconds();
      expect(Math.abs(result - expected)).toBeLessThanOrEqual(1);
    });

    it("should return a seconds timestamp", () => {
      expect(isSeconds(nowSeconds())).toBe(true);
    });
  });

  describe("toMs / fromMs roundtrip", () => {
    it("should convert Date to ms and back", () => {
      const ms = toMs(REF_DATE);
      expect(ms).toBe(REF_MS);
      const date = fromMs(ms);
      expect(date.getTime()).toBe(REF_DATE.getTime());
    });
  });

  describe("toSeconds / fromSeconds roundtrip", () => {
    it("should convert Date to seconds and back", () => {
      const seconds = toSeconds(REF_DATE);
      expect(seconds).toBe(REF_SECONDS);
      const date = fromSeconds(seconds);
      expect(date.getTime()).toBe(REF_DATE.getTime());
    });

    it("should floor sub-second precision", () => {
      const dateWithMs = new Date("2021-01-01T00:00:00.999Z");
      expect(toSeconds(dateWithMs)).toBe(REF_SECONDS);
    });
  });

  describe("isMilliseconds / isSeconds", () => {
    it("should classify milliseconds correctly", () => {
      expect(isMilliseconds(REF_MS)).toBe(true);
      expect(isMilliseconds(Date.now())).toBe(true);
    });

    it("should classify seconds correctly", () => {
      expect(isSeconds(REF_SECONDS)).toBe(true);
      expect(isSeconds(0)).toBe(true);
    });

    it("should be mutually exclusive at the threshold", () => {
      // At exactly 1e12, it's milliseconds
      expect(isMilliseconds(1e12)).toBe(true);
      expect(isSeconds(1e12)).toBe(false);
      // Just below, it's seconds
      expect(isMilliseconds(1e12 - 1)).toBe(false);
      expect(isSeconds(1e12 - 1)).toBe(true);
    });
  });
});
