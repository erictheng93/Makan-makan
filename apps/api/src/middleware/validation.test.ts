import { describe, expect, it } from "vitest";
import { commonSchemas } from "./validation";

describe("common validation schemas", () => {
  it("bounds pagination result size and offset cost", () => {
    expect(commonSchemas.paginationQuery.parse({})).toEqual({
      page: 1,
      limit: 20,
    });
    expect(
      commonSchemas.paginationQuery.parse({ page: "1000", limit: "100" }),
    ).toEqual({ page: 1000, limit: 100 });

    expect(() =>
      commonSchemas.paginationQuery.parse({ limit: "101" }),
    ).toThrow();
    expect(() =>
      commonSchemas.paginationQuery.parse({ page: "1001" }),
    ).toThrow();
  });
});
