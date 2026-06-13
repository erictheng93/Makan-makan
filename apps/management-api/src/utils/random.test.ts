import { afterEach, describe, expect, it, vi } from "vitest";
import { generateLicenseKey, randomBase36 } from "./random";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("randomBase36", () => {
  it("rejects biased bytes instead of mapping them with modulo", () => {
    const bytes = [252, 35];
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      const output = array as Uint8Array;
      output.fill(0);
      for (let index = 0; index < output.length; index += 1) {
        output[index] = bytes.shift() ?? 0;
      }
      return array;
    });

    expect(randomBase36(1)).toBe("z");
  });

  it("rejects invalid lengths", () => {
    expect(() => randomBase36(-1)).toThrow(RangeError);
    expect(() => randomBase36(1.5)).toThrow(RangeError);
  });
});

describe("generateLicenseKey", () => {
  it("keeps the existing management license key format centralized", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      const output = array as Uint8Array;
      output.fill(1);
      return array;
    });

    expect(generateLicenseKey("professional")).toMatch(
      /^MKM-PRO-[A-Z0-9]{8}-[A-Z0-9]{8}$/,
    );
  });
});
