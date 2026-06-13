/**
 * 收據管理服務
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import {
  amountFromCents,
  businessNumber,
  dateFromUnixMs,
  receipts,
  orders,
  orderItems,
} from "@makanmakan/database";

type OrderRow = typeof orders.$inferSelect;
type ReceiptRow = typeof receipts.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;
import type { Receipt, PrintReceiptRequest } from "../types";
import { printReceiptSchema } from "../schemas";

export class ReceiptService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * Map a receipts row to the Receipt domain type: parse the JSON content
   * column and normalise nullable columns to optional (null -> undefined).
   */
  private mapReceipt(receipt: ReceiptRow): Receipt {
    return {
      id: receipt.id,
      orderId: receipt.orderId,
      registerId: receipt.registerId,
      shiftId: receipt.shiftId ?? undefined,
      receiptNumber: receipt.receiptNumber,
      receiptType: receipt.receiptType as Receipt["receiptType"],
      templateName: receipt.templateName,
      content: JSON.parse(receipt.content || "{}"),
      rawContent: receipt.rawContent ?? undefined,
      printStatus: receipt.printStatus as Receipt["printStatus"],
      printAttempts: receipt.printAttempts,
      printerName: receipt.printerName ?? undefined,
      printerResponse: receipt.printerResponse ?? undefined,
      printedAt: receipt.printedAt ?? undefined,
      reprintedCount: receipt.reprintedCount,
      lastReprintAt: receipt.lastReprintAt ?? undefined,
      createdAt: receipt.createdAt,
    };
  }

  /**
   * 打印收據
   */
  async printReceipt(
    data: PrintReceiptRequest,
    registerId: string,
    shiftId?: string,
  ): Promise<{ success: boolean; data?: Receipt; error?: string }> {
    try {
      const validatedData = printReceiptSchema.parse(data);

      // 檢查訂單是否存在
      const [order] = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, validatedData.orderId))
        .limit(1);

      if (!order) {
        return {
          success: false,
          error: "訂單不存在",
        };
      }

      const receiptId = crypto.randomUUID();
      const receiptNumber = businessNumber("R");

      // 生成收據內容
      const receiptContent = await this.generateReceiptContent(
        order,
        validatedData.templateName,
      );

      const now = new Date();
      await this.db.insert(receipts).values({
        id: receiptId,
        orderId: validatedData.orderId,
        registerId,
        shiftId: shiftId || null,
        receiptNumber,
        receiptType: validatedData.receiptType,
        templateName: validatedData.templateName,
        content: JSON.stringify(receiptContent),
        printStatus: "pending",
        printAttempts: 0,
        reprintedCount: 0,
        createdAt: now,
      });

      // 模擬打印過程
      this.simulatePrinting(receiptId, validatedData.copies);

      const [receipt] = await this.db
        .select()
        .from(receipts)
        .where(eq(receipts.id, receiptId))
        .limit(1);

      return {
        success: true,
        data: this.mapReceipt(receipt),
      };
    } catch (error) {
      console.error("打印收據失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "打印收據失敗",
      };
    }
  }

  /**
   * 重打收據
   */
  async reprintReceipt(
    receiptId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 檢查收據是否存在
      const [receipt] = await this.db
        .select()
        .from(receipts)
        .where(eq(receipts.id, receiptId))
        .limit(1);

      if (!receipt) {
        return {
          success: false,
          error: "收據不存在",
        };
      }

      // 更新重打次數
      const reprintTime = new Date();
      await this.db
        .update(receipts)
        .set({
          reprintedCount: sql`${receipts.reprintedCount} + 1`,
          lastReprintAt: reprintTime,
          printStatus: "pending",
        })
        .where(eq(receipts.id, receiptId));

      // 模擬重打過程
      this.simulatePrinting(receiptId, 1);

      return {
        success: true,
      };
    } catch (error) {
      console.error("重打收據失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "重打收據失敗",
      };
    }
  }

  /**
   * 獲取收據列表
   */
  async getReceipts(
    registerId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      receiptType?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    success: boolean;
    data?: {
      receipts: Receipt[];
      pagination: { page: number; limit: number; hasMore: boolean };
    };
    error?: string;
  }> {
    try {
      const {
        startDate,
        endDate,
        receiptType,
        page = 1,
        limit = 20,
      } = options || {};
      const offset = (page - 1) * limit;

      const conditions: SQL[] = [eq(receipts.registerId, registerId)];

      if (startDate) {
        conditions.push(
          sql`${dateFromUnixMs(receipts.createdAt)} >= ${startDate}`,
        );
      }

      if (endDate) {
        conditions.push(
          sql`${dateFromUnixMs(receipts.createdAt)} <= ${endDate}`,
        );
      }

      if (receiptType) {
        conditions.push(eq(receipts.receiptType, receiptType));
      }

      const receiptList = await this.db
        .select()
        .from(receipts)
        .where(and(...conditions))
        .orderBy(desc(receipts.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        success: true,
        data: {
          receipts: receiptList.map((receipt) => this.mapReceipt(receipt)),
          pagination: {
            page,
            limit,
            hasMore: receiptList.length === limit,
          },
        },
      };
    } catch (error) {
      console.error("獲取收據列表失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取收據列表失敗",
      };
    }
  }

  /**
   * 獲取收據詳情
   */
  async getReceiptDetail(
    receiptId: string,
  ): Promise<{ success: boolean; data?: Receipt; error?: string }> {
    try {
      const [receipt] = await this.db
        .select()
        .from(receipts)
        .where(eq(receipts.id, receiptId))
        .limit(1);

      if (!receipt) {
        return {
          success: false,
          error: "收據不存在",
        };
      }

      return {
        success: true,
        data: this.mapReceipt(receipt),
      };
    } catch (error) {
      console.error("獲取收據詳情失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取收據詳情失敗",
      };
    }
  }

  /**
   * 生成收據內容
   */
  private async generateReceiptContent(
    order: OrderRow,
    templateName: string,
  ): Promise<Record<string, unknown>> {
    // 獲取訂單項目
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    // Drizzle returns camelCase keys based on the schema definition; the
    // snake_case fallback chain that used to live here was dead code.
    // Customer/table display names live outside the orders row — they're
    // pulled from the customerInfo JSON snapshot and (TODO) a tables join.
    const customerSnapshot = order.customerInfo ?? null;

    return {
      template: templateName,
      orderNumber: order.orderNumber,
      customerName: customerSnapshot?.name ?? null,
      // TODO: join `tables` to surface the table number — currently absent.
      tableNumber: null as string | null,
      items: items.map((item: OrderItemRow) => ({
        name: item.itemSnapshot?.name ?? null,
        quantity: item.quantity,
        price: amountFromCents(item.unitPriceCents, item.unitPrice) ?? 0,
        subtotal: amountFromCents(item.totalPriceCents, item.totalPrice) ?? 0,
        customizations:
          typeof item.customizations === "string"
            ? JSON.parse(item.customizations || "[]")
            : (item.customizations ?? []),
      })),
      subtotal: amountFromCents(order.subtotalCents, order.subtotal) ?? 0,
      taxAmount: amountFromCents(order.taxAmountCents, order.taxAmount) ?? 0,
      discountAmount:
        amountFromCents(order.discountAmountCents, order.discountAmount) ?? 0,
      totalAmount:
        amountFromCents(order.totalAmountCents, order.totalAmount) ?? 0,
      paymentMethod: order.paymentMethod,
      timestamp: new Date().toISOString(),
      footer: "謝謝光臨 MakanMakan",
    };
  }

  /**
   * 模擬打印過程
   */
  private simulatePrinting(receiptId: string, copies: number = 1): void {
    setTimeout(async () => {
      try {
        const printedTime = new Date();
        await this.db
          .update(receipts)
          .set({
            printStatus: "printed",
            printedAt: printedTime,
            printAttempts: sql`${receipts.printAttempts} + 1`,
          })
          .where(eq(receipts.id, receiptId));
      } catch (error) {
        console.error("更新打印狀態失敗:", error);
        // 標記為打印失敗
        try {
          await this.db
            .update(receipts)
            .set({
              printStatus: "failed",
              printAttempts: sql`${receipts.printAttempts} + 1`,
            })
            .where(eq(receipts.id, receiptId));
        } catch (updateError) {
          console.error("更新失敗狀態失敗:", updateError);
        }
      }
    }, 2000 * copies); // 每份收據需要2秒打印時間
  }

  /**
   * 取消收據打印
   */
  async cancelPrint(
    receiptId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db
        .update(receipts)
        .set({ printStatus: "cancelled" })
        .where(
          and(eq(receipts.id, receiptId), eq(receipts.printStatus, "pending")),
        );

      return { success: true };
    } catch (error) {
      console.error("取消打印失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "取消打印失敗",
      };
    }
  }
}
