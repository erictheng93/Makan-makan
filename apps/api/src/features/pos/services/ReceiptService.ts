/**
 * 收據管理服務
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import { receipts, orders, orderItems } from "@makanmakan/database";

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
      const receiptNumber = `R${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

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
        data: {
          ...receipt,
          content: JSON.parse((receipt.content as string) || "{}"),
        } as unknown as Receipt,
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
        conditions.push(sql`DATE(${receipts.createdAt}) >= ${startDate}`);
      }

      if (endDate) {
        conditions.push(sql`DATE(${receipts.createdAt}) <= ${endDate}`);
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
          receipts: receiptList.map(
            (receipt: ReceiptRow) =>
              ({
                ...receipt,
                content: JSON.parse((receipt.content as string) || "{}"),
              }) as unknown as Receipt,
          ),
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
        data: {
          ...receipt,
          content: JSON.parse((receipt.content as string) || "{}"),
        } as unknown as Receipt,
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

    // Some legacy records carry snake_case column duplicates — index loosely.
    const o = order as OrderRow & Record<string, unknown>;

    return {
      template: templateName,
      orderNumber: o.order_number || o.orderNumber,
      customerName: o.customer_name || o.customerName,
      tableNumber: o.table_number || o.tableNumber,
      items: items.map((item: OrderItemRow) => {
        const it = item as OrderItemRow & Record<string, unknown>;
        return {
          name: it.item_name || it.itemName || it.name,
          quantity: it.quantity,
          price: it.unitPrice || it.price,
          subtotal: it.totalPrice || it.subtotal,
          customizations:
            typeof it.customizations === "string"
              ? JSON.parse(it.customizations || "[]")
              : it.customizations || [],
        };
      }),
      subtotal: o.subtotal,
      taxAmount: o.tax_amount || o.taxAmount,
      discountAmount: o.discount_amount || o.discountAmount,
      totalAmount: o.total_amount || o.totalAmount,
      paymentMethod: o.payment_method || o.paymentMethod,
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
