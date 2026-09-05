/**
 * Platform Integrations Table & Relations
 * 外送平台串接設定
 */

import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";

// ================================================
// ENUMS & CONSTANTS
// ================================================

export const PLATFORM_TYPES = {
  UBER_EATS: "uber_eats",
  FOODPANDA: "foodpanda",
  GRABFOOD: "grabfood",
} as const;

export type PlatformType = (typeof PLATFORM_TYPES)[keyof typeof PLATFORM_TYPES];

export const MENU_SYNC_STATUS = {
  IDLE: "idle",
  SYNCING: "syncing",
  SUCCESS: "success",
  ERROR: "error",
} as const;

export type MenuSyncStatus =
  (typeof MENU_SYNC_STATUS)[keyof typeof MENU_SYNC_STATUS];

// ================================================
// TABLE DEFINITION
// ================================================

export const platformIntegrations = sqliteTable(
  "platform_integrations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Restaurant reference
    restaurantId: text("restaurant_id").notNull(),

    // Platform identification
    platform: text("platform").$type<PlatformType>().notNull(),

    // Status
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),

    // Encrypted credentials payload.
    credentials: text("credentials"),

    /**
     * The platform's own identifier for this store, in plaintext and on
     * purpose.
     *
     * The unauthenticated webhook route has to know which integration a
     * delivery platform is calling about before it can check that call's
     * signature -- and the signing secret lives inside `credentials`. While
     * this id was only stored in there too, the only way to answer "whose
     * webhook is this?" was to decrypt every enabled row and compare, which
     * meant one stranger's request decrypted every tenant's credentials
     * before anything authenticated it (#338).
     *
     * Safe to expose: it arrives in the untrusted webhook payload, it is a
     * path segment in the platform's own menu API, and it identifies rather
     * than authorises. The secrets it used to sit beside -- clientId,
     * clientSecret, webhookSecret -- stay encrypted.
     */
    storeId: text("store_id"),

    // Configuration (JSON)
    // { autoAcceptOrders, menuSyncEnabled }
    config: text("config", { mode: "json" })
      .$type<{
        autoAcceptOrders?: boolean;
        menuSyncEnabled?: boolean;
      }>()
      .default(sql`'{"autoAcceptOrders":false,"menuSyncEnabled":false}'`),

    // Menu sync status
    lastMenuSyncAt: integer("last_menu_sync_at_ms", { mode: "timestamp_ms" }),
    menuSyncStatus: text("menu_sync_status")
      .$type<MenuSyncStatus>()
      .default(MENU_SYNC_STATUS.IDLE),
    menuSyncError: text("menu_sync_error"),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Unique constraint: one integration per platform per restaurant
    restaurantPlatformIdx: uniqueIndex(
      "platform_integrations_restaurant_platform_idx",
    ).on(table.restaurantId, table.platform),
    // Index for enabled integrations lookup
    enabledIdx: index("platform_integrations_enabled_idx").on(
      table.enabled,
      table.platform,
    ),
    // One platform store resolves to at most one integration, so an
    // unauthenticated webhook reads a single row instead of every tenant's.
    // Partial, so rows predating the column do not all collide on NULL.
    platformStoreIdx: uniqueIndex("platform_integrations_platform_store_idx")
      .on(table.platform, table.storeId)
      .where(sql`${table.storeId} IS NOT NULL`),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const platformIntegrationsRelations = relations(
  platformIntegrations,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [platformIntegrations.restaurantId],
      references: [restaurants.id],
    }),
  }),
);
