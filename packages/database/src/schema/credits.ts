/**
 * Stored-Value Credits Schema (代幣)
 *
 * 平台級可儲值餘額（fungible balance），透過儲值卡 / QR 輕量身分持有。
 * 設計重點：
 *  - 帳戶（credit_accounts）= 平台負債本體，物化餘額 + 樂觀鎖（version）。
 *  - 卡（credit_cards）= 存取憑證，可掛失/重發，指向同一帳戶。
 *  - 流水（credit_ledger_entries）= append-only 不可變審計來源，idempotencyKey 唯一防雙扣。
 *
 * 扣款一律走「條件式 UPDATE + 樂觀鎖 + 餘額 guard」，禁止讀-改-寫：
 *   UPDATE credit_accounts
 *      SET balance_cents = balance_cents - :amount, version = version + 1, ...
 *    WHERE id = :id AND currency = :currency
 *      AND balance_cents >= :amount AND version = :expectedVersion;
 *
 * 決策鎖定：
 *  - (a) 單幣別卡：currency 發行時固定、不可變，「平台通用」= 同幣別所有 market 通用。
 *  - (b) 門檻式 PIN：小額免 PIN，超過門檻需 secretHash 驗證（門檻為設定值，不入 schema）。
 *  - PK：全 TEXT UUID v7（付款憑證不可枚舉；append-only 無自增競爭）。
 */

import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { customers } from "./customers";

// ================================================
// ENUMS
// ================================================

export const CREDIT_ACCOUNT_STATUS = ["active", "frozen", "closed"] as const;
export type CreditAccountStatus = (typeof CREDIT_ACCOUNT_STATUS)[number];

export const CREDIT_CARD_STATUS = [
  "active",
  "frozen",
  "lost",
  "replaced",
] as const;
export type CreditCardStatus = (typeof CREDIT_CARD_STATUS)[number];

export const CREDIT_ENTRY_TYPE = [
  "topup", // 儲值（正）
  "spend", // 消費扣款（負）
  "refund", // 退款回補（正）
  "expire", // 到期失效（負）
  "adjust", // 人工調整（正/負）
] as const;
export type CreditEntryType = (typeof CREDIT_ENTRY_TYPE)[number];

// ================================================
// TABLE: credit_accounts (帳戶 = 負債本體)
// ================================================

export const creditAccounts = sqliteTable(
  "credit_accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    // 選填歸屬：卡可先無主，後續由顧客認領
    ownerCustomerId: text("owner_customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),

    // (a) 發行固定、不可變
    currency: text("currency").notNull(), // TWD | MYR | VND

    // 物化餘額（單位：分）。非負由條件式 UPDATE 保證，不在此放 CHECK 以對齊現有 schema 慣例
    balanceCents: integer("balance_cents").notNull().default(0),
    reservedCents: integer("reserved_cents").notNull().default(0), // 結帳鎖定中

    version: integer("version").notNull().default(0), // 樂觀鎖

    status: text("status")
      .$type<CreditAccountStatus>()
      .notNull()
      .default("active"),

    expiresAtMs: integer("expires_at_ms", { mode: "timestamp_ms" }), // rolling expiry，儲值/消費往後推

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    // 一個顧客每幣別最多一個帳戶（僅在已認領時約束；未認領 owner 為 NULL，彼此不衝突）
    ownerCurrencyIdx: uniqueIndex("idx_credit_accounts_owner_currency")
      .on(table.ownerCustomerId, table.currency)
      .where(sql`${table.ownerCustomerId} IS NOT NULL`),
    // 到期掃描 cron 用
    expiryScanIdx: index("idx_credit_accounts_expiry_scan").on(
      table.status,
      table.expiresAtMs,
    ),
  }),
);

// ================================================
// TABLE: credit_cards (卡 = 存取憑證)
// ================================================

export const creditCards = sqliteTable(
  "credit_cards",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    accountId: text("account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "restrict" }),

    // QR 編碼此值：可查餘額/儲值（無害），不可直接扣款
    publicId: text("public_id").notNull().unique(),

    // (b) 門檻式 PIN：超過門檻金額扣款需驗此 hash；未設定前為 NULL
    secretHash: text("secret_hash"),
    pinRetryCount: integer("pin_retry_count").notNull().default(0),
    lockedUntilMs: integer("locked_until_ms", { mode: "timestamp_ms" }), // PIN 連續錯誤鎖定

    status: text("status")
      .$type<CreditCardStatus>()
      .notNull()
      .default("active"),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    accountIdx: index("idx_credit_cards_account").on(table.accountId),
    statusIdx: index("idx_credit_cards_status").on(table.status),
  }),
);

// ================================================
// TABLE: credit_ledger_entries (流水 = 不可變審計來源)
// ================================================

export const creditLedgerEntries = sqliteTable(
  "credit_ledger_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    accountId: text("account_id")
      .notNull()
      .references(() => creditAccounts.id, { onDelete: "restrict" }),

    entryType: text("entry_type").$type<CreditEntryType>().notNull(),

    amountCents: integer("amount_cents").notNull(), // 帶正負號
    balanceAfterCents: integer("balance_after_cents").notNull(), // 寫入當下餘額快照
    currency: text("currency").notNull(), // 去正規化，審計自洽

    // 來源追溯
    sourceType: text("source_type").notNull(), // market_checkout | topup | admin_adjust | expiry_job
    sourceId: text("source_id"), // 對應來源主鍵
    // 對帳回連 market_checkout_payments.payment_id（非 PK，故不設硬 FK）
    marketCheckoutPaymentId: text("market_checkout_payment_id"),

    // 重試 / 雙扣閘門：同一邏輯操作只記一次
    idempotencyKey: text("idempotency_key").notNull().unique(),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    accountCreatedIdx: index("idx_credit_ledger_account_created").on(
      table.accountId,
      table.createdAt,
    ),
    entryTypeIdx: index("idx_credit_ledger_entry_type").on(table.entryType),
    sourceIdx: index("idx_credit_ledger_source").on(
      table.sourceType,
      table.sourceId,
    ),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const creditAccountsRelations = relations(
  creditAccounts,
  ({ one, many }) => ({
    owner: one(customers, {
      fields: [creditAccounts.ownerCustomerId],
      references: [customers.id],
    }),
    cards: many(creditCards),
    ledgerEntries: many(creditLedgerEntries),
  }),
);

export const creditCardsRelations = relations(creditCards, ({ one }) => ({
  account: one(creditAccounts, {
    fields: [creditCards.accountId],
    references: [creditAccounts.id],
  }),
}));

export const creditLedgerEntriesRelations = relations(
  creditLedgerEntries,
  ({ one }) => ({
    account: one(creditAccounts, {
      fields: [creditLedgerEntries.accountId],
      references: [creditAccounts.id],
    }),
  }),
);
