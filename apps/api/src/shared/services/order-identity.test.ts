import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../utils/api-error";
import {
  resolveOrderIdentity,
  toOrderLookupInput,
  type OrderIdentityRow,
} from "./order-identity";

function createDb(rows: Array<OrderIdentityRow | null>) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...bindings: unknown[]) => ({
        first: vi.fn(async () => rows.shift() ?? null),
        sql,
        bindings,
      })),
    })),
  } as unknown as D1Database;
}

describe("order identity resolver", () => {
  it("normalizes numeric order identifiers", () => {
    expect(toOrderLookupInput(42)).toEqual({ numericId: 42 });
    expect(toOrderLookupInput("42")).toEqual({ numericId: 42 });
    expect(toOrderLookupInput(" ORD-42 ")).toEqual({ lookupKey: "ORD-42" });
  });

  it("rejects invalid identifiers before querying", async () => {
    await expect(resolveOrderIdentity(createDb([]), "")).rejects.toMatchObject({
      code: "ORDER_ID_INVALID",
      status: 400,
    });
    await expect(resolveOrderIdentity(createDb([]), 0)).rejects.toMatchObject({
      code: "ORDER_ID_INVALID",
      status: 400,
    });
  });

  it("resolves numeric ids and keeps restaurant scope when provided", async () => {
    const db = createDb([
      {
        id: 101,
        public_id: "018f0000-0000-7000-8000-000000000101",
        order_number: "ORD-101",
        restaurant_id: "restaurant-1",
      },
    ]);

    const row = await resolveOrderIdentity(db, "101", {
      restaurantId: "restaurant-1",
    });

    expect(row).toMatchObject({
      id: 101,
      publicId: "018f0000-0000-7000-8000-000000000101",
      orderNumber: "ORD-101",
      restaurantId: "restaurant-1",
    });
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE `id` = ? AND `restaurant_id` = ?"),
    );
  });

  it("resolves public ids, order numbers, and client mutation ids inside a restaurant", async () => {
    const db = createDb([
      {
        id: 202,
        public_id: "018f0000-0000-7000-8000-000000000202",
        order_number: "ORD-202",
        restaurant_id: "restaurant-1",
      },
    ]);

    const row = await resolveOrderIdentity(
      db,
      "018f0000-0000-7000-8000-000000000202",
      { restaurantId: "restaurant-1" },
    );

    expect(row.id).toBe(202);
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining(
        "(`public_id` = ? OR `order_number` = ? OR `client_mutation_id` = ?)",
      ),
    );
  });

  it("requires restaurant scope for non-numeric identifiers by default", async () => {
    await expect(
      resolveOrderIdentity(createDb([]), "ORD-303"),
    ).rejects.toMatchObject({
      code: "RESTAURANT_ID_REQUIRED",
      status: 400,
    });
  });

  it("maps misses to ORDER_NOT_FOUND", async () => {
    await expect(
      resolveOrderIdentity(createDb([null]), "303", {
        restaurantId: "restaurant-1",
      }),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      resolveOrderIdentity(createDb([null]), "303", {
        restaurantId: "restaurant-1",
      }),
    ).rejects.toMatchObject({
      code: "ORDER_NOT_FOUND",
      status: 404,
    });
  });
});
