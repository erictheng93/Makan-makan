import { describe, expect, it } from "vitest";
import {
  cleanupSchema,
  invalidateTagsSchema,
  warmupSchema,
} from "./validation";

describe("cache validation schemas", () => {
  it("validates tag invalidation limits", () => {
    expect(
      invalidateTagsSchema.parse({
        tags: ["menu", "restaurant"],
        reason: "menu updated",
      }),
    ).toEqual({
      tags: ["menu", "restaurant"],
      reason: "menu updated",
    });

    expect(() => invalidateTagsSchema.parse({ tags: [] })).toThrow();
  });

  it("validates warmup key strategies", () => {
    expect(
      warmupSchema.parse({
        keys: [{ key: "restaurant:1:menu", strategy: "MENU" }],
      }),
    ).toEqual({
      keys: [{ key: "restaurant:1:menu", strategy: "MENU" }],
    });

    expect(() =>
      warmupSchema.parse({
        keys: [{ key: "x", strategy: "UNKNOWN" }],
      }),
    ).toThrow();
  });

  it("applies cleanup defaults and bounds", () => {
    expect(cleanupSchema.parse({})).toEqual({
      maxAge: 3600,
      dryRun: false,
    });

    expect(() => cleanupSchema.parse({ maxAge: 86401 })).toThrow();
  });
});
