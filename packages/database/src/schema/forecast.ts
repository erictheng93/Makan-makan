import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { menuItems } from "./menu-items";

// --- Forecast Cache ---
export const forecastCache = sqliteTable(
  "forecast_cache",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(),
    forecastDate: text("forecast_date").notNull(), // YYYY-MM-DD
    forecastType: text("forecast_type").notNull(), // 'item_level' | 'ingredient_level'
    data: text("data", { mode: "json" }).$type<
      Record<string, { predicted: number; confidence: number; trend: string }>
    >(),
    metadata: text("metadata", { mode: "json" }).$type<{
      dataSourceDays: number;
      model: string;
      weights: Record<string, number>;
      generatedAt: string;
    }>(),
    generatedBy: text("generated_by").notNull(), // 'statistical' | 'ai_enhanced'
    expiresAt: integer("expires_at_ms", { mode: "timestamp_ms" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    restaurantDateTypeIdx: uniqueIndex(
      "forecast_cache_restaurant_date_type_idx",
    ).on(table.restaurantId, table.forecastDate, table.forecastType),
    expiresAtIdx: index("forecast_cache_expires_at_idx").on(table.expiresAt),
  }),
);

export const forecastCacheRelations = relations(forecastCache, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [forecastCache.restaurantId],
    references: [restaurants.id],
  }),
}));

// --- Ingredient Definitions (future expansion, MVP optional) ---
export const ingredientDefinitions = sqliteTable(
  "ingredient_definitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(), // 'kg', '份', 'ml', etc.
    category: text("category"), // '肉類', '蔬菜', '調味料'
    costPerUnitCents: integer("cost_per_unit_cents"),
    supplier: text("supplier"),
    minStockLevel: real("min_stock_level"),
    currentStock: real("current_stock"),
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
    restaurantActiveIdx: index("ingredient_defs_restaurant_active_idx").on(
      table.restaurantId,
      table.isActive,
    ),
    restaurantCategoryIdx: index("ingredient_defs_restaurant_category_idx").on(
      table.restaurantId,
      table.category,
    ),
  }),
);

/**
 * Ledger behind `ingredientDefinitions.currentStock` (#277).
 *
 * The scalar is kept as a read cache — BOM explosion, the procurement list and
 * the low-stock filter all read it — and every change to it writes a row here
 * in the same batch, so a stock figure can always be explained.
 *
 * `reason` is a free-ish tag rather than an enum so a later consumer (order
 * deduction, #278) can add its own without a migration; the UI offers the
 * known set.
 */
export const ingredientStockMovements = sqliteTable(
  "ingredient_stock_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(),
    ingredientId: integer("ingredient_id").notNull(),
    /** Signed: positive receives, negative consumes or writes off. */
    delta: real("delta").notNull(),
    /** Stock after this movement, so history reads without re-summing. */
    balanceAfter: real("balance_after").notNull(),
    reason: text("reason").notNull(),
    note: text("note"),
    createdBy: text("created_by"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    ingredientIdx: index("ingredient_stock_movements_ingredient_idx").on(
      table.ingredientId,
      table.createdAt,
    ),
    restaurantIdx: index("ingredient_stock_movements_restaurant_idx").on(
      table.restaurantId,
      table.createdAt,
    ),
  }),
);

export const ingredientStockMovementsRelations = relations(
  ingredientStockMovements,
  ({ one }) => ({
    ingredient: one(ingredientDefinitions, {
      fields: [ingredientStockMovements.ingredientId],
      references: [ingredientDefinitions.id],
    }),
  }),
);

export const ingredientDefinitionsRelations = relations(
  ingredientDefinitions,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [ingredientDefinitions.restaurantId],
      references: [restaurants.id],
    }),
    menuItemIngredients: many(menuItemIngredients),
  }),
);

// --- Menu Item Ingredients (future expansion, MVP optional) ---
export const menuItemIngredients = sqliteTable(
  "menu_item_ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    menuItemId: integer("menu_item_id").notNull(),
    ingredientId: integer("ingredient_id").notNull(),
    quantityPerServing: real("quantity_per_serving").notNull(),
    unit: text("unit").notNull(),
    isOptional: integer("is_optional", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    menuItemIdx: index("menu_item_ingredients_menu_item_idx").on(
      table.menuItemId,
    ),
    ingredientIdx: index("menu_item_ingredients_ingredient_idx").on(
      table.ingredientId,
    ),
  }),
);

export const menuItemIngredientsRelations = relations(
  menuItemIngredients,
  ({ one }) => ({
    menuItem: one(menuItems, {
      fields: [menuItemIngredients.menuItemId],
      references: [menuItems.id],
    }),
    ingredient: one(ingredientDefinitions, {
      fields: [menuItemIngredients.ingredientId],
      references: [ingredientDefinitions.id],
    }),
  }),
);
