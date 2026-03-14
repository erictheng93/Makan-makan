import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { menuItems } from "./menu-items";

export const dishSearchIndex = sqliteTable(
  "dish_search_index",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    menuItemId: integer("menu_item_id").notNull(),
    restaurantId: text("restaurant_id").notNull(),
    dishName: text("dish_name").notNull(),
    dishNameNormalized: text("dish_name_normalized").notNull(),
    categoryName: text("category_name"),
    price: real("price"),
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    district: text("district"),
    restaurantType: text("restaurant_type"),
    supportsTakeaway: integer("supports_takeaway", { mode: "boolean" })
      .notNull()
      .default(false),
    supportsDelivery: integer("supports_delivery", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    nameAvailableIdx: index("dish_search_name_available_idx").on(
      table.dishNameNormalized,
      table.isAvailable,
    ),
    restaurantAvailableIdx: index("dish_search_restaurant_available_idx").on(
      table.restaurantId,
      table.isAvailable,
    ),
    priceAvailableIdx: index("dish_search_price_available_idx").on(
      table.price,
      table.isAvailable,
    ),
    districtAvailableIdx: index("dish_search_district_available_idx").on(
      table.district,
      table.isAvailable,
    ),
  }),
);

export const dishSearchIndexRelations = relations(
  dishSearchIndex,
  ({ one }) => ({
    menuItem: one(menuItems, {
      fields: [dishSearchIndex.menuItemId],
      references: [menuItems.id],
    }),
    restaurant: one(restaurants, {
      fields: [dishSearchIndex.restaurantId],
      references: [restaurants.id],
    }),
  }),
);
