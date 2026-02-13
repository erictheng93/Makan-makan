/**
 * Employee Leave Balances Schema (員工假期餘額)
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
    carryoverExpiresAt: integer("carryover_expires_at_ms", {
      mode: "timestamp_ms",
    }),

    // Manual Adjustments (手動調整)
    manualAdjustment: real("manual_adjustment").default(0),
    adjustmentReason: text("adjustment_reason"),
    adjustedBy: integer("adjusted_by").references(() => users.id),
    adjustedAt: integer("adjusted_at_ms", { mode: "timestamp_ms" }),

    // Metadata
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
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
