import { describe, expect, it, vi } from "vitest";
import { generateOtp } from "./index";

describe("generateOtp", () => {
  it("rejects random values outside the unbiased modulo range", () => {
    const randomValues = [4_294_000_000, 123_456];
    const getRandomValues = vi.fn((array: Uint32Array) => {
      array[0] = randomValues.shift() ?? 0;
      return array;
    });

    expect(generateOtp(getRandomValues)).toBe("123456");
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("returns zero-padded six digit codes", () => {
    const getRandomValues = vi.fn((array: Uint32Array) => {
      array[0] = 42;
      return array;
    });

    expect(generateOtp(getRandomValues)).toBe("000042");
  });
});
