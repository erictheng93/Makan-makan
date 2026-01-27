/**
 * Employee Scheduling Types
 * Shared type definitions for employee work scheduling management
 */

// ========================================
// Enums & Constants
// ========================================

export const SHIFT_TYPES = ['regular', 'split', 'overnight'] as const
export type ShiftType = typeof SHIFT_TYPES[number]

export const SCHEDULE_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const
export type ScheduleStatus = typeof SCHEDULE_STATUSES[number]

export const CONFLICT_TYPES = [
  'overlapping_shifts',
  'insufficient_rest',
  'max_hours_exceeded',
  'consecutive_days_exceeded',
  'skill_mismatch',
  'leave_conflict',
  'availability_conflict',
] as const
export type ConflictType = typeof CONFLICT_TYPES[number]

export const CONFLICT_SEVERITIES = ['error', 'warning', 'info'] as const
export type ConflictSeverity = typeof CONFLICT_SEVERITIES[number]

export const CONFLICT_STATUSES = ['unresolved', 'acknowledged', 'resolved', 'ignored'] as const
export type ConflictStatus = typeof CONFLICT_STATUSES[number]

export const SWAP_REQUEST_TYPES = ['swap', 'cover', 'drop', 'open'] as const
export type SwapRequestType = typeof SWAP_REQUEST_TYPES[number]

export const SWAP_REQUEST_URGENCY = ['low', 'normal', 'high', 'urgent'] as const
export type SwapRequestUrgency = typeof SWAP_REQUEST_URGENCY[number]

export const SWAP_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'approved',
  'rejected',
  'cancelled',
  'expired',
] as const
export type SwapRequestStatus = typeof SWAP_REQUEST_STATUSES[number]

export const RULE_TYPES = [
  'max_hours_per_day',
  'max_hours_per_week',
  'min_rest_period',
  'max_consecutive_days',
  'skill_requirement',
  'availability_check',
] as const
export type RuleType = typeof RULE_TYPES[number]

export const AVAILABILITY_TYPES = ['preferred', 'unavailable', 'flexible'] as const
export type AvailabilityType = typeof AVAILABILITY_TYPES[number]

// ========================================
// Core Entities
// ========================================

/**
 * Shift Template - 班別模板
 * Reusable shift patterns (e.g., morning shift, evening shift)
 */
export interface ShiftTemplate {
  id: number
  restaurantId: string

  // Basic Information
  name: string
  description?: string
  shiftType: ShiftType

  // Time Settings
  startTime: string // HH:MM format
  endTime: string   // HH:MM format
  durationMinutes: number

  // Split Shift Support
  isSplitShift: boolean
  breakStartTime?: string
  breakEndTime?: string
  breakDurationMinutes: number

  // Applicable Days (JSON array of 0-6, 0=Sunday)
  applicableDays: string | number[]

  // Staffing Requirements
  minEmployees: number
  maxEmployees: number

  // Compensation
  hourlyRate?: number
  overtimeMultiplier: number

  // Display Settings
  colorCode: string
  icon?: string
  sortOrder: number

  // Status
  isActive: boolean

  // Audit
  createdBy?: number
  updatedBy?: number
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Employee Schedule - 員工排班
 * Individual employee work schedule assignment
 */
export interface EmployeeSchedule {
  id: number
  restaurantId: string
  employeeId: number
  shiftTemplateId?: number

  // Schedule Details
  workDate: string // YYYY-MM-DD format
  startTime: string // HH:MM format
  endTime: string   // HH:MM format
  breakDurationMinutes: number

  // Clock In/Out
  clockInTime?: Date | string
  clockOutTime?: Date | string

  // Hours Tracking
  scheduledHours: number
  actualHours: number
  overtimeHours: number

  // Status
  status: ScheduleStatus

  // Notes
  notes?: string
  managerNotes?: string

  // Confirmation
  confirmedBy?: number
  confirmedAt?: Date | string

  // Audit
  createdBy: number
  updatedBy?: number
  createdAt: Date | string
  updatedAt: Date | string

  // Relations (optional, for populated data)
  employee?: {
    id: number
    fullName: string
    role: number
  }
  shiftTemplate?: ShiftTemplate
}

/**
 * Scheduling Rule - 排班規則
 * Business rules and labor law compliance checks
 */
export interface SchedulingRule {
  id: number
  restaurantId: string

  // Rule Definition
  name: string
  description?: string
  ruleType: RuleType

  // Rule Configuration (JSON)
  ruleConfig: string | Record<string, any>

  // Applicability
  appliesToRoles?: string | number[]
  appliesToEmployees?: string | number[]

  // Priority & Severity
  priority: number
  severity: ConflictSeverity

  // Flags
  isSystemRule: boolean
  isActive: boolean

  // Audit
  createdBy: number
  updatedBy?: number
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Scheduling Conflict - 排班衝突
 * Detected conflicts in scheduling
 */
export interface SchedulingConflict {
  id: number
  restaurantId: string

  // Conflict Details
  conflictType: ConflictType
  severity: ConflictSeverity
  message: string
  details?: string | Record<string, any>

  // Affected Entities
  scheduleIds: string | number[]
  employeeIds: string | number[]
  ruleId?: number

  // Resolution
  status: ConflictStatus
  resolvedBy?: number
  resolvedAt?: Date | string
  resolutionNotes?: string

  // Timestamps
  detectedAt: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Schedule Swap Request - 換班申請
 * Employee shift swap/cover requests
 */
export interface ScheduleSwapRequest {
  id: number
  restaurantId: string

  // Requester Information
  requesterEmployeeId: number
  requesterScheduleId: number

  // Target Information
  targetEmployeeId?: number
  targetScheduleId?: number

  // Request Details
  requestType: SwapRequestType
  reason: string
  urgency: SwapRequestUrgency
  isOpenRequest: boolean

  // Status & Workflow
  status: SwapRequestStatus

  // Target Response
  acceptedBy?: number
  acceptedAt?: Date | string

  // Manager Approval
  approvedBy?: number
  approvedAt?: Date | string
  rejectedBy?: number
  rejectedAt?: Date | string
  rejectionReason?: string

  // Expiration
  expiresAt?: Date | string

  // Audit
  createdAt: Date | string
  updatedAt: Date | string

  // Relations (optional, for populated data)
  requester?: {
    id: number
    fullName: string
  }
  targetEmployee?: {
    id: number
    fullName: string
  }
  requesterSchedule?: EmployeeSchedule
  targetSchedule?: EmployeeSchedule
}

/**
 * Employee Availability - 員工可用時段
 * Employee availability preferences
 */
export interface EmployeeAvailability {
  id: number
  restaurantId: string
  employeeId: number

  // Availability Type
  availabilityType: AvailabilityType

  // Time Settings
  dayOfWeek?: number // 0-6, 0=Sunday
  startDate?: string // YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD
  startTime?: string // HH:MM
  endTime?: string   // HH:MM

  // Recurrence
  isRecurring: boolean

  // Notes
  notes?: string

  // Status
  isActive: boolean

  // Audit
  createdAt: Date | string
  updatedAt: Date | string
}

// ========================================
// Request & Response Types
// ========================================

/**
 * Shift Template API Payloads
 */
export interface CreateShiftTemplateRequest {
  restaurantId: string
  name: string
  description?: string
  shiftType: ShiftType
  startTime: string
  endTime: string
  durationMinutes: number
  isSplitShift?: boolean
  breakStartTime?: string
  breakEndTime?: string
  breakDurationMinutes?: number
  applicableDays?: number[]
  minEmployees?: number
  maxEmployees?: number
  hourlyRate?: number
  overtimeMultiplier?: number
  colorCode?: string
  icon?: string
  sortOrder?: number
  createdBy: number
}

export interface UpdateShiftTemplateRequest extends Partial<CreateShiftTemplateRequest> {
  updatedBy: number
}

/**
 * Employee Schedule API Payloads
 */
export interface CreateScheduleRequest {
  restaurantId: string
  employeeId: number
  shiftTemplateId?: number
  workDate: string
  startTime: string
  endTime: string
  breakDurationMinutes?: number
  scheduledHours: number
  notes?: string
  createdBy: number
}

export interface UpdateScheduleRequest extends Partial<CreateScheduleRequest> {
  status?: ScheduleStatus
  managerNotes?: string
  updatedBy: number
}

export interface BulkCreateScheduleRequest {
  restaurantId: string
  shiftTemplateId: number
  employeeIds: number[]
  dateRange: {
    startDate: string
    endDate: string
  }
  daysOfWeek: number[] // 0-6, 0=Sunday
  createdBy: number
}

/**
 * Clock In/Out Payloads
 */
export interface ClockInRequest {
  scheduleId: number
  employeeId: number
  clockInTime: Date | string
  notes?: string
}

export interface ClockOutRequest {
  scheduleId: number
  employeeId: number
  clockOutTime: Date | string
  notes?: string
}

/**
 * Swap Request API Payloads
 */
export interface CreateSwapRequestRequest {
  restaurantId: string
  requesterEmployeeId: number
  requesterScheduleId: number
  targetEmployeeId?: number
  targetScheduleId?: number
  requestType: SwapRequestType
  reason: string
  urgency?: SwapRequestUrgency
  isOpenRequest?: boolean
}

export interface ApproveSwapRequestRequest {
  managerId: number
  notes?: string
}

export interface RejectSwapRequestRequest {
  managerId: number
  reason: string
}

/**
 * Filter & Query Types
 */
export interface ScheduleFilters {
  restaurantId?: string
  employeeId?: number
  shiftTemplateId?: number
  startDate?: string
  endDate?: string
  status?: ScheduleStatus
  page?: number
  limit?: number
}

export interface ConflictFilters {
  restaurantId?: string
  conflictType?: ConflictType
  severity?: ConflictSeverity
  status?: ConflictStatus
  employeeId?: number
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface SwapRequestFilters {
  restaurantId?: string
  requestType?: SwapRequestType
  status?: SwapRequestStatus
  requesterEmployeeId?: number
  targetEmployeeId?: number
  page?: number
  limit?: number
}

/**
 * Conflict Check Result
 */
export interface ConflictCheckResult {
  hasConflicts: boolean
  conflicts: SchedulingConflict[]
  warnings: SchedulingConflict[]
  info: SchedulingConflict[]
}

/**
 * Available Employees Query
 */
export interface AvailableEmployeesRequest {
  restaurantId: string
  date: string
  shiftTemplateId?: number
}

export interface AvailableEmployee {
  id: number
  fullName: string
  role: number
  availability: 'available' | 'on_leave' | 'scheduled'
  reason?: string
}

// ========================================
// Statistics & Analytics
// ========================================

/**
 * Schedule Statistics
 */
export interface ScheduleStatistics {
  restaurantId: string
  period: {
    startDate: string
    endDate: string
  }
  totalSchedules: number
  totalEmployees: number
  totalHours: number
  totalOvertimeHours: number
  statusBreakdown: {
    scheduled: number
    confirmed: number
    completed: number
    cancelled: number
    noShow: number
  }
  shiftTypeBreakdown: Record<ShiftType, number>
}

/**
 * Employee Weekly Hours
 */
export interface EmployeeWeeklyHours {
  employeeId: number
  employeeName: string
  restaurantId: string
  yearWeek: string // YYYY-WW format
  shiftsCount: number
  totalHours: number
  overtimeHours: number
  noShowCount: number
}

/**
 * Daily Staffing Coverage
 */
export interface DailyStaffingCoverage {
  restaurantId: string
  workDate: string
  shiftType: ShiftType
  shiftName: string
  scheduledCount: number
  minEmployees: number
  maxEmployees: number
  staffingStatus: 'understaffed' | 'optimal' | 'overstaffed'
}

/**
 * Weekly Schedule Summary
 */
export interface WeeklyScheduleSummary {
  restaurantId: string
  workDate: string
  weekNumber: number
  year: number
  totalEmployees: number
  totalShifts: number
  totalScheduledMinutes: number
  confirmedShifts: number
  completedShifts: number
  cancelledShifts: number
}
