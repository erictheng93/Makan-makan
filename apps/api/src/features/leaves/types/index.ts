/**
 * Leave Management Types
 * Type definitions for employee leave/time-off management system
 */

/**
 * The leaves entities, re-exported from the schema rather than hand-copied.
 *
 * This file used to declare its own LeaveType, EmployeeLeaveBalance,
 * LeaveRequest and their DTOs. All of them had drifted: timestamp_ms columns
 * declared as numbers, TEXT user ids as numbers, and a join projection with
 * an `employee.name` field the query has never selected. Nothing imported
 * them, so nothing caught it (#330).
 */
import type {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestWithRelations,
  LeaveBalanceWithType,
  CreateLeaveTypeData,
  UpdateLeaveTypeData,
  CreateLeaveRequestData,
  LeaveRequestFilters,
  LeaveBalanceAdjustment,
} from "@makanmasak/database";

export type {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestWithRelations,
  LeaveBalanceWithType,
  CreateLeaveTypeData,
  UpdateLeaveTypeData,
  CreateLeaveRequestData,
  LeaveRequestFilters,
  LeaveBalanceAdjustment,
};

/** Kept for the older name used by the service interface below. */
export type EmployeeLeaveBalance = LeaveBalance;

/**
 * Leave Approval Rule (審批規則)
 * Defines approval workflow rules for leave requests
 */
export interface LeaveApprovalRule {
  id: number;
  restaurantId: string;
  leaveTypeId: number | null; // null for global rules

  // Rule Configuration (規則配置)
  name: string;
  description: string | null;
  approvalLevel: number; // 1, 2, 3... for multi-level approval

  // Approvers (審批人)
  approverType: "role" | "specific_user";
  approverRoleIds: string | null; // JSON array
  approverUserIds: string | null; // JSON array

  // Auto-approval (自動審批)
  enableAutoApproval: boolean;
  autoApprovalConditions: string | null; // JSON object

  // Escalation (升級)
  enableAutoEscalation: boolean;
  escalationTimeoutHours: number | null;
  escalationToUserId: number | null;

  // Rule Priority & Status
  priority: number;
  isActive: boolean;

  createdAt: number;
  updatedAt: number;
  createdBy: number;
  updatedBy: number | null;
}

/**
 * Leave Calendar Event (假期行事曆)
 * Public holidays, company holidays, and special events
 */
export interface LeaveCalendarEvent {
  id: number;
  restaurantId: string | null; // null for system-wide/Taiwan public holidays

  // Event Details (事件內容)
  name: string;
  description: string | null;
  eventType: "public_holiday" | "company_holiday" | "special_event";
  eventDate: string; // YYYY-MM-DD format

  // Recurrence (重複設定)
  isRecurring: boolean;
  recurrencePattern: string | null; // JSON object (e.g., {type: 'yearly', month: 1, day: 1})

  // Work Day Settings (工作日設定)
  isWorkingDay: boolean; // false = holiday, true = compensatory work day
  compensatoryFor: string | null; // Date that this day compensates for

  // Metadata
  createdAt: number;
  updatedAt: number;
  createdBy: number | null;
  color: string | null;
  icon: string | null;
}

/**
 * Leave Statistics
 */
export interface LeaveStatistics {
  restaurantId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  totalDaysUsed: number;
  mostUsedLeaveType: {
    leaveTypeId: number;
    name: string;
    count: number;
  } | null;
  departmentStats?: Array<{
    departmentId: number;
    totalRequests: number;
    totalDays: number;
  }>;
}

/**
 * Leave Service Interface
 */
export interface ILeaveService {
  // Leave Types
  // `restaurantId` params below are the caller's tenant scope; undefined =
  // platform admin (unscoped).
  getLeaveTypes(restaurantId: string): Promise<LeaveType[]>;
  getLeaveType(id: number, restaurantId?: string): Promise<LeaveType | null>;
  createLeaveType(data: CreateLeaveTypeData): Promise<LeaveType>;
  updateLeaveType(
    id: number,
    data: UpdateLeaveTypeData,
    restaurantId?: string,
  ): Promise<LeaveType>;
  deleteLeaveType(id: number, restaurantId?: string): Promise<boolean>;

  // Leave Balances
  getEmployeeLeaveBalances(
    employeeId: string,
    year: number,
    restaurantId?: string,
  ): Promise<LeaveBalanceWithType[]>;
  getLeaveBalance(
    employeeId: string,
    leaveTypeId: number,
    year: number,
    restaurantId?: string,
  ): Promise<EmployeeLeaveBalance | null>;
  adjustLeaveBalance(
    adjustment: LeaveBalanceAdjustment,
  ): Promise<EmployeeLeaveBalance>;
  accrueLeaveBalances(restaurantId: string, year: number): Promise<number>; // Returns count of accrued balances

  // Leave Requests
  getLeaveRequests(
    filters: LeaveRequestFilters,
  ): Promise<{ items: LeaveRequestWithRelations[]; total: number }>;
  getLeaveRequest(
    id: number,
    restaurantId?: string,
  ): Promise<LeaveRequestWithRelations | null>;
  createLeaveRequest(data: CreateLeaveRequestData): Promise<LeaveRequest>;
  approveLeaveRequest(
    requestId: number,
    approverId: string,
    comments?: string,
    restaurantId?: string,
  ): Promise<LeaveRequest>;
  rejectLeaveRequest(
    requestId: number,
    approverId: string,
    reason: string,
    restaurantId?: string,
  ): Promise<LeaveRequest>;
  cancelLeaveRequest(
    requestId: number,
    userId: string,
    reason: string,
    restaurantId?: string,
  ): Promise<LeaveRequest>;

  // Leave Calendar
  getHolidays(
    restaurantId: string | null,
    year: number,
  ): Promise<LeaveCalendarEvent[]>;
  isWorkingDay(restaurantId: string, date: string): Promise<boolean>;

  // Statistics & Analytics
  getLeaveStatistics(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<LeaveStatistics>;
  getUpcomingLeaves(
    restaurantId: string,
    days: number,
  ): Promise<LeaveRequestWithRelations[]>;
  getExpiringBalances(
    restaurantId: string,
    months: number,
  ): Promise<LeaveBalanceWithType[]>;
}
