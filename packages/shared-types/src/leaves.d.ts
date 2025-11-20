/**
 * Leave Management Types
 * Shared type definitions for employee leave/time-off management
 */
export declare const LEAVE_STATUSES: readonly ["draft", "pending", "approved", "rejected", "cancelled", "withdrawn"];
export type LeaveStatus = typeof LEAVE_STATUSES[number];
export declare const LEAVE_ACCRUAL_TYPES: readonly ["yearly", "monthly", "per_service_year", "manual"];
export type LeaveAccrualType = typeof LEAVE_ACCRUAL_TYPES[number];
export declare const HALF_DAY_TYPES: readonly ["morning", "afternoon"];
export type HalfDayType = typeof HALF_DAY_TYPES[number];
/**
 * Leave Type - 假期類型
 * Defines different types of leave available (annual, sick, personal, etc.)
 */
export interface LeaveType {
    id: number;
    restaurantId?: number;
    code: string;
    name: string;
    description?: string;
    defaultDaysPerYear: number;
    maxDaysPerYear?: number;
    minServiceMonths: number;
    accrualType: LeaveAccrualType;
    accrualRate?: number;
    minNoticeDays: number;
    maxConsecutiveDays?: number;
    requiresDocumentation: boolean;
    canBeNegative: boolean;
    allowCarryover: boolean;
    maxCarryoverDays: number;
    carryoverExpiresMonths?: number;
    requiresApproval: boolean;
    approvalLevels: number;
    autoApproveThresholdDays?: number;
    isPaid: boolean;
    paymentPercentage: number;
    colorCode: string;
    color?: string;
    iconName?: string;
    displayOrder: number;
    isActive: boolean;
    isSystemDefined: boolean;
    allowHalfDay?: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
}
/**
 * Employee Leave Balance - 員工假期餘額
 * Tracks available leave days for each employee per year
 */
export interface LeaveBalance {
    id: number;
    employeeId: number;
    leaveTypeId: number;
    year: number;
    totalDays: number;
    usedDays: number;
    pendingDays: number;
    remainingDays: number;
    carryoverDays: number;
    carryoverExpiresAt?: Date | string;
    accruedDays: number;
    lastAccrualDate?: string;
    adjustmentDays: number;
    adjustmentReason?: string;
    adjustedBy?: number;
    adjustedAt?: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
    leaveType?: LeaveType;
}
/**
 * Leave Request - 請假申請
 * Individual employee leave request
 */
export interface LeaveRequest {
    id: number;
    restaurantId: number;
    employeeId: number;
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    daysCount: number;
    halfDayType?: HalfDayType;
    reason: string;
    description?: string;
    attachments?: Array<{
        name: string;
        url: string;
        type?: string;
        size?: number;
    }>;
    status: LeaveStatus;
    currentApprovalLevel: number;
    requiredApprovalLevels: number;
    approvedBy?: number;
    approvedAt?: Date | string;
    rejectedBy?: number;
    rejectedAt?: Date | string;
    rejectionReason?: string;
    cancelledBy?: number;
    cancelledAt?: Date | string;
    cancellationReason?: string;
    hasScheduleConflict: boolean;
    conflictDetails?: string | Record<string, any>;
    delegatedTo?: number;
    delegationNotes?: string;
    approvalChain?: Array<{
        level: number;
        approverId: number;
        approverName: string;
        status: 'pending' | 'approved' | 'rejected';
        decidedAt?: Date | string;
    }>;
    submittedAt: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
    employeeName?: string;
    leaveType?: LeaveType;
    approver?: {
        id: number;
        fullName: string;
    };
}
/**
 * Leave Approval Record - 假期審批記錄
 * Tracks approval workflow history
 */
export interface LeaveApprovalRecord {
    id: number;
    leaveRequestId: number;
    approvalLevel: number;
    approverId: number;
    approverName?: string;
    approverRole: number;
    action: 'approve' | 'reject';
    decision: 'approved' | 'rejected' | 'pending';
    comments?: string;
    decidedAt?: Date | string;
    createdAt: Date | string;
}
/**
 * Leave Type API Payloads
 */
export interface CreateLeaveTypeRequest {
    restaurantId?: number;
    code: string;
    name: string;
    description?: string;
    defaultDaysPerYear: number;
    maxDaysPerYear?: number;
    minServiceMonths?: number;
    accrualType?: LeaveAccrualType;
    accrualRate?: number;
    minNoticeDays?: number;
    maxConsecutiveDays?: number;
    requiresDocumentation?: boolean;
    canBeNegative?: boolean;
    allowCarryover?: boolean;
    maxCarryoverDays?: number;
    carryoverExpiresMonths?: number;
    requiresApproval?: boolean;
    approvalLevels?: number;
    autoApproveThresholdDays?: number;
    isPaid?: boolean;
    paymentPercentage?: number;
    colorCode?: string;
    iconName?: string;
    displayOrder?: number;
}
export interface UpdateLeaveTypeRequest extends Partial<CreateLeaveTypeRequest> {
    id: number;
}
/**
 * Leave Request API Payloads
 */
export interface CreateLeaveRequestRequest {
    restaurantId: number;
    employeeId: number;
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    daysCount: number;
    halfDayType?: HalfDayType;
    reason: string;
    description?: string;
    attachments?: Array<{
        name: string;
        url: string;
        type?: string;
        size?: number;
    }>;
    delegatedTo?: number;
    delegationNotes?: string;
}
export interface UpdateLeaveRequestRequest extends Partial<CreateLeaveRequestRequest> {
    id: number;
}
export interface ApproveLeaveRequestRequest {
    requestId: number;
    approverId: number;
    comments?: string;
}
export interface RejectLeaveRequestRequest {
    requestId: number;
    rejectedBy: number;
    reason: string;
}
export interface CancelLeaveRequestRequest {
    requestId: number;
    cancelledBy: number;
    reason: string;
}
/**
 * Leave Balance API Payloads
 */
export interface AdjustLeaveBalanceRequest {
    balanceId: number;
    adjustmentDays: number;
    reason: string;
    adjustedBy: number;
}
export interface InitializeLeaveBalancesRequest {
    employeeId: number;
    year: number;
    leaveTypeIds?: number[];
}
/**
 * Filter & Query Types
 */
export interface LeaveRequestFilters {
    restaurantId?: number;
    employeeId?: number;
    leaveTypeId?: number;
    status?: LeaveStatus;
    startDate?: string;
    endDate?: string;
    year?: number;
    page?: number;
    limit?: number;
}
export interface LeaveBalanceFilters {
    restaurantId?: number;
    employeeId?: number;
    leaveTypeId?: number;
    year?: number;
}
export interface LeaveTypeFilters {
    restaurantId?: number;
    isActive?: boolean;
    isSystemDefined?: boolean;
}
/**
 * Conflict Check Result
 */
export interface LeaveConflictCheckResult {
    hasConflicts: boolean;
    scheduleConflicts: Array<{
        scheduleId: number;
        date: string;
        shiftName: string;
        message: string;
    }>;
    balanceIssues: Array<{
        leaveTypeId: number;
        leaveTypeName: string;
        availableDays: number;
        requestedDays: number;
        message: string;
    }>;
    policyViolations: Array<{
        rule: string;
        message: string;
    }>;
}
/**
 * Leave Statistics
 */
export interface LeaveStatistics {
    restaurantId: number;
    period: {
        startDate: string;
        endDate: string;
    };
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    pendingRequests: number;
    totalDaysTaken: number;
    statusBreakdown: {
        pending: number;
        approved: number;
        rejected: number;
        cancelled: number;
    };
    leaveTypeBreakdown: Record<string, {
        requests: number;
        days: number;
    }>;
}
/**
 * Employee Leave Summary
 */
export interface EmployeeLeaveSummary {
    employeeId: number;
    employeeName: string;
    year: number;
    balances: Array<{
        leaveType: string;
        totalDays: number;
        usedDays: number;
        pendingDays: number;
        remainingDays: number;
    }>;
    recentRequests: LeaveRequest[];
}
/**
 * Team Leave Calendar
 */
export interface TeamLeaveCalendar {
    restaurantId: number;
    date: string;
    onLeave: Array<{
        employeeId: number;
        employeeName: string;
        leaveType: string;
        leaveTypeColor: string;
    }>;
    availableEmployees: number;
    totalEmployees: number;
}
