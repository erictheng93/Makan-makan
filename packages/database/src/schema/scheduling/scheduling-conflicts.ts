/**
 * Scheduling Conflicts Schema (排班衝突)
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";
import { schedulingRules } from "./scheduling-rules";

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

    // Resolution
    status: text("status", {
      enum: ["unresolved", "acknowledged", "resolved", "ignored"],
    })
      .notNull()
      .default("unresolved"),
    resolvedBy: integer("resolved_by").references(() => users.id),
    resolvedAt: integer("resolved_at_ms", { mode: "timestamp_ms" }),
    resolutionNotes: text("resolution_notes"),

    // Auto-detected
    detectedAt: integer("detected_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),

    // Audit
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    restaurantStatusIdx: index("idx_scheduling_conflicts_restaurant_status").on(
      table.restaurantId,
      table.status,
    ),
    detectedAtIdx: index("idx_scheduling_conflicts_detected_at_ms").on(
      table.detectedAt,
    ),
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
