import { ApiError } from "../utils/api-error";

export type OrderIdentifier = string | number;

export interface OrderIdentityRow {
  id: number;
  public_id: string | null;
  order_number: string;
  restaurant_id: string;
}

export interface OrderIdentity {
  id: number;
  publicId: string | null;
  orderNumber: string;
  restaurantId: string;
}

export interface OrderIdentityOptions {
  restaurantId?: string;
  requireRestaurantForAliases?: boolean;
}

export type OrderLookupInput =
  | { numericId: number; lookupKey?: never }
  | { lookupKey: string; numericId?: never };

export function toOrderLookupInput(
  identifier: OrderIdentifier,
): OrderLookupInput {
  if (typeof identifier === "number") {
    if (!Number.isInteger(identifier) || identifier <= 0) {
      throw new ApiError(
        "ORDER_ID_INVALID",
        "Order id must be a positive integer or non-empty public identifier",
        400,
      );
    }
    return { numericId: identifier };
  }

  const lookupKey = identifier.trim();
  if (!lookupKey) {
    throw new ApiError(
      "ORDER_ID_INVALID",
      "Order id must be a positive integer or non-empty public identifier",
      400,
    );
  }

  if (/^\d+$/.test(lookupKey)) {
    const numericId = Number.parseInt(lookupKey, 10);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new ApiError(
        "ORDER_ID_INVALID",
        "Order id must be a positive integer or non-empty public identifier",
        400,
      );
    }
    return { numericId };
  }

  return { lookupKey };
}

export async function resolveOrderIdentity(
  db: D1Database,
  identifier: OrderIdentifier,
  options: OrderIdentityOptions = {},
): Promise<OrderIdentity> {
  const requireRestaurantForAliases =
    options.requireRestaurantForAliases ?? true;
  const restaurantId = options.restaurantId?.trim();
  const lookup = toOrderLookupInput(identifier);

  let row: OrderIdentityRow | null;
  if ("numericId" in lookup) {
    const sql = restaurantId
      ? "SELECT `id`, `public_id`, `order_number`, `restaurant_id` FROM `orders` WHERE `id` = ? AND `restaurant_id` = ? LIMIT 1"
      : "SELECT `id`, `public_id`, `order_number`, `restaurant_id` FROM `orders` WHERE `id` = ? LIMIT 1";
    const statement = db.prepare(sql);
    row = restaurantId
      ? await statement
          .bind(lookup.numericId, restaurantId)
          .first<OrderIdentityRow>()
      : await statement.bind(lookup.numericId).first<OrderIdentityRow>();
  } else {
    if (requireRestaurantForAliases && !restaurantId) {
      throw new ApiError(
        "RESTAURANT_ID_REQUIRED",
        "restaurantId is required for non-numeric order identifiers",
        400,
      );
    }

    const sql = restaurantId
      ? "SELECT `id`, `public_id`, `order_number`, `restaurant_id` FROM `orders` WHERE `restaurant_id` = ? AND (`public_id` = ? OR `order_number` = ? OR `client_mutation_id` = ?) LIMIT 1"
      : "SELECT `id`, `public_id`, `order_number`, `restaurant_id` FROM `orders` WHERE `public_id` = ? OR `order_number` = ? OR `client_mutation_id` = ? LIMIT 1";
    const statement = db.prepare(sql);
    row = restaurantId
      ? await statement
          .bind(
            restaurantId,
            lookup.lookupKey,
            lookup.lookupKey,
            lookup.lookupKey,
          )
          .first<OrderIdentityRow>()
      : await statement
          .bind(lookup.lookupKey, lookup.lookupKey, lookup.lookupKey)
          .first<OrderIdentityRow>();
  }

  if (!row) {
    throw new ApiError("ORDER_NOT_FOUND", "Order not found", 404);
  }

  return {
    id: row.id,
    publicId: row.public_id,
    orderNumber: row.order_number,
    restaurantId: row.restaurant_id,
  };
}
