/**
 * Customers Schema
 * 顧客資料表結構定義
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ================================================
// TABLE: customers (顧客表)
// ================================================

export const customers = sqliteTable(
  "customers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID().replace(/-/g, "")),

    // 基本資訊
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),

    // 時間戳記
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    emailIdx: index("idx_customers_email").on(table.email),
    phoneIdx: index("idx_customers_phone").on(table.phone),
    createdAtIdx: index("idx_customers_created_at").on(table.createdAt),
  }),
);

// ================================================
// RELATIONS
// ================================================

export const customersRelations = relations(customers, ({ many }) => ({
  // Relations will be added as needed
}));

// ================================================
// TYPE INFERENCE
// ================================================

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
