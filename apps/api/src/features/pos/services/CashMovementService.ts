/**
 * 現金操作管理服務
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import {
  cashMovements,
  cashShifts,
  dateFromUnixMs,
} from "@makanmakan/database";
import type {
  CashMovement as _CashMovement,
  CashMovementRequest,
} from "../types";
import { cashMovementSchema } from "../schemas";
import { toRequiredCents } from "../../../shared/utils/money";

export class CashMovementService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 處理現金操作
   */
  async processCashMovement(
    shiftId: string,
    data: CashMovementRequest,
    operatorId: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const validatedData = cashMovementSchema.parse(data);

      // 檢查班次狀態
      const [shift] = await this.db
        .select({
          status: cashShifts.status,
          registerId: cashShifts.registerId,
        })
        .from(cashShifts)
        .where(eq(cashShifts.id, shiftId))
        .limit(1);

      if (!shift || shift.status !== "active") {
        return {
          success: false,
          error: "班次不存在或已結束",
        };
      }

      await this.recordCashMovement(shiftId, shift.registerId, {
        type: validatedData.type,
        amount: validatedData.amount,
        description: validatedData.description,
        recordedBy: operatorId,
        referenceId: validatedData.referenceId,
        referenceType: validatedData.referenceType,
        denominationBreakdown: validatedData.denominationBreakdown,
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

  /**
   * 獲取現金流動記錄
   */
  async getCashMovements(
    shiftId: string,
    options?: {
      type?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    success: boolean;
    data?: {
      movements: (typeof cashMovements.$inferSelect & {
        denominationBreakdown: unknown;
        metadata: unknown;
      })[];
      pagination: { page: number; limit: number; hasMore: boolean };
    };
    error?: string;
  }> {
    try {
      const { type, page = 1, limit = 20 } = options || {};
      const offset = (page - 1) * limit;

      const conditions = [eq(cashMovements.shiftId, shiftId)];
      if (type) {
        conditions.push(eq(cashMovements.type, type));
      }

      const movements = await this.db
        .select()
        .from(cashMovements)
        .where(and(...conditions))
        .orderBy(desc(cashMovements.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        success: true,
        data: {
          movements: movements.map(
            (movement: typeof cashMovements.$inferSelect) => ({
              ...movement,
              denominationBreakdown: JSON.parse(
                (movement.denominationBreakdown as string) || "{}",
              ),
              metadata: JSON.parse((movement.metadata as string) || "{}"),
            }),
          ),
          pagination: {
            page,
            limit,
            hasMore: movements.length === limit,
          },
        },
      };
    } catch (error) {
      console.error("獲取現金流動記錄失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取現金流動記錄失敗",
      };
    }
  }

  /**
   * 獲取現金盤點記錄
   */
  async getCashCount(
    registerId: string,
    date?: string,
  ): Promise<{
    success: boolean;
    data?: (typeof cashMovements.$inferSelect & {
      denominationBreakdown: unknown;
      metadata: unknown;
    })[];
    error?: string;
  }> {
    try {
      const conditions: SQL[] = [
        eq(cashMovements.registerId, registerId),
        eq(cashMovements.type, "count"),
      ];

      if (date) {
        conditions.push(
          sql`${dateFromUnixMs(cashMovements.createdAt)} = ${date}`,
        );
      }

      const counts = await this.db
        .select()
        .from(cashMovements)
        .where(and(...conditions))
        .orderBy(desc(cashMovements.createdAt));

      return {
        success: true,
        data: counts.map((count: typeof cashMovements.$inferSelect) => ({
          ...count,
          denominationBreakdown: JSON.parse(
            (count.denominationBreakdown as string) || "{}",
          ),
          metadata: JSON.parse((count.metadata as string) || "{}"),
        })),
      };
    } catch (error) {
      console.error("獲取現金盤點記錄失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取現金盤點記錄失敗",
      };
    }
  }

  /**
   * 記錄現金操作
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
      denominationBreakdown?: Record<string, number>;
    },
  ): Promise<string> {
    const movementId = crypto.randomUUID();
    const now = new Date();

    await this.db.insert(cashMovements).values({
      id: movementId,
      shiftId,
      registerId,
      type: movement.type,
      amountCents: toRequiredCents(movement.amount),
      description: movement.description,
      referenceId: movement.referenceId || null,
      referenceType: movement.referenceType || null,
      denominationBreakdown: JSON.stringify(
        movement.denominationBreakdown || {},
      ),
      recordedBy: movement.recordedBy,
      approvalStatus: "approved",
      metadata: "{}",
      createdAt: now,
    });

    return movementId;
  }

  /**
   * 審核現金操作
   */
  async approveCashMovement(
    movementId: string,
    approvedBy: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db
        .update(cashMovements)
        .set({
          approvalStatus: "approved",
          approvedBy,
        })
        .where(
          and(
            eq(cashMovements.id, movementId),
            eq(cashMovements.approvalStatus, "pending"),
          ),
        );

      return { success: true };
    } catch (error) {
      console.error("審核現金操作失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "審核現金操作失敗",
      };
    }
  }

  /**
   * 拒絕現金操作
   */
  async rejectCashMovement(
    movementId: string,
    approvedBy: number,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const metadata = reason
        ? JSON.stringify({ rejection_reason: reason })
        : "{}";

      await this.db
        .update(cashMovements)
        .set({
          approvalStatus: "rejected",
          approvedBy,
          metadata,
        })
        .where(
          and(
            eq(cashMovements.id, movementId),
            eq(cashMovements.approvalStatus, "pending"),
          ),
        );

      return { success: true };
    } catch (error) {
      console.error("拒絕現金操作失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "拒絕現金操作失敗",
      };
    }
  }
}
