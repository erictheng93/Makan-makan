import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { tables } from "./tables";
import { orders } from "./orders";

/**
 * 座位表 - 支持座位級別的 QR 碼管理
 * 當桌子的 qr_mode 為 'seat' 時使用
 */
export const seats = sqliteTable(
  "seats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tableId: integer("table_id")
      .notNull()
      .references(() => tables.id, {
        onDelete: "cascade",
      }),

    // 座位基本資訊
    seatNumber: text("seat_number").notNull(), // 座位編號 (01, 02, A, B...)
    seatName: text("seat_name"), // 座位名稱（可選）
    position: text("position"), // 座位位置描述（如：靠窗、角落）

    // QR Code 資訊
    qrCode: text("qr_code").notNull().unique(), // QR 碼內容
    qrCodeImageUrl: text("qr_code_image_url"), // QR 碼圖片 URL
    qrCodeVersion: integer("qr_code_version").notNull().default(1), // QR 碼版本（用於更新）

    /**
     * Prepared-but-not-live QR code (#114 two-phase rotation).
     *
     * A rotation writes the next signed code here and leaves qr_code alone, so
     * the sticker still on the seat keeps working while new ones are printed.
     * Activation moves it across. Nothing verifies against these columns — only
     * one code per seat is ever accepted, which is what keeps a rotation from
     * reopening the dual-accept window phase 3 closed.
     */
    pendingQrCode: text("pending_qr_code").unique(),
    pendingQrCodeVersion: integer("pending_qr_code_version"),
    pendingQrPreparedAt: integer("pending_qr_prepared_at_ms", {
      mode: "timestamp_ms",
    }),

    // 狀態管理
    isOccupied: integer("is_occupied", { mode: "boolean" })
      .notNull()
      .default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    currentOrderId: text("current_order_id"),

    // 使用追蹤
    occupiedAt: integer("occupied_at_ms", { mode: "timestamp_ms" }),
    occupiedBy: text("occupied_by"), // 使用者標識
    totalUsage: integer("total_usage").notNull().default(0), // 使用次數

    // 時間戳記
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),

    // 軟刪除
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    // 索引優化
    tableIdIdx: index("seats_table_id_idx").on(table.tableId),
    qrCodeIdx: index("seats_qr_code_idx").on(table.qrCode),
    tableSeatNumberIdx: uniqueIndex("seats_table_seat_number_idx").on(
      table.tableId,
      table.seatNumber,
    ),
    isOccupiedIdx: index("seats_is_occupied_idx").on(table.isOccupied),
    isActiveIdx: index("seats_is_active_idx").on(table.isActive),
  }),
);

/**
 * 座位關聯定義
 */
export const seatRelations = relations(seats, ({ one, many }) => ({
  // 座位所屬的桌子
  table: one(tables, {
    fields: [seats.tableId],
    references: [tables.id],
  }),
  // 座位當前的訂單（如果有）
  currentOrder: one(orders, {
    fields: [seats.currentOrderId],
    references: [orders.id],
  }),
}));

/**
 * 座位類型（用於 TypeScript）
 */
export type Seat = typeof seats.$inferSelect;
export type NewSeat = typeof seats.$inferInsert;
