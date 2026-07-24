/**
 * 退款管理服務
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql, inArray, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  refunds,
  orders,
  cashMovements,
  cashShifts,
  amountFromCents,
  businessNumber,
  dateFromUnixMs,
  sumMoneyAmount,
} from "@makanmakan/database";
import type { Refund, ProcessRefundRequest } from "../types";
import { processRefundSchema } from "../schemas";
import { toRequiredCents } from "../../../shared/utils/money";

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

export interface RefundCompletionAlert {
  title: string;
  message: string;
  severity: "error" | "critical";
  metadata: Record<string, unknown>;
}

export interface RefundServiceOptions {
  alertSink?: (alert: RefundCompletionAlert) => Promise<void> | void;
}

export class RefundService {
  private db;
  private readonly alertSink?: RefundServiceOptions["alertSink"];

  constructor(d1: D1Database, options: RefundServiceOptions = {}) {
    this.db = drizzle(d1);
    this.alertSink = options.alertSink;
  }

  /**
   * 處理退款
   */
  async processRefund(
    data: ProcessRefundRequest,
    registerId: string,
    processedBy: string,
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
      const orderTotalAmount =
        amountFromCents(originalOrder.totalAmountCents) ?? 0;
      if (validatedData.refundAmount > orderTotalAmount) {
        return {
          success: false,
          error: "退款金額不能超過原訂單金額",
        };
      }

      // 檢查是否已有退款記錄
      const [existingRefund] = await this.db
        .select({
          totalRefunded: sumMoneyAmount(refunds.refundAmountCents),
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
      const refundNumber = businessNumber("RF");

      const processedAt = new Date();
      const writeStatements: BatchItem<"sqlite">[] = [
        this.db.insert(refunds).values({
          id: refundId,
          originalOrderId: validatedData.originalOrderId,
          registerId,
          shiftId: shiftId || null,
          refundNumber,
          refundType: validatedData.refundType,
          originalAmountCents: toRequiredCents(orderTotalAmount),
          refundAmountCents: toRequiredCents(validatedData.refundAmount),
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
        }),
      ];

      // 記錄現金流動（如果是現金退款）— closed shifts must not mutate the live
      // ledger. The refund row itself serves as the adjustment record.
      if (!isPostClose && shiftId && validatedData.refundMethod === "cash") {
        writeStatements.push(
          this.buildCashMovementInsert(shiftId, registerId, {
            type: "refund",
            amount: -validatedData.refundAmount, // 負數表示流出
            description: `退款 - ${refundNumber}`,
            recordedBy: processedBy,
            referenceId: undefined,
            referenceType: "refund",
          }),
        );
      }

      await this.db.batch(
        writeStatements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
      );

      // Complete the refund synchronously. The previous implementation
      // scheduled this via setTimeout to mimic an asynchronous PSP callback,
      // but on Cloudflare Workers a timer scheduled after the response is sent
      // is not guaranteed to run (and there is no real external callback here),
      // so refunds got stuck in "processing". There is no genuine async work to
      // defer, so we settle the terminal state before returning.
      await this.completeRefund(refundId);

      const [refund] = await this.db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .limit(1);

      const base = {
        ...refund,
        originalAmount: amountFromCents(refund.originalAmountCents) ?? 0,
        refundAmount: amountFromCents(refund.refundAmountCents) ?? 0,
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
      orderId?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    success: boolean;
    data?: {
      refunds: (typeof refunds.$inferSelect & {
        itemsRefunded: unknown;
        metadata: unknown;
      })[];
      pagination: { page: number; limit: number; hasMore: boolean };
    };
    error?: string;
  }> {
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

      const conditions: SQL[] = [eq(refunds.registerId, registerId)];

      if (startDate) {
        conditions.push(
          sql`${dateFromUnixMs(refunds.processedAt)} >= ${startDate}`,
        );
      }

      if (endDate) {
        conditions.push(
          sql`${dateFromUnixMs(refunds.processedAt)} <= ${endDate}`,
        );
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
          refunds: refundList.map((refund: typeof refunds.$inferSelect) => ({
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
  async getRefundDetail(refundId: string): Promise<{
    success: boolean;
    data?: typeof refunds.$inferSelect & {
      itemsRefunded: unknown;
      metadata: unknown;
    };
    error?: string;
  }> {
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
    cancelledBy: string,
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
    approvedBy: string,
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
    rejectedBy: string,
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
  private buildCashMovementInsert(
    shiftId: string,
    registerId: string,
    movement: {
      type: string;
      amount: number;
      description: string;
      recordedBy: string;
      referenceId?: number;
      referenceType?: string;
    },
  ): BatchItem<"sqlite"> {
    const movementId = crypto.randomUUID();
    const now = new Date();

    return this.db.insert(cashMovements).values({
      id: movementId,
      shiftId,
      registerId,
      type: movement.type,
      amountCents: toRequiredCents(movement.amount),
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
   * Settle the refund's terminal state. Runs synchronously (awaited by the
   * caller) rather than on a fire-and-forget timer. Any write failure is
   * handled here — the refund is best-effort marked "failed" and an alert is
   * raised — so a completion failure never rejects the caller.
   */
  private async completeRefund(refundId: string): Promise<void> {
    try {
      const completedAt = new Date();
      await this.db
        .update(refunds)
        .set({
          status: "completed",
          completedAt,
        })
        .where(and(eq(refunds.id, refundId), eq(refunds.status, "processing")));
    } catch (error) {
      console.error("更新退款狀態失敗:", error);
      let markFailedError: unknown;
      try {
        await this.db
          .update(refunds)
          .set({ status: "failed" })
          .where(
            and(eq(refunds.id, refundId), eq(refunds.status, "processing")),
          );
        await this.alertRefundCompletionFailure(refundId, error);
      } catch (updateError) {
        markFailedError = updateError;
        await this.alertRefundCompletionFailure(
          refundId,
          error,
          markFailedError,
        );
        console.error("更新失敗狀態失敗:", updateError);
      }
    }
  }
  private async alertRefundCompletionFailure(
    refundId: string,
    completionError: unknown,
    markFailedError?: unknown,
  ): Promise<void> {
    if (!this.alertSink) {
      return;
    }

    try {
      await this.alertSink({
        title: "Refund completion failed",
        message: markFailedError
          ? "Refund completion failed and the refund could not be marked failed."
          : "Refund completion failed and the refund was marked failed.",
        severity: markFailedError ? "critical" : "error",
        metadata: {
          refundId,
          completionError: errorMessage(completionError),
          ...(markFailedError
            ? { markFailedError: errorMessage(markFailedError) }
            : {}),
        },
      });
    } catch (alertError) {
      console.error("Refund failure alert failed:", alertError);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
