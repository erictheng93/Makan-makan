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

export type MarketGeoJsonBoundary =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

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
    boundaryGeojson: text("boundary_geojson", {
      mode: "json",
    }).$type<MarketGeoJsonBoundary | null>(),
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
    locationLabel: text("location_label"),
    marketHours: text("market_hours", { mode: "json" }).$type<Record<
      string,
      { open: string; close: string; closed?: boolean }
    > | null>(),
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

export const marketJoinRequests = sqliteTable(
  "market_join_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    marketId: text("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    message: text("message"),
    requestedAt: integer("requested_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    resolvedAt: integer("resolved_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    pendingPairIdx: uniqueIndex("market_join_requests_pending_pair_idx")
      .on(table.restaurantId, table.marketId)
      .where(sql`${table.status} = 'pending'`),
    restaurantStatusIdx: index("market_join_requests_restaurant_status_idx").on(
      table.restaurantId,
      table.status,
    ),
    marketStatusIdx: index("market_join_requests_market_status_idx").on(
      table.marketId,
      table.status,
    ),
  }),
);

export const marketCheckoutSessions = sqliteTable(
  "market_checkout_sessions",
  {
    id: text("id").primaryKey(),
    marketId: text("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "restrict" }),
    marketSlug: text("market_slug").notNull(),
    marketName: text("market_name").notNull(),
    status: text("status").notNull().default("submitted"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    subtotalCents: integer("subtotal_cents").notNull(),
    childOrderCount: integer("child_order_count").notNull().default(0),
    paymentSummary: text("payment_summary", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    marketCreatedIdx: index("market_checkout_sessions_market_created_idx").on(
      table.marketId,
      table.createdAt,
    ),
    paymentStatusIdx: index("market_checkout_sessions_payment_status_idx").on(
      table.paymentStatus,
    ),
  }),
);

export const marketCheckoutChildOrders = sqliteTable(
  "market_checkout_child_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    checkoutId: text("checkout_id")
      .notNull()
      .references(() => marketCheckoutSessions.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "restrict" }),
    restaurantName: text("restaurant_name").notNull(),
    orderId: integer("order_id").notNull(),
    orderNumber: text("order_number").notNull(),
    totalAmount: real("total_amount").notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    tokenExpiresAt: integer("token_expires_at_ms", {
      mode: "timestamp_ms",
    }).notNull(),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    checkoutIdx: index("market_checkout_child_orders_checkout_idx").on(
      table.checkoutId,
    ),
    restaurantIdx: index("market_checkout_child_orders_restaurant_idx").on(
      table.restaurantId,
    ),
    checkoutOrderIdx: uniqueIndex(
      "market_checkout_child_orders_checkout_order_idx",
    ).on(table.checkoutId, table.orderId),
  }),
);

export const marketsRelations = relations(markets, ({ many }) => ({
  memberships: many(restaurantMarketMemberships),
  checkoutSessions: many(marketCheckoutSessions),
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

export const marketJoinRequestsRelations = relations(
  marketJoinRequests,
  ({ one }) => ({
    market: one(markets, {
      fields: [marketJoinRequests.marketId],
      references: [markets.id],
    }),
    restaurant: one(restaurants, {
      fields: [marketJoinRequests.restaurantId],
      references: [restaurants.id],
    }),
  }),
);

export const marketCheckoutSessionsRelations = relations(
  marketCheckoutSessions,
  ({ one, many }) => ({
    market: one(markets, {
      fields: [marketCheckoutSessions.marketId],
      references: [markets.id],
    }),
    childOrders: many(marketCheckoutChildOrders),
  }),
);

export const marketCheckoutChildOrdersRelations = relations(
  marketCheckoutChildOrders,
  ({ one }) => ({
    checkout: one(marketCheckoutSessions, {
      fields: [marketCheckoutChildOrders.checkoutId],
      references: [marketCheckoutSessions.id],
    }),
    restaurant: one(restaurants, {
      fields: [marketCheckoutChildOrders.restaurantId],
      references: [restaurants.id],
    }),
  }),
);
