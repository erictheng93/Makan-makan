import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";
import { restaurants } from "./restaurants";

export const METER_KEYS = {
  ORDERS_CREATED: "orders.created",
  API_REQUESTS: "api.requests",
  PRINT_JOBS: "print.jobs",
  AI_REQUESTS: "ai.requests",
  STORAGE_BYTES: "storage.bytes",
} as const;

export type MeterKey = (typeof METER_KEYS)[keyof typeof METER_KEYS];

export const usageEvents = sqliteTable(
  "usage_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    meterKey: text("meter_key").$type<MeterKey>().notNull(),
    quantity: integer("quantity").notNull().default(1),
    metadata: text("metadata", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    aggregatedAt: integer("aggregated_at_ms", { mode: "timestamp_ms" }),
    occurredAt: integer("occurred_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    restaurantMeterTimeIdx: index("usage_events_restaurant_meter_time_idx").on(
      table.restaurantId,
      table.meterKey,
      table.occurredAt,
    ),
    pendingAggregationIdx: index("usage_events_pending_idx")
      .on(table.aggregatedAt)
      .where(sql`${table.aggregatedAt} IS NULL`),
    // The daily TTL sweep (workers/usage-events-ttl.ts) deletes on
    // `occurred_at_ms < ? AND aggregated_at_ms IS NOT NULL`, and neither index
    // above can serve it: `pendingAggregationIdx` is partial on IS NULL — the
    // exact complement of what the sweep asks for — and
    // `restaurantMeterTimeIdx` leads with `restaurant_id`, so a bare time range
    // cannot seek into it. The sweep was therefore full-scanning the table
    // every night. At 90-day retention of one row per API request that is tens
    // of millions of rows read per run, billed at D1's rows-read rate for a
    // query that deletes a thin tail.
    ttlSweepIdx: index("usage_events_ttl_idx")
      .on(table.occurredAt)
      .where(sql`${table.aggregatedAt} IS NOT NULL`),
  }),
);

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [usageEvents.restaurantId],
    references: [restaurants.id],
  }),
}));
