import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { tables } from "./tables";
import { customers } from "./customers";

// ── Status Constants ───────────────────────────────────

export const WAITING_STATUS = {
  WAITING: "waiting",
  CALLED: "called",
  CONFIRMED: "confirmed",
  SEATED: "seated",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  NO_SHOW: "no_show",
} as const;

export type WaitingStatus =
  (typeof WAITING_STATUS)[keyof typeof WAITING_STATUS];

// ── Waiting List Table ─────────────────────────────────
// Column names match WaitingListService.ts raw SQL exactly

export const waitingList = sqliteTable(
  "waiting_list",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    partySize: integer("party_size").notNull(),
    preferredTableType: text("preferred_table_type"),
    queueNumber: integer("queue_number").notNull(),
    queueLetter: text("queue_letter"),
    queueDate: text("queue_date"),
    priority: integer("priority").notNull().default(0),
    estimatedWaitMinutes: integer("estimated_wait_minutes"),
    tableId: integer("table_id"),
    status: text("status").notNull().default(WAITING_STATUS.WAITING),
    notes: text("notes"),

    // Status timestamps (raw integer ms)
    calledAt: integer("called_at"),
    notifiedAt: integer("notified_at"),
    confirmedAt: integer("confirmed_at"),
    seatedAt: integer("seated_at"),
    cancelledAt: integer("cancelled_at"),
    expiredAt: integer("expired_at"),
    timeoutAt: integer("timeout_at"),

    // Record timestamps
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    restaurantStatusIdx: index("waiting_restaurant_status_idx").on(
      table.restaurantId,
      table.status,
      table.createdAt,
    ),
    restaurantQueueIdx: index("waiting_restaurant_queue_idx").on(
      table.restaurantId,
      table.queueLetter,
      table.queueNumber,
    ),
    uniqueQueueNumberPerDayIdx: uniqueIndex(
      "waiting_unique_queue_number_per_day_idx",
    ).on(
      table.restaurantId,
      table.queueDate,
      table.queueLetter,
      table.queueNumber,
    ),
    customerPhoneActiveIdx: index("waiting_customer_phone_active_idx").on(
      table.restaurantId,
      table.customerPhone,
      table.queueDate,
      table.status,
    ),
    customerPhoneIdx: index("waiting_customer_phone_idx").on(
      table.customerPhone,
    ),
  }),
);

export const waitingListRelations = relations(waitingList, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [waitingList.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, {
    fields: [waitingList.tableId],
    references: [tables.id],
  }),
  customer: one(customers, {
    fields: [waitingList.customerId],
    references: [customers.id],
  }),
}));

export type WaitingListEntry = typeof waitingList.$inferSelect;
export type NewWaitingListEntry = typeof waitingList.$inferInsert;
