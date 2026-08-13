import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { categories } from "./categories";
import { orderItems } from "./order-items";

export const menuItems = sqliteTable(
  "menu_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.public_id (TEXT)
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),

    // 基本資訊
    name: text("name").notNull(),
    // Optional English name shown alongside `name`; the admin menu form has
    // always collected it and filters search on it (#107).
    nameEn: text("name_en"),
    description: text("description"),
    ingredients: text("ingredients"), // 食材列表

    // 價格資訊
    priceCents: integer("price_cents"),
    originalPriceCents: integer("original_price_cents"),
    costPriceCents: integer("cost_price_cents"),

    // 圖片資訊
    imageUrl: text("image_url"),
    imageVariants: text("image_variants", { mode: "json" }).$type<{
      thumbnail?: string | null; // 縮圖 (150x150)
      small?: string | null; // 小圖 (300x300)
      medium?: string | null; // 中圖 (600x600)
      large?: string | null; // 大圖 (1200x1200)
    }>(),
    imageId: text("image_id"), // 引用 images.id，供換圖刪舊

    // 狀態設定
    catalogType: text("catalog_type")
      .$type<"menu_item" | "product">()
      .notNull()
      .default("menu_item"),
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    isFeatured: integer("is_featured", { mode: "boolean" })
      .notNull()
      .default(false),
    isPopular: integer("is_popular", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    // 庫存管理
    inventoryCount: integer("inventory_count"), // null = 無限庫存
    minInventoryAlert: integer("min_inventory_alert").default(5),

    // 飲食特性
    spiceLevel: integer("spice_level").notNull().default(0), // 0-5 辣度等級
    preparationTime: integer("preparation_time").default(15), // 準備時間（分鐘）
    calories: integer("calories"), // 卡路里

    // 飲食資訊標籤
    dietaryInfo: text("dietary_info", { mode: "json" }).$type<{
      vegetarian?: boolean; // 素食
      vegan?: boolean; // 純素
      halal?: boolean; // 清真
      glutenFree?: boolean; // 無麩質
      dairyFree?: boolean; // 無乳製品
      nutFree?: boolean; // 無堅果
      seafoodFree?: boolean; // 無海鮮
      organic?: boolean; // 有機
      localSource?: boolean; // 在地食材
    }>(),

    // 過敏原資訊
    allergens: text("allergens", { mode: "json" }).$type<string[]>(),

    // 客製化選項
    options: text("options", { mode: "json" }).$type<{
      // 尺寸選項
      sizes?: Array<{
        id: string;
        name: string; // 小、中、大
        priceAdjustment: number; // 價格調整
        description?: string; // 說明
        isDefault?: boolean; // 是否為預設選項
      }>;

      // 客製化選項
      customizations?: Array<{
        id: string;
        name: string; // 選項名稱（如：辣度、甜度）
        type: "single" | "multiple"; // 單選或多選
        required: boolean; // 是否必選
        maxSelections?: number; // 最大選擇數（多選時使用）
        choices: Array<{
          id: string;
          name: string; // 選項值（如：不辣、小辣、中辣）
          priceAdjustment?: number; // 價格調整
          isDefault?: boolean; // 是否為預設選項
        }>;
      }>;

      // 加購項目
      addOns?: Array<{
        id: string;
        name: string; // 加購項目名稱
        price: number; // 加購價格
        description?: string; // 說明
        maxQuantity?: number; // 最大數量
        category?: string; // 分類（如：飲料、小菜）
      }>;
    }>(),

    // 營業時間限制
    availableHours: text("available_hours", { mode: "json" }).$type<{
      start?: string; // HH:mm
      end?: string; // HH:mm
      days?: number[]; // 0-6
    }>(),

    // 統計資訊
    orderCount: integer("order_count").notNull().default(0),
    rating: real("rating").default(0),
    reviewCount: integer("review_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),

    // SEO 和搜尋
    tags: text("tags", { mode: "json" }).$type<string[]>(), // 搜尋標籤
    keywords: text("keywords"), // 關鍵字（用於搜尋）

    // 時間戳記
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),

    // 軟刪除
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    // 關鍵索引優化
    restaurantCategoryIdx: index("menu_items_restaurant_category_idx").on(
      table.restaurantId,
      table.categoryId,
      table.isAvailable,
    ),
    restaurantFeaturedIdx: index("menu_items_restaurant_featured_idx").on(
      table.restaurantId,
      table.isFeatured,
      table.isAvailable,
    ),
    restaurantPopularIdx: index("menu_items_restaurant_popular_idx").on(
      table.restaurantId,
      table.isPopular,
      table.orderCount,
    ),
    priceRangeIdx: index("menu_items_price_range_idx").on(
      table.restaurantId,
      table.priceCents,
    ),
    availabilityIdx: index("menu_items_availability_idx").on(
      table.isAvailable,
      table.inventoryCount,
    ),
    restaurantCatalogIdx: index("menu_items_restaurant_catalog_idx").on(
      table.restaurantId,
      table.catalogType,
      table.isAvailable,
    ),
  }),
);

export const menuItemRelations = relations(menuItems, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id], // UUID v7 關聯
  }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
}));
