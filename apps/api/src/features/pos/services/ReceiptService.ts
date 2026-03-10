/**
 * 收據管理服務
 */

import { BaseService } from "../../../shared/services/BaseService";
import { getCurrentTimestamp } from "@makanmakan/database";
import type { Receipt, PrintReceiptRequest } from "../types";
import { printReceiptSchema } from "../schemas";

export class ReceiptService extends BaseService {
  constructor(db: any) {
    super(db);
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
      const order = await this.d1
        .prepare("SELECT * FROM orders WHERE id = ?")
        .bind(validatedData.orderId)
        .first();

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
        order as any,
        validatedData.templateName,
      );

      const now = getCurrentTimestamp();
      await this.d1
        .prepare(
          `
        INSERT INTO receipts (
          id, order_id, register_id, shift_id, receipt_number, receipt_type,
          template_name, content, print_status, print_attempts, reprinted_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?)
      `,
        )
        .bind(
          receiptId,
          validatedData.orderId,
          registerId,
          shiftId || null,
          receiptNumber,
          validatedData.receiptType,
          validatedData.templateName,
          JSON.stringify(receiptContent),
          now,
        )
        .run();

      // 模擬打印過程
      this.simulatePrinting(receiptId, validatedData.copies);

      const receipt = (await this.d1
        .prepare("SELECT * FROM receipts WHERE id = ?")
        .bind(receiptId)
        .first()) as any;

      return {
        success: true,
        data: {
          ...receipt,
          content: JSON.parse(receipt.content || "{}"),
        },
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
      const receipt = await this.d1
        .prepare("SELECT * FROM receipts WHERE id = ?")
        .bind(receiptId)
        .first();

      if (!receipt) {
        return {
          success: false,
          error: "收據不存在",
        };
      }

      // 更新重打次數
      const reprintTime = getCurrentTimestamp();
      await this.d1
        .prepare(
          `
        UPDATE receipts
        SET reprinted_count = reprinted_count + 1,
            last_reprint_at = ?,
            print_status = 'pending'
        WHERE id = ?
      `,
        )
        .bind(reprintTime, receiptId)
        .run();

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
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const {
        startDate,
        endDate,
        receiptType,
        page = 1,
        limit = 20,
      } = options || {};
      const offset = (page - 1) * limit;

      const filters = [];
      const params = [registerId];

      if (startDate) {
        filters.push("DATE(created_at) >= ?");
        params.push(startDate);
      }

      if (endDate) {
        filters.push("DATE(created_at) <= ?");
        params.push(endDate);
      }

      if (receiptType) {
        filters.push("receipt_type = ?");
        params.push(receiptType);
      }

      const whereClause =
        filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "";

      const receipts = await this.d1
        .prepare(
          `
        SELECT
          r.*,
          o.order_number,
          o.customer_name,
          o.total_amount
        FROM receipts r
        LEFT JOIN orders o ON r.order_id = o.id
        WHERE r.register_id = ? ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `,
        )
        .bind(...params, limit, offset)
        .all();

      return {
        success: true,
        data: {
          receipts: (receipts.results || []).map((receipt: any) => ({
            ...receipt,
            content: JSON.parse(receipt.content || "{}"),
          })),
          pagination: {
            page,
            limit,
            hasMore: (receipts.results || []).length === limit,
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
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const receipt = await this.d1
        .prepare(
          `
        SELECT
          r.*,
          o.order_number,
          o.customer_name,
          o.total_amount,
          o.payment_method,
          cr.name as register_name
        FROM receipts r
        LEFT JOIN orders o ON r.order_id = o.id
        LEFT JOIN cash_registers cr ON r.register_id = cr.id
        WHERE r.id = ?
      `,
        )
        .bind(receiptId)
        .first();

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
          content: JSON.parse(receipt.content || "{}"),
        },
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
    order: any,
    templateName: string,
  ): Promise<any> {
    // 獲取訂單項目
    const orderItems = await this.d1
      .prepare(
        `
      SELECT
        oi.*,
        mi.name as item_name,
        mi.price as item_price
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
    `,
      )
      .bind(order.id)
      .all();

    return {
      template: templateName,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      tableNumber: order.table_number,
      items: (orderItems.results || []).map((item: any) => ({
        name: item.item_name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        customizations: JSON.parse(item.customizations || "[]"),
      })),
      subtotal: order.subtotal,
      taxAmount: order.tax_amount,
      discountAmount: order.discount_amount,
      totalAmount: order.total_amount,
      paymentMethod: order.payment_method,
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
        const printedTime = getCurrentTimestamp();
        await this.d1
          .prepare(
            `
          UPDATE receipts
          SET print_status = 'printed',
              printed_at = ?,
              print_attempts = print_attempts + 1
          WHERE id = ?
        `,
          )
          .bind(printedTime, receiptId)
          .run();
      } catch (error) {
        console.error("更新打印狀態失敗:", error);
        // 標記為打印失敗
        try {
          await this.d1
            .prepare(
              `
            UPDATE receipts
            SET print_status = 'failed',
                print_attempts = print_attempts + 1
            WHERE id = ?
          `,
            )
            .bind(receiptId)
            .run();
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
      await this.d1
        .prepare(
          `
        UPDATE receipts
        SET print_status = 'cancelled'
        WHERE id = ? AND print_status = 'pending'
      `,
        )
        .bind(receiptId)
        .run();

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
