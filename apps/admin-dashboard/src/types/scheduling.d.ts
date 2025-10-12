/**
 * Employee Scheduling TypeScript Type Definitions
 * Matches backend API responses and database schema
 */
export interface ShiftTemplate {
    id: number;
    restaurantId: number;
    name: string;
    description: string | null;
    shiftType: 'regular' | 'split' | 'overnight';
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isSplitShift: boolean;
    breakStartTime: string | null;
    breakEndTime: string | null;
    breakDurationMinutes: number;
    applicableDays: string;
    minEmployees: number;
    maxEmployees: number;
    hourlyRate: number | null;
    overtimeMultiplier: number;
    colorCode: string;
    icon: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    createdBy: number;
    updatedBy: number | null;
}
export interface CreateShiftTemplateData {
    name: string;
    description?: string;
    shiftType: 'regular' | 'split' | 'overnight';
    startTime: string;
    endTime: string;
    durationMinutes: number;
    isSplitShift?: boolean;
    breakStartTime?: string;
    breakEndTime?: string;
    breakDurationMinutes?: number;
    applicableDays?: string;
    minEmployees?: number;
    maxEmployees?: number;
    hourlyRate?: number;
    overtimeMultiplier?: number;
    colorCode?: string;
    icon?: string;
    sortOrder?: number;
}
export interface EmployeeSchedule {
    id: number;
    restaurantId: number;
    employeeId: number;
    employeeName?: string;
    shiftTemplateId: number | null;
    shiftTemplate?: ShiftTemplate;
    workDate: string;
    startTime: string;
    endTime: string;
    breakDurationMinutes: number;
    scheduledHours: number;
    actualStartTime: string | null;
    actualEndTime: string | null;
    actualHours: number | null;
    overtimeHours: number | null;
    status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    notes: string | null;
    managerNotes: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy: number;
    updatedBy: number | null;
}
export interface CreateScheduleData {
    employeeId: number;
    shiftTemplateId?: number;
    workDate: string;
    startTime: string;
    endTime: string;
    breakDurationMinutes?: number;
    scheduledHours: number;
    notes?: string;
    managerNotes?: string;
}
export interface UpdateScheduleData {
    shiftTemplateId?: number;
    workDate?: string;
    startTime?: string;
    endTime?: string;
    breakDurationMinutes?: number;
    scheduledHours?: number;
    status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    notes?: string;
    managerNotes?: string;
}
export interface BulkCreateSchedulesData {
    shiftTemplateId: number;
    employeeIds: number[];
    dateRange: {
        startDate: string;
        endDate: string;
    };
    daysOfWeek: number[];
}
export interface AvailableEmployee {
    id: number;
    fullName: string;
    role: number;
    availability: 'available' | 'on_leave' | 'scheduled';
    reason?: string;
}
export interface SchedulingConflict {
    id: number;
    restaurantId: number;
    scheduleId: number;
    employeeId: number;
    conflictType: 'overlapping_shifts' | 'insufficient_rest' | 'max_hours_exceeded' | 'consecutive_days_exceeded' | 'skill_mismatch' | 'leave_conflict' | 'availability_conflict';
    severity: 'error' | 'warning' | 'info';
    message: string;
    conflictDetails: string;
    status: 'unresolved' | 'acknowledged' | 'resolved' | 'ignored';
    resolvedBy: number | null;
    resolvedAt: string | null;
    resolutionNotes: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface SwapRequest {
    id: number;
    restaurantId: number;
    requesterEmployeeId: number;
    requesterEmployeeName?: string;
    requesterScheduleId: number;
    targetEmployeeId: number | null;
    targetEmployeeName?: string;
    targetScheduleId: number | null;
    requestType: 'swap' | 'cover' | 'drop';
    reason: string;
    urgency: 'low' | 'normal' | 'high' | 'urgent';
    status: 'pending' | 'accepted' | 'approved' | 'rejected' | 'cancelled' | 'expired';
    isOpenRequest: boolean;
    acceptedBy: number | null;
    acceptedAt: string | null;
    approvedBy: number | null;
    approvedAt: string | null;
    rejectedBy: number | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface CreateSwapRequestData {
    requesterScheduleId: number;
    targetEmployeeId?: number;
    targetScheduleId?: number;
    requestType: 'swap' | 'cover' | 'drop';
    reason: string;
    urgency?: 'low' | 'normal' | 'high' | 'urgent';
    isOpenRequest?: boolean;
}
export interface ClockInData {
    scheduleId: number;
    employeeId: number;
    notes?: string;
}
export interface ClockOutData {
    scheduleId: number;
    employeeId: number;
    notes?: string;
}
export interface ScheduleFilters {
    restaurantId?: number;
    employeeId?: number;
    shiftTemplateId?: number;
    startDate?: string;
    endDate?: string;
    status?: EmployeeSchedule['status'];
    page?: number;
    limit?: number;
}
export interface ConflictFilters {
    restaurantId?: number;
    conflictType?: SchedulingConflict['conflictType'];
    severity?: SchedulingConflict['severity'];
    status?: SchedulingConflict['status'];
    employeeId?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}
export interface SwapRequestFilters {
    restaurantId?: number;
    requesterEmployeeId?: number;
    targetEmployeeId?: number;
    status?: SwapRequest['status'];
    requestType?: SwapRequest['requestType'];
    page?: number;
    limit?: number;
}
export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}
export interface ApiError {
    success: false;
    error: string;
    code?: string;
    details?: any;
}
export interface DailyStats {
    date: string;
    totalSchedules: number;
    confirmedSchedules: number;
    completedSchedules: number;
    totalHours: number;
    totalEmployees: number;
}
export interface WeeklySummary {
    weekStartDate: string;
    weekEndDate: string;
    totalSchedules: number;
    totalHours: number;
    averageHoursPerDay: number;
    employeeStats: Array<{
        employeeId: number;
        employeeName: string;
        totalHours: number;
        scheduleCount: number;
    }>;
}
