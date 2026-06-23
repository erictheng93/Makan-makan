/**
 * Partnership Plans Table & Relations
 * 特約方案表
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";
import { partnerships } from "./partnerships";
import { partnershipUsageLogs } from "./usage-logs";

// ================================================
// ENUMS & CONSTANTS
// ================================================

export const PLAN_DISCOUNT_TYPES = {
  PERCENTAGE: "percentage",
  FIXED: "fixed",
  SPECIAL_PRICE: "special_price",
} as const;

// ================================================
// TYPE EXPORTS
// ================================================

export type PlanDiscountType =
  (typeof PLAN_DISCOUNT_TYPES)[keyof typeof PLAN_DISCOUNT_TYPES];

// ================================================
// TABLE: partnership_plans (特約方案表)
// ================================================

export const partnershipPlans = sqliteTable(
  "partnership_plans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID().replace(/-/g, "")),

    // 關聯資訊
    partnershipId: text("partnership_id")
      .notNull()
      .references(() => partnerships.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.public_id (TEXT)

    // 方案基本資訊
    planCode: text("plan_code").notNull(),
    planName: text("plan_name").notNull(),
    planNameEn: text("plan_name_en"),
    description: text("description"),

    // 折扣設定
    discountType: text("discount_type").notNull().$type<PlanDiscountType>(),
    discountPercentageBps: integer("discount_percentage_bps"),
    discountValueCents: integer("discount_value_cents"),
    maxDiscountAmountCents: integer("max_discount_amount_cents"),

    // 使用條件
    minOrderAmountCents: integer("min_order_amount_cents"),
    maxOrderAmountCents: integer("max_order_amount_cents"),
    applicableMenuItems: text("applicable_menu_items", { mode: "json" })
      .$type<string[]>()
      .default([]),
    applicableCategories: text("applicable_categories", { mode: "json" })
      .$type<string[]>()
      .default([]),
    excludedMenuItems: text("excluded_menu_items", { mode: "json" })
      .$type<string[]>()
      .default([]),
    excludedCategories: text("excluded_categories", { mode: "json" })
      .$type<string[]>()
      .default([]),

    // 時間限制
    applicableDays: text("applicable_days", { mode: "json" })
      .$type<number[]>()
      .default([]), // 0-6, 0=Sunday
    applicableTimeSlots: text("applicable_time_slots", { mode: "json" })
      .$type<Array<{ start: string; end: string }>>()
      .default([]),

    // 使用限制
    usageLimitPerMember: integer("usage_limit_per_member"),
    usageLimitPerDay: integer("usage_limit_per_day"),
    dailyUsageCount: integer("daily_usage_count").default(0),
    totalUsageCount: integer("total_usage_count").default(0),

    // 有效期
    validFrom: integer("valid_from_ms", { mode: "timestamp_ms" }).notNull(),
    validTo: integer("valid_to_ms", { mode: "timestamp_ms" }).notNull(),

    // 優先級和組合
    priority: integer("priority").default(0),
    canCombineWithCoupons: integer("can_combine_with_coupons", {
      mode: "boolean",
    }).default(false),
    canCombineWithPromotions: integer("can_combine_with_promotions", {
      mode: "boolean",
    }).default(false),

    // 狀態控制
    isActive: integer("is_active", { mode: "boolean" }).default(true),

    // 顯示設定
    badgeText: text("badge_text"),
    badgeColor: text("badge_color"),
    showOnMenu: integer("show_on_menu", { mode: "boolean" }).default(true),

    // 統計資料
    totalDiscountGivenCents: integer("total_discount_given_cents"),
    totalRevenueCents: integer("total_revenue_cents"),

    // 額外資訊
    termsAndConditions: text("terms_and_conditions"),
    notes: text("notes"),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, any>>()
      .default({}),

    // 時間戳記
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    partnershipIdx: index("idx_partnership_plans_partnership").on(
      table.partnershipId,
    ),
    restaurantIdx: index("idx_partnership_plans_restaurant").on(
      table.restaurantId,
    ),
    codeIdx: index("idx_partnership_plans_code").on(
      table.partnershipId,
      table.restaurantId,
      table.planCode,
    ),
    validPeriodIdx: index("idx_partnership_plans_valid_period").on(
      table.validFrom,
      table.validTo,
    ),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const partnershipPlansRelations = relations(
  partnershipPlans,
  ({ one, many }) => ({
    partnership: one(partnerships, {
      fields: [partnershipPlans.partnershipId],
      references: [partnerships.id],
    }),
    restaurant: one(restaurants, {
      fields: [partnershipPlans.restaurantId],
      references: [restaurants.id],
    }),
    usageLogs: many(partnershipUsageLogs),
    creator: one(users, {
      fields: [partnershipPlans.createdBy],
      references: [users.id],
    }),
  }),
);

// ================================================
// TYPE INFERENCE
// ================================================

export type PartnershipPlan = typeof partnershipPlans.$inferSelect;
export type NewPartnershipPlan = typeof partnershipPlans.$inferInsert;
