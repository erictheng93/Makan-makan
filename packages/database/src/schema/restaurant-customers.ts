import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";
import { customers } from "./customers";
import { restaurants } from "./restaurants";

/**
 * Tenant-local customer projection. `id` is deliberately the only identifier
 * exposed to a restaurant: the platform-wide customers.id never leaves the
 * member-directory service.
 */
export const restaurantCustomers = sqliteTable(
  "restaurant_customers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderCount: integer("order_count").notNull().default(0),
    cancelledOrderCount: integer("cancelled_order_count").notNull().default(0),
    totalSpentCents: integer("total_spent_cents").notNull().default(0),
    firstOrderAt: integer("first_order_at_ms", { mode: "timestamp_ms" }),
    lastOrderAt: integer("last_order_at_ms", { mode: "timestamp_ms" }),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    note: text("note"),
    isBlocked: integer("is_blocked").notNull().default(0),
    blockedReason: text("blocked_reason"),
    recomputedAt: integer("recomputed_at_ms", { mode: "timestamp_ms" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    tenantCustomerUnique: uniqueIndex(
      "restaurant_customers_tenant_customer_unique",
    ).on(table.restaurantId, table.customerId),
    recentIdx: index("restaurant_customers_recent_idx").on(
      table.restaurantId,
      table.lastOrderAt,
    ),
    spendIdx: index("restaurant_customers_spend_idx").on(
      table.restaurantId,
      table.totalSpentCents,
    ),
    ordersIdx: index("restaurant_customers_orders_idx").on(
      table.restaurantId,
      table.orderCount,
    ),
    customerIdx: index("restaurant_customers_customer_idx").on(
      table.customerId,
    ),
  }),
);

export const restaurantCustomersRelations = relations(
  restaurantCustomers,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [restaurantCustomers.restaurantId],
      references: [restaurants.id],
    }),
    customer: one(customers, {
      fields: [restaurantCustomers.customerId],
      references: [customers.id],
    }),
  }),
);

export type RestaurantCustomer = typeof restaurantCustomers.$inferSelect;
