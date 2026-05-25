import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { tables } from "./tables";
import { customers } from "./customers";

// ── Status Constants ───────────────────────────────────

export const RESERVATION_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  ARRIVED: "arrived",
  SEATED: "seated",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

export type ReservationStatus =
  (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];

// ── Reservations Table ─────────────────────────────────
// Column names match ReservationService.ts raw SQL exactly

export const reservations = sqliteTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    partySize: integer("party_size").notNull(),
    reservationDate: text("reservation_date").notNull(), // YYYY-MM-DD
    reservationTime: text("reservation_time").notNull(), // HH:MM
    durationMinutes: integer("duration_minutes").notNull().default(90),
    tableId: integer("table_id"),
    specialRequests: text("special_requests"),
    status: text("status").notNull().default(RESERVATION_STATUS.PENDING),
    confirmationCode: text("confirmation_code").notNull(),
    notes: text("notes"),

    // Status timestamps (raw integer ms — matches service's Date.now())
    confirmedAt: integer("confirmed_at"),
    remindedAt: integer("reminded_at"),
    arrivedAt: integer("arrived_at"),
    seatedAt: integer("seated_at"),
    completedAt: integer("completed_at"),
    cancelledAt: integer("cancelled_at"),
    noShowAt: integer("no_show_at"),

    // Record timestamps
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    restaurantStatusDateIdx: index(
      "reservations_restaurant_status_date_idx",
    ).on(table.restaurantId, table.status, table.reservationDate),
    restaurantDateTimeIdx: index("reservations_restaurant_date_time_idx").on(
      table.restaurantId,
      table.reservationDate,
      table.reservationTime,
    ),
    confirmationCodeIdx: uniqueIndex("reservations_confirmation_code_idx").on(
      table.confirmationCode,
    ),
    customerPhoneIdx: index("reservations_customer_phone_idx").on(
      table.customerPhone,
    ),
    tableIdx: index("reservations_table_idx").on(table.tableId),
  }),
);

export const reservationRelations = relations(reservations, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [reservations.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, {
    fields: [reservations.tableId],
    references: [tables.id],
  }),
  customer: one(customers, {
    fields: [reservations.customerId],
    references: [customers.id],
  }),
}));

// ── Reservation Slots Table ────────────────────────────

export const reservationSlots = sqliteTable(
  "reservation_slots",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    timeSlot: text("time_slot").notNull(), // HH:MM
    maxCapacity: integer("max_capacity").notNull(),
    maxTables: integer("max_tables").notNull(),
    currentReservations: integer("current_reservations").notNull().default(0),
    currentCapacity: integer("current_capacity").notNull().default(0),
    isAvailable: integer("is_available").notNull().default(1),
    blockReason: text("block_reason"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    restaurantDateSlotIdx: uniqueIndex("slots_restaurant_date_slot_idx").on(
      table.restaurantId,
      table.date,
      table.timeSlot,
    ),
    restaurantDateAvailIdx: index("slots_restaurant_date_avail_idx").on(
      table.restaurantId,
      table.date,
      table.isAvailable,
    ),
  }),
);

export const reservationSlotRelations = relations(
  reservationSlots,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [reservationSlots.restaurantId],
      references: [restaurants.id],
    }),
  }),
);

// ── Type Exports ───────────────────────────────────────

export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type ReservationSlot = typeof reservationSlots.$inferSelect;
export type NewReservationSlot = typeof reservationSlots.$inferInsert;
