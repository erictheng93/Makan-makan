import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";
import { restaurants } from "./restaurants";
import { paymentTransactions } from "./payments";

export const PAYMENT_AUDIT_EVENT_TYPES = {
  ATTEMPT: "attempt",
  SUCCESS: "success",
  FAILURE: "failure",
  REFUND: "refund",
  WEBHOOK_RECEIVED: "webhook_received",
  CYCLE_CLOSE: "cycle_close",
  TRIAL_DOWNGRADE: "trial_downgrade",
  PLAN_CHANGE: "plan_change",
  GRACE_PERIOD_START: "grace_period_start",
  ACCOUNT_SUSPENDED: "account_suspended",
} as const;

export type PaymentAuditEventType =
  (typeof PAYMENT_AUDIT_EVENT_TYPES)[keyof typeof PAYMENT_AUDIT_EVENT_TYPES];

export const paymentAuditLog = sqliteTable(
  "payment_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    restaurantId: text("restaurant_id").references(() => restaurants.id),
    paymentTransactionId: text("payment_transaction_id"),
    subscriptionId: text("subscription_id"),

    eventType: text("event_type").notNull().$type<PaymentAuditEventType>(),
    provider: text("provider"),
    providerEventId: text("provider_event_id"),
    providerEventType: text("provider_event_type"),

    amount: integer("amount"),
    currency: text("currency"),

    rawPayload: text("raw_payload", { mode: "json" }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    occurredAt: integer("occurred_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    providerEventIdx: uniqueIndex("payment_audit_provider_event_idx")
      .on(table.provider, table.providerEventId)
      .where(sql`${table.providerEventId} IS NOT NULL`),
    restaurantTimeIdx: index("payment_audit_restaurant_time_idx").on(
      table.restaurantId,
      table.occurredAt,
    ),
  }),
);

export const paymentAuditLogRelations = relations(
  paymentAuditLog,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [paymentAuditLog.restaurantId],
      references: [restaurants.id],
    }),
    paymentTransaction: one(paymentTransactions, {
      fields: [paymentAuditLog.paymentTransactionId],
      references: [paymentTransactions.transactionId],
    }),
  }),
);

export type PaymentAuditLog = typeof paymentAuditLog.$inferSelect;
export type NewPaymentAuditLog = typeof paymentAuditLog.$inferInsert;
