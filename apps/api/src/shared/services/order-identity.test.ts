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
  it("normalizes UUID and alias order identifiers as lookup keys", () => {
    expect(toOrderLookupInput("018f0000-0000-7000-8000-000000000042")).toEqual({
      lookupKey: "018f0000-0000-7000-8000-000000000042",
    });
    expect(toOrderLookupInput(" ORD-42 ")).toEqual({ lookupKey: "ORD-42" });
  });

  it("rejects invalid identifiers before querying", async () => {
    await expect(resolveOrderIdentity(createDb([]), "")).rejects.toMatchObject({
      code: "ORDER_ID_INVALID",
      status: 400,
    });
    await expect(resolveOrderIdentity(createDb([]), " ")).rejects.toMatchObject(
      {
        code: "ORDER_ID_INVALID",
        status: 400,
      },
    );
  });

  it("resolves UUID ids and keeps restaurant scope when provided", async () => {
    const orderId = "018f0000-0000-7000-8000-000000000101";
    const db = createDb([
      {
        id: orderId,
        order_number: "ORD-101",
        restaurant_id: "restaurant-1",
      },
    ]);

    const row = await resolveOrderIdentity(db, orderId, {
      restaurantId: "restaurant-1",
    });

    expect(row).toMatchObject({
      id: orderId,
      publicId: orderId,
      orderNumber: "ORD-101",
      restaurantId: "restaurant-1",
    });
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("`id` = ? OR `order_number` = ?"),
    );
  });

  it("resolves UUID ids, order numbers, and client mutation ids inside a restaurant", async () => {
    const orderId = "018f0000-0000-7000-8000-000000000202";
    const db = createDb([
      {
        id: orderId,
        order_number: "ORD-202",
        restaurant_id: "restaurant-1",
      },
    ]);

    const row = await resolveOrderIdentity(db, orderId, {
      restaurantId: "restaurant-1",
    });

    expect(row.id).toBe(orderId);
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining(
        "(`id` = ? OR `order_number` = ? OR `client_mutation_id` = ?)",
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
