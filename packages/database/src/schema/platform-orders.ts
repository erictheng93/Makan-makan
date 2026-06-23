/**
 * Platform Orders Table & Relations
 * 外送平台訂單映射
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { orders } from "./orders";
import { restaurants } from "./restaurants";
import type { PlatformType } from "./platform-integrations";

// ================================================
// TABLE DEFINITION
// ================================================

export const platformOrders = sqliteTable(
  "platform_orders",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    // Internal order reference
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    // Platform info
    platform: text("platform").$type<PlatformType>().notNull(),
    platformOrderId: text("platform_order_id").notNull(),
    platformStoreId: text("platform_store_id"),

    // Restaurant reference
    restaurantId: text("restaurant_id").notNull(),

    // Platform status tracking
    platformStatus: text("platform_status"),

    // Sync info
    lastSyncedAt: integer("last_synced_at_ms", { mode: "timestamp_ms" }),

    // Raw webhook payload for debugging
    rawPayload: text("raw_payload", { mode: "json" }),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Unique: one mapping per platform order
    platformOrderIdx: uniqueIndex("platform_orders_platform_order_idx").on(
      table.platform,
      table.platformOrderId,
    ),
    // Lookup by internal order
    orderIdx: index("platform_orders_order_idx").on(table.orderId),
    // Lookup by restaurant + platform
    restaurantPlatformIdx: index("platform_orders_restaurant_platform_idx").on(
      table.restaurantId,
      table.platform,
      table.createdAt,
    ),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const platformOrdersRelations = relations(platformOrders, ({ one }) => ({
  order: one(orders, {
    fields: [platformOrders.orderId],
    references: [orders.id],
  }),
  restaurant: one(restaurants, {
    fields: [platformOrders.restaurantId],
    references: [restaurants.id],
  }),
}));
