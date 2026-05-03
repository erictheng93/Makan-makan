import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";
import { restaurants } from "./restaurants";
import type { MeterKey } from "./usage-events";

export const usageMeters = sqliteTable(
  "usage_meters",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    meterKey: text("meter_key").$type<MeterKey>().notNull(),
    cycleStartAt: integer("cycle_start_at_ms", {
      mode: "timestamp_ms",
    }).notNull(),
    cycleEndAt: integer("cycle_end_at_ms", {
      mode: "timestamp_ms",
    }).notNull(),
    totalQuantity: integer("total_quantity").notNull().default(0),
    lastAggregatedAt: integer("last_aggregated_at_ms", {
      mode: "timestamp_ms",
    }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`)
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    restaurantMeterIdx: index("usage_meters_restaurant_meter_idx").on(
      table.restaurantId,
      table.meterKey,
    ),
    uniqueCycleIdx: uniqueIndex("usage_meters_restaurant_meter_cycle_idx").on(
      table.restaurantId,
      table.meterKey,
      table.cycleStartAt,
    ),
  }),
);

export const usageMetersRelations = relations(usageMeters, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [usageMeters.restaurantId],
    references: [restaurants.id],
  }),
}));
