import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { orders } from "./orders";
import { restaurants } from "./restaurants";

export const PAYMENT_TRANSACTION_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  PARTIAL_REFUNDED: "partial_refunded",
} as const;

export const REFUND_TRANSACTION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type PaymentTransactionStatus =
  (typeof PAYMENT_TRANSACTION_STATUS)[keyof typeof PAYMENT_TRANSACTION_STATUS];
export type RefundTransactionStatus =
  (typeof REFUND_TRANSACTION_STATUS)[keyof typeof REFUND_TRANSACTION_STATUS];

export const paymentTransactions = sqliteTable(
  "payment_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    transactionId: text("transaction_id").notNull().unique(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency"),
    countryCode: text("country_code"),
    paymentMethod: text("payment_method").notNull(),
    gateway: text("gateway"),
    status: text("status")
      .$type<PaymentTransactionStatus>()
      .notNull()
      .default(PAYMENT_TRANSACTION_STATUS.PENDING),
    idempotencyKey: text("idempotency_key"),
    providerTransactionId: text("provider_transaction_id"),
    customerInfo: text("customer_info", { mode: "json" }),
    metadata: text("metadata", { mode: "json" }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    completedAt: integer("completed_at_ms", { mode: "timestamp_ms" }),
    failedAt: integer("failed_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    orderIdx: index("payment_transactions_order_idx").on(
      table.orderId,
      table.createdAt,
    ),
    restaurantStatusIdx: index("payment_transactions_restaurant_status_idx").on(
      table.restaurantId,
      table.status,
      table.createdAt,
    ),
    idempotencyIdx: index("payment_transactions_idempotency_idx").on(
      table.idempotencyKey,
    ),
  }),
);

export const refundTransactions = sqliteTable(
  "refund_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    refundId: text("refund_id").notNull().unique(),
    paymentTransactionId: text("payment_transaction_id")
      .notNull()
      .references(() => paymentTransactions.transactionId, {
        onDelete: "cascade",
      }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    reason: text("reason"),
    status: text("status")
      .$type<RefundTransactionStatus>()
      .notNull()
      .default(REFUND_TRANSACTION_STATUS.PENDING),
    providerRefundId: text("provider_refund_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    completedAt: integer("completed_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    paymentIdx: index("refund_transactions_payment_idx").on(
      table.paymentTransactionId,
      table.createdAt,
    ),
    orderIdx: index("refund_transactions_order_idx").on(
      table.orderId,
      table.createdAt,
    ),
  }),
);

export const paymentTransactionsRelations = relations(
  paymentTransactions,
  ({ one, many }) => ({
    order: one(orders, {
      fields: [paymentTransactions.orderId],
      references: [orders.id],
    }),
    restaurant: one(restaurants, {
      fields: [paymentTransactions.restaurantId],
      references: [restaurants.id],
    }),
    refunds: many(refundTransactions),
  }),
);

export const refundTransactionsRelations = relations(
  refundTransactions,
  ({ one }) => ({
    payment: one(paymentTransactions, {
      fields: [refundTransactions.paymentTransactionId],
      references: [paymentTransactions.transactionId],
    }),
    order: one(orders, {
      fields: [refundTransactions.orderId],
      references: [orders.id],
    }),
    restaurant: one(restaurants, {
      fields: [refundTransactions.restaurantId],
      references: [restaurants.id],
    }),
  }),
);

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactions.$inferInsert;
export type RefundTransaction = typeof refundTransactions.$inferSelect;
export type NewRefundTransaction = typeof refundTransactions.$inferInsert;
