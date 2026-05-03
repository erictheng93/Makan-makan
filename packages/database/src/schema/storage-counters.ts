import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { restaurants } from "./restaurants";

export const storageCounters = sqliteTable("storage_counters", {
  restaurantId: text("restaurant_id")
    .primaryKey()
    .references(() => restaurants.id),
  r2Bytes: integer("r2_bytes").notNull().default(0),
  imagesCount: integer("images_count").notNull().default(0),
  updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`)
    .$onUpdate(() => new Date()),
});

export const storageCountersRelations = relations(
  storageCounters,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [storageCounters.restaurantId],
      references: [restaurants.id],
    }),
  }),
);
