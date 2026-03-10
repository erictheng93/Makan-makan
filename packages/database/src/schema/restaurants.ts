import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { categories } from "./categories";
import { menuItems } from "./menu-items";
import { tables } from "./tables";
import { orders } from "./orders";
import { users } from "./users";

export const restaurants = sqliteTable("restaurants", {
  // Primary key: UUID v7 (time-sortable, globally unique)
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  type: text("type").notNull(), // 餐廳類型：中式、西式、日式等
  category: text("category").notNull(), // 餐廳分類：火鍋、燒烤、快餐等
  description: text("description"),
  address: text("address").notNull(),
  district: text("district").notNull(),
  city: text("city").notNull().default("台中市"),
  phone: text("phone").notNull(),
  email: text("email"),
  website: text("website"),

  // 營業資訊
  businessHours: text("business_hours", { mode: "json" }).$type<{
    monday?: { open: string; close: string; closed?: boolean };
    tuesday?: { open: string; close: string; closed?: boolean };
    wednesday?: { open: string; close: string; closed?: boolean };
    thursday?: { open: string; close: string; closed?: boolean };
    friday?: { open: string; close: string; closed?: boolean };
    saturday?: { open: string; close: string; closed?: boolean };
    sunday?: { open: string; close: string; closed?: boolean };
  }>(),

  // 狀態和設定
  isAvailable: integer("is_available", { mode: "boolean" })
    .notNull()
    .default(true),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

  // 媒體檔案
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  imageUrls: text("image_urls", { mode: "json" }).$type<string[]>(),

  // 店家级别 QR Code（用于无桌号的外带/自取订单）
  shopQrCode: text("shop_qr_code").unique(),
  shopQrCodeImageUrl: text("shop_qr_code_image_url"),
  enableShopMode: integer("enable_shop_mode", { mode: "boolean" })
    .notNull()
    .default(false),
  shopQrSettings: text("shop_qr_settings", { mode: "json" }).$type<{
    displayName?: string;
    instructions?: string;
    requirePhone?: boolean;
  }>(),
  shopQrVersion: integer("shop_qr_version").notNull().default(1),

  // 設定
  settings: text("settings", { mode: "json" }).$type<{
    allowOnlineOrdering?: boolean;
    allowTableReservation?: boolean;
    allowGuestOrders?: boolean;
    requireCustomerInfo?: boolean;
    autoConfirmOrders?: boolean;
    currency?: string;
    taxRate?: number;
    serviceChargeRate?: number;
    minOrderAmount?: number;
    maxOrderAmount?: number;
    orderTimeoutMinutes?: number;
  }>(),

  // 評分和統計
  rating: real("rating").default(0),
  reviewCount: integer("review_count").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),

  // 時間戳記
  createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date()),

  // 軟刪除
  deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
});

export const restaurantRelations = relations(restaurants, ({ many }) => ({
  categories: many(categories),
  menuItems: many(menuItems),
  tables: many(tables),
  orders: many(orders),
  users: many(users), // 餐廳員工
}));
