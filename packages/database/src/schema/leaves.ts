/**
 * Leave Management Schema
 * Drizzle ORM schema definitions for employee leave/time-off management
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { users } from "./users";

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
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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

// ========================================
// Employee Leave Balances (員工假期餘額)
// ========================================

export const employeeLeaveBalances = sqliteTable(
  "employee_leave_balances",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leaveTypeId: integer("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)
    year: integer("year").notNull(),

    // Balance Tracking (餘額追蹤)
    totalDays: real("total_days").notNull().default(0),
    usedDays: real("used_days").notNull().default(0),
    pendingDays: real("pending_days").notNull().default(0),
    // remainingDays is a VIRTUAL GENERATED column in SQL, calculated in application layer

    // Carryover Management (遞延管理)
    carryoverFromPrevious: real("carryover_from_previous").default(0),
    carryoverToNext: real("carryover_to_next").default(0),
    carryoverExpiresAt: integer("carryover_expires_at", { mode: "timestamp" }),

    // Manual Adjustments (手動調整)
    manualAdjustment: real("manual_adjustment").default(0),
    adjustmentReason: text("adjustment_reason"),
    adjustedBy: integer("adjusted_by").references(() => users.id),
    adjustedAt: integer("adjusted_at", { mode: "timestamp" }),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),
    lastUpdatedBy: integer("last_updated_by").references(() => users.id),
  },
  (table) => ({
    employeeYearIdx: index("idx_employee_leave_balances_employee_year").on(
      table.employeeId,
      table.year,
    ),
    restaurantYearTypeIdx: index(
      "idx_employee_leave_balances_restaurant_year_type",
    ).on(table.restaurantId, table.year, table.leaveTypeId),
  }),
);

// ========================================
// Leave Requests (請假申請)
// ========================================

export const leaveRequests = sqliteTable(
  "leave_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)
    employeeId: integer("employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leaveTypeId: integer("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "restrict" }),

    // Date & Duration (日期與時長)
    startDate: text("start_date").notNull(), // YYYY-MM-DD format
    endDate: text("end_date").notNull(), // YYYY-MM-DD format
    startPeriod: text("start_period", { enum: ["full", "am", "pm"] })
      .notNull()
      .default("full"),
    endPeriod: text("end_period", { enum: ["full", "am", "pm"] })
      .notNull()
      .default("full"),
    totalDays: real("total_days").notNull(), // Supports 0.5 for half days

    // Request Details (申請內容)
    reason: text("reason").notNull(),
    attachmentUrl: text("attachment_url"),
    emergencyContact: text("emergency_contact"),

    // Approval Workflow (審批流程)
    status: text("status", {
      enum: ["pending", "approved", "rejected", "cancelled", "withdrawn"],
    })
      .notNull()
      .default("pending"),
    approvalChain: text("approval_chain").notNull(), // JSON array of approval steps
    currentApprovalLevel: integer("current_approval_level")
      .notNull()
      .default(0),
    finalApproverId: integer("final_approver_id").references(() => users.id),
    finalApprovedAt: integer("final_approved_at", { mode: "timestamp" }),
    rejectedBy: integer("rejected_by").references(() => users.id),
    rejectedAt: integer("rejected_at", { mode: "timestamp" }),
    rejectionReason: text("rejection_reason"),

    // Cancellation (取消)
    cancelledBy: integer("cancelled_by").references(() => users.id),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    cancellationReason: text("cancellation_reason"),

    // Schedule Integration (排班整合)
    affectedScheduleIds: text("affected_schedule_ids"), // JSON array of schedule IDs
    replacementNotified: integer("replacement_notified", { mode: "boolean" })
      .notNull()
      .default(false),

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),
    submittedAt: integer("submitted_at", { mode: "timestamp" }),
  },
  (table) => ({
    restaurantStatusIdx: index("idx_leave_requests_restaurant_status").on(
      table.restaurantId,
      table.status,
    ),
    employeeDateIdx: index("idx_leave_requests_employee_date").on(
      table.employeeId,
      table.startDate,
    ),
    statusDateIdx: index("idx_leave_requests_status_date").on(
      table.status,
      table.startDate,
    ),
  }),
);

// ========================================
// Leave Approval Rules (審批規則)
// ========================================

export const leaveApprovalRules = sqliteTable(
  "leave_approval_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)
    leaveTypeId: integer("leave_type_id").references(() => leaveTypes.id, {
      onDelete: "cascade",
    }), // null for global rules

    // Rule Configuration (規則配置)
    name: text("name").notNull(),
    description: text("description"),
    approvalLevel: integer("approval_level").notNull(), // 1, 2, 3... for multi-level approval

    // Approvers (審批人)
    approverType: text("approver_type", {
      enum: ["role", "specific_user"],
    }).notNull(),
    approverRoleIds: text("approver_role_ids"), // JSON array
    approverUserIds: text("approver_user_ids"), // JSON array

    // Auto-approval (自動審批)
    enableAutoApproval: integer("enable_auto_approval", { mode: "boolean" })
      .notNull()
      .default(false),
    autoApprovalConditions: text("auto_approval_conditions"), // JSON object

    // Escalation (升級)
    enableAutoEscalation: integer("enable_auto_escalation", { mode: "boolean" })
      .notNull()
      .default(false),
    escalationTimeoutHours: integer("escalation_timeout_hours"),
    escalationToUserId: integer("escalation_to_user_id").references(
      () => users.id,
    ),

    // Rule Priority & Status
    priority: integer("priority").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
  },
  (table) => ({
    restaurantTypeIdx: index("idx_leave_approval_rules_restaurant_type").on(
      table.restaurantId,
      table.leaveTypeId,
    ),
    levelActiveIdx: index("idx_leave_approval_rules_level_active").on(
      table.approvalLevel,
      table.isActive,
    ),
  }),
);

// ========================================
// Leave Calendar Events (假期行事曆)
// ========================================

export const leaveCalendarEvents = sqliteTable(
  "leave_calendar_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id"), // 引用 restaurants.id (UUID v7), nullable for system-wide

    // Event Details (事件內容)
    name: text("name").notNull(),
    description: text("description"),
    eventType: text("event_type", {
      enum: ["public_holiday", "company_holiday", "special_event"],
    }).notNull(),
    eventDate: text("event_date").notNull(), // YYYY-MM-DD format

    // Recurrence (重複設定)
    isRecurring: integer("is_recurring", { mode: "boolean" })
      .notNull()
      .default(false),
    recurrencePattern: text("recurrence_pattern"), // JSON object

    // Work Day Settings (工作日設定)
    isWorkingDay: integer("is_working_day", { mode: "boolean" })
      .notNull()
      .default(false),
    compensatoryFor: text("compensatory_for"), // Date that this day compensates for

    // Metadata
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: integer("created_by").references(() => users.id),
    color: text("color"),
    icon: text("icon"),
  },
  (table) => ({
    restaurantDateIdx: index("idx_leave_calendar_events_restaurant_date").on(
      table.restaurantId,
      table.eventDate,
    ),
    eventTypeIdx: index("idx_leave_calendar_events_type").on(table.eventType),
  }),
);

// ========================================
// Relations
// ========================================

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

export const employeeLeaveBalancesRelations = relations(
  employeeLeaveBalances,
  ({ one }) => ({
    employee: one(users, {
      fields: [employeeLeaveBalances.employeeId],
      references: [users.id],
      relationName: "leaveBalances",
    }),
    leaveType: one(leaveTypes, {
      fields: [employeeLeaveBalances.leaveTypeId],
      references: [leaveTypes.id],
    }),
    restaurant: one(restaurants, {
      fields: [employeeLeaveBalances.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    adjuster: one(users, {
      fields: [employeeLeaveBalances.adjustedBy],
      references: [users.id],
      relationName: "balanceAdjustments",
    }),
  }),
);

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [leaveRequests.restaurantId],
    references: [restaurants.id], // UUID v7 primary key,
  }),
  employee: one(users, {
    fields: [leaveRequests.employeeId],
    references: [users.id],
    relationName: "leaveRequests",
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveRequests.leaveTypeId],
    references: [leaveTypes.id],
  }),
  finalApprover: one(users, {
    fields: [leaveRequests.finalApproverId],
    references: [users.id],
    relationName: "approvedLeaveRequests",
  }),
  rejector: one(users, {
    fields: [leaveRequests.rejectedBy],
    references: [users.id],
    relationName: "rejectedLeaveRequests",
  }),
  canceller: one(users, {
    fields: [leaveRequests.cancelledBy],
    references: [users.id],
    relationName: "cancelledLeaveRequests",
  }),
}));

export const leaveApprovalRulesRelations = relations(
  leaveApprovalRules,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [leaveApprovalRules.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    leaveType: one(leaveTypes, {
      fields: [leaveApprovalRules.leaveTypeId],
      references: [leaveTypes.id],
    }),
    creator: one(users, {
      fields: [leaveApprovalRules.createdBy],
      references: [users.id],
      relationName: "createdApprovalRules",
    }),
    escalationUser: one(users, {
      fields: [leaveApprovalRules.escalationToUserId],
      references: [users.id],
      relationName: "escalationTarget",
    }),
  }),
);

export const leaveCalendarEventsRelations = relations(
  leaveCalendarEvents,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [leaveCalendarEvents.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    creator: one(users, {
      fields: [leaveCalendarEvents.createdBy],
      references: [users.id],
      relationName: "createdCalendarEvents",
    }),
  }),
);
