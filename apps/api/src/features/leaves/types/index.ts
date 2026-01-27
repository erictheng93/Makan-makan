/**
 * Leave Management Types
 * Type definitions for employee leave/time-off management system
 */

/**
 * Leave Type (假別類型)
 * Defines different types of leave available (annual, sick, personal, etc.)
 */
export interface LeaveType {
  id: number;
  restaurantId: string | null; // null for system-level leave types
  code: string;
  name: string;
  description: string | null;

  // Accrual Rules (計算規則)
  accrualType: "yearly" | "monthly" | "none";
  accrualAmount: number;
  accrualBasedOnSeniority: boolean;

  // Usage Rules (使用規則)
  requiresApproval: boolean;
  requiredApprovalLevels: number;
  minNoticeDays: number;
  maxConsecutiveDays: number | null;
  canCarryover: boolean;
  carryoverMaxDays: number | null;
  carryoverExpiryMonths: number | null;

  // Documentation & Payment (文件與給付)
  requiresDocumentation: boolean;
  documentationRequiredAfterDays: number | null;
  isPaid: boolean;
  paymentRate: number; // 0.0 to 1.0 (e.g., 0.5 for half pay)

  // Restrictions (限制條件)
  allowHalfDay: boolean;
  gender: "any" | "male" | "female" | null;
  applicableToRoles: string | null; // JSON array of role IDs
  maxUsagePerYear: number | null;

  // System Fields
  isSystemDefined: boolean;
  isActive: boolean;
  sortOrder: number;
  color: string | null;
  icon: string | null;

  createdAt: number;
  updatedAt: number;
  createdBy: number | null;
  updatedBy: number | null;
}

/**
 * Employee Leave Balance (員工假期餘額)
 * Tracks leave balance for each employee per year
 */
export interface EmployeeLeaveBalance {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  restaurantId: string;
  year: number;

  // Balance Tracking (餘額追蹤)
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number; // Generated: totalDays - usedDays - pendingDays

  // Carryover Management (遞延管理)
  carryoverFromPrevious: number;
  carryoverToNext: number;
  carryoverExpiresAt: number | null;

  // Manual Adjustments (手動調整)
  manualAdjustment: number;
  adjustmentReason: string | null;
  adjustedBy: number | null;
  adjustedAt: number | null;

  // Metadata
  createdAt: number;
  updatedAt: number;
  lastUpdatedBy: number | null;
}

/**
 * Type alias for compatibility with database service
 */
export type LeaveBalance = EmployeeLeaveBalance;

/**
 * Leave Request (請假申請)
 * Employee leave request submission and approval workflow
 */
export interface LeaveRequest {
  id: number;
  restaurantId: string;
  employeeId: number;
  leaveTypeId: number;

  // Date & Duration (日期與時長)
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  startPeriod: "full" | "am" | "pm";
  endPeriod: "full" | "am" | "pm";
  totalDays: number; // Supports 0.5 for half days

  // Request Details (申請內容)
  reason: string;
  attachmentUrl: string | null;
  emergencyContact: string | null;

  // Approval Workflow (審批流程)
  status: "pending" | "approved" | "rejected" | "cancelled" | "withdrawn";
  approvalChain: string; // JSON array of approval steps
  currentApprovalLevel: number;
  finalApproverId: number | null;
  finalApprovedAt: number | null;
  rejectedBy: number | null;
  rejectedAt: number | null;
  rejectionReason: string | null;

  // Cancellation (取消)
  cancelledBy: number | null;
  cancelledAt: number | null;
  cancellationReason: string | null;

  // Schedule Integration (排班整合)
  affectedScheduleIds: string | null; // JSON array of schedule IDs
  replacementNotified: boolean;

  // Metadata
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
}

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
 * Leave Request with Relations
 * Extended leave request with employee and leave type information
 */
export interface LeaveRequestWithRelations extends LeaveRequest {
  employee: {
    id: number;
    name: string;
    email: string;
    role: number;
  };
  leaveType: {
    id: number;
    code: string;
    name: string;
    isPaid: boolean;
    color: string | null;
  };
  approvers?: Array<{
    level: number;
    userId: number;
    userName: string;
    approvedAt: number | null;
    comments: string | null;
  }>;
}

/**
 * Leave Balance with Leave Type
 */
export interface LeaveBalanceWithType extends EmployeeLeaveBalance {
  leaveType: {
    id: number;
    code: string;
    name: string;
    accrualType: string;
    isPaid: boolean;
    color: string | null;
    icon: string | null;
  };
}

/**
 * Create Leave Type Data
 */
export type CreateLeaveTypeData = Omit<
  LeaveType,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

/**
 * Update Leave Type Data
 */
export type UpdateLeaveTypeData = Partial<
  Omit<LeaveType, "id" | "createdAt" | "updatedAt">
>;

/**
 * Create Leave Request Data
 */
export type CreateLeaveRequestData = Omit<
  LeaveRequest,
  | "id"
  | "status"
  | "approvalChain"
  | "currentApprovalLevel"
  | "finalApproverId"
  | "finalApprovedAt"
  | "rejectedBy"
  | "rejectedAt"
  | "rejectionReason"
  | "cancelledBy"
  | "cancelledAt"
  | "cancellationReason"
  | "affectedScheduleIds"
  | "replacementNotified"
  | "createdAt"
  | "updatedAt"
  | "submittedAt"
>;

/**
 * Leave Request Filters
 */
export interface LeaveRequestFilters {
  employeeId?: number;
  leaveTypeId?: number;
  status?: LeaveRequest["status"];
  startDate?: string; // Filter requests that overlap with this date range
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Leave Balance Adjustment
 */
export interface LeaveBalanceAdjustment {
  employeeId: number;
  leaveTypeId: number;
  year: number;
  adjustment: number;
  reason: string;
  adjustedBy: number;
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
  getLeaveTypes(restaurantId: string): Promise<LeaveType[]>;
  getLeaveType(id: number): Promise<LeaveType | null>;
  createLeaveType(data: CreateLeaveTypeData): Promise<LeaveType>;
  updateLeaveType(id: number, data: UpdateLeaveTypeData): Promise<LeaveType>;
  deleteLeaveType(id: number): Promise<boolean>;

  // Leave Balances
  getEmployeeLeaveBalances(
    employeeId: number,
    year: number,
  ): Promise<LeaveBalanceWithType[]>;
  getLeaveBalance(
    employeeId: number,
    leaveTypeId: number,
    year: number,
  ): Promise<EmployeeLeaveBalance | null>;
  adjustLeaveBalance(
    adjustment: LeaveBalanceAdjustment,
  ): Promise<EmployeeLeaveBalance>;
  accrueLeaveBalances(restaurantId: string, year: number): Promise<number>; // Returns count of accrued balances

  // Leave Requests
  getLeaveRequests(
    filters: LeaveRequestFilters,
  ): Promise<{ items: LeaveRequestWithRelations[]; total: number }>;
  getLeaveRequest(id: number): Promise<LeaveRequestWithRelations | null>;
  createLeaveRequest(data: CreateLeaveRequestData): Promise<LeaveRequest>;
  approveLeaveRequest(
    requestId: number,
    approverId: number,
    comments?: string,
  ): Promise<LeaveRequest>;
  rejectLeaveRequest(
    requestId: number,
    approverId: number,
    reason: string,
  ): Promise<LeaveRequest>;
  cancelLeaveRequest(
    requestId: number,
    userId: number,
    reason: string,
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
