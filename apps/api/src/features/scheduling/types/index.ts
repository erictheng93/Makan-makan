/**
 * Employee Scheduling Types
 * Type definitions for employee work scheduling management
 */

/**
 * Shift Template (班別模板)
 * Reusable shift definitions for scheduling
 */
export interface ShiftTemplate {
  id: number
  restaurantId: number
  name: string
  description: string | null
  shiftType: 'regular' | 'split' | 'overnight'
  startTime: string
  endTime: string
  durationMinutes: number
  isSplitShift: boolean
  breakStartTime: string | null
  breakEndTime: string | null
  breakDurationMinutes: number
  applicableDays: string // JSON array
  minEmployees: number
  maxEmployees: number
  hourlyRate: number | null
  overtimeMultiplier: number
  colorCode: string
  icon: string | null
  sortOrder: number
  isActive: boolean
  createdBy: number | null
  updatedBy: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Employee Schedule (員工排班)
 * Individual employee work schedule assignment
 */
export interface EmployeeSchedule {
  id: number
  restaurantId: number
  employeeId: number
  shiftTemplateId: number | null
  workDate: string // YYYY-MM-DD
  startTime: string
  endTime: string
  breakDurationMinutes: number
  clockInTime: number | null
  clockOutTime: number | null
  scheduledHours: number
  actualHours: number
  overtimeHours: number
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  managerNotes: string | null
  confirmedBy: number | null
  confirmedAt: number | null
  createdBy: number
  updatedBy: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Scheduling Rule (排班規則)
 */
export interface SchedulingRule {
  id: number
  restaurantId: number
  name: string
  description: string | null
  ruleType: 'max_hours_per_day' | 'max_hours_per_week' | 'min_rest_period' | 'max_consecutive_days' | 'skill_requirement' | 'custom'
  ruleConfig: string // JSON object
  appliesToRoles: string | null // JSON array
  appliesToEmployees: string | null // JSON array
  priority: number
  severity: 'error' | 'warning' | 'info'
  isSystemRule: boolean
  isActive: boolean
  createdBy: number
  updatedBy: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Scheduling Conflict (排班衝突)
 */
export interface SchedulingConflict {
  id: number
  restaurantId: number
  conflictType: 'overlapping_shifts' | 'insufficient_rest' | 'max_hours_exceeded' | 'consecutive_days_exceeded' | 'skill_mismatch' | 'leave_conflict' | 'availability_conflict'
  severity: 'error' | 'warning' | 'info'
  scheduleIds: string // JSON array
  employeeIds: string // JSON array
  ruleId: number | null
  message: string
  details: string | null // JSON object
  status: 'unresolved' | 'acknowledged' | 'resolved' | 'ignored'
  resolvedBy: number | null
  resolvedAt: number | null
  resolutionNotes: string | null
  detectedAt: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * Schedule Swap Request (換班請求)
 */
export interface ScheduleSwapRequest {
  id: number
  restaurantId: number
  requesterEmployeeId: number
  requesterScheduleId: number
  targetEmployeeId: number | null
  targetScheduleId: number | null
  requestType: 'swap' | 'cover' | 'drop'
  reason: string
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  isOpenRequest: boolean
  status: 'pending' | 'accepted' | 'approved' | 'rejected' | 'cancelled' | 'expired'
  acceptedBy: number | null
  acceptedAt: number | null
  approvedBy: number | null
  approvedAt: number | null
  rejectedBy: number | null
  rejectedAt: number | null
  rejectionReason: string | null
  expiresAt: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Employee Availability (員工可用時間)
 */
export interface EmployeeAvailability {
  id: number
  restaurantId: number
  employeeId: number
  availabilityType: 'recurring' | 'specific_date'
  dayOfWeek: number | null // 0-6
  startTime: string | null
  endTime: string | null
  startDate: string | null // YYYY-MM-DD
  endDate: string | null
  preferenceType: 'preferred' | 'available' | 'unavailable'
  priority: number
  notes: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Extended types with relations
 */

export interface EmployeeScheduleWithRelations extends EmployeeSchedule {
  employee: {
    id: number
    fullName: string
    role: number
  }
  shiftTemplate: {
    id: number
    name: string
    startTime: string
    endTime: string
    colorCode: string
  } | null
}

export interface SchedulingConflictWithDetails extends SchedulingConflict {
  affectedSchedules: Array<{
    id: number
    employeeId: number
    employeeName: string
    workDate: string
    startTime: string
    endTime: string
  }>
  rule: {
    id: number
    name: string
    ruleType: string
  } | null
}

export interface ScheduleSwapRequestWithRelations extends ScheduleSwapRequest {
  requesterEmployee: {
    id: number
    fullName: string
  }
  requesterSchedule: {
    id: number
    workDate: string
    startTime: string
    endTime: string
  }
  targetEmployee: {
    id: number
    fullName: string
  } | null
  targetSchedule: {
    id: number
    workDate: string
    startTime: string
    endTime: string
  } | null
}

/**
 * Create/Update types
 */

export type CreateShiftTemplateData = Omit<ShiftTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

export type UpdateShiftTemplateData = Partial<Omit<ShiftTemplate, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>>

export type CreateEmployeeScheduleData = Omit<
  EmployeeSchedule,
  'id' | 'clockInTime' | 'clockOutTime' | 'actualHours' | 'overtimeHours' | 'status' | 'confirmedBy' | 'confirmedAt' | 'createdAt' | 'updatedAt'
>

export type UpdateEmployeeScheduleData = Partial<Omit<EmployeeSchedule, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>>

export type CreateSchedulingRuleData = Omit<SchedulingRule, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

export type UpdateSchedulingRuleData = Partial<Omit<SchedulingRule, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>>

export type CreateScheduleSwapRequestData = Omit<
  ScheduleSwapRequest,
  'id' | 'status' | 'acceptedBy' | 'acceptedAt' | 'approvedBy' | 'approvedAt' | 'rejectedBy' | 'rejectedAt' | 'rejectionReason' | 'createdAt' | 'updatedAt'
>

export type CreateEmployeeAvailabilityData = Omit<EmployeeAvailability, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Filter and Query types
 */

export interface ScheduleFilters {
  restaurantId?: number
  employeeId?: number
  shiftTemplateId?: number
  startDate?: string
  endDate?: string
  status?: EmployeeSchedule['status']
  page?: number
  limit?: number
}

export interface ConflictFilters {
  restaurantId?: number
  conflictType?: SchedulingConflict['conflictType']
  severity?: SchedulingConflict['severity']
  status?: SchedulingConflict['status']
  employeeId?: number
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface SwapRequestFilters {
  restaurantId?: number
  requesterEmployeeId?: number
  targetEmployeeId?: number
  status?: ScheduleSwapRequest['status']
  requestType?: ScheduleSwapRequest['requestType']
  page?: number
  limit?: number
}

/**
 * Business logic types
 */

export interface ConflictCheckResult {
  hasConflicts: boolean
  conflicts: SchedulingConflict[]
  warnings: SchedulingConflict[]
  info: SchedulingConflict[]
}

export interface ScheduleStats {
  restaurantId: number
  date: string
  totalSchedules: number
  totalEmployees: number
  totalHours: number
  overtimeHours: number
  conflicts: number
  noShows: number
}

export interface WeeklyScheduleSummary {
  restaurantId: number
  weekStartDate: string
  weekEndDate: string
  totalSchedules: number
  uniqueEmployees: number
  totalHours: number
  averageHoursPerEmployee: number
  conflicts: ConflictCheckResult
}

export interface EmployeeScheduleSummary {
  employeeId: number
  employeeName: string
  weekStartDate: string
  weekEndDate: string
  scheduledShifts: number
  completedShifts: number
  totalHours: number
  overtimeHours: number
  conflicts: number
}

export interface BulkScheduleData {
  restaurantId: number
  shiftTemplateId: number
  employeeIds: number[]
  dateRange: {
    startDate: string
    endDate: string
  }
  daysOfWeek: number[] // 0-6
  createdBy: number
}

export interface ClockInData {
  scheduleId: number
  employeeId: number
  clockInTime: Date
  notes?: string
}

export interface ClockOutData {
  scheduleId: number
  employeeId: number
  clockOutTime: Date
  notes?: string
}

/**
 * Taiwan Labor Law Compliance Types
 */

export interface LaborLawCheckResult {
  isCompliant: boolean
  violations: Array<{
    ruleType: string
    severity: 'error' | 'warning'
    message: string
    details: any
  }>
}

export interface DailyHoursCheck {
  employeeId: number
  date: string
  totalHours: number
  normalHours: number
  overtimeHours: number
  maxAllowedHours: number
  isCompliant: boolean
}

export interface WeeklyHoursCheck {
  employeeId: number
  weekStartDate: string
  weekEndDate: string
  totalHours: number
  maxAllowedHours: number
  isCompliant: boolean
}

export interface RestPeriodCheck {
  employeeId: number
  schedule1: {
    id: number
    workDate: string
    endTime: string
  }
  schedule2: {
    id: number
    workDate: string
    startTime: string
  }
  restHours: number
  minRequiredHours: number
  isCompliant: boolean
}

export interface ConsecutiveDaysCheck {
  employeeId: number
  startDate: string
  endDate: string
  consecutiveDays: number
  maxAllowedDays: number
  isCompliant: boolean
}

/**
 * Service Interface
 */

export interface ISchedulingService {
  // Shift Templates
  getShiftTemplates(restaurantId: number): Promise<ShiftTemplate[]>
  getShiftTemplate(id: number): Promise<ShiftTemplate | null>
  createShiftTemplate(data: CreateShiftTemplateData): Promise<ShiftTemplate>
  updateShiftTemplate(id: number, data: UpdateShiftTemplateData): Promise<ShiftTemplate>
  deleteShiftTemplate(id: number): Promise<boolean>

  // Employee Schedules
  getSchedules(filters: ScheduleFilters): Promise<{ items: EmployeeScheduleWithRelations[]; total: number }>
  getSchedule(id: number): Promise<EmployeeScheduleWithRelations | null>
  createSchedule(data: CreateEmployeeScheduleData): Promise<EmployeeSchedule>
  updateSchedule(id: number, data: UpdateEmployeeScheduleData): Promise<EmployeeSchedule>
  deleteSchedule(id: number): Promise<boolean>
  bulkCreateSchedules(data: BulkScheduleData): Promise<number>

  // Clock In/Out
  clockIn(data: ClockInData): Promise<EmployeeSchedule>
  clockOut(data: ClockOutData): Promise<EmployeeSchedule>

  // Conflict Detection
  checkConflicts(schedules: CreateEmployeeScheduleData[]): Promise<ConflictCheckResult>
  getConflicts(filters: ConflictFilters): Promise<{ items: SchedulingConflictWithDetails[]; total: number }>
  resolveConflict(conflictId: number, userId: number, notes: string): Promise<SchedulingConflict>

  // Swap Requests
  getSwapRequests(filters: SwapRequestFilters): Promise<{ items: ScheduleSwapRequestWithRelations[]; total: number }>
  createSwapRequest(data: CreateScheduleSwapRequestData): Promise<ScheduleSwapRequest>
  acceptSwapRequest(requestId: number, employeeId: number): Promise<ScheduleSwapRequest>
  approveSwapRequest(requestId: number, managerId: number): Promise<ScheduleSwapRequest>
  rejectSwapRequest(requestId: number, managerId: number, reason: string): Promise<ScheduleSwapRequest>

  // Availability
  getEmployeeAvailability(employeeId: number): Promise<EmployeeAvailability[]>
  setEmployeeAvailability(data: CreateEmployeeAvailabilityData): Promise<EmployeeAvailability>

  // Statistics
  getScheduleStats(restaurantId: number, date: string): Promise<ScheduleStats>
  getWeeklySummary(restaurantId: number, weekStartDate: string): Promise<WeeklyScheduleSummary>
  getEmployeeSummary(employeeId: number, weekStartDate: string): Promise<EmployeeScheduleSummary>
}
