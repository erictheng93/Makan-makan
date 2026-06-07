import { describe, expect, it } from "vitest";
import { normalizeE164Phone } from "./phone";

describe("normalizeE164Phone", () => {
  it.each([
    ["0912 345 678", "+886912345678"],
    ["(0912)-345-678", "+886912345678"],
    ["8860912345678", "+886912345678"],
    ["886912345678", "+886912345678"],
    ["00886912345678", "+886912345678"],
    ["+60 12-345 6789", "+60123456789"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeE164Phone(input)).toBe(expected);
  });
});
