import { ApiError } from "../utils/api-error";

export type OrderIdentifier = string | number;

export interface OrderIdentityRow {
  id: string;
  order_number: string;
  restaurant_id: string;
}

export interface OrderIdentity {
  id: string;
  publicId: string;
  orderNumber: string;
  restaurantId: string;
}

export interface OrderIdentityOptions {
  restaurantId?: string;
  requireRestaurantForAliases?: boolean;
}

export type OrderLookupInput = { lookupKey: string };

export function toOrderLookupInput(
  identifier: OrderIdentifier,
): OrderLookupInput {
  const lookupKey = String(identifier).trim();
  if (!lookupKey) {
    throw new ApiError(
      "ORDER_ID_INVALID",
      "Order id must be a non-empty UUID or order alias",
      400,
    );
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

  if (requireRestaurantForAliases && !restaurantId) {
    throw new ApiError(
      "RESTAURANT_ID_REQUIRED",
      "restaurantId is required for order aliases",
      400,
    );
  }
  const sql = restaurantId
    ? "SELECT `id`, `order_number`, `restaurant_id` FROM `orders` WHERE `restaurant_id` = ? AND (`id` = ? OR `order_number` = ? OR `client_mutation_id` = ?) LIMIT 1"
    : "SELECT `id`, `order_number`, `restaurant_id` FROM `orders` WHERE `id` = ? OR `order_number` = ? OR `client_mutation_id` = ? LIMIT 1";
  const statement = db.prepare(sql);
  const row = restaurantId
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

  if (!row) {
    throw new ApiError("ORDER_NOT_FOUND", "Order not found", 404);
  }

  return {
    id: row.id,
    publicId: row.id,
    orderNumber: row.order_number,
    restaurantId: row.restaurant_id,
  };
}
