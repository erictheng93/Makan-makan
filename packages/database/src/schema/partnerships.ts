/**
 * Partnership System Schema Definitions
 * 特約商店體系 - 資料庫 Schema 定義
 */

import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { users } from "./users";
import { customers } from "./customers";
import { orders } from "./orders";

// ================================================
// ENUMS & CONSTANTS
// ================================================

export const PARTNER_TYPES = {
  UNIVERSITY: "university",
  SCHOOL: "school",
  CORPORATION: "corporation",
  GOVERNMENT: "government",
  NGO: "ngo",
  OTHER: "other",
} as const;

export const VERIFICATION_METHODS = {
  MANUAL: "manual",
  EMAIL_DOMAIN: "email_domain",
  ID_CARD: "id_card",
  QR_CODE: "qr_code",
  API: "api",
} as const;

export const PARTNERSHIP_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  EXPIRED: "expired",
  TERMINATED: "terminated",
} as const;

export const MEMBER_TYPES = {
  STUDENT: "student",
  EMPLOYEE: "employee",
  FACULTY: "faculty",
  ALUMNI: "alumni",
  STAFF: "staff",
  OTHER: "other",
} as const;

export const MEMBER_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  EXPIRED: "expired",
  SUSPENDED: "suspended",
} as const;

export const PLAN_DISCOUNT_TYPES = {
  PERCENTAGE: "percentage",
  FIXED: "fixed",
  SPECIAL_PRICE: "special_price",
} as const;

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

export type PartnerType = (typeof PARTNER_TYPES)[keyof typeof PARTNER_TYPES];
export type VerificationMethod =
  (typeof VERIFICATION_METHODS)[keyof typeof VERIFICATION_METHODS];
export type PartnershipStatus =
  (typeof PARTNERSHIP_STATUS)[keyof typeof PARTNERSHIP_STATUS];
export type MemberType = (typeof MEMBER_TYPES)[keyof typeof MEMBER_TYPES];
export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];
export type PlanDiscountType =
  (typeof PLAN_DISCOUNT_TYPES)[keyof typeof PLAN_DISCOUNT_TYPES];
export type UsageLogStatus =
  (typeof USAGE_LOG_STATUS)[keyof typeof USAGE_LOG_STATUS];
export type UsageChannel = (typeof USAGE_CHANNELS)[keyof typeof USAGE_CHANNELS];

// ================================================
// TABLE: partnerships (合作夥伴表)
// ================================================

export const partnerships = sqliteTable(
  "partnerships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID().replace(/-/g, "")),

    // 機構基本資訊
    partnerCode: text("partner_code").notNull().unique(),
    partnerName: text("partner_name").notNull(),
    partnerNameEn: text("partner_name_en"),
    partnerType: text("partner_type").notNull().$type<PartnerType>(),

    // 聯絡資訊
    contactPerson: text("contact_person").notNull(),
    contactTitle: text("contact_title"),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email").notNull(),
    address: text("address"),

    // 合約資訊
    contractNumber: text("contract_number").unique(),
    contractStartDate: integer("contract_start_date_ms", {
      mode: "timestamp_ms",
    }).notNull(),
    contractEndDate: integer("contract_end_date_ms", {
      mode: "timestamp_ms",
    }).notNull(),
    contractDocumentUrl: text("contract_document_url"),

    // 認證設定
    verificationMethod: text("verification_method")
      .notNull()
      .default("manual")
      .$type<VerificationMethod>(),
    verificationConfig: text("verification_config", { mode: "json" })
      .$type<Record<string, any>>()
      .default({}),
    allowedEmailDomains: text("allowed_email_domains", { mode: "json" })
      .$type<string[]>()
      .default([]),

    // 優惠設定
    defaultDiscountType: text("default_discount_type").$type<
      "percentage" | "fixed"
    >(),
    defaultDiscountValue: real("default_discount_value"),

    // 統計資料
    totalVerifiedMembers: integer("total_verified_members").default(0),
    totalUsageCount: integer("total_usage_count").default(0),
    totalDiscountGiven: real("total_discount_given").default(0),
    totalRevenue: real("total_revenue").default(0),

    // 狀態控制
    status: text("status")
      .notNull()
      .default("draft")
      .$type<PartnershipStatus>(),
    isActive: integer("is_active", { mode: "boolean" }).default(true),

    // 額外資訊
    logoUrl: text("logo_url"),
    description: text("description"),
    notes: text("notes"),
    tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
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
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    codeIdx: index("idx_partnerships_code").on(table.partnerCode),
    typeIdx: index("idx_partnerships_type").on(table.partnerType),
    statusIdx: index("idx_partnerships_status").on(
      table.status,
      table.isActive,
    ),
    contractDatesIdx: index("idx_partnerships_contract_dates").on(
      table.contractStartDate,
      table.contractEndDate,
    ),
  }),
);

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
    discountValue: real("discount_value").notNull(),
    maxDiscountAmount: real("max_discount_amount"),

    // 使用條件
    minOrderAmount: real("min_order_amount").default(0),
    maxOrderAmount: real("max_order_amount"),
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
    totalDiscountGiven: real("total_discount_given").default(0),
    totalRevenue: real("total_revenue").default(0),

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
    createdBy: integer("created_by").references(() => users.id, {
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
// TABLE: verified_members (認證會員表)
// ================================================

export const verifiedMembers = sqliteTable(
  "verified_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID().replace(/-/g, "")),

    // 關聯資訊
    partnershipId: text("partnership_id")
      .notNull()
      .references(() => partnerships.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),

    // 會員基本資訊
    memberId: text("member_id").notNull(), // 學號/工號
    memberType: text("member_type").notNull().$type<MemberType>(),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),

    // 認證資訊
    verificationMethod: text("verification_method").notNull(),
    verificationDocumentUrl: text("verification_document_url"),
    verifiedAt: integer("verified_at_ms", { mode: "timestamp_ms" }),
    verifiedBy: integer("verified_by").references(() => users.id, {
      onDelete: "set null",
    }),
    verificationExpiry: integer("verification_expiry_ms", {
      mode: "timestamp_ms",
    }),

    // 狀態控制
    status: text("status").notNull().default("pending").$type<MemberStatus>(),
    rejectionReason: text("rejection_reason"),

    // 使用統計
    totalUsageCount: integer("total_usage_count").default(0),
    totalDiscountReceived: real("total_discount_received").default(0),
    totalSpending: real("total_spending").default(0),
    lastUsedAt: integer("last_used_at_ms", { mode: "timestamp_ms" }),

    // 額外資訊
    department: text("department"),
    gradeOrPosition: text("grade_or_position"),
    studentIdPhotoUrl: text("student_id_photo_url"),
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
  },
  (table) => ({
    partnershipIdx: index("idx_verified_members_partnership").on(
      table.partnershipId,
    ),
    customerIdx: index("idx_verified_members_customer").on(table.customerId),
    memberIdIdx: index("idx_verified_members_member_id").on(
      table.partnershipId,
      table.memberId,
    ),
    statusIdx: index("idx_verified_members_status").on(table.status),
    emailIdx: index("idx_verified_members_email").on(table.email),
  }),
);

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
    discountValue: real("discount_value").notNull(),
    discountAmount: real("discount_amount").notNull(),

    // 訂單資訊
    originalAmount: real("original_amount").notNull(),
    finalAmount: real("final_amount").notNull(),
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

export const partnershipsRelations = relations(
  partnerships,
  ({ many, one }) => ({
    plans: many(partnershipPlans),
    members: many(verifiedMembers),
    usageLogs: many(partnershipUsageLogs),
    creator: one(users, {
      fields: [partnerships.createdBy],
      references: [users.id],
    }),
  }),
);

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

export const verifiedMembersRelations = relations(
  verifiedMembers,
  ({ one, many }) => ({
    partnership: one(partnerships, {
      fields: [verifiedMembers.partnershipId],
      references: [partnerships.id],
    }),
    customer: one(customers, {
      fields: [verifiedMembers.customerId],
      references: [customers.id],
    }),
    verifier: one(users, {
      fields: [verifiedMembers.verifiedBy],
      references: [users.id],
    }),
    usageLogs: many(partnershipUsageLogs),
  }),
);

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

export type Partnership = typeof partnerships.$inferSelect;
export type NewPartnership = typeof partnerships.$inferInsert;
export type PartnershipPlan = typeof partnershipPlans.$inferSelect;
export type NewPartnershipPlan = typeof partnershipPlans.$inferInsert;
export type VerifiedMember = typeof verifiedMembers.$inferSelect;
export type NewVerifiedMember = typeof verifiedMembers.$inferInsert;
export type PartnershipUsageLog = typeof partnershipUsageLogs.$inferSelect;
export type NewPartnershipUsageLog = typeof partnershipUsageLogs.$inferInsert;
