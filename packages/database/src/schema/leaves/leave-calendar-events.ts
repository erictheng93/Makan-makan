/**
 * Leave Calendar Events Schema (假期行事曆)
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "../restaurants";
import { users } from "../users";

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
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    createdBy: text("created_by").references(() => users.id),
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
