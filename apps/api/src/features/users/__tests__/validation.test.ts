import { describe, expect, it } from "vitest";
import {
  userFilterSchema,
  userSearchSchema,
  userStatsSchema,
} from "../schemas/validation";

describe("users query validation", () => {
  it("accepts string restaurant ids for list filters", () => {
    const result = userFilterSchema.parse({ restaurantId: "rest-1" });

    expect(result.restaurantId).toBe("rest-1");
  });

  it("accepts string restaurant ids for stats filters", () => {
    const result = userStatsSchema.parse({ restaurantId: "rest-1" });

    expect(result.restaurantId).toBe("rest-1");
  });

  it("accepts string restaurant ids for search filters", () => {
    const result = userSearchSchema.parse({
      query: "chef",
      restaurantId: "rest-1",
    });

    expect(result.restaurantId).toBe("rest-1");
  });

  it("rejects empty restaurant ids", () => {
    expect(() => userStatsSchema.parse({ restaurantId: "" })).toThrow();
  });
});
