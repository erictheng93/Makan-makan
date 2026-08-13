/**
 * Verified Members Table & Relations
 * 認證會員表
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { customers } from "../customers";
import { users } from "../users";
import { partnerships } from "./partnerships";
import { partnershipUsageLogs } from "./usage-logs";
import { v7 as uuidv7 } from "uuid";

// ================================================
// ENUMS & CONSTANTS
// ================================================

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

// ================================================
// TYPE EXPORTS
// ================================================

export type MemberType = (typeof MEMBER_TYPES)[keyof typeof MEMBER_TYPES];
export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

// ================================================
// TABLE: verified_members (認證會員表)
// ================================================

export const verifiedMembers = sqliteTable(
  "verified_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7().replace(/-/g, "")),

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
    verifiedBy: text("verified_by").references(() => users.id, {
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
    totalDiscountReceivedCents: integer("total_discount_received_cents"),
    totalSpendingCents: integer("total_spending_cents"),
    lastUsedAt: integer("last_used_at_ms", { mode: "timestamp_ms" }),

    // 額外資訊
    department: text("department"),
    gradeOrPosition: text("grade_or_position"),
    studentIdPhotoUrl: text("student_id_photo_url"),
    notes: text("notes"),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),

    // 時間戳記
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
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
// RELATIONS
// ================================================

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

// ================================================
// TYPE INFERENCE
// ================================================

export type VerifiedMember = typeof verifiedMembers.$inferSelect;
export type NewVerifiedMember = typeof verifiedMembers.$inferInsert;
