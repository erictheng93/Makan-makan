/**
 * Waiting List Service
 * API service for waiting list management
 */

import { api } from "@/services/api";
import {
  WaitingStatus,
  type WaitingListEntry,
  type JoinWaitingListRequest,
  type WaitingListFilters,
  type CallWaitingRequest,
  type QueueStatus,
  type WaitingStats,
  type WaitTimeEstimateRequest,
  type WaitTimeEstimateResult,
} from "@makanmasak/shared-types";

export class WaitingListService {
  /**
   * 取得候位列表
   */
  static async listWaitingList(filters: WaitingListFilters = {}) {
    const params = new URLSearchParams();

    if (filters.restaurantId)
      params.append("restaurantId", filters.restaurantId);
    if (filters.status) {
      const statusValue = Array.isArray(filters.status)
        ? filters.status.map((s) => String(s)).join(",")
        : String(filters.status);
      params.append("status", statusValue);
    }
    if (filters.customerPhone) params.append("phone", filters.customerPhone);
    if (filters.date) params.append("date", filters.date);
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());

    const response = await api.get<WaitingListEntry[]>(
      `/waiting-list?${params.toString()}`,
    );
    return response.data;
  }

  /**
   * 取得單一候位詳情
   */
  static async getWaitingEntry(id: string) {
    const response = await api.get<WaitingListEntry>(`/waiting-list/${id}`);
    return response.data.data;
  }

  /**
   * 加入候位（管理員代為加入）
   */
  static async joinWaitingList(data: JoinWaitingListRequest) {
    const response = await api.post<WaitingListEntry>(`/waiting-list`, data);
    return response.data;
  }

  /**
   * 叫號
   */
  static async callWaiting(id: string, data: CallWaitingRequest) {
    const response = await api.post<WaitingListEntry>(
      `/waiting-list/${id}/call`,
      data,
    );
    return response.data;
  }

  /**
   * 標記入座
   */
  static async markSeated(id: string) {
    const response = await api.post<WaitingListEntry>(
      `/waiting-list/${id}/seat`,
    );
    return response.data;
  }

  /**
   * 標記過號
   */
  static async expireWaiting(id: string) {
    const response = await api.post<WaitingListEntry>(
      `/waiting-list/${id}/expire`,
    );
    return response.data;
  }

  /**
   * 取消候位
   */
  static async cancelWaiting(id: string, customerPhone: string) {
    const response = await api.delete<WaitingListEntry>(`/waiting-list/${id}`, {
      customerPhone,
    });
    return response.data;
  }

  /**
   * 取得排隊狀態
   */
  static async getQueueStatus(restaurantId: string) {
    const response = await api.get<QueueStatus>(
      `/waiting-list/queue-status/${restaurantId}`,
    );
    return response.data.data;
  }

  /**
   * 預估等待時間
   */
  static async estimateWaitTime(request: WaitTimeEstimateRequest) {
    const params = new URLSearchParams({
      partySize: request.partySize.toString(),
    });

    const response = await api.get<WaitTimeEstimateResult>(
      `/waiting-list/estimate-wait/${request.restaurantId}?${params.toString()}`,
    );
    return response.data.data;
  }

  /**
   * 取得候位統計
   */
  static async getStats(restaurantId: string, date?: string) {
    const params = new URLSearchParams({ ...(date && { date }) });
    const response = await api.get<WaitingStats>(
      `/waiting-list/stats/${restaurantId}?${params.toString()}`,
    );
    return response.data.data;
  }

  /**
   * 批次叫號
   */
  static async batchCall(restaurantId: string, count: number = 1) {
    const response = await api.post<any[]>(`/waiting-list/batch-call`, {
      restaurantId,
      count,
    });
    return response.data;
  }

  /**
   * 取得狀態顯示文字
   */
  static getStatusText(status: WaitingStatus): string {
    const statusMap: Record<WaitingStatus, string> = {
      [WaitingStatus.WAITING]: "等待中",
      [WaitingStatus.CALLED]: "已叫號",
      [WaitingStatus.CONFIRMED]: "已確認",
      [WaitingStatus.SEATED]: "已入座",
      [WaitingStatus.CANCELLED]: "已取消",
      [WaitingStatus.EXPIRED]: "已過號",
      [WaitingStatus.NO_SHOW]: "未到",
    };
    return statusMap[status] || status;
  }

  /**
   * 取得狀態顏色
   */
  static getStatusColor(status: WaitingStatus): string {
    const colorMap: Record<WaitingStatus, string> = {
      [WaitingStatus.WAITING]: "info",
      [WaitingStatus.CALLED]: "warning",
      [WaitingStatus.CONFIRMED]: "primary",
      [WaitingStatus.SEATED]: "success",
      [WaitingStatus.CANCELLED]: "default",
      [WaitingStatus.EXPIRED]: "error",
      [WaitingStatus.NO_SHOW]: "error",
    };
    return colorMap[status] || "default";
  }

  /**
   * 格式化隊列顯示號碼
   */
  static formatQueueDisplay(entry: WaitingListEntry): string {
    return entry.queueLetter
      ? `${entry.queueLetter}${entry.queueNumber}`
      : entry.queueNumber.toString();
  }

  /**
   * 格式化等待時間
   */
  static formatWaitTime(minutes?: number): string {
    if (!minutes) return "--";
    if (minutes < 60) return `${minutes} 分鐘`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} 小時 ${mins} 分鐘` : `${hours} 小時`;
  }
}
