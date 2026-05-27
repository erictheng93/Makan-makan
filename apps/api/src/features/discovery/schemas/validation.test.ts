import { describe, expect, it } from "vitest";
import {
  dishCategoryQuerySchema,
  dishSearchQuerySchema,
  serviceSearchQuerySchema,
} from "./validation";

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

  it("accepts open status sorting for market catalog and service search", () => {
    expect(
      dishSearchQuerySchema.parse({
        marketId: "market-1",
        sortBy: "open_now",
      }),
    ).toMatchObject({
      marketId: "market-1",
      sortBy: "open_now",
    });

    expect(
      serviceSearchQuerySchema.parse({
        marketId: "market-1",
        sortBy: "open_now",
      }),
    ).toMatchObject({
      marketId: "market-1",
      sortBy: "open_now",
    });
  });
});
