/**
 * Leave Management Types
 * Shared type definitions for employee leave/time-off management
 */

// ========================================
// Enums & Constants
// ========================================

// Mirrors the leave_requests.status enum. "draft" was listed here and no
// column has ever accepted it (#330).
export const LEAVE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "withdrawn",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

// Mirrors the leave_types.accrual_type enum. "per_service_year" and "manual"
// were listed here for a long time and no column has ever accepted them (#330).
export const LEAVE_ACCRUAL_TYPES = ["yearly", "monthly", "none"] as const;
export type LeaveAccrualType = (typeof LEAVE_ACCRUAL_TYPES)[number];

export const LEAVE_GENDERS = ["any", "male", "female"] as const;
export type LeaveGender = (typeof LEAVE_GENDERS)[number];

// Mirrors leave_requests.start_period / end_period. A half day is a period on
// the first or last day of the range; there is no separate half-day field, and
// the HALF_DAY_TYPES enum that used to sit here matched no column (#330).
export const LEAVE_PERIODS = ["full", "am", "pm"] as const;
export type LeavePeriod = (typeof LEAVE_PERIODS)[number];

// ========================================
// Core Entities
// ========================================

/**
 * Leave Type - 假期類型
 *
 * The wire shape of a `leave_types` row. `GET /leaves/:restaurantId/types`
 * runs an unprojected `.select()`, so the JSON is the row itself with its
 * Date columns serialised to ISO strings and nothing else changed.
 *
 * Keep this a field-for-field mirror of the Drizzle table. It is pinned by a
 * compile-time assertion in `packages/database/src/services/LeaveService.ts`;
 * renaming a column there breaks the build instead of silently handing every
 * reader `undefined` (#330).
 */
export interface LeaveType {
  id: number;
  restaurantId: string | null; // null for system-wide types

  // Type Information
  code: string; // "ANNUAL", "SICK", "PERSONAL", etc.
  name: string;
  description: string | null;

  // Accrual Rules
  accrualType: LeaveAccrualType;
  accrualAmount: number; // Days granted per accrualType period
  accrualBasedOnSeniority: boolean;

  // Usage Rules
  requiresApproval: boolean;
  requiredApprovalLevels: number;
  minNoticeDays: number;
  maxConsecutiveDays: number | null;
  canCarryover: boolean;
  carryoverMaxDays: number | null;
  carryoverExpiryMonths: number | null;

  // Documentation & Payment
  requiresDocumentation: boolean;
  documentationRequiredAfterDays: number | null;
  isPaid: boolean;
  paymentRate: number; // 0.0-1.0 -- a rate, not a percentage

  // Restrictions
  allowHalfDay: boolean;
  gender: LeaveGender | null;
  applicableToRoles: string | null; // JSON array of role ids
  maxUsagePerYear: number | null;

  // Display & Status
  isSystemDefined: boolean; // Cannot be deleted
  isActive: boolean;
  sortOrder: number;
  color: string | null;
  icon: string | null;

  // Metadata
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * The columns the leave-request join projects out of leave_types. Endpoints
 * that embed a leave type in another row never return the whole row, so a
 * relation typed as `LeaveType` would over-promise on every field but these.
 * Pinned against the query in LeaveService.ts, same as LeaveType.
 */
export interface LeaveTypeSummary {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
  color: string | null;
}

/** The balance join projects two more columns than the request join does. */
export interface LeaveTypeBalanceSummary extends LeaveTypeSummary {
  accrualType: LeaveAccrualType;
  icon: string | null;
}

/**
 * Employee Leave Balance - 員工假期餘額
 *
 * The wire shape of an `employee_leave_balances` row plus the two things the
 * service adds on top: `remainingDays`, which is computed rather than stored,
 * and the joined `leaveType` projection. Pinned against the schema by
 * `LeavesWireConformance` in packages/database/src/services/LeaveService.ts.
 */
export interface LeaveBalance {
  id: number;
  employeeId: string; // users.id is TEXT
  leaveTypeId: number;
  restaurantId: string;
  year: number;

  // Balance Tracking
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  /** Computed by the service as totalDays - usedDays - pendingDays. */
  remainingDays: number;

  // Carryover from Previous Year
  carryoverFromPrevious: number | null;
  carryoverToNext: number | null;
  carryoverExpiresAt: string | null; // ISO 8601

  // Manual Adjustments
  manualAdjustment: number | null;
  adjustmentReason: string | null;
  adjustedBy: string | null;
  adjustedAt: string | null; // ISO 8601

  // Metadata
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  lastUpdatedBy: string | null;

  // Relations, present on the endpoints that join leave_types
  leaveType?: LeaveTypeBalanceSummary;
}

/**
 * One entry of `leave_requests.approval_chain`, which the service stores as
 * JSON text. `buildApprovalChain` writes exactly these three fields. The
 * approverId/approverName/status shape declared here before matched nothing,
 * so every consumer that validated against it silently dropped every step.
 */
export interface LeaveApprovalStep {
  level: number;
  approverRole: number;
  required: boolean;
}

/** The `users` columns the leave-request join projects. */
export interface LeaveRequestEmployee {
  id: string;
  fullName: string;
  email: string | null;
  role: number;
}

/**
 * Leave Request - 請假申請
 *
 * The wire shape of a `leave_requests` row plus the two relations the list
 * and detail endpoints join in. Pinned against the schema by
 * `LeavesWireConformance` in packages/database/src/services/LeaveService.ts.
 */
export interface LeaveRequest {
  id: number;
  restaurantId: string;
  employeeId: string; // users.id is TEXT
  leaveTypeId: number;

  // Date & Duration
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startPeriod: LeavePeriod;
  endPeriod: LeavePeriod;
  totalDays: number; // 0.5 steps for half days

  // Request Details
  reason: string;
  attachmentUrl: string | null; // one URL, not a list
  emergencyContact: string | null;

  // Approval Workflow
  status: LeaveStatus;
  /** JSON array of {@link LeaveApprovalStep}. Parse before reading. */
  approvalChain: string;
  currentApprovalLevel: number;
  finalApproverId: string | null;
  finalApprovedAt: string | null; // ISO 8601
  rejectedBy: string | null;
  rejectedAt: string | null; // ISO 8601
  rejectionReason: string | null;

  // Cancellation
  cancelledBy: string | null;
  cancelledAt: string | null; // ISO 8601
  cancellationReason: string | null;

  // Schedule Integration
  affectedScheduleIds: string | null; // JSON array of schedule ids
  replacementNotified: boolean;

  // Metadata
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  submittedAt: string | null; // ISO 8601
  deletedAt: string | null; // ISO 8601

  // Relations, present on the list and detail endpoints
  employee?: LeaveRequestEmployee;
  leaveType?: LeaveTypeSummary;
}

// ========================================
// Request & Response Types
// ========================================

/**
 * Leave Type API Payloads
 */
export interface CreateLeaveTypeRequest {
  restaurantId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  accrualType: LeaveAccrualType;
  accrualAmount: number;
  accrualBasedOnSeniority?: boolean;
  requiresApproval?: boolean;
  requiredApprovalLevels?: number;
  minNoticeDays?: number;
  maxConsecutiveDays?: number | null;
  canCarryover?: boolean;
  carryoverMaxDays?: number | null;
  carryoverExpiryMonths?: number | null;
  requiresDocumentation?: boolean;
  documentationRequiredAfterDays?: number | null;
  isPaid?: boolean;
  paymentRate?: number; // 0.0-1.0
  allowHalfDay?: boolean;
  gender?: LeaveGender | null;
  applicableToRoles?: string | null;
  maxUsagePerYear?: number | null;
  isActive?: boolean;
  sortOrder?: number;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateLeaveTypeRequest extends Partial<CreateLeaveTypeRequest> {
  id: number;
}

/**
 * Leave Request API Payloads
 */
export interface CreateLeaveRequestRequest {
  restaurantId?: string; // taken from the URL by the route handler
  employeeId?: string; // taken from the auth context for self-service
  leaveTypeId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startPeriod?: LeavePeriod;
  endPeriod?: LeavePeriod;
  reason: string;
  attachmentUrl?: string | null;
  emergencyContact?: string | null;
}

// The acting user is always the authenticated session, never client input, so
// approverId / rejectedBy / cancelledBy are absent from these bodies. The
// request id travels in the path.
export interface ApproveLeaveRequestRequest {
  comments?: string;
}

export interface RejectLeaveRequestRequest {
  reason: string;
}

export interface CancelLeaveRequestRequest {
  reason: string;
}

/**
 * Leave Balance API Payloads
 */
export interface AdjustLeaveBalanceRequest {
  employeeId: string;
  leaveTypeId: number;
  year: number;
  adjustment: number; // signed, -365..365
  reason: string;
}

/** POST /:restaurantId/balances/accrue takes restaurantId from the path. */
export interface AccrueLeaveBalancesRequest {
  year: number;
}

/**
 * Filter & Query Types
 */
export interface LeaveRequestFilters {
  restaurantId?: string;
  employeeId?: string;
  leaveTypeId?: number;
  status?: LeaveStatus;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  year?: number;
  page?: number;
  limit?: number;
}

export interface LeaveBalanceFilters {
  restaurantId?: string;
  employeeId?: string;
  leaveTypeId?: number;
  year?: number;
}

export interface LeaveTypeFilters {
  restaurantId?: string;
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

// ========================================
// Statistics & Analytics
// ========================================

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
  rejectedRequests: number;
  pendingRequests: number;
  totalDaysTaken: number;
  statusBreakdown: {
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
  leaveTypeBreakdown: Record<
    string,
    {
      requests: number;
      days: number;
    }
  >;
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
  restaurantId: string;
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
