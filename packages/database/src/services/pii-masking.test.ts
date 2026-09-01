import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "./pii-masking";

describe("maskPhone", () => {
  it("masks a TW E.164 number in its local dial form", () => {
    expect(maskPhone("+886912345678")).toBe("0912***678");
  });

  it("leaves a number without the TW country code in the form it was stored", () => {
    expect(maskPhone("0912345678")).toBe("0912***678");
    expect(maskPhone("+6591234567")).toBe("+659***567");
  });

  it("never reveals overlapping characters on a short value", () => {
    // The previous implementation took slice(0, 4) and slice(-3)
    // independently, so every length from 5 to 7 echoed the whole value back
    // through a field the UI presents as masked.
    for (const value of ["12345", "123456", "1234567"]) {
      const masked = maskPhone(value)!;
      const revealed = masked.replace("***", "");
      expect(revealed.length).toBeLessThan(value.length);
      expect(value).not.toBe(revealed);
    }
    expect(maskPhone("12345")).toBe("1***345");
    expect(maskPhone("1234567")).toBe("123***567");
  });

  it("reveals nothing at all when the value is too short to mask", () => {
    expect(maskPhone("1234")).toBe("****");
    expect(maskPhone("1")).toBe("*");
  });

  it("never opens more than the first four and last three characters", () => {
    const masked = maskPhone("+886912345678")!;
    const [head, tail] = masked.split("***");
    expect(head!.length).toBeLessThanOrEqual(4);
    expect(tail!.length).toBeLessThanOrEqual(3);
  });

  it("passes a missing value straight through", () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone("")).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
  });
});

describe("maskEmail", () => {
  it("keeps the first character and the whole domain", () => {
    expect(maskEmail("eric@example.com")).toBe("e***@example.com");
  });

  it("reveals nothing for a value with no usable local part", () => {
    expect(maskEmail("@example.com")).toBe("*");
    expect(maskEmail("not-an-email")).toBe("*");
  });

  it("passes a missing value straight through", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
  });
});
