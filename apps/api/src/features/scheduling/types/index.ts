/**
 * Employee Scheduling Types
 *
 * Re-exports DB-layer types as single source of truth,
 * plus feature-only types (relations, labor law, service interface).
 */

// ── Core types from database layer (single source of truth) ──
export type {
  ShiftTemplate,
  EmployeeSchedule,
  SchedulingConflict,
  ScheduleSwapRequest,
  ConflictCheckResult,
  ScheduleFilters,
  BulkScheduleData,
  ClockInData,
  ClockOutData,
} from "@makanmasak/database";

// ── Feature-only types (not in DB layer) ──

import type {
  ShiftTemplate,
  EmployeeSchedule,
  SchedulingConflict,
  ScheduleSwapRequest,
  ConflictCheckResult,
} from "@makanmasak/database";

/**
 * Scheduling Rule (排班規則)
 */
export interface SchedulingRule {
  id: number;
  restaurantId: string;
  name: string;
  description: string | null;
  ruleType:
    | "max_hours_per_day"
    | "max_hours_per_week"
    | "min_rest_period"
    | "max_consecutive_days"
    | "skill_requirement"
    | "custom";
  ruleConfig: string;
  appliesToRoles: string | null;
  appliesToEmployees: string | null;
  priority: number;
  severity: "error" | "warning" | "info";
  isSystemRule: boolean;
  isActive: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Employee Availability (員工可用時間)
 */
export interface EmployeeAvailability {
  id: number;
  restaurantId: string;
  employeeId: string;
  availabilityType: "recurring" | "specific_date";
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
  preferenceType: "preferred" | "available" | "unavailable";
  priority: number;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Extended types with relations ──

export interface EmployeeScheduleWithRelations extends EmployeeSchedule {
  employee: {
    id: number;
    fullName: string;
    role: number;
  };
  shiftTemplate: {
    id: number;
    name: string;
    startTime: string;
    endTime: string;
    colorCode: string;
  } | null;
}

export interface SchedulingConflictWithDetails extends SchedulingConflict {
  affectedSchedules: Array<{
    id: number;
    employeeId: string;
    employeeName: string;
    workDate: string;
    startTime: string;
    endTime: string;
  }>;
  rule: {
    id: number;
    name: string;
    ruleType: string;
  } | null;
}

export interface ScheduleSwapRequestWithRelations extends ScheduleSwapRequest {
  requesterEmployee: { id: string; fullName: string };
  requesterSchedule: {
    id: number;
    workDate: string;
    startTime: string;
    endTime: string;
  };
  targetEmployee: { id: string; fullName: string } | null;
  targetSchedule: {
    id: number;
    workDate: string;
    startTime: string;
    endTime: string;
  } | null;
}

// ── Create/Update types ──

export type CreateShiftTemplateData = Omit<
  ShiftTemplate,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

export type UpdateShiftTemplateData = Partial<
  Omit<ShiftTemplate, "id" | "restaurantId" | "createdAt" | "updatedAt">
>;

export type CreateEmployeeScheduleData = Omit<
  EmployeeSchedule,
  | "id"
  | "clockInTime"
  | "clockOutTime"
  | "actualHours"
  | "overtimeHours"
  | "status"
  | "confirmedBy"
  | "confirmedAt"
  | "createdAt"
  | "updatedAt"
>;

export type UpdateEmployeeScheduleData = Partial<
  Omit<EmployeeSchedule, "id" | "restaurantId" | "createdAt" | "updatedAt">
>;

export type CreateSchedulingRuleData = Omit<
  SchedulingRule,
  "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

export type UpdateSchedulingRuleData = Partial<
  Omit<SchedulingRule, "id" | "restaurantId" | "createdAt" | "updatedAt">
>;

export type CreateScheduleSwapRequestData = Omit<
  ScheduleSwapRequest,
  | "id"
  | "status"
  | "acceptedBy"
  | "acceptedAt"
  | "approvedBy"
  | "approvedAt"
  | "rejectedBy"
  | "rejectedAt"
  | "rejectionReason"
  | "createdAt"
  | "updatedAt"
>;

export type CreateEmployeeAvailabilityData = Omit<
  EmployeeAvailability,
  "id" | "createdAt" | "updatedAt"
>;

// ── Filter types ──

export interface ConflictFilters {
  restaurantId?: string;
  conflictType?: SchedulingConflict["conflictType"];
  severity?: SchedulingConflict["severity"];
  status?: SchedulingConflict["status"];
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface SwapRequestFilters {
  restaurantId?: string;
  requesterEmployeeId?: string;
  targetEmployeeId?: string;
  status?: ScheduleSwapRequest["status"];
  requestType?: ScheduleSwapRequest["requestType"];
  page?: number;
  limit?: number;
}

// ── Statistics ──

export interface ScheduleStats {
  restaurantId: string;
  date: string;
  totalSchedules: number;
  totalEmployees: number;
  totalHours: number;
  overtimeHours: number;
  conflicts: number;
  noShows: number;
}

export interface WeeklyScheduleSummary {
  restaurantId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalSchedules: number;
  uniqueEmployees: number;
  totalHours: number;
  averageHoursPerEmployee: number;
  conflicts: ConflictCheckResult;
}

export interface EmployeeScheduleSummary {
  employeeId: string;
  employeeName: string;
  weekStartDate: string;
  weekEndDate: string;
  scheduledShifts: number;
  completedShifts: number;
  totalHours: number;
  overtimeHours: number;
  conflicts: number;
}

// ── Taiwan Labor Law Compliance ──

export interface LaborLawCheckResult {
  isCompliant: boolean;
  violations: Array<{
    ruleType: string;
    severity: "error" | "warning";
    message: string;
    details: Record<string, unknown>;
  }>;
}

export interface DailyHoursCheck {
  employeeId: string;
  date: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  maxAllowedHours: number;
  isCompliant: boolean;
}

export interface WeeklyHoursCheck {
  employeeId: string;
  weekStartDate: string;
  weekEndDate: string;
  totalHours: number;
  maxAllowedHours: number;
  isCompliant: boolean;
}

export interface RestPeriodCheck {
  employeeId: string;
  schedule1: { id: number; workDate: string; endTime: string };
  schedule2: { id: number; workDate: string; startTime: string };
  restHours: number;
  minRequiredHours: number;
  isCompliant: boolean;
}

export interface ConsecutiveDaysCheck {
  employeeId: string;
  startDate: string;
  endDate: string;
  consecutiveDays: number;
  maxAllowedDays: number;
  isCompliant: boolean;
}

// ── Service Interface ──

export interface ISchedulingService {
  getShiftTemplates(restaurantId: string): Promise<ShiftTemplate[]>;
  getShiftTemplate(id: number): Promise<ShiftTemplate | null>;
  createShiftTemplate(data: CreateShiftTemplateData): Promise<ShiftTemplate>;
  updateShiftTemplate(
    id: number,
    data: UpdateShiftTemplateData,
  ): Promise<ShiftTemplate>;
  deleteShiftTemplate(id: number): Promise<boolean>;
  getSchedules(
    filters: import("@makanmasak/database").ScheduleFilters,
  ): Promise<{ items: EmployeeScheduleWithRelations[]; total: number }>;
  getSchedule(id: number): Promise<EmployeeScheduleWithRelations | null>;
  createSchedule(data: CreateEmployeeScheduleData): Promise<EmployeeSchedule>;
  updateSchedule(
    id: number,
    data: UpdateEmployeeScheduleData,
  ): Promise<EmployeeSchedule>;
  deleteSchedule(id: number): Promise<boolean>;
  bulkCreateSchedules(
    data: import("@makanmasak/database").BulkScheduleData,
  ): Promise<number>;
  clockIn(
    data: import("@makanmasak/database").ClockInData,
  ): Promise<EmployeeSchedule>;
  clockOut(
    data: import("@makanmasak/database").ClockOutData,
  ): Promise<EmployeeSchedule>;
  checkConflicts(
    schedules: CreateEmployeeScheduleData[],
  ): Promise<ConflictCheckResult>;
  getConflicts(
    filters: ConflictFilters,
  ): Promise<{ items: SchedulingConflictWithDetails[]; total: number }>;
  resolveConflict(
    conflictId: number,
    userId: string,
    notes: string,
  ): Promise<SchedulingConflict>;
  getSwapRequests(
    filters: SwapRequestFilters,
  ): Promise<{ items: ScheduleSwapRequestWithRelations[]; total: number }>;
  createSwapRequest(
    data: CreateScheduleSwapRequestData,
  ): Promise<ScheduleSwapRequest>;
  acceptSwapRequest(
    requestId: number,
    employeeId: string,
  ): Promise<ScheduleSwapRequest>;
  approveSwapRequest(
    requestId: number,
    managerId: string,
  ): Promise<ScheduleSwapRequest>;
  rejectSwapRequest(
    requestId: number,
    managerId: string,
    reason: string,
  ): Promise<ScheduleSwapRequest>;
  getEmployeeAvailability(employeeId: string): Promise<EmployeeAvailability[]>;
  setEmployeeAvailability(
    data: CreateEmployeeAvailabilityData,
  ): Promise<EmployeeAvailability>;
  getScheduleStats(restaurantId: string, date: string): Promise<ScheduleStats>;
  getWeeklySummary(
    restaurantId: string,
    weekStartDate: string,
  ): Promise<WeeklyScheduleSummary>;
  getEmployeeSummary(
    employeeId: string,
    weekStartDate: string,
  ): Promise<EmployeeScheduleSummary>;
}
