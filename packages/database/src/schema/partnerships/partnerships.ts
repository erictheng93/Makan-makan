/**
 * Partnership Table & Relations
 * 合作夥伴表
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { users } from "../users";
import { partnershipPlans } from "./plans";
import { verifiedMembers } from "./members";
import { partnershipUsageLogs } from "./usage-logs";

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

// ================================================
// TYPE EXPORTS
// ================================================

export type PartnerType = (typeof PARTNER_TYPES)[keyof typeof PARTNER_TYPES];
export type VerificationMethod =
  (typeof VERIFICATION_METHODS)[keyof typeof VERIFICATION_METHODS];
export type PartnershipStatus =
  (typeof PARTNERSHIP_STATUS)[keyof typeof PARTNERSHIP_STATUS];

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
    defaultDiscountPercentageBps: integer("default_discount_percentage_bps"),
    defaultDiscountValueCents: integer("default_discount_value_cents"),

    // 統計資料
    totalVerifiedMembers: integer("total_verified_members").default(0),
    totalUsageCount: integer("total_usage_count").default(0),
    totalDiscountGivenCents: integer("total_discount_given_cents"),
    totalRevenueCents: integer("total_revenue_cents"),

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
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => users.id, {
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

// ================================================
// TYPE INFERENCE
// ================================================

export type Partnership = typeof partnerships.$inferSelect;
export type NewPartnership = typeof partnerships.$inferInsert;
