/**
 * POS (Point of Sale) System Schema
 *
 * Tables:
 * - cash_registers: 收銀機管理
 * - cash_shifts: 班次管理
 * - cash_movements: 現金流動記錄
 * - receipts: 收據管理
 * - refunds: 退款處理
 * - shift_reports: 班次報表
 */

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { users } from "./users";
import { orders } from "./orders";

// ==========================================
// 收銀機表 (Cash Registers)
// ==========================================

export const cashRegisters = sqliteTable(
  "cash_registers",
  {
    id: text("id").primaryKey(), // UUID
    name: text("name").notNull(),
    location: text("location"),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.public_id (TEXT)
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    currentShiftId: text("current_shift_id"), // FK to cash_shifts

    // 硬體配置
    hardwareConfig: text("hardware_config").notNull().default("{}"), // JSON
    peripherals: text("peripherals").notNull().default("{}"), // JSON: 周邊設備（打印機、錢箱等）
    settings: text("settings").notNull().default("{}"), // JSON: 設定

    // 維護資訊
    lastMaintenanceAt: integer("last_maintenance_at_ms", {
      mode: "timestamp_ms",
    }),

    // 時間戳
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    restaurantIdx: index("idx_cash_registers_restaurant").on(
      table.restaurantId,
    ),
    activeIdx: index("idx_cash_registers_active").on(
      table.restaurantId,
      table.isActive,
    ),
  }),
);

// ==========================================
// 班次表 (Cash Shifts)
// ==========================================

export const cashShifts = sqliteTable(
  "cash_shifts",
  {
    id: text("id").primaryKey(), // UUID
    registerId: text("register_id")
      .notNull()
      .references(() => cashRegisters.id),
    operatorId: text("operator_id")
      .notNull()
      .references(() => users.id),

    // 金額資訊
    startAmountCents: integer("start_amount_cents"),
    endAmountCents: integer("end_amount_cents"),
    expectedAmountCents: integer("expected_amount_cents"),
    actualAmountCents: integer("actual_amount_cents"),
    differenceAmountCents: integer("difference_amount_cents"),

    // 銷售統計
    totalSalesCents: integer("total_sales_cents"),
    totalRefundsCents: integer("total_refunds_cents"),
    cashSalesCents: integer("cash_sales_cents"),
    cardSalesCents: integer("card_sales_cents"),
    digitalSalesCents: integer("digital_sales_cents"),
    totalTransactions: integer("total_transactions").notNull().default(0),

    // 時間資訊
    startedAt: integer("started_at_ms", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at_ms", { mode: "timestamp_ms" }),

    // 狀態
    status: text("status").notNull().default("active"), // active, closed, suspended

    // 備註
    notes: text("notes"),
    closingNotes: text("closing_notes"),
  },
  (table) => ({
    registerIdx: index("idx_cash_shifts_register").on(table.registerId),
    operatorIdx: index("idx_cash_shifts_operator").on(table.operatorId),
    statusIdx: index("idx_cash_shifts_status").on(
      table.registerId,
      table.status,
    ),
    startedAtIdx: index("idx_cash_shifts_started").on(table.startedAt),
  }),
);

// ==========================================
// 現金流動記錄表 (Cash Movements)
// ==========================================

export const cashMovements = sqliteTable(
  "cash_movements",
  {
    id: text("id").primaryKey(), // UUID
    shiftId: text("shift_id")
      .notNull()
      .references(() => cashShifts.id),
    registerId: text("register_id")
      .notNull()
      .references(() => cashRegisters.id),

    // 操作類型
    type: text("type").notNull(), // sale, refund, cash_in, cash_out, count, opening, closing, adjustment, payout, deposit
    amountCents: integer("amount_cents"),
    description: text("description"),

    // 參考資訊
    referenceId: integer("reference_id"), // 關聯的訂單ID或其他ID
    referenceType: text("reference_type"), // order, refund, adjustment, etc.
    paymentMethod: text("payment_method"), // cash, card, digital, etc.

    // 面額細分
    denominationBreakdown: text("denomination_breakdown")
      .notNull()
      .default("{}"), // JSON: {1000: 5, 500: 10, ...}

    // 操作人員
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => users.id),
    approvedBy: text("approved_by").references(() => users.id),
    approvalStatus: text("approval_status").notNull().default("pending"), // pending, approved, rejected

    // 收據編號
    receiptNumber: text("receipt_number"),

    // 額外資訊
    metadata: text("metadata").notNull().default("{}"), // JSON

    // 時間戳
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    shiftIdx: index("idx_cash_movements_shift").on(table.shiftId),
    registerIdx: index("idx_cash_movements_register").on(table.registerId),
    typeIdx: index("idx_cash_movements_type").on(table.shiftId, table.type),
    createdAtIdx: index("idx_cash_movements_created").on(table.createdAt),
  }),
);

// ==========================================
// 收據表 (Receipts)
// ==========================================

export const receipts = sqliteTable(
  "receipts",
  {
    id: text("id").primaryKey(), // UUID
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    // 可空：訂單確認時自動產生的廚房票沒有收銀機。派工時 NULL 只配對到同樣
    // 沒有綁收銀機的代理（全店代理，例如廚房出單機）。
    registerId: text("register_id").references(() => cashRegisters.id),
    shiftId: text("shift_id").references(() => cashShifts.id),

    // 收據資訊
    receiptNumber: text("receipt_number").notNull().unique(),
    receiptType: text("receipt_type").notNull(), // customer, kitchen, merchant, duplicate
    templateName: text("template_name").notNull().default("standard"),

    // 內容
    content: text("content").notNull(), // JSON: 格式化的收據內容
    rawContent: text("raw_content"), // 原始打印指令

    // 打印狀態
    printStatus: text("print_status").notNull().default("pending"), // pending, printing, printed, failed, cancelled
    printAttempts: integer("print_attempts").notNull().default(0),
    printerName: text("printer_name"),
    printerResponse: text("printer_response"),
    printedAt: integer("printed_at_ms", { mode: "timestamp_ms" }),

    // 重印資訊
    reprintedCount: integer("reprinted_count").notNull().default(0),
    lastReprintAt: integer("last_reprint_at_ms", { mode: "timestamp_ms" }),

    // 打印代理認領這筆工作的時間。用來回收沒有回報結果的認領：代理在送出
    // ack 之前掛掉，這一列就會永遠停在 "printing"，沒有這個欄位就沒辦法分辨
    // 「正在印」與「認領後死掉」。
    claimedAt: integer("claimed_at_ms", { mode: "timestamp_ms" }),

    // 時間戳
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    orderIdx: index("idx_receipts_order").on(table.orderId),
    registerIdx: index("idx_receipts_register").on(table.registerId),
    shiftIdx: index("idx_receipts_shift").on(table.shiftId),
    printStatusIdx: index("idx_receipts_print_status").on(table.printStatus),
  }),
);

// ==========================================
// 列印代理憑證 (Print Agents)
// ==========================================

/**
 * 一台店內列印代理的憑證。租戶範圍是從 `register_id` join 出來的，不是由代理
 * 自己宣告的 header —— 代理只出示金鑰，餐廳與收銀機都由伺服器端推導，這樣
 * 一家店的代理就無法讀取另一家店的收據。
 *
 * 只存 SHA-256 摘要，明文金鑰在核發當下回傳一次就不再留存。
 */
export const printAgents = sqliteTable(
  "print_agents",
  {
    id: text("id").primaryKey(), // UUID v7
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),

    // 可空。綁定收銀機 = 櫃檯出單機，只拿該台的收據；不綁 = 全店代理，拿沒有
    // 收銀機的收據（廚房票）。配對規則是 null-safe 相等，見 features/print。
    registerId: text("register_id").references(() => cashRegisters.id),

    label: text("label").notNull(), // 人看的名稱，例如「櫃檯出單機」
    keyHash: text("key_hash").notNull().unique(), // SHA-256 hex

    // 代理每次輪詢時回報。少了這兩個欄位，後台分不出「代理整個掛了」與「代理
    // 活著但印表機被拔掉」—— last_seen_at_ms 只看得出前者。
    printersTotal: integer("printers_total"),
    printersOnline: integer("printers_online"),

    lastSeenAt: integer("last_seen_at_ms", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at_ms", { mode: "timestamp_ms" }),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    restaurantIdx: index("idx_print_agents_restaurant").on(table.restaurantId),
    registerIdx: index("idx_print_agents_register").on(table.registerId),
  }),
);

// ==========================================
// 退款表 (Refunds)
// ==========================================

export const refunds = sqliteTable(
  "refunds",
  {
    id: text("id").primaryKey(), // UUID
    originalOrderId: text("original_order_id")
      .notNull()
      .references(() => orders.id),
    registerId: text("register_id")
      .notNull()
      .references(() => cashRegisters.id),
    shiftId: text("shift_id").references(() => cashShifts.id),

    // 退款資訊
    refundNumber: text("refund_number").notNull().unique(),
    refundType: text("refund_type").notNull(), // full, partial, item, service
    originalAmountCents: integer("original_amount_cents"),
    refundAmountCents: integer("refund_amount_cents"),
    refundMethod: text("refund_method").notNull(), // cash, card, original_method, etc.

    // 原因
    reasonCode: text("reason_code").notNull(),
    reasonDescription: text("reason_description"),

    // 退款項目
    itemsRefunded: text("items_refunded").notNull().default("[]"), // JSON array

    // 處理人員
    processedBy: text("processed_by")
      .notNull()
      .references(() => users.id),
    approvedBy: text("approved_by").references(() => users.id),

    // 客戶簽名
    customerSignature: text("customer_signature"),

    // 狀態
    status: text("status").notNull().default("pending"), // pending, processing, completed, failed, cancelled

    // 處理時間
    processedAt: integer("processed_at_ms", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at_ms", { mode: "timestamp_ms" }),

    // 額外資訊
    metadata: text("metadata").notNull().default("{}"), // JSON
  },
  (table) => ({
    orderIdx: index("idx_refunds_order").on(table.originalOrderId),
    registerIdx: index("idx_refunds_register").on(table.registerId),
    shiftIdx: index("idx_refunds_shift").on(table.shiftId),
    statusIdx: index("idx_refunds_status").on(table.status),
  }),
);

// ==========================================
// 班次報表表 (Shift Reports)
// ==========================================

export const shiftReports = sqliteTable(
  "shift_reports",
  {
    id: text("id").primaryKey(), // UUID
    shiftId: text("shift_id")
      .notNull()
      .references(() => cashShifts.id),
    registerId: text("register_id")
      .notNull()
      .references(() => cashRegisters.id),
    operatorId: text("operator_id")
      .notNull()
      .references(() => users.id),

    // 報表數據
    reportData: text("report_data").notNull(), // JSON: 完整報表內容
    summaryData: text("summary_data").notNull(), // JSON: 摘要數據

    // 生成時間
    generatedAt: integer("generated_at_ms", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    shiftIdx: index("idx_shift_reports_shift").on(table.shiftId),
    registerIdx: index("idx_shift_reports_register").on(table.registerId),
    operatorIdx: index("idx_shift_reports_operator").on(table.operatorId),
    generatedAtIdx: index("idx_shift_reports_generated").on(table.generatedAt),
  }),
);

// ==========================================
// Relations 定義
// ==========================================

export const cashRegistersRelations = relations(
  cashRegisters,
  ({ one, many }) => ({
    restaurant: one(restaurants, {
      fields: [cashRegisters.restaurantId],
      references: [restaurants.id],
    }),
    currentShift: one(cashShifts, {
      fields: [cashRegisters.currentShiftId],
      references: [cashShifts.id],
    }),
    shifts: many(cashShifts),
    movements: many(cashMovements),
    receipts: many(receipts),
    refunds: many(refunds),
  }),
);

export const cashShiftsRelations = relations(cashShifts, ({ one, many }) => ({
  register: one(cashRegisters, {
    fields: [cashShifts.registerId],
    references: [cashRegisters.id],
  }),
  operator: one(users, {
    fields: [cashShifts.operatorId],
    references: [users.id],
  }),
  movements: many(cashMovements),
  receipts: many(receipts),
  refunds: many(refunds),
  reports: many(shiftReports),
}));

export const cashMovementsRelations = relations(cashMovements, ({ one }) => ({
  shift: one(cashShifts, {
    fields: [cashMovements.shiftId],
    references: [cashShifts.id],
  }),
  register: one(cashRegisters, {
    fields: [cashMovements.registerId],
    references: [cashRegisters.id],
  }),
  recordedByUser: one(users, {
    fields: [cashMovements.recordedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [cashMovements.approvedBy],
    references: [users.id],
  }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  order: one(orders, {
    fields: [receipts.orderId],
    references: [orders.id],
  }),
  register: one(cashRegisters, {
    fields: [receipts.registerId],
    references: [cashRegisters.id],
  }),
  shift: one(cashShifts, {
    fields: [receipts.shiftId],
    references: [cashShifts.id],
  }),
}));

export const printAgentsRelations = relations(printAgents, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [printAgents.restaurantId],
    references: [restaurants.id],
  }),
  register: one(cashRegisters, {
    fields: [printAgents.registerId],
    references: [cashRegisters.id],
  }),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  originalOrder: one(orders, {
    fields: [refunds.originalOrderId],
    references: [orders.id],
  }),
  register: one(cashRegisters, {
    fields: [refunds.registerId],
    references: [cashRegisters.id],
  }),
  shift: one(cashShifts, {
    fields: [refunds.shiftId],
    references: [cashShifts.id],
  }),
  processedByUser: one(users, {
    fields: [refunds.processedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [refunds.approvedBy],
    references: [users.id],
  }),
}));

export const shiftReportsRelations = relations(shiftReports, ({ one }) => ({
  shift: one(cashShifts, {
    fields: [shiftReports.shiftId],
    references: [cashShifts.id],
  }),
  register: one(cashRegisters, {
    fields: [shiftReports.registerId],
    references: [cashRegisters.id],
  }),
  operator: one(users, {
    fields: [shiftReports.operatorId],
    references: [users.id],
  }),
}));
