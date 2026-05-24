/**
 * UnifiedQueueService — adapter that exposes the queue feature's API to
 * the production-ready WaitingListService. The legacy hardcoded
 * implementation that previously lived here returned hardcoded data
 * and never persisted to D1; it has been replaced wholesale.
 */

import { WaitingListService } from "@makanmakan/database";
import {
  WaitingStatus,
  type WaitingListResponse,
  type QueueStatus as WaitingQueueStatus,
} from "@makanmakan/shared-types";
import type { Env } from "../../../types/env";
import { ConsoleLogger } from "../../../core/monitoring";
import type { CallNextRequest, JoinQueueRequest, ApiResponse } from "../types";

export interface UnifiedJoinResult {
  queueId: string;
  queueNumber: number;
  queueDisplay: string;
  status: string;
  estimatedWaitMinutes: number;
  currentPosition: number;
  customerName: string;
  partySize: number;
  joinedAt: number;
}

export interface UnifiedCallNextResult {
  queueId: string;
  queueNumber: number;
  queueDisplay: string;
  customerName: string;
  customerPhone: string;
  tableId: number | null;
  status: string;
  calledAt: number | null;
}

export class UnifiedQueueService {
  private logger: ConsoleLogger;
  private service: WaitingListService;

  constructor(env: Env) {
    this.logger = new ConsoleLogger("UnifiedQueueService");
    this.service = new WaitingListService(env.DB, env);
  }

  async joinQueue(
    data: JoinQueueRequest,
  ): Promise<ApiResponse<UnifiedJoinResult>> {
    if (!data.customerPhone) {
      return {
        success: false,
        error: "Customer phone is required",
      };
    }

    try {
      const entry = await this.service.joinWaitingList({
        restaurantId: data.restaurantId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        partySize: data.partySize,
        notes: data.specialRequests,
      });

      return {
        success: true,
        data: this.toJoinResult(entry),
      };
    } catch (error) {
      this.logger.warn("joinQueue failed", {
        restaurantId: data.restaurantId,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to join queue",
      };
    }
  }

  async getQueueStatus(
    restaurantId: string,
  ): Promise<ApiResponse<WaitingQueueStatus>> {
    try {
      const status = await this.service.getQueueStatus(restaurantId);
      return { success: true, data: status };
    } catch (error) {
      this.logger.warn("getQueueStatus failed", {
        restaurantId,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get queue status",
      };
    }
  }

  async getCurrentQueue(
    restaurantId: string,
    limit?: number,
  ): Promise<ApiResponse<WaitingListResponse[]>> {
    try {
      const result = await this.service.listWaitingList({
        restaurantId,
        status: WaitingStatus.WAITING,
        limit: limit ?? 50,
      });
      return { success: true, data: result.data };
    } catch (error) {
      this.logger.warn("getCurrentQueue failed", {
        restaurantId,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get current queue",
      };
    }
  }

  async getQueueEntry(
    queueId: string,
  ): Promise<ApiResponse<WaitingListResponse>> {
    try {
      const entry = await this.service.getWaitingListEntryById(queueId);
      if (!entry) {
        return { success: false, error: "Queue entry not found" };
      }
      return { success: true, data: entry };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get queue entry",
      };
    }
  }

  async callNext(
    restaurantId: string,
    data: CallNextRequest,
  ): Promise<ApiResponse<UnifiedCallNextResult>> {
    try {
      if (data.specificQueueId) {
        const entry = await this.service.getWaitingListEntryById(
          data.specificQueueId,
        );
        if (!entry) {
          return { success: false, error: "Queue entry not found" };
        }
        if (String(entry.restaurantId) !== String(restaurantId)) {
          return {
            success: false,
            error: "Queue entry does not belong to this restaurant",
          };
        }

        const tableId =
          data.tableId ??
          (await this.service.findAvailableTable(restaurantId, entry.partySize))
            ?.tableId;

        if (!tableId) {
          return { success: false, error: "No available table for party size" };
        }

        const called = await this.service.callWaiting(data.specificQueueId, {
          tableId,
        });
        return { success: true, data: this.toCallResult(called) };
      }

      // Otherwise auto-pick the next waiting entry and assign a table.
      const results = await this.service.batchCallNext(restaurantId, 1);
      const first = results[0];

      if (!first) {
        return { success: false, error: "No customers waiting in queue" };
      }
      if (!first.success) {
        return { success: false, error: first.message };
      }

      const entry = await this.service.getWaitingListEntryById(first.id);
      if (!entry) {
        return {
          success: false,
          error: "Failed to load queue entry after calling",
        };
      }

      return { success: true, data: this.toCallResult(entry) };
    } catch (error) {
      this.logger.warn("callNext failed", {
        restaurantId,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to call next customer",
      };
    }
  }

  async seatCustomer(queueId: string): Promise<ApiResponse<void>> {
    try {
      await this.service.markSeated(queueId);
      return { success: true };
    } catch (error) {
      this.logger.warn("seatCustomer failed", {
        queueId,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to seat customer",
      };
    }
  }

  async cancelQueue(queueId: string): Promise<ApiResponse<void>> {
    try {
      await this.service.cancelWaiting(queueId);
      return { success: true };
    } catch (error) {
      this.logger.warn("cancelQueue failed", {
        queueId,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to cancel queue",
      };
    }
  }

  // ── Response shape helpers ──────────────────────────────────────────

  private toJoinResult(entry: WaitingListResponse): UnifiedJoinResult {
    return {
      queueId: entry.id,
      queueNumber: entry.queueNumber,
      queueDisplay: entry.queueDisplay,
      status: entry.status,
      estimatedWaitMinutes: entry.estimatedWaitMinutes ?? 0,
      currentPosition: entry.partiesAhead + 1,
      customerName: entry.customerName,
      partySize: entry.partySize,
      joinedAt: entry.createdAt,
    };
  }

  private toCallResult(entry: WaitingListResponse): UnifiedCallNextResult {
    return {
      queueId: entry.id,
      queueNumber: entry.queueNumber,
      queueDisplay: entry.queueDisplay,
      customerName: entry.customerName,
      customerPhone: entry.customerPhone,
      tableId: entry.tableId ?? null,
      status: entry.status,
      calledAt: entry.calledAt ?? null,
    };
  }
}
