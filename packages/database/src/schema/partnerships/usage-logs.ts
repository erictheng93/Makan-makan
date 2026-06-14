/**
 * Partnership Usage Logs Table & Relations
 * 特約使用記錄表
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";
import { orders } from "../orders";
import { partnerships } from "./partnerships";
import { partnershipPlans } from "./plans";
import { verifiedMembers } from "./members";

// ================================================
// ENUMS & CONSTANTS
// ================================================

export const USAGE_LOG_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

export const USAGE_CHANNELS = {
  DINE_IN: "dine_in",
  TAKEAWAY: "takeaway",
  DELIVERY: "delivery",
  ONLINE: "online",
} as const;

// ================================================
// TYPE EXPORTS
// ================================================

export type UsageLogStatus =
  (typeof USAGE_LOG_STATUS)[keyof typeof USAGE_LOG_STATUS];
export type UsageChannel = (typeof USAGE_CHANNELS)[keyof typeof USAGE_CHANNELS];

// ================================================
// TABLE: partnership_usage_logs (特約使用記錄表)
// ================================================

export const partnershipUsageLogs = sqliteTable(
  "partnership_usage_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID().replace(/-/g, "")),

    // 關聯資訊
    partnershipId: text("partnership_id")
      .notNull()
      .references(() => partnerships.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => partnershipPlans.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => verifiedMembers.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.public_id (TEXT)

    // 折扣資訊
    discountType: text("discount_type").notNull(),
    discountPercentageBps: integer("discount_percentage_bps"),
    discountValueCents: integer("discount_value_cents"),
    discountAmountCents: integer("discount_amount_cents"),

    // 訂單資訊
    originalAmountCents: integer("original_amount_cents"),
    finalAmountCents: integer("final_amount_cents"),
    orderItems: text("order_items", { mode: "json" })
      .$type<any[]>()
      .default([]),

    // 使用資訊
    usedAt: integer("used_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    channel: text("channel").$type<UsageChannel>(),

    // 驗證資訊
    verificationMethod: text("verification_method"),
    verifiedByUserId: integer("verified_by_user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      },
    ),

    // 狀態
    status: text("status")
      .notNull()
      .default("completed")
      .$type<UsageLogStatus>(),
    cancelledAt: integer("cancelled_at_ms", { mode: "timestamp_ms" }),
    cancellationReason: text("cancellation_reason"),
    refundedAt: integer("refunded_at_ms", { mode: "timestamp_ms" }),

    // 額外資訊
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, any>>()
      .default({}),

    // 時間戳記
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    partnershipIdx: index("idx_partnership_usage_logs_partnership").on(
      table.partnershipId,
    ),
    planIdx: index("idx_partnership_usage_logs_plan").on(table.planId),
    memberIdx: index("idx_partnership_usage_logs_member").on(table.memberId),
    orderIdx: index("idx_partnership_usage_logs_order").on(table.orderId),
    restaurantIdx: index("idx_partnership_usage_logs_restaurant").on(
      table.restaurantId,
    ),
    dateIdx: index("idx_partnership_usage_logs_date").on(table.usedAt),
    statusIdx: index("idx_partnership_usage_logs_status").on(table.status),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const partnershipUsageLogsRelations = relations(
  partnershipUsageLogs,
  ({ one }) => ({
    partnership: one(partnerships, {
      fields: [partnershipUsageLogs.partnershipId],
      references: [partnerships.id],
    }),
    plan: one(partnershipPlans, {
      fields: [partnershipUsageLogs.planId],
      references: [partnershipPlans.id],
    }),
    member: one(verifiedMembers, {
      fields: [partnershipUsageLogs.memberId],
      references: [verifiedMembers.id],
    }),
    order: one(orders, {
      fields: [partnershipUsageLogs.orderId],
      references: [orders.id],
    }),
    restaurant: one(restaurants, {
      fields: [partnershipUsageLogs.restaurantId],
      references: [restaurants.id],
    }),
    verifiedBy: one(users, {
      fields: [partnershipUsageLogs.verifiedByUserId],
      references: [users.id],
    }),
  }),
);

// ================================================
// TYPE INFERENCE
// ================================================

export type PartnershipUsageLog = typeof partnershipUsageLogs.$inferSelect;
export type NewPartnershipUsageLog = typeof partnershipUsageLogs.$inferInsert;
