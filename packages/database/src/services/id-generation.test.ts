import { describe, expect, it, vi } from "vitest";
import { businessNumber, prefixedUuid } from "./id-generation";

describe("id generation helpers", () => {
  it("generates prefixed UUID identifiers without Math.random", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "12345678-abcd-4000-8000-123456789abc",
    );
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random should not be used for IDs");
    });

    expect(prefixedUuid("batch")).toBe(
      "batch_12345678-abcd-4000-8000-123456789abc",
    );
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it("generates business numbers with uppercase UUID suffixes", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "abcdef12-3456-4000-8000-abcdef123456",
    );
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random should not be used for business numbers");
    });

    expect(businessNumber("RF", 1770220800000)).toBe(
      "RF1770220800000-ABCDEF12",
    );
    expect(randomSpy).not.toHaveBeenCalled();
  });
});
