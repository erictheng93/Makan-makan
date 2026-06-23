/**
 * Employee Availability Schema (員工可用時間)
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";

// ========================================
// Employee Availability (員工可用時間)
// ========================================

export const employeeAvailability = sqliteTable(
  "employee_availability",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.id (UUID v7)
    employeeId: text("employee_id")
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

    // Audit
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
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
