import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

export const qrCodes = sqliteTable("qr_codes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  content: text("content").notNull(),
  styleJson: text("style_json"),
  format: text("format").notNull().default("png"),
  url: text("url"),
  metadataJson: text("metadata_json"),

  // 時間戳 - 標準化為 INTEGER (Unix milliseconds)
  createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const qrTemplates = sqliteTable("qr_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  styleJson: text("style_json").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  createdBy: integer("created_by"),

  // 時間戳 - 標準化為 INTEGER (Unix milliseconds)
  createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const qrDownloads = sqliteTable("qr_downloads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  qrCodeId: text("qr_code_id").notNull(),
  format: text("format").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  // 時間戳 - 標準化為 INTEGER (Unix milliseconds)
  downloadedAt: integer("downloaded_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
});

export const qrBatches = sqliteTable("qr_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: text("batch_id").notNull().unique(),
  restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.public_id (TEXT)
  totalCodes: integer("total_codes").notNull(),
  generatedCodes: integer("generated_codes").notNull().default(0),
  status: text("status").notNull().default("pending"),
  createdBy: integer("created_by").notNull(),

  // 時間戳 - 標準化為 INTEGER (Unix milliseconds)
  createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('now') * 1000)`),
  completedAt: integer("completed_at_ms", { mode: "timestamp_ms" }),
});

// Export types for TypeScript
export type QRCode = typeof qrCodes.$inferSelect;
export type NewQRCode = typeof qrCodes.$inferInsert;
export type QRTemplate = typeof qrTemplates.$inferSelect;
export type NewQRTemplate = typeof qrTemplates.$inferInsert;
export type QRDownload = typeof qrDownloads.$inferSelect;
export type NewQRDownload = typeof qrDownloads.$inferInsert;
export type QRBatch = typeof qrBatches.$inferSelect;
export type NewQRBatch = typeof qrBatches.$inferInsert;
