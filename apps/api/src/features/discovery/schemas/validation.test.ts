import { describe, expect, it } from "vitest";
import { dishCategoryQuerySchema, dishSearchQuerySchema } from "./validation";

describe("discovery query validation", () => {
  it("accepts catalog type filters for market product search", () => {
    expect(
      dishSearchQuerySchema.parse({
        marketId: "market-1",
        catalogType: "product",
      }),
    ).toMatchObject({
      marketId: "market-1",
      catalogType: "product",
    });

    expect(
      dishCategoryQuerySchema.parse({
        marketId: "market-1",
        catalogType: "menu_item",
      }),
    ).toMatchObject({
      marketId: "market-1",
      catalogType: "menu_item",
    });
  });

  it("rejects non-catalog result types on dish search", () => {
    expect(() =>
      dishSearchQuerySchema.parse({
        marketId: "market-1",
        catalogType: "service",
      }),
    ).toThrow();
  });
});
