/**
 * 退款管理服務
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  refunds,
  orders,
  cashMovements,
  cashShifts,
} from "@makanmakan/database";
import type { Refund, ProcessRefundRequest } from "../types";
import { processRefundSchema } from "../schemas";

// K6 release gate: refunds issued while a shift is already closed must not
// mutate the closed ledger totals or post a live cash movement. Instead the
// refund row itself acts as the adjustment/credit-note and the response
// signals `ledgerMutation: false` so the caller can verify the invariant.
type PostCloseRefundResult = Refund & {
  refundId: string;
  adjustmentId: string;
  ledgerMutation: false;
};
type LiveRefundResult = Refund & {
  refundId: string;
  ledgerMutation: true;
};
type RefundResult = PostCloseRefundResult | LiveRefundResult;

export class RefundService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 處理退款
   */
  async processRefund(
    data: ProcessRefundRequest,
    registerId: string,
    processedBy: number,
    shiftId?: string,
  ): Promise<{ success: boolean; data?: RefundResult; error?: string }> {
    try {
      const validatedData = processRefundSchema.parse(data);

      // 檢查原訂單
      const [originalOrder] = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, validatedData.originalOrderId))
        .limit(1);

      if (!originalOrder) {
        return {
          success: false,
          error: "原訂單不存在",
        };
      }

      // 檢查退款金額是否合理
      const orderTotalAmount = parseFloat(
        String(
          (originalOrder as any).total_amount ??
            (originalOrder as any).totalAmount ??
            0,
        ),
      );
      if (validatedData.refundAmount > orderTotalAmount) {
        return {
          success: false,
          error: "退款金額不能超過原訂單金額",
        };
      }

      // 檢查是否已有退款記錄
      const [existingRefund] = await this.db
        .select({
          totalRefunded: sql<number>`SUM(${refunds.refundAmount})`,
        })
        .from(refunds)
        .where(
          and(
            eq(refunds.originalOrderId, validatedData.originalOrderId),
            inArray(refunds.status, ["completed", "processing"]),
          ),
        );

      const totalRefunded = existingRefund?.totalRefunded || 0;
      if (totalRefunded + validatedData.refundAmount > orderTotalAmount) {
        return {
          success: false,
          error: "退款金額超過可退款額度",
        };
      }

      // K6: detect post-close adjustment by looking up the referenced shift.
      // Only an explicitly closed shift triggers the no-ledger-mutation path;
      // active/suspended/unknown shifts fall through to the normal refund flow.
      let isPostClose = false;
      if (shiftId) {
        const [shift] = await this.db
          .select({ status: cashShifts.status })
          .from(cashShifts)
          .where(eq(cashShifts.id, shiftId))
          .limit(1);
        isPostClose = shift?.status === "closed";
      }

      const refundId = crypto.randomUUID();
      const refundNumber = `RF${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const processedAt = new Date();
      await this.db.insert(refunds).values({
        id: refundId,
        originalOrderId: validatedData.originalOrderId,
        registerId,
        shiftId: shiftId || null,
        refundNumber,
        refundType: validatedData.refundType,
        originalAmount: orderTotalAmount,
        refundAmount: validatedData.refundAmount,
        refundMethod: validatedData.refundMethod,
        reasonCode: validatedData.reasonCode,
        reasonDescription: validatedData.reasonDescription || null,
        itemsRefunded: JSON.stringify(validatedData.itemsRefunded || []),
        processedBy,
        customerSignature: validatedData.customerSignature || null,
        status: "processing",
        metadata: JSON.stringify(
          isPostClose ? { postCloseAdjustment: true } : {},
        ),
        processedAt,
      });

      // 記錄現金流動（如果是現金退款）— closed shifts must not mutate the live
      // ledger. The refund row itself serves as the adjustment record.
      if (!isPostClose && shiftId && validatedData.refundMethod === "cash") {
        await this.recordCashMovement(shiftId, registerId, {
          type: "refund",
          amount: -validatedData.refundAmount, // 負數表示流出
          description: `退款 - ${refundNumber}`,
          recordedBy: processedBy,
          referenceId: validatedData.originalOrderId,
          referenceType: "refund",
        });
      }

      // 模擬退款處理完成
      this.processRefundCompletion(refundId);

      const [refund] = await this.db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .limit(1);

      const base = {
        ...refund,
        itemsRefunded: JSON.parse((refund.itemsRefunded as string) || "[]"),
        metadata: JSON.parse((refund.metadata as string) || "{}"),
        refundId: refund.id,
      };

      return {
        success: true,
        data: (isPostClose
          ? {
              ...base,
              adjustmentId: refund.id,
              ledgerMutation: false,
            }
          : {
              ...base,
              ledgerMutation: true,
            }) as RefundResult,
      };
    } catch (error) {
      console.error("處理退款失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "處理退款失敗",
      };
    }
  }

  /**
   * 獲取退款記錄
   */
  async getRefunds(
    registerId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      orderId?: number;
      page?: number;
      limit?: number;
    },
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const {
        startDate,
        endDate,
        status,
        orderId,
        page = 1,
        limit = 20,
      } = options || {};
      const offset = (page - 1) * limit;

      const conditions: any[] = [eq(refunds.registerId, registerId)];

      if (startDate) {
        conditions.push(
          sql`DATE(${refunds.processedAt}) >= ${startDate}` as any,
        );
      }

      if (endDate) {
        conditions.push(sql`DATE(${refunds.processedAt}) <= ${endDate}` as any);
      }

      if (status) {
        conditions.push(eq(refunds.status, status));
      }

      if (orderId) {
        conditions.push(eq(refunds.originalOrderId, orderId));
      }

      const refundList = await this.db
        .select()
        .from(refunds)
        .where(and(...conditions))
        .orderBy(desc(refunds.processedAt))
        .limit(limit)
        .offset(offset);

      return {
        success: true,
        data: {
          refunds: refundList.map((refund: any) => ({
            ...refund,
            itemsRefunded: JSON.parse((refund.itemsRefunded as string) || "[]"),
            metadata: JSON.parse((refund.metadata as string) || "{}"),
          })),
          pagination: {
            page,
            limit,
            hasMore: refundList.length === limit,
          },
        },
      };
    } catch (error) {
      console.error("獲取退款記錄失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取退款記錄失敗",
      };
    }
  }

  /**
   * 獲取退款詳情
   */
  async getRefundDetail(
    refundId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const [refund] = await this.db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .limit(1);

      if (!refund) {
        return {
          success: false,
          error: "退款記錄不存在",
        };
      }

      return {
        success: true,
        data: {
          ...refund,
          itemsRefunded: JSON.parse((refund.itemsRefunded as string) || "[]"),
          metadata: JSON.parse((refund.metadata as string) || "{}"),
        },
      };
    } catch (error) {
      console.error("獲取退款詳情失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取退款詳情失敗",
      };
    }
  }

  /**
   * 取消退款
   */
  async cancelRefund(
    refundId: string,
    cancelledBy: number,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const metadata = reason
        ? JSON.stringify({ cancellation_reason: reason })
        : "{}";

      await this.db
        .update(refunds)
        .set({
          status: "cancelled",
          metadata,
          approvedBy: cancelledBy,
        })
        .where(
          and(
            eq(refunds.id, refundId),
            inArray(refunds.status, ["pending", "processing"]),
          ),
        );

      return { success: true };
    } catch (error) {
      console.error("取消退款失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "取消退款失敗",
      };
    }
  }

  /**
   * 審核退款
   */
  async approveRefund(
    refundId: string,
    approvedBy: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const completedAt = new Date();
      await this.db
        .update(refunds)
        .set({
          status: "completed",
          approvedBy,
          completedAt,
        })
        .where(and(eq(refunds.id, refundId), eq(refunds.status, "processing")));

      return { success: true };
    } catch (error) {
      console.error("審核退款失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "審核退款失敗",
      };
    }
  }

  /**
   * 拒絕退款
   */
  async rejectRefund(
    refundId: string,
    rejectedBy: number,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const metadata = reason
        ? JSON.stringify({ rejection_reason: reason })
        : "{}";

      await this.db
        .update(refunds)
        .set({
          status: "failed",
          approvedBy: rejectedBy,
          metadata,
        })
        .where(and(eq(refunds.id, refundId), eq(refunds.status, "processing")));

      return { success: true };
    } catch (error) {
      console.error("拒絕退款失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "拒絕退款失敗",
      };
    }
  }

  /**
   * 記錄現金流動
   */
  private async recordCashMovement(
    shiftId: string,
    registerId: string,
    movement: {
      type: string;
      amount: number;
      description: string;
      recordedBy: number;
      referenceId?: number;
      referenceType?: string;
    },
  ): Promise<void> {
    const movementId = crypto.randomUUID();
    const now = new Date();

    await this.db.insert(cashMovements).values({
      id: movementId,
      shiftId,
      registerId,
      type: movement.type,
      amount: movement.amount,
      description: movement.description,
      referenceId: movement.referenceId || null,
      referenceType: movement.referenceType || null,
      denominationBreakdown: "{}",
      recordedBy: movement.recordedBy,
      approvalStatus: "approved",
      metadata: "{}",
      createdAt: now,
    });
  }

  /**
   * 模擬退款處理完成
   */
  private processRefundCompletion(refundId: string): void {
    setTimeout(async () => {
      try {
        const completedAt = new Date();
        await this.db
          .update(refunds)
          .set({
            status: "completed",
            completedAt,
          })
          .where(
            and(eq(refunds.id, refundId), eq(refunds.status, "processing")),
          );
      } catch (error) {
        console.error("更新退款狀態失敗:", error);
        try {
          await this.db
            .update(refunds)
            .set({ status: "failed" })
            .where(
              and(eq(refunds.id, refundId), eq(refunds.status, "processing")),
            );
        } catch (updateError) {
          console.error("更新失敗狀態失敗:", updateError);
        }
      }
    }, 5000); // 5秒後完成退款處理
  }
}
