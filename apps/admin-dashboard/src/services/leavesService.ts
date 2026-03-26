/**
 * Leaves Service
 * API client for employee leave management
 */

import { api } from "@/services/api";

export interface LeaveType {
  id: number;
  name: string;
  description?: string;
  maxDaysPerYear: number;
  requiresApproval: boolean;
  color?: string;
}

export interface LeaveBalance {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  leaveTypeName: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  year: number;
  color?: string;
}

export interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName?: string;
  leaveTypeId: number;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  period: "full" | "am" | "pm";
  days: number;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy?: number;
  approverName?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

class LeavesService {
  private api: typeof api;

  constructor() {
    this.api = api;
  }

  /**
   * Get all leave types for a restaurant
   */
  async getLeaveTypes(restaurantId: string): Promise<LeaveType[]> {
    const response = await this.api.get<LeaveType[]>(
      `/leaves/${restaurantId}/types`,
    );
    return response.data.data!;
  }

  /**
   * Get leave balances with optional filters
   */
  async getBalances(params: {
    restaurantId?: string;
    employeeId?: number;
    year?: number;
  }): Promise<LeaveBalance[]> {
    const response = await this.api.get<LeaveBalance[]>(
      "/leaves/balances",
      params,
    );
    return response.data.data!;
  }

  /**
   * Get leave requests with optional filters
   */
  async getRequests(
    restaurantId: string,
    params?: {
      employeeId?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<LeaveRequest[]> {
    const response = await this.api.get<LeaveRequest[]>(
      `/leaves/${restaurantId}/requests`,
      params,
    );
    return response.data.data!;
  }

  /**
   * Create a new leave request
   */
  async createRequest(
    restaurantId: string,
    data: {
      leaveTypeId: number;
      startDate: string;
      endDate: string;
      period: string;
      reason?: string;
    },
  ): Promise<LeaveRequest> {
    const response = await this.api.post<LeaveRequest>(
      `/leaves/${restaurantId}/requests`,
      data,
    );
    return response.data.data!;
  }

  /**
   * Approve a leave request
   */
  async approveRequest(requestId: number): Promise<void> {
    await this.api.post(`/leaves/requests/${requestId}/approve`);
  }

  /**
   * Reject a leave request
   */
  async rejectRequest(requestId: number, reason?: string): Promise<void> {
    await this.api.post(`/leaves/requests/${requestId}/reject`, { reason });
  }

  /**
   * Cancel a leave request
   */
  async cancelRequest(requestId: number): Promise<void> {
    await this.api.post(`/leaves/requests/${requestId}/cancel`);
  }
}

// Export singleton instance
export const leavesService = new LeavesService();
export default leavesService;
