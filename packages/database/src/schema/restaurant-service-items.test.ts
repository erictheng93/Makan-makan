import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { restaurantServiceItems } from "./index";

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

describe("restaurant service item schema", () => {
  it("adds first-class service items separate from menu items", () => {
    expect(columnNames(restaurantServiceItems)).toEqual(
      expect.arrayContaining([
        "id",
        "restaurant_id",
        "name",
        "description",
        "service_type",
        "price_cents",
        "price_label",
        "duration_minutes",
        "requires_booking",
        "booking_url",
        "available_hours",
        "tags",
        "keywords",
        "sort_order",
        "is_active",
        "is_public",
        "created_at_ms",
        "updated_at_ms",
        "deleted_at_ms",
      ]),
    );
    expect(columnSqlType(restaurantServiceItems, "restaurant_id")).toBe("text");
    expect(columnSqlType(restaurantServiceItems, "service_type")).toBe("text");
    expect(columnSqlType(restaurantServiceItems, "price_cents")).toBe(
      "integer",
    );
  });
});
