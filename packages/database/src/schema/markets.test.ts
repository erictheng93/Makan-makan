import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
  dishSearchIndex,
  markets,
  menuItems,
  restaurantMarketMemberships,
} from "./index";

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

function columnSqlType(
  table: Parameters<typeof getTableConfig>[0],
  columnName: string,
): string | undefined {
  return getTableConfig(table)
    .columns.find((column) => column.name === columnName)
    ?.getSQLType();
}

describe("market discovery schema", () => {
  it("adds first-class markets", () => {
    expect(columnNames(markets)).toEqual(
      expect.arrayContaining([
        "id",
        "slug",
        "name",
        "type",
        "description",
        "city",
        "district",
        "address",
        "latitude",
        "longitude",
        "opening_hours",
        "banner_url",
        "logo_url",
        "image_urls",
        "tags",
        "is_active",
        "created_at_ms",
        "updated_at_ms",
        "deleted_at_ms",
      ]),
    );
    expect(columnSqlType(markets, "id")).toBe("text");
    expect(columnSqlType(markets, "latitude")).toBe("real");
    expect(columnSqlType(markets, "longitude")).toBe("real");
  });

  it("adds soft-leavable restaurant market memberships", () => {
    expect(columnNames(restaurantMarketMemberships)).toEqual(
      expect.arrayContaining([
        "id",
        "restaurant_id",
        "market_id",
        "stall_number",
        "is_primary",
        "joined_at_ms",
        "left_at_ms",
      ]),
    );
    expect(columnSqlType(restaurantMarketMemberships, "restaurant_id")).toBe(
      "text",
    );
    expect(columnSqlType(restaurantMarketMemberships, "market_id")).toBe(
      "text",
    );
  });

  it("denormalizes market and GPS fields into the dish search index", () => {
    expect(columnNames(dishSearchIndex)).toEqual(
      expect.arrayContaining([
        "primary_market_id",
        "market_ids",
        "latitude",
        "longitude",
      ]),
    );
  });

  it("tracks catalog item types for market-wide product discovery", () => {
    expect(columnNames(menuItems)).toContain("catalog_type");
    expect(columnNames(dishSearchIndex)).toContain("catalog_type");
    expect(columnSqlType(menuItems, "catalog_type")).toBe("text");
    expect(columnSqlType(dishSearchIndex, "catalog_type")).toBe("text");
  });
});
