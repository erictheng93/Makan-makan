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
import {
  shopSubscriptions,
  type ModuleMap,
  type PlanTier,
} from "./subscriptions";

export interface CycleSnapshotUsageMeter {
  total: number;
  softLimit: number | null;
  hardLimit: number | null;
  overage: number;
}

export type CycleSnapshotUsage = Record<string, CycleSnapshotUsageMeter>;

export const cycleSnapshots = sqliteTable(
  "cycle_snapshots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    subscriptionId: text("subscription_id").references(
      () => shopSubscriptions.id,
    ),
    planTier: text("plan_tier").$type<PlanTier>().notNull(),
    cycleStartAt: integer("cycle_start_at_ms", {
      mode: "timestamp_ms",
    }).notNull(),
    cycleEndAt: integer("cycle_end_at_ms", {
      mode: "timestamp_ms",
    }).notNull(),
    modules: text("modules", { mode: "json" }).$type<ModuleMap>().notNull(),
    usage: text("usage", { mode: "json" })
      .$type<CycleSnapshotUsage>()
      .notNull(),
    totalOverageCents: integer("total_overage_cents").notNull().default(0),
    currency: text("currency").notNull().default("TWD"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    uniqueCycleIdx: uniqueIndex("cycle_snapshots_restaurant_cycle_idx").on(
      table.restaurantId,
      table.cycleStartAt,
    ),
    restaurantTimeIdx: index("cycle_snapshots_restaurant_time_idx").on(
      table.restaurantId,
      table.cycleEndAt,
    ),
  }),
);

export const cycleSnapshotsRelations = relations(cycleSnapshots, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [cycleSnapshots.restaurantId],
    references: [restaurants.id],
  }),
  subscription: one(shopSubscriptions, {
    fields: [cycleSnapshots.subscriptionId],
    references: [shopSubscriptions.id],
  }),
}));

export type CycleSnapshot = typeof cycleSnapshots.$inferSelect;
export type NewCycleSnapshot = typeof cycleSnapshots.$inferInsert;
