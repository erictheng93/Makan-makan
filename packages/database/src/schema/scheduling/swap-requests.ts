/**
 * Schedule Swap Requests Schema (換班請求)
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";
import { employeeSchedules } from "./employee-schedules";

// ========================================
// Schedule Swap Requests (換班請求)
// ========================================

export const scheduleSwapRequests = sqliteTable(
  "schedule_swap_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)

    // Requester Information
    requesterEmployeeId: text("requester_employee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requesterScheduleId: integer("requester_schedule_id")
      .notNull()
      .references(() => employeeSchedules.id, { onDelete: "cascade" }),

    // Target Information
    targetEmployeeId: text("target_employee_id").references(() => users.id, {
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

    // Approval Workflow
    acceptedBy: text("accepted_by").references(() => users.id), // Employee who accepts (for open requests)
    acceptedAt: integer("accepted_at_ms", { mode: "timestamp_ms" }),

    approvedBy: text("approved_by").references(() => users.id), // Manager approval
    approvedAt: integer("approved_at_ms", { mode: "timestamp_ms" }),

    rejectedBy: text("rejected_by").references(() => users.id),
    rejectedAt: integer("rejected_at_ms", { mode: "timestamp_ms" }),
    rejectionReason: text("rejection_reason"),

    // Expiration
    expiresAt: integer("expires_at_ms", { mode: "timestamp_ms" }),

    // Audit
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
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
