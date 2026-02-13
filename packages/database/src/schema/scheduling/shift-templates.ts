/**
 * Shift Templates Schema (班別模板)
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
import { employeeSchedules } from "./employee-schedules";

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

    // Audit
    createdBy: integer("created_by").references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    restaurantActiveIdx: index("idx_shift_templates_restaurant_active").on(
      table.restaurantId,
      table.isActive,
    ),
  }),
);

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
