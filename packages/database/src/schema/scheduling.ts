/**
 * Employee Scheduling Schema
 * Drizzle ORM schema definitions for employee work scheduling management
 */

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

// ========================================
// Shift Templates (班別模板)
// ========================================

export const shiftTemplates = sqliteTable(
  "shift_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)

    // Basic Information
    name: text("name").notNull(), // 早班, 午班, 晚班, 全日班
    description: text("description"),
    shiftType: text("shift_type", { enum: ["regular", "split", "overnight"] })
      .notNull()
      .default("regular"),

    // Time Settings
    startTime: text("start_time").notNull(), // HH:MM format
    endTime: text("end_time").notNull(), // HH:MM format
    durationMinutes: integer("duration_minutes").notNull(),

    // Split Shift Support
    isSplitShift: integer("is_split_shift", { mode: "boolean" })
      .notNull()
      .default(false),

    // Break Time
    breakStartTime: text("break_start_time"),
    breakEndTime: text("break_end_time"),
    breakDurationMinutes: integer("break_duration_minutes").default(0),

    // Applicable Days (JSON array of day numbers 0-6, 0=Sunday)
    applicableDays: text("applicable_days").default("[]"),

    // Staffing Limits
    minEmployees: integer("min_employees").default(1),
    maxEmployees: integer("max_employees").default(10),

    // Compensation
    hourlyRate: real("hourly_rate"),
    overtimeMultiplier: real("overtime_multiplier").default(1.5),

    // Visual Settings
    colorCode: text("color_code").default("#3B82F6"),
    icon: text("icon"),
    sortOrder: integer("sort_order").default(0),

    // Status
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    // Audit (legacy - seconds)
    createdBy: integer("created_by").references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),

    // Audit (milliseconds - new standard)
    createdAtMs: integer("created_at_ms", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date(),
    ),
    updatedAtMs: integer("updated_at_ms", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    restaurantActiveIdx: index("idx_shift_templates_restaurant_active").on(
      table.restaurantId,
      table.isActive,
    ),
  }),
);

// ========================================
// Employee Schedules (員工排班)
// ========================================

export const employeeSchedules = sqliteTable(
  "employee_schedules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)
    employeeId: integer("employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shiftTemplateId: integer("shift_template_id").references(
      () => shiftTemplates.id,
      { onDelete: "set null" },
    ),

    // Schedule Date & Time
    workDate: text("work_date").notNull(), // YYYY-MM-DD format
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    breakDurationMinutes: integer("break_duration_minutes").default(0),

    // Clock In/Out (Actual times) (legacy - seconds)
    clockInTime: integer("clock_in_time", { mode: "timestamp" }),
    clockOutTime: integer("clock_out_time", { mode: "timestamp" }),

    // Clock In/Out (milliseconds - new standard)
    clockInTimeMs: integer("clock_in_time_ms", { mode: "timestamp_ms" }),
    clockOutTimeMs: integer("clock_out_time_ms", { mode: "timestamp_ms" }),

    // Hours Tracking
    scheduledHours: real("scheduled_hours").notNull(),
    actualHours: real("actual_hours").default(0),
    overtimeHours: real("overtime_hours").default(0),

    // Status
    status: text("status", {
      enum: ["scheduled", "confirmed", "completed", "cancelled", "no_show"],
    })
      .notNull()
      .default("scheduled"),

    // Notes
    notes: text("notes"),
    managerNotes: text("manager_notes"),

    // Confirmation (legacy - seconds)
    confirmedBy: integer("confirmed_by").references(() => users.id),
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),

    // Audit (legacy - seconds)
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),

    // Confirmation (milliseconds - new standard)
    confirmedAtMs: integer("confirmed_at_ms", { mode: "timestamp_ms" }),

    // Audit (milliseconds - new standard)
    createdAtMs: integer("created_at_ms", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date(),
    ),
    updatedAtMs: integer("updated_at_ms", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    restaurantDateIdx: index("idx_employee_schedules_restaurant_date").on(
      table.restaurantId,
      table.workDate,
    ),
    employeeDateIdx: index("idx_employee_schedules_employee_date").on(
      table.employeeId,
      table.workDate,
    ),
    statusDateIdx: index("idx_employee_schedules_status_date").on(
      table.status,
      table.workDate,
    ),
  }),
);

// ========================================
// Scheduling Rules (排班規則)
// ========================================

export const schedulingRules = sqliteTable(
  "scheduling_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)

    // Rule Definition
    name: text("name").notNull(),
    description: text("description"),
    ruleType: text("rule_type", {
      enum: [
        "max_hours_per_day",
        "max_hours_per_week",
        "min_rest_period",
        "max_consecutive_days",
        "skill_requirement",
        "custom",
      ],
    }).notNull(),

    // Rule Configuration (JSON)
    ruleConfig: text("rule_config").notNull(), // JSON object with rule-specific parameters

    // Applicability
    appliesToRoles: text("applies_to_roles"), // JSON array of role IDs
    appliesToEmployees: text("applies_to_employees"), // JSON array of employee IDs

    // Priority & Severity
    priority: integer("priority").default(0), // Higher number = higher priority
    severity: text("severity", { enum: ["error", "warning", "info"] })
      .notNull()
      .default("warning"),

    // System Rule Flag
    isSystemRule: integer("is_system_rule", { mode: "boolean" })
      .notNull()
      .default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    // Audit (legacy - seconds)
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),

    // Audit (milliseconds - new standard)
    createdAtMs: integer("created_at_ms", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date(),
    ),
    updatedAtMs: integer("updated_at_ms", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    restaurantTypeActiveIdx: index(
      "idx_scheduling_rules_restaurant_type_active",
    ).on(table.restaurantId, table.ruleType, table.isActive),
  }),
);

// ========================================
// Scheduling Conflicts (排班衝突)
// ========================================

export const schedulingConflicts = sqliteTable(
  "scheduling_conflicts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)

    // Conflict Details
    conflictType: text("conflict_type", {
      enum: [
        "overlapping_shifts",
        "insufficient_rest",
        "max_hours_exceeded",
        "consecutive_days_exceeded",
        "skill_mismatch",
        "leave_conflict",
        "availability_conflict",
      ],
    }).notNull(),

    severity: text("severity", {
      enum: ["error", "warning", "info"],
    }).notNull(),

    // Related Records
    scheduleIds: text("schedule_ids").notNull(), // JSON array of affected schedule IDs
    employeeIds: text("employee_ids").notNull(), // JSON array of affected employee IDs
    ruleId: integer("rule_id").references(() => schedulingRules.id, {
      onDelete: "set null",
    }),

    // Conflict Message
    message: text("message").notNull(),
    details: text("details"), // JSON object with conflict details

    // Resolution (legacy - seconds)
    status: text("status", {
      enum: ["unresolved", "acknowledged", "resolved", "ignored"],
    })
      .notNull()
      .default("unresolved"),
    resolvedBy: integer("resolved_by").references(() => users.id),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolutionNotes: text("resolution_notes"),

    // Auto-detected (legacy - seconds)
    detectedAt: integer("detected_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),

    // Resolution (milliseconds - new standard)
    resolvedAtMs: integer("resolved_at_ms", { mode: "timestamp_ms" }),

    // Auto-detected (milliseconds - new standard)
    detectedAtMs: integer("detected_at_ms", {
      mode: "timestamp_ms",
    }).$defaultFn(() => new Date()),
    createdAtMs: integer("created_at_ms", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date(),
    ),
    updatedAtMs: integer("updated_at_ms", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    restaurantStatusIdx: index("idx_scheduling_conflicts_restaurant_status").on(
      table.restaurantId,
      table.status,
    ),
    detectedAtIdx: index("idx_scheduling_conflicts_detected_at").on(
      table.detectedAt,
    ),
  }),
);

// ========================================
// Schedule Swap Requests (換班請求)
// ========================================

export const scheduleSwapRequests = sqliteTable(
  "schedule_swap_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)

    // Requester Information
    requesterEmployeeId: integer("requester_employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requesterScheduleId: integer("requester_schedule_id")
      .notNull()
      .references(() => employeeSchedules.id, { onDelete: "cascade" }),

    // Target Information
    targetEmployeeId: integer("target_employee_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    targetScheduleId: integer("target_schedule_id").references(
      () => employeeSchedules.id,
      { onDelete: "cascade" },
    ),

    // Request Type
    requestType: text("request_type", {
      enum: ["swap", "cover", "drop"],
    }).notNull(),
    // swap: Exchange shifts with another employee
    // cover: Request someone to cover this shift (no exchange)
    // drop: Request to drop shift without replacement

    // Request Details
    reason: text("reason").notNull(),
    urgency: text("urgency", {
      enum: ["low", "normal", "high", "urgent"],
    }).default("normal"),

    // Open Request (broadcast to all eligible employees)
    isOpenRequest: integer("is_open_request", { mode: "boolean" }).default(
      false,
    ),

    // Approval Workflow
    status: text("status", {
      enum: [
        "pending",
        "accepted",
        "approved",
        "rejected",
        "cancelled",
        "expired",
      ],
    })
      .notNull()
      .default("pending"),

    // Approval Workflow (legacy - seconds)
    acceptedBy: integer("accepted_by").references(() => users.id), // Employee who accepts (for open requests)
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),

    approvedBy: integer("approved_by").references(() => users.id), // Manager approval
    approvedAt: integer("approved_at", { mode: "timestamp" }),

    rejectedBy: integer("rejected_by").references(() => users.id),
    rejectedAt: integer("rejected_at", { mode: "timestamp" }),
    rejectionReason: text("rejection_reason"),

    // Expiration (legacy - seconds)
    expiresAt: integer("expires_at", { mode: "timestamp" }),

    // Audit (legacy - seconds)
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),

    // Approval Workflow (milliseconds - new standard)
    acceptedAtMs: integer("accepted_at_ms", { mode: "timestamp_ms" }),
    approvedAtMs: integer("approved_at_ms", { mode: "timestamp_ms" }),
    rejectedAtMs: integer("rejected_at_ms", { mode: "timestamp_ms" }),

    // Expiration (milliseconds - new standard)
    expiresAtMs: integer("expires_at_ms", { mode: "timestamp_ms" }),

    // Audit (milliseconds - new standard)
    createdAtMs: integer("created_at_ms", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date(),
    ),
    updatedAtMs: integer("updated_at_ms", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    restaurantStatusIdx: index(
      "idx_schedule_swap_requests_restaurant_status",
    ).on(table.restaurantId, table.status),
    requesterStatusIdx: index("idx_schedule_swap_requests_requester_status").on(
      table.requesterEmployeeId,
      table.status,
    ),
  }),
);

// ========================================
// Employee Availability (員工可用時間)
// ========================================

export const employeeAvailability = sqliteTable(
  "employee_availability",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)
    employeeId: integer("employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Time Pattern (either recurring or specific dates)
    availabilityType: text("availability_type", {
      enum: ["recurring", "specific_date"],
    }).notNull(),

    // Recurring Pattern
    dayOfWeek: integer("day_of_week"), // 0-6, 0=Sunday (for recurring)
    startTime: text("start_time"),
    endTime: text("end_time"),

    // Specific Date Range
    startDate: text("start_date"), // YYYY-MM-DD
    endDate: text("end_date"), // YYYY-MM-DD

    // Preference
    preferenceType: text("preference_type", {
      enum: ["preferred", "available", "unavailable"],
    }).notNull(),

    // Priority
    priority: integer("priority").default(0),

    // Notes
    notes: text("notes"),

    // Status
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    // Audit (legacy - seconds)
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$onUpdate(() => new Date()),

    // Audit (milliseconds - new standard)
    createdAtMs: integer("created_at_ms", { mode: "timestamp_ms" }).$defaultFn(
      () => new Date(),
    ),
    updatedAtMs: integer("updated_at_ms", { mode: "timestamp_ms" }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => ({
    restaurantEmployeeIdx: index(
      "idx_employee_availability_restaurant_employee",
    ).on(table.restaurantId, table.employeeId),
    dayPreferenceIdx: index("idx_employee_availability_day_preference").on(
      table.dayOfWeek,
      table.preferenceType,
    ),
  }),
);

// ========================================
// Relations
// ========================================

export const shiftTemplatesRelations = relations(
  shiftTemplates,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [shiftTemplates.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    creator: one(users, {
      fields: [shiftTemplates.createdBy],
      references: [users.id],
      relationName: "createdShiftTemplates",
    }),
    schedules: many(employeeSchedules),
  }),
);

export const employeeSchedulesRelations = relations(
  employeeSchedules,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [employeeSchedules.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    employee: one(users, {
      fields: [employeeSchedules.employeeId],
      references: [users.id],
      relationName: "employeeSchedules",
    }),
    shiftTemplate: one(shiftTemplates, {
      fields: [employeeSchedules.shiftTemplateId],
      references: [shiftTemplates.id],
    }),
    creator: one(users, {
      fields: [employeeSchedules.createdBy],
      references: [users.id],
      relationName: "createdSchedules",
    }),
    confirmer: one(users, {
      fields: [employeeSchedules.confirmedBy],
      references: [users.id],
      relationName: "confirmedSchedules",
    }),
  }),
);

export const schedulingRulesRelations = relations(
  schedulingRules,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [schedulingRules.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    creator: one(users, {
      fields: [schedulingRules.createdBy],
      references: [users.id],
      relationName: "createdRules",
    }),
    conflicts: many(schedulingConflicts),
  }),
);

export const schedulingConflictsRelations = relations(
  schedulingConflicts,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [schedulingConflicts.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    rule: one(schedulingRules, {
      fields: [schedulingConflicts.ruleId],
      references: [schedulingRules.id],
    }),
    resolver: one(users, {
      fields: [schedulingConflicts.resolvedBy],
      references: [users.id],
      relationName: "resolvedConflicts",
    }),
  }),
);

export const scheduleSwapRequestsRelations = relations(
  scheduleSwapRequests,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [scheduleSwapRequests.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    requesterEmployee: one(users, {
      fields: [scheduleSwapRequests.requesterEmployeeId],
      references: [users.id],
      relationName: "requestedSwaps",
    }),
    targetEmployee: one(users, {
      fields: [scheduleSwapRequests.targetEmployeeId],
      references: [users.id],
      relationName: "targetedSwaps",
    }),
    requesterSchedule: one(employeeSchedules, {
      fields: [scheduleSwapRequests.requesterScheduleId],
      references: [employeeSchedules.id],
      relationName: "swapRequesterSchedule",
    }),
    targetSchedule: one(employeeSchedules, {
      fields: [scheduleSwapRequests.targetScheduleId],
      references: [employeeSchedules.id],
      relationName: "swapTargetSchedule",
    }),
    accepter: one(users, {
      fields: [scheduleSwapRequests.acceptedBy],
      references: [users.id],
      relationName: "acceptedSwaps",
    }),
    approver: one(users, {
      fields: [scheduleSwapRequests.approvedBy],
      references: [users.id],
      relationName: "approvedSwaps",
    }),
    rejector: one(users, {
      fields: [scheduleSwapRequests.rejectedBy],
      references: [users.id],
      relationName: "rejectedSwaps",
    }),
  }),
);

export const employeeAvailabilityRelations = relations(
  employeeAvailability,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [employeeAvailability.restaurantId],
      references: [restaurants.id], // UUID v7 primary key,
    }),
    employee: one(users, {
      fields: [employeeAvailability.employeeId],
      references: [users.id],
      relationName: "availability",
    }),
  }),
);
