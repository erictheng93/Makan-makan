import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
  dishSearchIndex,
  marketCheckoutChildOrders,
  marketCheckoutSessions,
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
        "boundary_geojson",
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
    expect(columnSqlType(markets, "boundary_geojson")).toBe("text");
  });

  it("adds soft-leavable restaurant market memberships", () => {
    expect(columnNames(restaurantMarketMemberships)).toEqual(
      expect.arrayContaining([
        "id",
        "restaurant_id",
        "market_id",
        "stall_number",
        "location_label",
        "market_hours",
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
    expect(columnSqlType(restaurantMarketMemberships, "location_label")).toBe(
      "text",
    );
    expect(columnSqlType(restaurantMarketMemberships, "market_hours")).toBe(
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

  it("persists market checkout sessions and child orders", () => {
    expect(columnNames(marketCheckoutSessions)).toEqual(
      expect.arrayContaining([
        "id",
        "market_id",
        "market_slug",
        "market_name",
        "status",
        "payment_status",
        "phone_last_digits",
        "subtotal_cents",
        "child_order_count",
        "payment_summary",
        "created_at_ms",
        "updated_at_ms",
      ]),
    );
    expect(columnSqlType(marketCheckoutSessions, "id")).toBe("text");
    expect(columnSqlType(marketCheckoutSessions, "subtotal_cents")).toBe(
      "integer",
    );
    expect(columnSqlType(marketCheckoutSessions, "payment_summary")).toBe(
      "text",
    );

    expect(columnNames(marketCheckoutChildOrders)).toEqual(
      expect.arrayContaining([
        "id",
        "checkout_id",
        "restaurant_id",
        "restaurant_name",
        "order_id",
        "order_number",
        "total_amount",
        "total_amount_cents",
        "token_expires_at_ms",
        "created_at_ms",
      ]),
    );
    expect(columnSqlType(marketCheckoutChildOrders, "checkout_id")).toBe(
      "text",
    );
    expect(columnSqlType(marketCheckoutChildOrders, "order_id")).toBe(
      "integer",
    );
  });
});
