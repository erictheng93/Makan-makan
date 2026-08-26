import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { menuItems } from "./menu-items";

/**
 * Restaurant-level customization option groups (migration 0081).
 *
 * `menu_items.options` is per-item JSON, so the same 甜度 had to be rebuilt on
 * every drink and edited on every drink. A group lives here once and items
 * reference it, with per-item overrides for the "this one but no 半糖" case.
 *
 * `publicId` is what the assembled `options` JSON emits as each `id`. It is
 * kept separate from the primary key so backfilled groups can carry the string
 * an existing cart or order snapshot already refers to.
 *
 * sizes / addOns / customizations are all rows here, told apart by `kind`.
 */
export const optionGroups = sqliteTable(
  "option_groups",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    publicId: text("public_id").notNull(),
    kind: text("kind", { enum: ["size", "choice", "addon"] }).notNull(),
    name: text("name").notNull(),
    type: text("type", { enum: ["single", "multiple"] })
      .notNull()
      .default("single"),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    maxSelections: integer("max_selections"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    restaurantIdx: index("option_groups_restaurant_idx").on(table.restaurantId),
    publicIdUnique: uniqueIndex("option_groups_restaurant_public_id_unique")
      .on(table.restaurantId, table.publicId)
      .where(sql`${table.deletedAt} IS NULL`),
  }),
);

export const optionChoices = sqliteTable(
  "option_choices",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    priceAdjustmentCents: integer("price_adjustment_cents")
      .notNull()
      .default(0),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    /**
     * The manual sold-out switch, shared across every item offering this
     * choice — 珍珠 running out is true for all of them. Hiding a choice for
     * one item only is `menuItemOptionChoiceOverrides.isHidden` instead.
     */
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    /** Per-order cap; only meaningful for `kind: "addon"` groups. */
    maxQuantity: integer("max_quantity"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    // D1 bills rows scanned. Without this, assembling one menu scans the whole
    // table on every request.
    groupIdx: index("option_choices_group_idx").on(table.groupId),
    publicIdUnique: uniqueIndex("option_choices_public_id_unique").on(
      table.groupId,
      table.publicId,
    ),
  }),
);

/** Which groups an item offers, in what order, and where it disagrees. */
export const menuItemOptionGroups = sqliteTable(
  "menu_item_option_groups",
  {
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    /** NULL inherits the group's value. */
    requiredOverride: integer("required_override", { mode: "boolean" }),
    maxSelectionsOverride: integer("max_selections_override"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.menuItemId, table.groupId] }),
    // The primary key already indexes by menuItemId; this covers "which items
    // use this group", which an edit needs to invalidate their caches.
    groupIdx: index("menu_item_option_groups_group_idx").on(table.groupId),
  }),
);

export const menuItemOptionChoiceOverrides = sqliteTable(
  "menu_item_option_choice_overrides",
  {
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    choiceId: text("choice_id")
      .notNull()
      .references(() => optionChoices.id, { onDelete: "cascade" }),
    isHidden: integer("is_hidden", { mode: "boolean" })
      .notNull()
      .default(false),
    /** NULL inherits the group's price for this choice. */
    priceAdjustmentCents: integer("price_adjustment_cents"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.menuItemId, table.choiceId] }),
    choiceIdx: index("menu_item_option_choice_overrides_choice_idx").on(
      table.choiceId,
    ),
  }),
);
