/**
 * POS (Point of Sale) Service
 *
 * Drizzle ORM-backed implementation of cash register, shift, refund,
 * receipt, and shift-report management for restaurant POS terminals.
 */

import { z } from "zod";
import { eq, and, sql, count } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { BaseService, CloudflareEnv } from "./base";
import {
  cashRegisters,
  cashShifts,
  cashMovements,
  receipts,
  refunds,
  shiftReports,
} from "../schema/pos";
import { users } from "../schema/users";
import { orders } from "../schema/orders";
import { amountFromCents, toRequiredCents } from "../utils/money";
import {
  avgAbsMoneyAmount,
  avgMoneyAmount,
  sumMoneyAmount,
} from "../utils/money-sql";
import { businessNumber } from "./id-generation";

// ==========================================
// 類型定義
// ==========================================

export interface CashRegister {
  id: string;
  name: string;
  location?: string;
  restaurantId: string;
  isActive: boolean;
  currentShiftId?: string;
  hardwareConfig: Record<string, any>;
  peripherals: Record<string, any>;
  settings: Record<string, any>;
  lastMaintenanceAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CashShift {
  id: string;
  registerId: string;
  operatorId: string;
  startAmount: number;
  endAmount?: number;
  expectedAmount: number;
  actualAmount?: number;
  differenceAmount: number;
  totalSales: number;
  totalRefunds: number;
  cashSales: number;
  cardSales: number;
  digitalSales: number;
  totalTransactions: number;
  startedAt: Date;
  endedAt?: Date;
  status: "active" | "closed" | "suspended";
  notes?: string;
  closingNotes?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  registerId: string;
  type:
    | "sale"
    | "refund"
    | "cash_in"
    | "cash_out"
    | "count"
    | "opening"
    | "closing"
    | "adjustment"
    | "payout"
    | "deposit";
  amount: number;
  description?: string;
  referenceId?: string;
  referenceType?: string;
  paymentMethod?: string;
  denominationBreakdown: Record<string, number>;
  recordedBy: string;
  approvedBy?: string;
  approvalStatus: "pending" | "approved" | "rejected";
  receiptNumber?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Receipt {
  id: string;
  orderId: string;
  registerId: string;
  shiftId?: string;
  receiptNumber: string;
  receiptType: "customer" | "kitchen" | "merchant" | "duplicate";
  templateName: string;
  content: string;
  rawContent?: string;
  printStatus: "pending" | "printing" | "printed" | "failed" | "cancelled";
  printAttempts: number;
  printerName?: string;
  printerResponse?: string;
  printedAt?: Date;
  reprintedCount: number;
  lastReprintAt?: Date;
  createdAt: Date;
}

export interface Refund {
  id: string;
  originalOrderId: string;
  registerId: string;
  shiftId?: string;
  refundNumber: string;
  refundType: "full" | "partial" | "item" | "service";
  originalAmount: number;
  refundAmount: number;
  refundMethod: string;
  reasonCode: string;
  reasonDescription?: string;
  itemsRefunded: any[];
  processedBy: string;
  approvedBy?: string;
  customerSignature?: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  processedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
}

// 請求/回應類型
export interface CreateRegisterRequest {
  name: string;
  location?: string;
  restaurantId: string;
  hardwareConfig?: Record<string, any>;
  peripherals?: Record<string, any>;
  settings?: Record<string, any>;
}

export interface StartShiftRequest {
  registerId: string;
  operatorId: string;
  startAmount: number;
  notes?: string;
}

export interface EndShiftRequest {
  actualAmount: number;
  closingNotes?: string;
}

export interface CashMovementRequest {
  type: "cash_in" | "cash_out" | "count" | "adjustment" | "payout" | "deposit";
  amount: number;
  description: string;
  denominationBreakdown?: Record<string, number>;
  referenceId?: string;
  referenceType?: string;
}

export interface PrintReceiptRequest {
  orderId: string;
  templateName?: string;
  receiptType?: "customer" | "kitchen" | "merchant";
  copies?: number;
}

export interface ProcessRefundRequest {
  originalOrderId: string;
  refundType: "full" | "partial" | "item" | "service";
  refundAmount: number;
  refundMethod: string;
  reasonCode: string;
  reasonDescription?: string;
  itemsRefunded?: any[];
  customerSignature?: string;
}

// ==========================================
// 驗證 Schemas
// ==========================================

const createRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  restaurantId: z.string(),
  hardwareConfig: z.record(z.any()).optional().default({}),
  peripherals: z.record(z.any()).optional().default({}),
  settings: z.record(z.any()).optional().default({}),
});

const startShiftSchema = z.object({
  registerId: z.string().uuid(),
  operatorId: z.string().uuid(),
  startAmount: z.number().min(0),
  notes: z.string().max(500).optional(),
});

const endShiftSchema = z.object({
  actualAmount: z.number().min(0),
  closingNotes: z.string().max(500).optional(),
});

const cashMovementSchema = z.object({
  type: z.enum([
    "cash_in",
    "cash_out",
    "count",
    "adjustment",
    "payout",
    "deposit",
  ]),
  amount: z.number(),
  description: z.string().min(1).max(200),
  denominationBreakdown: z.record(z.number()).optional().default({}),
  referenceId: z.string().uuid().optional(),
  referenceType: z.string().optional(),
});

const printReceiptSchema = z.object({
  orderId: z.string().uuid(),
  templateName: z.string().optional().default("standard"),
  receiptType: z
    .enum(["customer", "kitchen", "merchant"])
    .optional()
    .default("customer"),
  copies: z.number().int().min(1).max(5).optional().default(1),
});

const processRefundSchema = z.object({
  originalOrderId: z.string().uuid(),
  refundType: z.enum(["full", "partial", "item", "service"]),
  refundAmount: z.number().positive(),
  refundMethod: z.string().min(1).max(50),
  reasonCode: z.string().min(1).max(50),
  reasonDescription: z.string().max(500).optional(),
  itemsRefunded: z.array(z.any()).optional().default([]),
  customerSignature: z.string().optional(),
});

// ==========================================
// POSService Class
// ==========================================

export class POSService extends BaseService {
  constructor(db: any, env: CloudflareEnv) {
    super(db, env);
  }

  // ==========================================
  // 收銀機管理
  // ==========================================

  async createRegister(
    data: CreateRegisterRequest,
    createdBy: string,
  ): Promise<{ success: boolean; data?: CashRegister; error?: string }> {
    try {
      const validatedData = createRegisterSchema.parse(data);
      const registerId = crypto.randomUUID();
      const now = new Date();

      // 使用 Drizzle ORM 插入
      const registerData = {
        id: registerId,
        name: validatedData.name,
        location: validatedData.location ?? null,
        restaurantId: validatedData.restaurantId,
        isActive: true,
        hardwareConfig: JSON.stringify(validatedData.hardwareConfig),
        peripherals: JSON.stringify(validatedData.peripherals),
        settings: JSON.stringify(validatedData.settings),
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(cashRegisters).values(registerData);

      // 查詢剛創建的記錄
      const register = await this.db
        .select()
        .from(cashRegisters)
        .where(eq(cashRegisters.id, registerId))
        .get();

      if (!register) {
        throw new Error("創建後無法找到收銀機記錄");
      }

      return {
        success: true,
        data: {
          ...register,
          location: register.location ?? undefined,
          currentShiftId: register.currentShiftId ?? undefined,
          lastMaintenanceAt: register.lastMaintenanceAt ?? undefined,
          hardwareConfig: JSON.parse(register.hardwareConfig || "{}"),
          peripherals: JSON.parse(register.peripherals || "{}"),
          settings: JSON.parse(register.settings || "{}"),
        },
      };
    } catch (error) {
      console.error("創建收銀機失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "創建收銀機失敗",
      };
    }
  }

  async getRegisters(
    restaurantId: string,
  ): Promise<{ success: boolean; data?: CashRegister[]; error?: string }> {
    try {
      // 使用 Drizzle ORM 查詢，包含 LEFT JOIN
      const results = await this.db
        .select({
          register: cashRegisters,
          currentShiftStatus: cashShifts.id,
        })
        .from(cashRegisters)
        .leftJoin(
          cashShifts,
          and(
            eq(cashRegisters.currentShiftId, cashShifts.id),
            eq(cashShifts.status, "active"),
          ),
        )
        .where(eq(cashRegisters.restaurantId, restaurantId))
        .orderBy(cashRegisters.name)
        .all();

      const registers = results.map((row) => ({
        ...row.register,
        hardwareConfig: JSON.parse(row.register.hardwareConfig || "{}"),
        peripherals: JSON.parse(row.register.peripherals || "{}"),
        settings: JSON.parse(row.register.settings || "{}"),
        currentShiftStatus: row.currentShiftStatus,
      })) as CashRegister[];

      return {
        success: true,
        data: registers,
      };
    } catch (error) {
      console.error("獲取收銀機列表失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取收銀機列表失敗",
      };
    }
  }

  // ==========================================
  // 班次管理
  // ==========================================

  async startShift(
    data: StartShiftRequest,
  ): Promise<{ success: boolean; data?: CashShift; error?: string }> {
    try {
      const validatedData = startShiftSchema.parse(data);

      // 檢查收銀機是否已有活躍班次
      const existingShift = await this.db
        .select({ id: cashShifts.id })
        .from(cashShifts)
        .where(
          and(
            eq(cashShifts.registerId, validatedData.registerId),
            eq(cashShifts.status, "active"),
          ),
        )
        .get();

      if (existingShift) {
        return {
          success: false,
          error: "此收銀機已有活躍班次",
        };
      }

      const shiftId = crypto.randomUUID();
      const shiftStartTime = new Date();

      const shiftData = {
        id: shiftId,
        registerId: validatedData.registerId,
        operatorId: validatedData.operatorId,
        startAmountCents: toRequiredCents(validatedData.startAmount),
        expectedAmountCents: toRequiredCents(validatedData.startAmount),
        differenceAmountCents: 0,
        totalSalesCents: 0,
        totalRefundsCents: 0,
        cashSalesCents: 0,
        cardSalesCents: 0,
        digitalSalesCents: 0,
        totalTransactions: 0,
        startedAt: shiftStartTime,
        status: "active" as const,
        notes: validatedData.notes ?? null,
      };
      const openingMovementData = this.createCashMovementData(
        shiftId,
        validatedData.registerId,
        {
          type: "opening",
          amount: validatedData.startAmount,
          description: "開班現金",
          recordedBy: validatedData.operatorId,
        },
      );

      await this.db.batch([
        this.db.insert(cashShifts).values(shiftData),
        this.db.insert(cashMovements).values(openingMovementData),
      ] as [any, ...any[]]);

      // 查詢班次資料（在事務外）
      const shift = await this.db
        .select()
        .from(cashShifts)
        .where(eq(cashShifts.id, shiftId))
        .get();

      if (!shift) {
        throw new Error("創建後無法找到班次");
      }

      return {
        success: true,
        data: this.mapCashShift(shift),
      };
    } catch (error) {
      console.error("開班失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "開班失敗",
      };
    }
  }

  async endShift(
    shiftId: string,
    data: EndShiftRequest,
    operatorId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const validatedData = endShiftSchema.parse(data);

      // 獲取班次資訊
      const shift = await this.db
        .select()
        .from(cashShifts)
        .where(and(eq(cashShifts.id, shiftId), eq(cashShifts.status, "active")))
        .get();

      if (!shift) {
        return {
          success: false,
          error: "找不到活躍班次",
        };
      }

      // 計算預期金額
      const startAmount = amountFromCents(shift.startAmountCents) ?? 0;
      const totalSales = amountFromCents(shift.totalSalesCents) ?? 0;
      const totalRefunds = amountFromCents(shift.totalRefundsCents) ?? 0;
      const expectedAmount = startAmount + totalSales - totalRefunds;
      const differenceAmount = validatedData.actualAmount - expectedAmount;
      const shiftEndTime = new Date();

      const closingMovementData = this.createCashMovementData(
        shiftId,
        shift.registerId,
        {
          type: "closing",
          amount: validatedData.actualAmount,
          description: `結班現金 (差額: ${differenceAmount >= 0 ? "+" : ""}${differenceAmount})`,
          recordedBy: operatorId,
        },
      );
      const shiftUpdateData = {
        endAmountCents: toRequiredCents(validatedData.actualAmount),
        actualAmountCents: toRequiredCents(validatedData.actualAmount),
        expectedAmountCents: toRequiredCents(expectedAmount),
        differenceAmountCents: toRequiredCents(differenceAmount),
        endedAt: shiftEndTime,
        status: "closed" as const,
        closingNotes: validatedData.closingNotes ?? null,
      };
      const closedShift = {
        ...shift,
        ...shiftUpdateData,
      };
      const reportId = crypto.randomUUID();
      const reportData = await this.buildShiftReportData(shiftId, {
        shiftOverride: closedShift,
        extraMovements: [closingMovementData],
      });
      const reportInsertData = {
        id: reportId,
        shiftId,
        registerId: shift.registerId,
        operatorId: shift.operatorId,
        reportData: JSON.stringify(reportData),
        summaryData: JSON.stringify(reportData.summary),
        generatedAt: new Date(),
      };

      await this.db.batch([
        this.db
          .update(cashShifts)
          .set(shiftUpdateData)
          .where(eq(cashShifts.id, shiftId)) as BatchItem<"sqlite">,
        this.db.insert(cashMovements).values(closingMovementData),
        this.db
          .update(cashRegisters)
          .set({ currentShiftId: null })
          .where(eq(cashRegisters.id, shift.registerId)),
        this.db.insert(shiftReports).values(reportInsertData),
      ] as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);

      return {
        success: true,
        data: {
          shift: {
            ...shift,
            endAmount: validatedData.actualAmount,
            actualAmount: validatedData.actualAmount,
            expectedAmount,
            differenceAmount,
            status: "closed",
          },
          report: {
            reportId,
            reportData,
          },
        },
      };
    } catch (error) {
      console.error("結班失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "結班失敗",
      };
    }
  }

  // ==========================================
  // 現金操作記錄
  // ==========================================

  private async recordCashMovement(
    shiftId: string,
    movement: {
      type: string;
      amount: number;
      description: string;
      recordedBy: string;
      referenceId?: string | number;
      referenceType?: string;
      paymentMethod?: string;
      denominationBreakdown?: Record<string, number>;
    },

    tx?: any,
  ): Promise<void> {
    const db = tx ?? this.db;
    // 獲取 register_id
    const shift = await db
      .select({ registerId: cashShifts.registerId })
      .from(cashShifts)
      .where(eq(cashShifts.id, shiftId))
      .get();

    if (!shift) {
      throw new Error("找不到班次");
    }

    const movementData = this.createCashMovementData(
      shiftId,
      shift.registerId,
      movement,
    );

    await db.insert(cashMovements).values(movementData);
  }

  private createCashMovementData(
    shiftId: string,
    registerId: string,
    movement: {
      type: string;
      amount: number;
      description: string;
      recordedBy: string;
      referenceId?: string | number;
      referenceType?: string;
      paymentMethod?: string;
      denominationBreakdown?: Record<string, number>;
    },
  ): typeof cashMovements.$inferInsert {
    return {
      id: crypto.randomUUID(),
      shiftId,
      registerId,
      type: movement.type,
      amountCents: toRequiredCents(movement.amount),
      description: movement.description,
      referenceId: movement.referenceId ?? null,
      referenceType: movement.referenceType ?? null,
      paymentMethod: movement.paymentMethod ?? null,
      denominationBreakdown: JSON.stringify(
        movement.denominationBreakdown || {},
      ),
      recordedBy: movement.recordedBy,
      approvalStatus: "approved" as const,
      metadata: JSON.stringify({}),
      createdAt: new Date(),
    } as typeof cashMovements.$inferInsert;
  }

  async processCashMovement(
    shiftId: string,
    data: CashMovementRequest,
    operatorId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const validatedData = cashMovementSchema.parse(data);

      // 檢查班次狀態
      const shift = await this.db
        .select({ status: cashShifts.status })
        .from(cashShifts)
        .where(eq(cashShifts.id, shiftId))
        .get();

      if (!shift || shift.status !== "active") {
        return {
          success: false,
          error: "班次不存在或已結束",
        };
      }

      await this.recordCashMovement(shiftId, {
        ...validatedData,
        recordedBy: operatorId,
      });

      return { success: true };
    } catch (error) {
      console.error("現金操作記錄失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "現金操作記錄失敗",
      };
    }
  }

  // ==========================================
  // 收據管理
  // ==========================================

  async printReceipt(
    data: PrintReceiptRequest,
    registerId: string,
    shiftId?: string,
  ): Promise<{ success: boolean; data?: Receipt; error?: string }> {
    try {
      const validatedData = printReceiptSchema.parse(data);

      // 檢查訂單是否存在
      const order = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, validatedData.orderId))
        .get();

      if (!order) {
        return {
          success: false,
          error: "訂單不存在",
        };
      }

      const receiptId = crypto.randomUUID();
      const receiptNumber = businessNumber("R");

      // 生成收據內容
      const receiptContent = this.generateReceiptContent(
        order,
        validatedData.templateName,
      );

      const receiptCreatedAt = new Date();

      // 插入收據記錄
      const receiptData = {
        id: receiptId,
        orderId: validatedData.orderId,
        registerId,
        shiftId: shiftId ?? null,
        receiptNumber,
        receiptType: validatedData.receiptType,
        templateName: validatedData.templateName,
        content: JSON.stringify(receiptContent),
        printStatus: "pending" as const,
        printAttempts: 0,
        reprintedCount: 0,
        createdAt: receiptCreatedAt,
      };

      await this.db.insert(receipts).values(receiptData);

      // 模擬打印過程
      await this.simulatePrinting(receiptId);

      // 查詢收據
      const receipt = await this.db
        .select()
        .from(receipts)
        .where(eq(receipts.id, receiptId))
        .get();

      if (!receipt) {
        throw new Error("創建後無法找到收據");
      }

      return {
        success: true,
        data: {
          ...receipt,
          content: JSON.parse(receipt.content || "{}"),
        } as Receipt,
      };
    } catch (error) {
      console.error("打印收據失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "打印收據失敗",
      };
    }
  }

  private generateReceiptContent(order: any, templateName: string): any {
    return {
      template: templateName,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      items: [],
      subtotal: amountFromCents(order.subtotalCents) ?? 0,
      tax: amountFromCents(order.taxAmountCents) ?? 0,
      total: amountFromCents(order.totalAmountCents) ?? 0,
      paymentMethod: order.paymentMethod,
      timestamp: new Date().toISOString(),
      footer: "謝謝光臨 MakanMakan",
    };
  }

  private async simulatePrinting(receiptId: string): Promise<void> {
    setTimeout(async () => {
      try {
        const printedTime = new Date();
        await this.db
          .update(receipts)
          .set({
            printStatus: "printed" as const,
            printedAt: printedTime,
          })
          .where(eq(receipts.id, receiptId));
      } catch (error) {
        console.error("更新打印狀態失敗:", error);
      }
    }, 2000);
  }

  // ==========================================
  // 退款處理
  // ==========================================

  async processRefund(
    data: ProcessRefundRequest,
    registerId: string,
    processedBy: string,
    shiftId?: string,
  ): Promise<{ success: boolean; data?: Refund; error?: string }> {
    try {
      const validatedData = processRefundSchema.parse(data);

      // 檢查原訂單
      const originalOrder = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, validatedData.originalOrderId))
        .get();

      if (!originalOrder) {
        return {
          success: false,
          error: "原訂單不存在",
        };
      }

      // 檢查退款金額
      if (originalOrder.totalAmountCents == null) {
        throw new Error("原訂單缺少 total_amount_cents");
      }
      const originalAmountCents = originalOrder.totalAmountCents;
      const originalAmount = amountFromCents(originalAmountCents) ?? 0;
      if (validatedData.refundAmount > originalAmount) {
        return {
          success: false,
          error: "退款金額不能超過原訂單金額",
        };
      }

      const refundId = crypto.randomUUID();
      const refundNumber = businessNumber("RF");
      const refundProcessedAt = new Date();

      const refundData = {
        id: refundId,
        originalOrderId: validatedData.originalOrderId,
        registerId,
        shiftId: shiftId ?? null,
        refundNumber,
        refundType: validatedData.refundType,
        originalAmountCents,
        refundAmountCents: toRequiredCents(validatedData.refundAmount),
        refundMethod: validatedData.refundMethod,
        reasonCode: validatedData.reasonCode,
        reasonDescription: validatedData.reasonDescription ?? null,
        itemsRefunded: JSON.stringify(validatedData.itemsRefunded),
        processedBy,
        customerSignature: validatedData.customerSignature ?? null,
        status: "processing" as const,
        metadata: JSON.stringify({}),
        processedAt: refundProcessedAt,
      };
      const writeStatements: any[] = [
        this.db.insert(refunds).values(refundData),
      ];

      // 記錄現金流動（如果是現金退款）
      if (shiftId && validatedData.refundMethod === "cash") {
        const shift = await this.db
          .select({ registerId: cashShifts.registerId })
          .from(cashShifts)
          .where(eq(cashShifts.id, shiftId))
          .get();

        if (!shift) {
          throw new Error("找不到班次");
        }

        writeStatements.push(
          this.db.insert(cashMovements).values(
            this.createCashMovementData(shiftId, shift.registerId, {
              type: "refund",
              amount: -validatedData.refundAmount,
              description: `退款 - ${refundNumber}`,
              recordedBy: processedBy,
              referenceType: "refund",
            }),
          ),
        );
      }

      await this.db.batch(writeStatements as [any, ...any[]]);

      // 模擬退款完成
      setTimeout(async () => {
        try {
          const refundCompletedAt = new Date();
          await this.db
            .update(refunds)
            .set({
              status: "completed" as const,
              completedAt: refundCompletedAt,
            })
            .where(eq(refunds.id, refundId));
        } catch (error) {
          console.error("更新退款狀態失敗:", error);
        }
      }, 5000);

      // 查詢退款記錄
      const refund = await this.db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .get();

      if (!refund) {
        throw new Error("創建後無法找到退款記錄");
      }

      return {
        success: true,
        data: {
          ...refund,
          originalAmount: amountFromCents(refund.originalAmountCents) ?? 0,
          refundAmount: amountFromCents(refund.refundAmountCents) ?? 0,
          itemsRefunded: JSON.parse(refund.itemsRefunded || "[]"),
          metadata: JSON.parse(refund.metadata || "{}"),
        } as Refund,
      };
    } catch (error) {
      console.error("處理退款失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "處理退款失敗",
      };
    }
  }

  // ==========================================
  // 生成班次報表
  // ==========================================

  async generateShiftReport(
    shiftId: string,

    tx?: any,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const db = tx ?? this.db;
      const reportData = await this.buildShiftReportData(shiftId, { db });

      // 保存報表
      const reportId = crypto.randomUUID();
      const reportGeneratedAt = new Date();

      const reportInsertData = {
        id: reportId,
        shiftId,
        registerId: reportData.shift.registerId,
        operatorId: reportData.shift.operatorId,
        reportData: JSON.stringify(reportData),
        summaryData: JSON.stringify(reportData.summary),
        generatedAt: reportGeneratedAt,
      };

      await db.insert(shiftReports).values(reportInsertData);

      return {
        success: true,
        data: {
          reportId,
          reportData,
        },
      };
    } catch (error) {
      console.error("生成班次報表失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "生成班次報表失敗",
      };
    }
  }

  private async buildShiftReportData(
    shiftId: string,
    options: {
      db?: any;
      shiftOverride?: any;
      extraMovements?: any[];
    } = {},
  ) {
    const db = options.db ?? this.db;

    // 獲取班次基本資訊（包含 JOIN）
    const shift = await db
      .select({
        shift: cashShifts,
        registerName: cashRegisters.name,
        operatorName: users.fullName,
      })
      .from(cashShifts)
      .innerJoin(cashRegisters, eq(cashShifts.registerId, cashRegisters.id))
      .innerJoin(users, eq(cashShifts.operatorId, users.id))
      .where(eq(cashShifts.id, shiftId))
      .get();

    if (!shift) {
      throw new Error("班次不存在");
    }

    // 獲取現金流動記錄
    const existingMovements = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.shiftId, shiftId))
      .orderBy(cashMovements.createdAt)
      .all();

    // 獲取收據統計
    const receiptStats = await db
      .select({
        totalReceipts: count(),
        printedReceipts: sql<number>`COUNT(CASE WHEN ${receipts.printStatus} = 'printed' THEN 1 END)`,
      })
      .from(receipts)
      .where(eq(receipts.shiftId, shiftId))
      .get();

    const shiftRow = options.shiftOverride ?? shift.shift;
    const movements = [
      ...existingMovements,
      ...(options.extraMovements ?? []),
    ].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    // 計算班次時長
    const duration = shiftRow.endedAt
      ? Math.floor(
          (shiftRow.endedAt.getTime() - shiftRow.startedAt.getTime()) / 60000,
        )
      : null;

    const startAmount = amountFromCents(shiftRow.startAmountCents) ?? 0;
    const endAmount = amountFromCents(shiftRow.endAmountCents) ?? 0;
    const expectedAmount = amountFromCents(shiftRow.expectedAmountCents) ?? 0;
    const actualAmount = amountFromCents(shiftRow.actualAmountCents) ?? 0;
    const differenceAmount =
      amountFromCents(shiftRow.differenceAmountCents) ?? 0;
    const totalSales = amountFromCents(shiftRow.totalSalesCents) ?? 0;
    const totalRefunds = amountFromCents(shiftRow.totalRefundsCents) ?? 0;
    const cashSales = amountFromCents(shiftRow.cashSalesCents) ?? 0;
    const cardSales = amountFromCents(shiftRow.cardSalesCents) ?? 0;
    const digitalSales = amountFromCents(shiftRow.digitalSalesCents) ?? 0;

    return {
      shift: {
        ...shiftRow,
        registerName: shift.registerName,
        operatorName: shift.operatorName,
        duration,
      },
      summary: {
        startAmount,
        endAmount,
        totalSales,
        totalRefunds,
        netSales: totalSales - totalRefunds,
        expectedAmount,
        actualAmount,
        difference: differenceAmount,
      },
      breakdown: {
        cashSales,
        cardSales,
        digitalSales,
      },
      movements: movements.map((movement: any) => ({
        ...movement,
        denominationBreakdown: JSON.parse(
          movement.denominationBreakdown || "{}",
        ),
        metadata: JSON.parse(movement.metadata || "{}"),
      })),
      receipts: receiptStats || { totalReceipts: 0, printedReceipts: 0 },
    };
  }

  private mapCashShift(shift: typeof cashShifts.$inferSelect): CashShift {
    return {
      ...shift,
      startAmount: amountFromCents(shift.startAmountCents) ?? 0,
      endAmount: amountFromCents(shift.endAmountCents) ?? undefined,
      expectedAmount: amountFromCents(shift.expectedAmountCents) ?? 0,
      actualAmount: amountFromCents(shift.actualAmountCents) ?? undefined,
      differenceAmount: amountFromCents(shift.differenceAmountCents) ?? 0,
      totalSales: amountFromCents(shift.totalSalesCents) ?? 0,
      totalRefunds: amountFromCents(shift.totalRefundsCents) ?? 0,
      cashSales: amountFromCents(shift.cashSalesCents) ?? 0,
      cardSales: amountFromCents(shift.cardSalesCents) ?? 0,
      digitalSales: amountFromCents(shift.digitalSalesCents) ?? 0,
      status: shift.status as CashShift["status"],
      endedAt: shift.endedAt ?? undefined,
      notes: shift.notes ?? undefined,
      closingNotes: shift.closingNotes ?? undefined,
    };
  }

  // ==========================================
  // 獲取班次統計
  // ==========================================

  async getShiftStats(
    restaurantId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const whereConditions = dateRange
        ? and(
            eq(cashRegisters.restaurantId, restaurantId),
            sql`${cashShifts.startedAt} >= ${dateRange.from.getTime()}`,
            sql`${cashShifts.startedAt} <= ${dateRange.to.getTime()}`,
          )
        : eq(cashRegisters.restaurantId, restaurantId);

      const stats = await this.db
        .select({
          totalShifts: count(),
          totalSales: sumMoneyAmount(cashShifts.totalSalesCents),
          totalRefunds: sumMoneyAmount(cashShifts.totalRefundsCents),
          avgSalesPerShift: avgMoneyAmount(cashShifts.totalSalesCents),
          totalCashSales: sumMoneyAmount(cashShifts.cashSalesCents),
          totalCardSales: sumMoneyAmount(cashShifts.cardSalesCents),
          totalDigitalSales: sumMoneyAmount(cashShifts.digitalSalesCents),
          closedShifts: sql<number>`COUNT(CASE WHEN ${cashShifts.status} = 'closed' THEN 1 END)`,
          avgCashDifference: avgAbsMoneyAmount(
            cashShifts.differenceAmountCents,
          ),
        })
        .from(cashShifts)
        .innerJoin(cashRegisters, eq(cashShifts.registerId, cashRegisters.id))
        .where(whereConditions)
        .get();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error("獲取班次統計失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取班次統計失敗",
      };
    }
  }
}
