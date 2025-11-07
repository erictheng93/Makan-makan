/**
 * Leave Management Types
 * Shared type definitions for employee leave/time-off management
 */

// ========================================
// Enums & Constants
// ========================================

export const LEAVE_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'cancelled', 'withdrawn'] as const
export type LeaveStatus = typeof LEAVE_STATUSES[number]

export const LEAVE_ACCRUAL_TYPES = ['yearly', 'monthly', 'per_service_year', 'manual'] as const
export type LeaveAccrualType = typeof LEAVE_ACCRUAL_TYPES[number]

export const HALF_DAY_TYPES = ['morning', 'afternoon'] as const
export type HalfDayType = typeof HALF_DAY_TYPES[number]

// ========================================
// Core Entities
// ========================================

/**
 * Leave Type - 假期類型
 * Defines different types of leave available (annual, sick, personal, etc.)
 */
export interface LeaveType {
  id: number
  restaurantId?: number // NULL for system-wide types

  // Type Information
  code: string // "ANNUAL", "SICK", "PERSONAL", etc.
  name: string
  description?: string

  // Allocation Rules
  defaultDaysPerYear: number
  maxDaysPerYear?: number
  minServiceMonths: number // Minimum employment duration

  // Accrual Settings
  accrualType: LeaveAccrualType
  accrualRate?: number // For monthly accrual (e.g., 1.25 days/month)

  // Usage Rules
  minNoticeDays: number // Minimum advance notice required
  maxConsecutiveDays?: number // Maximum consecutive days allowed
  requiresDocumentation: boolean
  canBeNegative: boolean // Allow negative balance

  // Carry-over Rules
  allowCarryover: boolean
  maxCarryoverDays: number
  carryoverExpiresMonths?: number // Carryover days expire after N months

  // Approval Settings
  requiresApproval: boolean
  approvalLevels: number // Number of approval levels
  autoApproveThresholdDays?: number // Auto-approve if <= threshold

  // Payment
  isPaid: boolean
  paymentPercentage: number // Percentage of regular pay

  // Display & Status
  colorCode: string // Color for calendar display
  color?: string // Alias for colorCode (for backward compatibility)
  iconName?: string // Icon identifier
  displayOrder: number
  isActive: boolean
  isSystemDefined: boolean // Cannot be deleted
  allowHalfDay?: boolean // Allow half-day leave requests

  // Metadata
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Employee Leave Balance - 員工假期餘額
 * Tracks available leave days for each employee per year
 */
export interface LeaveBalance {
  id: number
  employeeId: number
  leaveTypeId: number
  year: number

  // Balance Tracking
  totalDays: number // Total allocated days
  usedDays: number // Used days (approved)
  pendingDays: number // Days in pending requests
  remainingDays: number // Calculated: totalDays - usedDays - pendingDays

  // Carryover from Previous Year
  carryoverDays: number
  carryoverExpiresAt?: Date | string // Timestamp when carryover expires

  // Accrual Tracking (for monthly accrual)
  accruedDays: number // Days accrued so far this year
  lastAccrualDate?: string // Last accrual calculation date (YYYY-MM-DD)

  // Manual Adjustments
  adjustmentDays: number // Manual additions/deductions
  adjustmentReason?: string
  adjustedBy?: number
  adjustedAt?: Date | string

  // Metadata
  createdAt: Date | string
  updatedAt: Date | string

  // Relations (optional, for populated data)
  leaveType?: LeaveType
}

/**
 * Leave Request - 請假申請
 * Individual employee leave request
 */
export interface LeaveRequest {
  id: number
  restaurantId: number
  employeeId: number
  leaveTypeId: number

  // Request Details
  startDate: string // YYYY-MM-DD format
  endDate: string // YYYY-MM-DD format
  daysCount: number // Total days (can be 0.5 for half-day)
  halfDayType?: HalfDayType

  // Reason & Documentation
  reason: string
  description?: string
  attachments?: Array<{
    name: string
    url: string
    type?: string
    size?: number
  }>

  // Status & Workflow
  status: LeaveStatus
  currentApprovalLevel: number
  requiredApprovalLevels: number

  // Approval History
  approvedBy?: number
  approvedAt?: Date | string
  rejectedBy?: number
  rejectedAt?: Date | string
  rejectionReason?: string
  cancelledBy?: number
  cancelledAt?: Date | string
  cancellationReason?: string

  // Conflict Detection
  hasScheduleConflict: boolean
  conflictDetails?: string | Record<string, any>

  // Delegation
  delegatedTo?: number // Employee who will cover duties
  delegationNotes?: string

  // Approval Chain
  approvalChain?: Array<{
    level: number
    approverId: number
    approverName: string
    status: 'pending' | 'approved' | 'rejected'
    decidedAt?: Date | string
  }>

  // Metadata
  submittedAt: Date | string
  createdAt: Date | string
  updatedAt: Date | string

  // Relations (optional, for populated data)
  employeeName?: string
  leaveType?: LeaveType
  approver?: {
    id: number
    fullName: string
  }
}

/**
 * Leave Approval Record - 假期審批記錄
 * Tracks approval workflow history
 */
export interface LeaveApprovalRecord {
  id: number
  leaveRequestId: number
  approvalLevel: number

  // Approver Information
  approverId: number
  approverName?: string
  approverRole: number

  // Decision
  action: 'approve' | 'reject'
  decision: 'approved' | 'rejected' | 'pending'
  comments?: string

  // Timestamps
  decidedAt?: Date | string
  createdAt: Date | string
}

// ========================================
// Request & Response Types
// ========================================

/**
 * Leave Type API Payloads
 */
export interface CreateLeaveTypeRequest {
  restaurantId?: number
  code: string
  name: string
  description?: string
  defaultDaysPerYear: number
  maxDaysPerYear?: number
  minServiceMonths?: number
  accrualType?: LeaveAccrualType
  accrualRate?: number
  minNoticeDays?: number
  maxConsecutiveDays?: number
  requiresDocumentation?: boolean
  canBeNegative?: boolean
  allowCarryover?: boolean
  maxCarryoverDays?: number
  carryoverExpiresMonths?: number
  requiresApproval?: boolean
  approvalLevels?: number
  autoApproveThresholdDays?: number
  isPaid?: boolean
  paymentPercentage?: number
  colorCode?: string
  iconName?: string
  displayOrder?: number
}

export interface UpdateLeaveTypeRequest extends Partial<CreateLeaveTypeRequest> {
  id: number
}

/**
 * Leave Request API Payloads
 */
export interface CreateLeaveRequestRequest {
  restaurantId: number
  employeeId: number
  leaveTypeId: number
  startDate: string
  endDate: string
  daysCount: number
  halfDayType?: HalfDayType
  reason: string
  description?: string
  attachments?: Array<{
    name: string
    url: string
    type?: string
    size?: number
  }>
  delegatedTo?: number
  delegationNotes?: string
}

export interface UpdateLeaveRequestRequest extends Partial<CreateLeaveRequestRequest> {
  id: number
}

export interface ApproveLeaveRequestRequest {
  requestId: number
  approverId: number
  comments?: string
}

export interface RejectLeaveRequestRequest {
  requestId: number
  rejectedBy: number
  reason: string
}

export interface CancelLeaveRequestRequest {
  requestId: number
  cancelledBy: number
  reason: string
}

/**
 * Leave Balance API Payloads
 */
export interface AdjustLeaveBalanceRequest {
  balanceId: number
  adjustmentDays: number
  reason: string
  adjustedBy: number
}

export interface InitializeLeaveBalancesRequest {
  employeeId: number
  year: number
  leaveTypeIds?: number[]
}

/**
 * Filter & Query Types
 */
export interface LeaveRequestFilters {
  restaurantId?: number
  employeeId?: number
  leaveTypeId?: number
  status?: LeaveStatus
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  year?: number
  page?: number
  limit?: number
}

export interface LeaveBalanceFilters {
  restaurantId?: number
  employeeId?: number
  leaveTypeId?: number
  year?: number
}

export interface LeaveTypeFilters {
  restaurantId?: number
  isActive?: boolean
  isSystemDefined?: boolean
}

/**
 * Conflict Check Result
 */
export interface LeaveConflictCheckResult {
  hasConflicts: boolean
  scheduleConflicts: Array<{
    scheduleId: number
    date: string
    shiftName: string
    message: string
  }>
  balanceIssues: Array<{
    leaveTypeId: number
    leaveTypeName: string
    availableDays: number
    requestedDays: number
    message: string
  }>
  policyViolations: Array<{
    rule: string
    message: string
  }>
}

// ========================================
// Statistics & Analytics
// ========================================

/**
 * Leave Statistics
 */
export interface LeaveStatistics {
  restaurantId: number
  period: {
    startDate: string
    endDate: string
  }
  totalRequests: number
  approvedRequests: number
  rejectedRequests: number
  pendingRequests: number
  totalDaysTaken: number
  statusBreakdown: {
    pending: number
    approved: number
    rejected: number
    cancelled: number
  }
  leaveTypeBreakdown: Record<string, {
    requests: number
    days: number
  }>
}

/**
 * Employee Leave Summary
 */
export interface EmployeeLeaveSummary {
  employeeId: number
  employeeName: string
  year: number
  balances: Array<{
    leaveType: string
    totalDays: number
    usedDays: number
    pendingDays: number
    remainingDays: number
  }>
  recentRequests: LeaveRequest[]
}

/**
 * Team Leave Calendar
 */
export interface TeamLeaveCalendar {
  restaurantId: number
  date: string
  onLeave: Array<{
    employeeId: number
    employeeName: string
    leaveType: string
    leaveTypeColor: string
  }>
  availableEmployees: number
  totalEmployees: number
}
