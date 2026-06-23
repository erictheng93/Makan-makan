/**
 * Leave Approval Rules Schema (審批規則)
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";
import { leaveTypes } from "./leave-types";

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
    escalationToUserId: text("escalation_to_user_id").references(
      () => users.id,
    ),

    // Rule Priority & Status
    priority: integer("priority").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    // Timestamps
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
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
