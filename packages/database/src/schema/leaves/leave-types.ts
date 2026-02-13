/**
 * Leave Types Schema (假別類型)
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";
import { employeeLeaveBalances } from "./leave-balances";
import { leaveRequests } from "./leave-requests";
import { leaveApprovalRules } from "./leave-approval-rules";

// ========================================
// Leave Types (假別類型)
// ========================================

export const leaveTypes = sqliteTable(
  "leave_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id"), // 引用 restaurants.id (UUID v7), nullable for system-wide types

    // Basic Information
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),

    // Accrual Rules (計算規則)
    accrualType: text("accrual_type", { enum: ["yearly", "monthly", "none"] })
      .notNull()
      .default("yearly"),
    accrualAmount: real("accrual_amount").notNull().default(0),
    accrualBasedOnSeniority: integer("accrual_based_on_seniority", {
      mode: "boolean",
    })
      .notNull()
      .default(false),

    // Usage Rules (使用規則)
    requiresApproval: integer("requires_approval", { mode: "boolean" })
      .notNull()
      .default(true),
    requiredApprovalLevels: integer("required_approval_levels")
      .notNull()
      .default(1),
    minNoticeDays: integer("min_notice_days").notNull().default(0),
    maxConsecutiveDays: integer("max_consecutive_days"),
    canCarryover: integer("can_carryover", { mode: "boolean" })
      .notNull()
      .default(false),
    carryoverMaxDays: real("carryover_max_days"),
    carryoverExpiryMonths: integer("carryover_expiry_months"),

    // Documentation & Payment (文件與給付)
    requiresDocumentation: integer("requires_documentation", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    documentationRequiredAfterDays: integer(
      "documentation_required_after_days",
    ),
    isPaid: integer("is_paid", { mode: "boolean" }).notNull().default(true),
    paymentRate: real("payment_rate").notNull().default(1.0), // 0.0 to 1.0

    // Restrictions (限制條件)
    allowHalfDay: integer("allow_half_day", { mode: "boolean" })
      .notNull()
      .default(true),
    gender: text("gender", { enum: ["any", "male", "female"] }),
    applicableToRoles: text("applicable_to_roles"), // JSON array
    maxUsagePerYear: real("max_usage_per_year"),

    // System Fields
    isSystemDefined: integer("is_system_defined", { mode: "boolean" })
      .notNull()
      .default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    color: text("color"),
    icon: text("icon"),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: integer("created_by").references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
  },
  (table) => ({
    restaurantCodeIdx: index("idx_leave_types_restaurant_code").on(
      table.restaurantId,
      table.code,
    ),
    restaurantActiveIdx: index("idx_leave_types_restaurant_active").on(
      table.restaurantId,
      table.isActive,
    ),
  }),
);

export const leaveTypesRelations = relations(leaveTypes, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [leaveTypes.restaurantId],
    references: [restaurants.id], // UUID v7 primary key,
  }),
  creator: one(users, {
    fields: [leaveTypes.createdBy],
    references: [users.id],
    relationName: "createdLeaveTypes",
  }),
  balances: many(employeeLeaveBalances),
  requests: many(leaveRequests),
  approvalRules: many(leaveApprovalRules),
}));
