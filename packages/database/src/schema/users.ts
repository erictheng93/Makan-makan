import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { orders } from "./orders";

// 用戶角色定義
export const USER_ROLES = {
  ADMIN: 0, // 系統管理員
  OWNER: 1, // 店主
  CHEF: 2, // 廚師
  SERVICE: 3, // 送菜員
  CASHIER: 4, // 收銀員
  CUSTOMER: 5, // 顧客（可選）
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  // 基本資訊
  username: text("username").notNull().unique(),
  email: text("email"),
  phone: text("phone"),
  fullName: text("full_name").notNull(),

  // 認證資訊
  passwordHash: text("password_hash").notNull(),

  // 角色和權限
  role: integer("role").notNull().default(USER_ROLES.CASHIER), // 預設為收銀員，顧客應使用 customers 表
  restaurantId: text("restaurant_id"), // 引用 restaurants.public_id (TEXT)

  // 個人資訊
  address: text("address"),
  dateOfBirth: text("date_of_birth"), // ISO date string
  profileImageUrl: text("profile_image_url"),

  // 狀態
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isVerified: integer("is_verified", { mode: "boolean" })
    .notNull()
    .default(false),

  // 偏好設定
  preferences: text("preferences", { mode: "json" }).$type<{
    language?: string;
    currency?: string;
    notifications?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };
    dietary?: {
      vegetarian?: boolean;
      vegan?: boolean;
      halal?: boolean;
      glutenFree?: boolean;
      allergies?: string[];
    };
  }>(),

  // 統計資訊
  totalOrders: integer("total_orders").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0), // 以分為單位

  // 安全資訊
  lastLoginAt: integer("last_login_at_ms", { mode: "timestamp_ms" }),
  passwordChangedAt: integer("password_changed_at_ms", {
    mode: "timestamp_ms",
  }),
  tokenVersion: integer("token_version").notNull().default(1),

  // 驗證時間戳
  emailVerifiedAt: integer("email_verified_at_ms", { mode: "timestamp_ms" }),
  phoneVerifiedAt: integer("phone_verified_at_ms", { mode: "timestamp_ms" }),

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

export const userRelations = relations(users, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [users.restaurantId],
    references: [restaurants.id], // UUID v7 關聯
  }),
  orders: many(orders),
}));
