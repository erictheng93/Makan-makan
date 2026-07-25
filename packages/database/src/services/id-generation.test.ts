import { describe, expect, it, vi } from "vitest";
import { businessNumber, prefixedUuid } from "./id-generation";

// Entity ids are UUID v7 so they sort by creation time; apps/image-processor
// also rejects non-v7 ids in access tokens.
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("id generation helpers", () => {
  it("generates prefixed UUID v7 identifiers without Math.random", () => {
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random should not be used for IDs");
    });

    const id = prefixedUuid("batch");

    expect(id.startsWith("batch_")).toBe(true);
    expect(id.slice("batch_".length)).toMatch(UUID_V7_PATTERN);
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it("keeps prefixed ids sortable by creation order", () => {
    const first = prefixedUuid("batch");
    const second = prefixedUuid("batch");

    expect(second >= first).toBe(true);
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
