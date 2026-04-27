/**
 * 班次管理服務
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import { cashShifts, cashRegisters, cashMovements } from "@makanmakan/database";
import type { CashShift, StartShiftRequest, EndShiftRequest } from "../types";
import { startShiftSchema, endShiftSchema } from "../schemas";

export class ShiftService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 開始班次
   */
  async startShift(
    data: StartShiftRequest,
  ): Promise<{ success: boolean; data?: CashShift; error?: string }> {
    try {
      const validatedData = startShiftSchema.parse(data);

      // 檢查收銀機是否已有活躍班次
      const [existingShift] = await this.db
        .select({ id: cashShifts.id })
        .from(cashShifts)
        .where(
          and(
            eq(cashShifts.registerId, validatedData.registerId),
            eq(cashShifts.status, "active"),
          ),
        )
        .limit(1);

      if (existingShift) {
        return {
          success: false,
          error: "此收銀機已有活躍班次",
        };
      }

      const shiftId = crypto.randomUUID();
      const startedAt = new Date();

      await this.db.insert(cashShifts).values({
        id: shiftId,
        registerId: validatedData.registerId,
        operatorId: validatedData.operatorId,
        startAmount: validatedData.startAmount,
        expectedAmount: validatedData.startAmount,
        totalSales: 0,
        totalRefunds: 0,
        cashSales: 0,
        cardSales: 0,
        digitalSales: 0,
        totalTransactions: 0,
        startedAt,
        status: "active",
        notes: validatedData.notes || null,
      });

      // 更新收銀機的當前班次
      await this.db
        .update(cashRegisters)
        .set({ currentShiftId: shiftId })
        .where(eq(cashRegisters.id, validatedData.registerId));

      // 記錄開班現金操作
      await this.recordCashMovement(shiftId, {
        type: "opening",
        amount: validatedData.startAmount,
        description: "開班現金",
        recordedBy: validatedData.operatorId,
      });

      const [shift] = await this.db
        .select()
        .from(cashShifts)
        .where(eq(cashShifts.id, shiftId))
        .limit(1);

      return {
        success: true,
        data: shift as unknown as CashShift,
      };
    } catch (error) {
      console.error("開班失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "開班失敗",
      };
    }
  }

  /**
   * 結束班次
   */
  async endShift(
    shiftId: string,
    data: EndShiftRequest,
    operatorId: number,
  ): Promise<{
    success: boolean;
    data?: { shift: CashShift };
    error?: string;
  }> {
    try {
      const validatedData = endShiftSchema.parse(data);

      // 獲取班次資訊
      const [shift] = await this.db
        .select()
        .from(cashShifts)
        .where(and(eq(cashShifts.id, shiftId), eq(cashShifts.status, "active")))
        .limit(1);

      if (!shift) {
        return {
          success: false,
          error: "找不到活躍班次",
        };
      }

      // 計算預期金額
      const expectedAmount =
        (shift.startAmount || 0) +
        (shift.totalSales || 0) -
        (shift.totalRefunds || 0);
      const differenceAmount = validatedData.actualAmount - expectedAmount;

      // 更新班次狀態
      const endedAt = new Date();
      await this.db
        .update(cashShifts)
        .set({
          endAmount: validatedData.actualAmount,
          actualAmount: validatedData.actualAmount,
          expectedAmount,
          differenceAmount,
          endedAt,
          status: "closed",
          closingNotes: validatedData.closingNotes || null,
        })
        .where(eq(cashShifts.id, shiftId));

      // 記錄結班現金操作
      await this.recordCashMovement(shiftId, {
        type: "closing",
        amount: validatedData.actualAmount,
        description: `結班現金 (差額: ${differenceAmount >= 0 ? "+" : ""}${differenceAmount})`,
        recordedBy: operatorId,
      });

      // 清除收銀機的當前班次
      await this.db
        .update(cashRegisters)
        .set({ currentShiftId: null })
        .where(eq(cashRegisters.id, shift.registerId));

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
          } as unknown as CashShift,
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

  /**
   * 獲取當前班次
   */
  async getCurrentShift(
    registerId: string,
  ): Promise<{ success: boolean; data?: CashShift | null; error?: string }> {
    try {
      const [shift] = await this.db
        .select()
        .from(cashShifts)
        .where(
          and(
            eq(cashShifts.registerId, registerId),
            eq(cashShifts.status, "active"),
          ),
        )
        .limit(1);

      return {
        success: true,
        data: shift ? (shift as unknown as CashShift) : null,
      };
    } catch (error) {
      console.error("獲取當前班次失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取當前班次失敗",
      };
    }
  }

  /**
   * 暫停班次
   */
  async suspendShift(
    shiftId: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db
        .update(cashShifts)
        .set({
          status: "suspended",
          closingNotes: sql`COALESCE(${cashShifts.closingNotes}, '') || ${reason ? `暫停原因: ${reason}` : "班次已暫停"} || CHAR(10)`,
        })
        .where(
          and(eq(cashShifts.id, shiftId), eq(cashShifts.status, "active")),
        );

      return { success: true };
    } catch (error) {
      console.error("暫停班次失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "暫停班次失敗",
      };
    }
  }

  /**
   * 恢復班次
   */
  async resumeShift(
    shiftId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db
        .update(cashShifts)
        .set({ status: "active" })
        .where(
          and(eq(cashShifts.id, shiftId), eq(cashShifts.status, "suspended")),
        );

      return { success: true };
    } catch (error) {
      console.error("恢復班次失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "恢復班次失敗",
      };
    }
  }

  /**
   * 記錄現金操作
   */
  private async recordCashMovement(
    shiftId: string,
    movement: {
      type: string;
      amount: number;
      description: string;
      recordedBy: number;
      referenceId?: number;
      referenceType?: string;
      paymentMethod?: string;
      denominationBreakdown?: Record<string, number>;
    },
  ): Promise<void> {
    const movementId = crypto.randomUUID();

    const [shift] = await this.db
      .select({ registerId: cashShifts.registerId })
      .from(cashShifts)
      .where(eq(cashShifts.id, shiftId))
      .limit(1);

    const now = new Date();
    await this.db.insert(cashMovements).values({
      id: movementId,
      shiftId,
      registerId: shift.registerId,
      type: movement.type,
      amount: movement.amount,
      description: movement.description,
      referenceId: movement.referenceId || null,
      referenceType: movement.referenceType || null,
      paymentMethod: movement.paymentMethod || null,
      denominationBreakdown: JSON.stringify(
        movement.denominationBreakdown || {},
      ),
      recordedBy: movement.recordedBy,
      approvalStatus: "approved",
      metadata: "{}",
      createdAt: now,
    });
  }
}
