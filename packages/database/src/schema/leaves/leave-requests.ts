/**
 * Leave Requests Schema (請假申請)
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
import { leaveTypes } from "./leave-types";

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
    finalApprovedAt: integer("final_approved_at_ms", { mode: "timestamp_ms" }),
    rejectedBy: integer("rejected_by").references(() => users.id),
    rejectedAt: integer("rejected_at_ms", { mode: "timestamp_ms" }),
    rejectionReason: text("rejection_reason"),

    // Cancellation (取消)
    cancelledBy: integer("cancelled_by").references(() => users.id),
    cancelledAt: integer("cancelled_at_ms", { mode: "timestamp_ms" }),
    cancellationReason: text("cancellation_reason"),

    // Schedule Integration (排班整合)
    affectedScheduleIds: text("affected_schedule_ids"), // JSON array of schedule IDs
    replacementNotified: integer("replacement_notified", { mode: "boolean" })
      .notNull()
      .default(false),

    // Metadata
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    submittedAt: integer("submitted_at_ms", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
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
