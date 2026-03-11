/**
 * Platform Menu Mappings Table & Relations
 * 平台菜單項目 ID 映射
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { menuItems } from "./menu-items";
import type { PlatformType } from "./platform-integrations";

// ================================================
// CONSTANTS
// ================================================

export const MENU_MAPPING_SYNC_STATUS = {
  PENDING: "pending",
  SYNCED: "synced",
  ERROR: "error",
} as const;

export type MenuMappingSyncStatus =
  (typeof MENU_MAPPING_SYNC_STATUS)[keyof typeof MENU_MAPPING_SYNC_STATUS];

// ================================================
// TABLE DEFINITION
// ================================================

export const platformMenuMappings = sqliteTable(
  "platform_menu_mappings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    // Internal menu item reference
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),

    // Restaurant reference (denormalized for query efficiency)
    restaurantId: text("restaurant_id").notNull(),

    // Platform info
    platform: text("platform").$type<PlatformType>().notNull(),
    platformItemId: text("platform_item_id"),

    // Sync status
    syncStatus: text("sync_status")
      .$type<MenuMappingSyncStatus>()
      .default(MENU_MAPPING_SYNC_STATUS.PENDING),

    lastSyncedAt: integer("last_synced_at_ms", { mode: "timestamp_ms" }),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Unique: one mapping per menu item per platform
    menuItemPlatformIdx: uniqueIndex(
      "platform_menu_mappings_item_platform_idx",
    ).on(table.menuItemId, table.platform),
    // Lookup by restaurant + platform
    restaurantPlatformIdx: index(
      "platform_menu_mappings_restaurant_platform_idx",
    ).on(table.restaurantId, table.platform),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const platformMenuMappingsRelations = relations(
  platformMenuMappings,
  ({ one }) => ({
    menuItem: one(menuItems, {
      fields: [platformMenuMappings.menuItemId],
      references: [menuItems.id],
    }),
  }),
);
