import { describe, expect, it } from "vitest";
import { isCentAlignedAmount } from "./money";

describe("isCentAlignedAmount", () => {
  it("accepts amounts with at most two decimal places", () => {
    for (const amount of [0, 0.01, 0.1, 1, 99.99, 1234.56, 100000.01]) {
      expect(isCentAlignedAmount(amount)).toBe(true);
    }
  });

  it("rejects sub-cent amounts", () => {
    for (const amount of [0.001, 1.005, 12.3456, 99.999]) {
      expect(isCentAlignedAmount(amount)).toBe(false);
    }
  });

  it("rejects non-finite amounts", () => {
    for (const amount of [NaN, Infinity, -Infinity]) {
      expect(isCentAlignedAmount(amount)).toBe(false);
    }
  });

  it("accepts large two-decimal amounts past the 2^17 float boundary", () => {
    // Regression: a fixed 1e-9 tolerance false-rejects from 131072.14 upward,
    // where one ulp of `amount * 100` already exceeds 1e-9. These are ordinary
    // TWD totals for catering orders and market checkouts, and the guard
    // returned a hard 400 with no way around it.
    for (const amount of [
      131072.13, 131072.14, 131072.15, 131072.64, 262144.07, 524288.29,
      1000000.99, 99999999.99,
    ]) {
      expect(isCentAlignedAmount(amount)).toBe(true);
    }
  });

  it("still rejects sub-cent amounts at large magnitudes", () => {
    for (const amount of [131072.145, 262144.001, 1000000.555]) {
      expect(isCentAlignedAmount(amount)).toBe(false);
    }
  });

  it("treats negative amounts symmetrically", () => {
    expect(isCentAlignedAmount(-131072.14)).toBe(true);
    expect(isCentAlignedAmount(-0.005)).toBe(false);
  });
});
