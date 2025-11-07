/**
 * Reservation Service
 * API service for reservation management
 */

import axios from 'axios';
import {
  ReservationStatus,
  type Reservation,
  type CreateReservationRequest,
  type UpdateReservationRequest,
  type ReservationFilters,
  type ReservationResponse,
  type AvailabilityRequest,
  type AvailabilityResponse,
  type CreateSlotRequest,
  type BatchCreateSlotsRequest,
  type ReservationStats,
} from '@makanmakan/shared-types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787/api/v1';

export class ReservationService {
  /**
   * 取得訂位列表
   */
  static async listReservations(filters: ReservationFilters = {}) {
    const params = new URLSearchParams();

    if (filters.restaurantId) params.append('restaurantId', filters.restaurantId);
    if (filters.status) {
      const statusValue = Array.isArray(filters.status)
        ? filters.status.map(s => String(s)).join(',')
        : String(filters.status);
      params.append('status', statusValue);
    }
    if (filters.reservationDate) params.append('date', filters.reservationDate);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.customerPhone) params.append('phone', filters.customerPhone);
    if (filters.confirmationCode) params.append('code', filters.confirmationCode);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await axios.get<ReservationResponse>(`${API_BASE_URL}/reservations?${params.toString()}`);
    return response.data;
  }

  /**
   * 取得單一訂位詳情
   */
  static async getReservation(id: string) {
    const response = await axios.get<{ success: boolean; data: Reservation }>(`${API_BASE_URL}/reservations/${id}`);
    return response.data.data;
  }

  /**
   * 建立新訂位
   */
  static async createReservation(data: CreateReservationRequest) {
    const response = await axios.post<{ success: boolean; data: Reservation; message: string }>(
      `${API_BASE_URL}/reservations`,
      data
    );
    return response.data;
  }

  /**
   * 更新訂位
   */
  static async updateReservation(id: string, data: UpdateReservationRequest) {
    const response = await axios.put<{ success: boolean; data: Reservation; message: string }>(
      `${API_BASE_URL}/reservations/${id}`,
      data
    );
    return response.data;
  }

  /**
   * 確認訂位
   */
  static async confirmReservation(id: string) {
    const response = await axios.post<{ success: boolean; data: Reservation; message: string }>(
      `${API_BASE_URL}/reservations/${id}/confirm`
    );
    return response.data;
  }

  /**
   * 標記到店
   */
  static async markArrived(id: string) {
    const response = await axios.post<{ success: boolean; data: Reservation; message: string }>(
      `${API_BASE_URL}/reservations/${id}/arrive`
    );
    return response.data;
  }

  /**
   * 標記入座
   */
  static async markSeated(id: string) {
    const response = await axios.post<{ success: boolean; data: Reservation; message: string }>(
      `${API_BASE_URL}/reservations/${id}/seat`
    );
    return response.data;
  }

  /**
   * 完成訂位
   */
  static async completeReservation(id: string) {
    const response = await axios.post<{ success: boolean; data: Reservation; message: string }>(
      `${API_BASE_URL}/reservations/${id}/complete`
    );
    return response.data;
  }

  /**
   * 標記未到店
   */
  static async markNoShow(id: string) {
    const response = await axios.post<{ success: boolean; data: Reservation; message: string }>(
      `${API_BASE_URL}/reservations/${id}/no-show`
    );
    return response.data;
  }

  /**
   * 取消訂位（管理員）
   */
  static async cancelReservation(id: string, reason?: string) {
    const response = await axios.delete<{ success: boolean; data: Reservation; message: string }>(
      `${API_BASE_URL}/reservations/${id}/cancel`,
      { data: { reason } }
    );
    return response.data;
  }

  /**
   * 查詢可用時段
   */
  static async getAvailability(request: AvailabilityRequest) {
    const params = new URLSearchParams({
      restaurantId: request.restaurantId,
      date: request.date,
      partySize: request.partySize.toString(),
      ...(request.duration && { duration: request.duration.toString() })
    });

    const response = await axios.get<AvailabilityResponse>(`${API_BASE_URL}/reservations/availability?${params.toString()}`);
    return response.data;
  }

  /**
   * 取得訂位統計
   */
  static async getStats(restaurantId: string, date?: string) {
    const params = new URLSearchParams({ ...(date && { date }) });
    const response = await axios.get<{ success: boolean; data: ReservationStats }>(
      `${API_BASE_URL}/reservations/stats/${restaurantId}?${params.toString()}`
    );
    return response.data.data;
  }

  /**
   * 建立時段
   */
  static async createSlot(data: CreateSlotRequest) {
    const response = await axios.post<{ success: boolean; data: any; message: string }>(
      `${API_BASE_URL}/reservations/slots`,
      data
    );
    return response.data;
  }

  /**
   * 批次建立時段
   */
  static async batchCreateSlots(data: BatchCreateSlotsRequest) {
    const response = await axios.post<{ success: boolean; data: { created: number }; message: string }>(
      `${API_BASE_URL}/reservations/slots/batch`,
      data
    );
    return response.data;
  }

  /**
   * 取得狀態顯示文字
   */
  static getStatusText(status: ReservationStatus): string {
    const statusMap: Record<ReservationStatus, string> = {
      [ReservationStatus.PENDING]: '待確認',
      [ReservationStatus.CONFIRMED]: '已確認',
      [ReservationStatus.ARRIVED]: '已到店',
      [ReservationStatus.SEATED]: '已入座',
      [ReservationStatus.COMPLETED]: '已完成',
      [ReservationStatus.CANCELLED]: '已取消',
      [ReservationStatus.NO_SHOW]: '未到店'
    };
    return statusMap[status] || status;
  }

  /**
   * 取得狀態顏色
   */
  static getStatusColor(status: ReservationStatus): string {
    const colorMap: Record<ReservationStatus, string> = {
      [ReservationStatus.PENDING]: 'warning',
      [ReservationStatus.CONFIRMED]: 'info',
      [ReservationStatus.ARRIVED]: 'primary',
      [ReservationStatus.SEATED]: 'success',
      [ReservationStatus.COMPLETED]: 'default',
      [ReservationStatus.CANCELLED]: 'error',
      [ReservationStatus.NO_SHOW]: 'error'
    };
    return colorMap[status] || 'default';
  }
}
