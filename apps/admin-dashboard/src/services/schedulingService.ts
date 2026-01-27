/**
 * Employee Scheduling Service
 * API client for employee scheduling and shift management
 */

import axios, { type AxiosInstance } from "axios";
import type {
  ShiftTemplate,
  CreateShiftTemplateData,
  EmployeeSchedule,
  CreateScheduleData,
  UpdateScheduleData,
  BulkCreateSchedulesData,
  AvailableEmployee,
  SchedulingConflict,
  SwapRequest,
  CreateSwapRequestData,
  ClockInData,
  ClockOutData,
  ScheduleFilters,
  ConflictFilters,
  SwapRequestFilters,
  PaginatedResponse,
  ApiResponse,
  DailyStats,
  WeeklySummary,
} from "@/types/scheduling";

class SchedulingService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      throw new Error(
        "[Config Error] VITE_API_URL is required. " +
          "Please set this environment variable in your .env file.",
      );
    }
    this.baseURL = apiUrl;
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add auth token interceptor
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem("authToken");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      },
    );
  }

  // ========================================
  // Shift Template Management
  // ========================================

  /**
   * Get all shift templates for a restaurant
   */
  async getShiftTemplates(restaurantId: string): Promise<ShiftTemplate[]> {
    const response = await this.api.get<ApiResponse<ShiftTemplate[]>>(
      `/scheduling/${restaurantId}/templates`,
    );
    return response.data.data;
  }

  /**
   * Get a specific shift template
   */
  async getShiftTemplate(id: number): Promise<ShiftTemplate> {
    const response = await this.api.get<ApiResponse<ShiftTemplate>>(
      `/scheduling/templates/${id}`,
    );
    return response.data.data;
  }

  /**
   * Create a new shift template
   */
  async createShiftTemplate(
    restaurantId: string,
    data: CreateShiftTemplateData,
  ): Promise<ShiftTemplate> {
    const response = await this.api.post<ApiResponse<ShiftTemplate>>(
      `/scheduling/${restaurantId}/templates`,
      data,
    );
    return response.data.data;
  }

  /**
   * Update a shift template
   */
  async updateShiftTemplate(
    id: number,
    data: Partial<CreateShiftTemplateData>,
  ): Promise<ShiftTemplate> {
    const response = await this.api.put<ApiResponse<ShiftTemplate>>(
      `/scheduling/templates/${id}`,
      data,
    );
    return response.data.data;
  }

  /**
   * Delete a shift template
   */
  async deleteShiftTemplate(id: number): Promise<void> {
    await this.api.delete(`/scheduling/templates/${id}`);
  }

  // ========================================
  // Employee Schedule Management
  // ========================================

  /**
   * Get employee schedules with filters
   */
  async getSchedules(
    filters: ScheduleFilters,
  ): Promise<PaginatedResponse<EmployeeSchedule>> {
    const { restaurantId, ...params } = filters;
    const response = await this.api.get<PaginatedResponse<EmployeeSchedule>>(
      `/scheduling/${restaurantId}/schedules`,
      { params },
    );
    return response.data;
  }

  /**
   * Get a specific schedule
   */
  async getSchedule(id: number): Promise<EmployeeSchedule> {
    const response = await this.api.get<ApiResponse<EmployeeSchedule>>(
      `/scheduling/schedules/${id}`,
    );
    return response.data.data;
  }

  /**
   * Create a new schedule
   */
  async createSchedule(
    restaurantId: string,
    data: CreateScheduleData,
  ): Promise<EmployeeSchedule> {
    const response = await this.api.post<ApiResponse<EmployeeSchedule>>(
      `/scheduling/${restaurantId}/schedules`,
      data,
    );
    return response.data.data;
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
    id: number,
    data: UpdateScheduleData,
  ): Promise<EmployeeSchedule> {
    const response = await this.api.put<ApiResponse<EmployeeSchedule>>(
      `/scheduling/schedules/${id}`,
      data,
    );
    return response.data.data;
  }

  /**
   * Delete (cancel) a schedule
   */
  async deleteSchedule(id: number): Promise<void> {
    await this.api.delete(`/scheduling/schedules/${id}`);
  }

  /**
   * Bulk create schedules
   */
  async bulkCreateSchedules(
    restaurantId: string,
    data: BulkCreateSchedulesData,
  ): Promise<{ count: number }> {
    const response = await this.api.post<ApiResponse<{ count: number }>>(
      `/scheduling/${restaurantId}/schedules/bulk`,
      data,
    );
    return response.data.data;
  }

  // ========================================
  // Available Employees (Leave Integration)
  // ========================================

  /**
   * Get available employees for scheduling on a specific date
   * Filters out employees on approved leave
   */
  async getAvailableEmployees(
    restaurantId: string,
    date: string,
    shiftTemplateId?: number,
  ): Promise<AvailableEmployee[]> {
    const params: any = { date };
    if (shiftTemplateId) {
      params.shiftTemplateId = shiftTemplateId;
    }

    const response = await this.api.get<ApiResponse<AvailableEmployee[]>>(
      `/scheduling/${restaurantId}/available-employees`,
      { params },
    );
    return response.data.data;
  }

  // ========================================
  // Clock In/Out
  // ========================================

  /**
   * Clock in to a shift
   */
  async clockIn(id: number, data: ClockInData): Promise<EmployeeSchedule> {
    const response = await this.api.post<ApiResponse<EmployeeSchedule>>(
      `/scheduling/schedules/${id}/clock-in`,
      data,
    );
    return response.data.data;
  }

  /**
   * Clock out from a shift
   */
  async clockOut(id: number, data: ClockOutData): Promise<EmployeeSchedule> {
    const response = await this.api.post<ApiResponse<EmployeeSchedule>>(
      `/scheduling/schedules/${id}/clock-out`,
      data,
    );
    return response.data.data;
  }

  // ========================================
  // Conflict Management
  // ========================================

  /**
   * Get scheduling conflicts
   */
  async getConflicts(
    filters: ConflictFilters,
  ): Promise<PaginatedResponse<SchedulingConflict>> {
    const { restaurantId, ...params } = filters;
    const response = await this.api.get<PaginatedResponse<SchedulingConflict>>(
      `/scheduling/${restaurantId}/conflicts`,
      { params },
    );
    return response.data;
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    id: number,
    userId: number,
    resolutionNotes: string,
  ): Promise<SchedulingConflict> {
    const response = await this.api.post<ApiResponse<SchedulingConflict>>(
      `/scheduling/conflicts/${id}/resolve`,
      { userId, resolutionNotes },
    );
    return response.data.data;
  }

  // ========================================
  // Swap Request Management
  // ========================================

  /**
   * Get swap requests
   */
  async getSwapRequests(
    filters: SwapRequestFilters,
  ): Promise<PaginatedResponse<SwapRequest>> {
    const { restaurantId, ...params } = filters;
    const response = await this.api.get<PaginatedResponse<SwapRequest>>(
      `/scheduling/${restaurantId}/swap-requests`,
      { params },
    );
    return response.data;
  }

  /**
   * Create a swap request
   */
  async createSwapRequest(
    restaurantId: string,
    data: CreateSwapRequestData,
  ): Promise<SwapRequest> {
    const response = await this.api.post<ApiResponse<SwapRequest>>(
      `/scheduling/${restaurantId}/swap-requests`,
      data,
    );
    return response.data.data;
  }

  /**
   * Approve a swap request
   */
  async approveSwapRequest(
    id: number,
    managerId: number,
  ): Promise<SwapRequest> {
    const response = await this.api.post<ApiResponse<SwapRequest>>(
      `/scheduling/swap-requests/${id}/approve`,
      { managerId },
    );
    return response.data.data;
  }

  /**
   * Accept a swap request (employee)
   */
  async acceptSwapRequest(
    id: number,
    employeeId: number,
  ): Promise<SwapRequest> {
    const response = await this.api.post<ApiResponse<SwapRequest>>(
      `/scheduling/swap-requests/${id}/accept`,
      { employeeId },
    );
    return response.data.data;
  }

  /**
   * Reject a swap request (manager)
   */
  async rejectSwapRequest(
    id: number,
    managerId: number,
    reason: string,
  ): Promise<SwapRequest> {
    const response = await this.api.post<ApiResponse<SwapRequest>>(
      `/scheduling/swap-requests/${id}/reject`,
      { managerId, reason },
    );
    return response.data.data;
  }

  /**
   * Cancel a swap request (requester)
   */
  async cancelSwapRequest(id: number): Promise<SwapRequest> {
    const response = await this.api.post<ApiResponse<SwapRequest>>(
      `/scheduling/swap-requests/${id}/cancel`,
    );
    return response.data.data;
  }

  // ========================================
  // Statistics & Analytics
  // ========================================

  /**
   * Get daily scheduling statistics
   */
  async getDailyStats(restaurantId: string, date: string): Promise<DailyStats> {
    const response = await this.api.get<ApiResponse<DailyStats>>(
      `/scheduling/${restaurantId}/stats/daily`,
      { params: { date } },
    );
    return response.data.data;
  }

  /**
   * Get weekly summary
   */
  async getWeeklySummary(
    restaurantId: string,
    weekStartDate: string,
  ): Promise<WeeklySummary> {
    const response = await this.api.get<ApiResponse<WeeklySummary>>(
      `/scheduling/${restaurantId}/stats/weekly`,
      { params: { weekStartDate } },
    );
    return response.data.data;
  }
}

// Export singleton instance
export const schedulingService = new SchedulingService();
export default schedulingService;
