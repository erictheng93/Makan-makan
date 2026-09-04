/**
 * Leaves Service
 * API client for employee leave management
 */

import { api } from "@/services/api";

/**
 * Mirrors the leave_types row, which GET /leaves/:restaurantId/types returns
 * unprojected. `maxDaysPerYear` used to be declared here and does not exist on
 * that table -- the per-year figure is accrualAmount, interpreted through
 * accrualType.
 */
export interface LeaveType {
  id: number;
  restaurantId: string | null;
  code: string;
  name: string;
  description?: string | null;
  accrualType: "yearly" | "monthly" | "none";
  accrualAmount: number;
  requiresApproval: boolean;
  minNoticeDays: number;
  requiresDocumentation: boolean;
  allowHalfDay: boolean;
  isActive: boolean;
  sortOrder: number;
  color?: string | null;
}

/**
 * The four fields createLeaveTypeSchema requires. Everything else it accepts
 * has a server-side default, so this is the whole minimum form.
 */
export interface CreateLeaveTypeInput {
  code: string;
  name: string;
  accrualType: "yearly" | "monthly" | "none";
  accrualAmount: number;
  description?: string;
  requiresApproval?: boolean;
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
    return response.data.data ?? [];
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
    return response.data.data ?? [];
  }

  /**
   * Get all leave balances for a restaurant (single bulk request)
   */
  async getRestaurantBalances(
    restaurantId: string,
    year?: number,
  ): Promise<LeaveBalance[]> {
    const params = year ? { year } : {};
    const response = await this.api.get<LeaveBalance[]>(
      `/leaves/${restaurantId}/balances`,
      params,
    );
    return response.data.data ?? [];
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
    return response.data.data ?? [];
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
      period: "full" | "am" | "pm";
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
   * Create a leave type.
   *
   * The route has existed since the feature shipped; nothing called it, so
   * every new tenant started with an empty list and the leave-request dialog's
   * type selector had nothing to offer -- which made its submit button
   * permanently disabled and the whole approval flow unreachable (#307).
   */
  async createLeaveType(
    restaurantId: string,
    data: CreateLeaveTypeInput,
  ): Promise<LeaveType> {
    const response = await this.api.post<LeaveType>(
      `/leaves/${restaurantId}/types`,
      data,
    );
    return response.data.data!;
  }

  /**
   * Update a leave type. Tenant scope is enforced inside the handler by
   * looking the id up, not by a route-level guard, so there is no restaurantId
   * in the path.
   */
  async updateLeaveType(
    typeId: number,
    data: Partial<CreateLeaveTypeInput> & { isActive?: boolean },
  ): Promise<LeaveType> {
    const response = await this.api.put<LeaveType>(
      `/leaves/types/${typeId}`,
      data,
    );
    return response.data.data!;
  }

  async deleteLeaveType(typeId: number): Promise<void> {
    await this.api.delete(`/leaves/types/${typeId}`);
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
