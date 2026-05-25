import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
  customerConsents,
  customerFavorites,
  customerPhoneVerificationTokens,
  customerPreferences,
  customerPushSubscriptions,
  customers,
  orders,
  reservations,
  waitingList,
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

describe("customer identity schema", () => {
  it("uses customers as the canonical customer profile table", () => {
    expect(columnNames(customers)).toEqual(
      expect.arrayContaining([
        "id",
        "display_name",
        "primary_phone",
        "primary_email",
        "avatar_url",
        "locale",
        "status",
        "last_seen_at_ms",
        "created_at_ms",
        "updated_at_ms",
        "deleted_at_ms",
      ]),
    );

    expect(columnSqlType(customers, "id")).toBe("text");
    expect(columnNames(customers)).not.toContain("full_name");
    expect(columnNames(customers)).not.toContain("phone");
    expect(columnNames(customers)).not.toContain("email");
  });

  it("adds profile-depth satellite tables", () => {
    expect(columnNames(customerPreferences)).toEqual(
      expect.arrayContaining([
        "customer_id",
        "dietary_tags",
        "allergens",
        "default_party_size",
        "marketing_opt_in",
        "waiting_list_opt_in",
        "promo_from_favorites_opt_in",
      ]),
    );
    expect(columnNames(customerFavorites)).toEqual(
      expect.arrayContaining([
        "customer_id",
        "target_type",
        "target_id",
        "created_at_ms",
      ]),
    );
    expect(columnNames(customerPushSubscriptions)).toEqual(
      expect.arrayContaining([
        "customer_id",
        "endpoint",
        "p256dh_key",
        "auth_key",
        "failure_count",
      ]),
    );
    expect(columnNames(customerConsents)).toEqual(
      expect.arrayContaining([
        "customer_id",
        "consent_type",
        "version",
        "granted",
        "granted_at_ms",
        "revoked_at_ms",
      ]),
    );
    expect(columnNames(customerPhoneVerificationTokens)).toEqual(
      expect.arrayContaining([
        "customer_id",
        "phone",
        "otp_code",
        "expires_at_ms",
        "attempts",
      ]),
    );
  });

  it("stores order, waiting-list, and reservation customer IDs as text", () => {
    expect(columnSqlType(orders, "customer_id")).toBe("text");
    expect(columnSqlType(waitingList, "customer_id")).toBe("text");
    expect(columnSqlType(reservations, "customer_id")).toBe("text");
  });
});
