/**
 * Credit Top-up Intents (代幣線上儲值意圖)
 *
 * Phase 2 online funding. An intent is created when a cardholder starts an
 * online top-up; the balance is credited ONLY when a verified provider webhook
 * confirms payment (the client is never trusted). Mirrors the market-checkout
 * pending → webhook → confirm flow, but single-amount (no split).
 */

import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { creditAccounts } from "./credits";

export const CREDIT_TOPUP_INTENT_STATUS = [
  "pending",
  "paid",
  "failed",
  "expired",
] as const;
export type CreditTopupIntentStatus =
  (typeof CREDIT_TOPUP_INTENT_STATUS)[number];

export const creditTopupIntents = sqliteTable(
  "credit_topup_intents",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    accountId: text("account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "restrict" }),
    // Card public id used to start the top-up (resolves the account on confirm).
    publicId: text("public_id").notNull(),

    provider: text("provider").notNull(),
    status: text("status")
      .$type<CreditTopupIntentStatus>()
      .notNull()
      .default("pending"),

    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),

    providerTransactionId: text("provider_transaction_id"),
    providerPayload: text("provider_payload", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),

    // Set to the credit_ledger_entries.id once the balance is credited.
    ledgerEntryId: text("ledger_entry_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    paidAtMs: integer("paid_at_ms", { mode: "timestamp_ms" }),
    failedAtMs: integer("failed_at_ms", { mode: "timestamp_ms" }),
    expiresAtMs: integer("expires_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    accountIdx: index("idx_credit_topup_intents_account").on(table.accountId),
    statusIdx: index("idx_credit_topup_intents_status").on(table.status),
    providerTxnIdx: index("idx_credit_topup_intents_provider_txn").on(
      table.providerTransactionId,
    ),
  }),
);

export const creditTopupIntentsRelations = relations(
  creditTopupIntents,
  ({ one }) => ({
    account: one(creditAccounts, {
      fields: [creditTopupIntents.accountId],
      references: [creditAccounts.id],
    }),
  }),
);
