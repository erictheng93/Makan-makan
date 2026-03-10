/**
 * 現金操作管理服務
 */

import { BaseService } from "../../../shared/services/BaseService";
import { getCurrentTimestamp } from "@makanmakan/database";
import type {
  CashMovement as _CashMovement,
  CashMovementRequest,
} from "../types";
import { cashMovementSchema } from "../schemas";

export class CashMovementService extends BaseService {
  constructor(db: any) {
    super(db);
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
      const shift = (await this.d1
        .prepare("SELECT status, register_id FROM cash_shifts WHERE id = ?")
        .bind(shiftId)
        .first()) as any;

      if (!shift || shift.status !== "active") {
        return {
          success: false,
          error: "班次不存在或已結束",
        };
      }

      await this.recordCashMovement(shiftId, shift.register_id, {
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
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const { type, page = 1, limit = 20 } = options || {};
      const offset = (page - 1) * limit;

      let typeFilter = "";
      const params = [shiftId];

      if (type) {
        typeFilter = " AND type = ?";
        params.push(type);
      }

      const movements = await this.d1
        .prepare(
          `
        SELECT
          cm.*,
          u.full_name as recorded_by_name,
          ua.full_name as approved_by_name
        FROM cash_movements cm
        LEFT JOIN users u ON cm.recorded_by = u.id
        LEFT JOIN users ua ON cm.approved_by = ua.id
        WHERE cm.shift_id = ? ${typeFilter}
        ORDER BY cm.created_at DESC
        LIMIT ? OFFSET ?
      `,
        )
        .bind(...params, limit, offset)
        .all();

      return {
        success: true,
        data: {
          movements: (movements.results || []).map((movement: any) => ({
            ...movement,
            denominationBreakdown: JSON.parse(
              movement.denomination_breakdown || "{}",
            ),
            metadata: JSON.parse(movement.metadata || "{}"),
          })),
          pagination: {
            page,
            limit,
            hasMore: (movements.results || []).length === limit,
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
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let dateFilter = "";
      const params = [registerId, "count"];

      if (date) {
        dateFilter = " AND DATE(cm.created_at) = ?";
        params.push(date);
      }

      const counts = await this.d1
        .prepare(
          `
        SELECT
          cm.*,
          u.full_name as recorded_by_name,
          cs.start_amount,
          cs.expected_amount
        FROM cash_movements cm
        LEFT JOIN users u ON cm.recorded_by = u.id
        LEFT JOIN cash_shifts cs ON cm.shift_id = cs.id
        WHERE cm.register_id = ? AND cm.type = ? ${dateFilter}
        ORDER BY cm.created_at DESC
      `,
        )
        .bind(...params)
        .all();

      return {
        success: true,
        data: (counts.results || []).map((count: any) => ({
          ...count,
          denominationBreakdown: JSON.parse(
            count.denomination_breakdown || "{}",
          ),
          metadata: JSON.parse(count.metadata || "{}"),
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
    const now = getCurrentTimestamp();

    await this.d1
      .prepare(
        `
      INSERT INTO cash_movements (
        id, shift_id, register_id, type, amount, description,
        reference_id, reference_type, denomination_breakdown,
        recorded_by, approval_status, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', '{}', ?)
    `,
      )
      .bind(
        movementId,
        shiftId,
        registerId,
        movement.type,
        movement.amount,
        movement.description,
        movement.referenceId || null,
        movement.referenceType || null,
        JSON.stringify(movement.denominationBreakdown || {}),
        movement.recordedBy,
        now,
      )
      .run();

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
      await this.d1
        .prepare(
          `
        UPDATE cash_movements
        SET approval_status = 'approved',
            approved_by = ?
        WHERE id = ? AND approval_status = 'pending'
      `,
        )
        .bind(approvedBy, movementId)
        .run();

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

      await this.d1
        .prepare(
          `
        UPDATE cash_movements
        SET approval_status = 'rejected',
            approved_by = ?,
            metadata = ?
        WHERE id = ? AND approval_status = 'pending'
      `,
        )
        .bind(approvedBy, metadata, movementId)
        .run();

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
