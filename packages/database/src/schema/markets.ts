import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { restaurants } from "./restaurants";

export const markets = sqliteTable(
  "markets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    description: text("description"),
    city: text("city").notNull(),
    district: text("district").notNull(),
    address: text("address").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    openingHours: text("opening_hours", { mode: "json" }).$type<Record<
      string,
      { open: string; close: string; closed?: boolean }
    > | null>(),
    bannerUrl: text("banner_url"),
    logoUrl: text("logo_url"),
    imageUrls: text("image_urls", { mode: "json" }).$type<string[]>(),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    cityDistrictActiveIdx: index("markets_city_district_active_idx").on(
      table.city,
      table.district,
      table.isActive,
    ),
  }),
);

export const restaurantMarketMemberships = sqliteTable(
  "restaurant_market_memberships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    marketId: text("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    stallNumber: text("stall_number"),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    joinedAt: integer("joined_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    leftAt: integer("left_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    activePairIdx: uniqueIndex("restaurant_market_active_pair_idx")
      .on(table.restaurantId, table.marketId)
      .where(sql`${table.leftAt} IS NULL`),
    marketActiveIdx: index("restaurant_market_market_active_idx").on(
      table.marketId,
      table.leftAt,
    ),
    restaurantActiveIdx: index("restaurant_market_restaurant_active_idx").on(
      table.restaurantId,
      table.leftAt,
    ),
  }),
);

export const marketsRelations = relations(markets, ({ many }) => ({
  memberships: many(restaurantMarketMemberships),
}));

export const restaurantMarketMembershipsRelations = relations(
  restaurantMarketMemberships,
  ({ one }) => ({
    market: one(markets, {
      fields: [restaurantMarketMemberships.marketId],
      references: [markets.id],
    }),
    restaurant: one(restaurants, {
      fields: [restaurantMarketMemberships.restaurantId],
      references: [restaurants.id],
    }),
  }),
);
