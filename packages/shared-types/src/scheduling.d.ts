/**
 * Employee Scheduling Types
 * Shared type definitions for employee work scheduling management
 */
export declare const SHIFT_TYPES: readonly ["regular", "split", "overnight"];
export type ShiftType = (typeof SHIFT_TYPES)[number];
export declare const SCHEDULE_STATUSES: readonly ["scheduled", "confirmed", "completed", "cancelled", "no_show"];
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];
export declare const CONFLICT_TYPES: readonly ["overlapping_shifts", "insufficient_rest", "max_hours_exceeded", "consecutive_days_exceeded", "skill_mismatch", "leave_conflict", "availability_conflict"];
export type ConflictType = (typeof CONFLICT_TYPES)[number];
export declare const CONFLICT_SEVERITIES: readonly ["error", "warning", "info"];
export type ConflictSeverity = (typeof CONFLICT_SEVERITIES)[number];
export declare const CONFLICT_STATUSES: readonly ["unresolved", "acknowledged", "resolved", "ignored"];
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];
export declare const SWAP_REQUEST_TYPES: readonly ["swap", "cover", "drop", "open"];
export type SwapRequestType = (typeof SWAP_REQUEST_TYPES)[number];
export declare const SWAP_REQUEST_URGENCY: readonly ["low", "normal", "high", "urgent"];
export type SwapRequestUrgency = (typeof SWAP_REQUEST_URGENCY)[number];
export declare const SWAP_REQUEST_STATUSES: readonly ["pending", "accepted", "approved", "rejected", "cancelled", "expired"];
export type SwapRequestStatus = (typeof SWAP_REQUEST_STATUSES)[number];
export declare const RULE_TYPES: readonly ["max_hours_per_day", "max_hours_per_week", "min_rest_period", "max_consecutive_days", "skill_requirement", "availability_check"];
export type RuleType = (typeof RULE_TYPES)[number];
export declare const AVAILABILITY_TYPES: readonly ["preferred", "unavailable", "flexible"];
export type AvailabilityType = (typeof AVAILABILITY_TYPES)[number];
/**
 * Shift Template - 班別模板
 * Reusable shift patterns (e.g., morning shift, evening shift)
 */
export interface ShiftTemplate {
    id: number;
    restaurantId: string;
    name: string;
    description?: string;
    shiftType: ShiftType;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isSplitShift: boolean;
    breakStartTime?: string;
    breakEndTime?: string;
    breakDurationMinutes: number;
    applicableDays: string | number[];
    minEmployees: number;
    maxEmployees: number;
    hourlyRate?: number;
    overtimeMultiplier: number;
    colorCode: string;
    icon?: string;
    sortOrder: number;
    isActive: boolean;
    createdBy?: number;
    updatedBy?: number;
    createdAt: Date | string;
    updatedAt: Date | string;
}
/**
 * Employee Schedule - 員工排班
 * Individual employee work schedule assignment
 */
export interface EmployeeSchedule {
    id: number;
    restaurantId: string;
    employeeId: number;
    shiftTemplateId?: number;
    workDate: string;
    startTime: string;
    endTime: string;
    breakDurationMinutes: number;
    clockInTime?: Date | string;
    clockOutTime?: Date | string;
    scheduledHours: number;
    actualHours: number;
    overtimeHours: number;
    status: ScheduleStatus;
    notes?: string;
    managerNotes?: string;
    confirmedBy?: number;
    confirmedAt?: Date | string;
    createdBy: number;
    updatedBy?: number;
    createdAt: Date | string;
    updatedAt: Date | string;
    employee?: {
        id: number;
        fullName: string;
        role: number;
    };
    shiftTemplate?: ShiftTemplate;
}
/**
 * Scheduling Rule - 排班規則
 * Business rules and labor law compliance checks
 */
export interface SchedulingRule {
    id: number;
    restaurantId: string;
    name: string;
    description?: string;
    ruleType: RuleType;
    ruleConfig: string | Record<string, any>;
    appliesToRoles?: string | number[];
    appliesToEmployees?: string | number[];
    priority: number;
    severity: ConflictSeverity;
    isSystemRule: boolean;
    isActive: boolean;
    createdBy: number;
    updatedBy?: number;
    createdAt: Date | string;
    updatedAt: Date | string;
}
/**
 * Scheduling Conflict - 排班衝突
 * Detected conflicts in scheduling
 */
export interface SchedulingConflict {
    id: number;
    restaurantId: string;
    conflictType: ConflictType;
    severity: ConflictSeverity;
    message: string;
    details?: string | Record<string, any>;
    scheduleIds: string | number[];
    employeeIds: string | number[];
    ruleId?: number;
    status: ConflictStatus;
    resolvedBy?: number;
    resolvedAt?: Date | string;
    resolutionNotes?: string;
    detectedAt: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
}
/**
 * Schedule Swap Request - 換班申請
 * Employee shift swap/cover requests
 */
export interface ScheduleSwapRequest {
    id: number;
    restaurantId: string;
    requesterEmployeeId: number;
    requesterScheduleId: number;
    targetEmployeeId?: number;
    targetScheduleId?: number;
    requestType: SwapRequestType;
    reason: string;
    urgency: SwapRequestUrgency;
    isOpenRequest: boolean;
    status: SwapRequestStatus;
    acceptedBy?: number;
    acceptedAt?: Date | string;
    approvedBy?: number;
    approvedAt?: Date | string;
    rejectedBy?: number;
    rejectedAt?: Date | string;
    rejectionReason?: string;
    expiresAt?: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
    requester?: {
        id: number;
        fullName: string;
    };
    targetEmployee?: {
        id: number;
        fullName: string;
    };
    requesterSchedule?: EmployeeSchedule;
    targetSchedule?: EmployeeSchedule;
}
/**
 * Employee Availability - 員工可用時段
 * Employee availability preferences
 */
export interface EmployeeAvailability {
    id: number;
    restaurantId: string;
    employeeId: number;
    availabilityType: AvailabilityType;
    dayOfWeek?: number;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    isRecurring: boolean;
    notes?: string;
    isActive: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
}
/**
 * Shift Template API Payloads
 */
export interface CreateShiftTemplateRequest {
    restaurantId: string;
    name: string;
    description?: string;
    shiftType: ShiftType;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isSplitShift?: boolean;
    breakStartTime?: string;
    breakEndTime?: string;
    breakDurationMinutes?: number;
    applicableDays?: number[];
    minEmployees?: number;
    maxEmployees?: number;
    hourlyRate?: number;
    overtimeMultiplier?: number;
    colorCode?: string;
    icon?: string;
    sortOrder?: number;
    createdBy: number;
}
export interface UpdateShiftTemplateRequest extends Partial<CreateShiftTemplateRequest> {
    updatedBy: number;
}
/**
 * Employee Schedule API Payloads
 */
export interface CreateScheduleRequest {
    restaurantId: string;
    employeeId: number;
    shiftTemplateId?: number;
    workDate: string;
    startTime: string;
    endTime: string;
    breakDurationMinutes?: number;
    scheduledHours: number;
    notes?: string;
    createdBy: number;
}
export interface UpdateScheduleRequest extends Partial<CreateScheduleRequest> {
    status?: ScheduleStatus;
    managerNotes?: string;
    updatedBy: number;
}
export interface BulkCreateScheduleRequest {
    restaurantId: string;
    shiftTemplateId: number;
    employeeIds: number[];
    dateRange: {
        startDate: string;
        endDate: string;
    };
    daysOfWeek: number[];
    createdBy: number;
}
/**
 * Clock In/Out Payloads
 */
export interface ClockInRequest {
    scheduleId: number;
    employeeId: number;
    clockInTime: Date | string;
    notes?: string;
}
export interface ClockOutRequest {
    scheduleId: number;
    employeeId: number;
    clockOutTime: Date | string;
    notes?: string;
}
/**
 * Swap Request API Payloads
 */
export interface CreateSwapRequestRequest {
    restaurantId: string;
    requesterEmployeeId: number;
    requesterScheduleId: number;
    targetEmployeeId?: number;
    targetScheduleId?: number;
    requestType: SwapRequestType;
    reason: string;
    urgency?: SwapRequestUrgency;
    isOpenRequest?: boolean;
}
export interface ApproveSwapRequestRequest {
    managerId: number;
    notes?: string;
}
export interface RejectSwapRequestRequest {
    managerId: number;
    reason: string;
}
/**
 * Filter & Query Types
 */
export interface ScheduleFilters {
    restaurantId?: string;
    employeeId?: number;
    shiftTemplateId?: number;
    startDate?: string;
    endDate?: string;
    status?: ScheduleStatus;
    page?: number;
    limit?: number;
}
export interface ConflictFilters {
    restaurantId?: string;
    conflictType?: ConflictType;
    severity?: ConflictSeverity;
    status?: ConflictStatus;
    employeeId?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}
export interface SwapRequestFilters {
    restaurantId?: string;
    requestType?: SwapRequestType;
    status?: SwapRequestStatus;
    requesterEmployeeId?: number;
    targetEmployeeId?: number;
    page?: number;
    limit?: number;
}
/**
 * Conflict Check Result
 */
export interface ConflictCheckResult {
    hasConflicts: boolean;
    conflicts: SchedulingConflict[];
    warnings: SchedulingConflict[];
    info: SchedulingConflict[];
}
/**
 * Available Employees Query
 */
export interface AvailableEmployeesRequest {
    restaurantId: string;
    date: string;
    shiftTemplateId?: number;
}
export interface AvailableEmployee {
    id: number;
    fullName: string;
    role: number;
    availability: "available" | "on_leave" | "scheduled";
    reason?: string;
}
/**
 * Schedule Statistics
 */
export interface ScheduleStatistics {
    restaurantId: string;
    period: {
        startDate: string;
        endDate: string;
    };
    totalSchedules: number;
    totalEmployees: number;
    totalHours: number;
    totalOvertimeHours: number;
    statusBreakdown: {
        scheduled: number;
        confirmed: number;
        completed: number;
        cancelled: number;
        noShow: number;
    };
    shiftTypeBreakdown: Record<ShiftType, number>;
}
/**
 * Employee Weekly Hours
 */
export interface EmployeeWeeklyHours {
    employeeId: number;
    employeeName: string;
    restaurantId: string;
    yearWeek: string;
    shiftsCount: number;
    totalHours: number;
    overtimeHours: number;
    noShowCount: number;
}
/**
 * Daily Staffing Coverage
 */
export interface DailyStaffingCoverage {
    restaurantId: string;
    workDate: string;
    shiftType: ShiftType;
    shiftName: string;
    scheduledCount: number;
    minEmployees: number;
    maxEmployees: number;
    staffingStatus: "understaffed" | "optimal" | "overstaffed";
}
/**
 * Weekly Schedule Summary
 */
export interface WeeklyScheduleSummary {
    restaurantId: string;
    workDate: string;
    weekNumber: number;
    year: number;
    totalEmployees: number;
    totalShifts: number;
    totalScheduledMinutes: number;
    confirmedShifts: number;
    completedShifts: number;
    cancelledShifts: number;
}
