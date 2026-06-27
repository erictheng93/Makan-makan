/**
 * Leave Management Validation Schemas
 * Zod schemas for validating leave-related requests
 */

import { z } from "zod";

// Base validation schemas
const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().min(0);
const nonNegativeNumber = z.number().min(0);
const nonEmptyString = z.string().min(1).trim();
const idString = z.preprocess((value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return value;
}, nonEmptyString);
const optionalUrl = z.string().url().optional();
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");
const yearInteger = z.number().int().min(2020).max(2100);
// Restaurant ID: UUID v7 format
const restaurantIdString = z
  .string()
  .uuid("Restaurant ID must be a valid UUID");

// Leave Type Schemas
export const createLeaveTypeSchema = z.object({
  restaurantId: restaurantIdString.optional().nullable(),
  code: nonEmptyString
    .max(20)
    .regex(/^[A-Z_]+$/, "Code must be uppercase letters and underscores"),
  name: nonEmptyString.max(50),
  description: z.string().max(500).optional().nullable(),

  // Accrual Rules
  accrualType: z.enum(["yearly", "monthly", "none"]),
  accrualAmount: nonNegativeNumber,
  accrualBasedOnSeniority: z.boolean().default(false),

  // Usage Rules
  requiresApproval: z.boolean().default(true),
  requiredApprovalLevels: positiveInteger.max(5).default(1),
  minNoticeDays: nonNegativeInteger.default(0),
  maxConsecutiveDays: positiveInteger.optional().nullable(),
  canCarryover: z.boolean().default(false),
  carryoverMaxDays: nonNegativeNumber.optional().nullable(),
  carryoverExpiryMonths: positiveInteger.optional().nullable(),

  // Documentation & Payment
  requiresDocumentation: z.boolean().default(false),
  documentationRequiredAfterDays: positiveInteger.optional().nullable(),
  isPaid: z.boolean().default(true),
  paymentRate: z.number().min(0).max(1).default(1), // 0.0 to 1.0

  // Restrictions
  allowHalfDay: z.boolean().default(true),
  gender: z.enum(["any", "male", "female"]).optional().nullable(),
  applicableToRoles: z.string().optional().nullable(), // JSON array string
  maxUsagePerYear: nonNegativeNumber.optional().nullable(),

  // System Fields
  isActive: z.boolean().default(true),
  sortOrder: nonNegativeInteger.default(0),
  color: z
    .string()
    .max(7)
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  icon: z.string().max(50).optional().nullable(),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

// Leave Request Schemas
export const createLeaveRequestSchema = z
  .object({
    restaurantId: restaurantIdString.optional(), // Injected by route handler from URL param
    employeeId: idString.optional(), // Staff UUID from auth context
    leaveTypeId: positiveInteger,

    // Date & Duration
    startDate: dateString,
    endDate: dateString,
    startPeriod: z.enum(["full", "am", "pm"]).default("full"),
    endPeriod: z.enum(["full", "am", "pm"]).default("full"),

    // Request Details
    reason: nonEmptyString.max(500),
    attachmentUrl: optionalUrl.nullable(),
    emergencyContact: z.string().max(100).optional().nullable(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end >= start;
    },
    { message: "End date must be equal to or after start date" },
  );

export const approveLeaveRequestSchema = z.object({
  approverId: idString,
  comments: z.string().max(500).optional(),
});

export const rejectLeaveRequestSchema = z.object({
  approverId: idString,
  reason: nonEmptyString.max(500),
});

export const cancelLeaveRequestSchema = z.object({
  userId: idString,
  reason: nonEmptyString.max(500),
});

// Leave Balance Schemas
export const adjustLeaveBalanceSchema = z.object({
  employeeId: idString,
  leaveTypeId: positiveInteger,
  year: yearInteger,
  adjustment: z.number().min(-365).max(365), // Allow both positive and negative adjustments
  reason: nonEmptyString.max(500),
  adjustedBy: idString,
});

export const accrueLeaveBalancesSchema = z.object({
  restaurantId: restaurantIdString,
  year: yearInteger,
});

// Leave Approval Rule Schemas
const baseLeaveApprovalRuleSchema = z.object({
  restaurantId: restaurantIdString,
  leaveTypeId: positiveInteger.optional().nullable(),
  name: nonEmptyString.max(100),
  description: z.string().max(500).optional().nullable(),
  approvalLevel: positiveInteger.max(5),

  // Approvers
  approverType: z.enum(["role", "specific_user"]),
  approverRoleIds: z.string().optional().nullable(), // JSON array string
  approverUserIds: z.string().optional().nullable(), // JSON array string

  // Auto-approval
  enableAutoApproval: z.boolean().default(false),
  autoApprovalConditions: z.string().optional().nullable(), // JSON object string

  // Escalation
  enableAutoEscalation: z.boolean().default(false),
  escalationTimeoutHours: positiveInteger.optional().nullable(),
  escalationToUserId: idString.optional().nullable(),

  // Priority
  priority: nonNegativeInteger.default(0),
  isActive: z.boolean().default(true),
});

export const createLeaveApprovalRuleSchema = baseLeaveApprovalRuleSchema
  .refine(
    (data) => {
      if (data.approverType === "role" && !data.approverRoleIds) {
        return false;
      }
      if (data.approverType === "specific_user" && !data.approverUserIds) {
        return false;
      }
      return true;
    },
    { message: "Approver IDs must be provided based on approver type" },
  )
  .refine(
    (data) => {
      if (
        data.enableAutoEscalation &&
        (!data.escalationTimeoutHours || !data.escalationToUserId)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Escalation timeout and user must be provided when auto-escalation is enabled",
    },
  );

export const updateLeaveApprovalRuleSchema =
  baseLeaveApprovalRuleSchema.partial();

// Leave Calendar Event Schemas
export const createLeaveCalendarEventSchema = z.object({
  restaurantId: restaurantIdString.optional().nullable(),
  name: nonEmptyString.max(100),
  description: z.string().max(500).optional().nullable(),
  eventType: z.enum(["public_holiday", "company_holiday", "special_event"]),
  eventDate: dateString,

  // Recurrence
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.string().optional().nullable(), // JSON object string

  // Work Day Settings
  isWorkingDay: z.boolean().default(false),
  compensatoryFor: dateString.optional().nullable(),

  // Metadata
  color: z
    .string()
    .max(7)
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
  icon: z.string().max(50).optional().nullable(),
});

export const updateLeaveCalendarEventSchema =
  createLeaveCalendarEventSchema.partial();

// Query Parameter Schemas
export const leaveRequestFiltersSchema = z.object({
  employeeId: idString.optional(),
  leaveTypeId: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: z
    .enum(["pending", "approved", "rejected", "cancelled", "withdrawn"])
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
});

export const leaveBalanceQuerySchema = z.object({
  employeeId: idString,
  year: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const holidaysQuerySchema = z.object({
  restaurantId: restaurantIdString.optional(),
  year: z.string().regex(/^\d+$/).transform(Number),
});

export const statisticsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const upcomingLeavesQuerySchema = z.object({
  days: z.string().regex(/^\d+$/).transform(Number).default("30"),
});

export const expiringBalancesQuerySchema = z.object({
  months: z.string().regex(/^\d+$/).transform(Number).default("3"),
});

// Parameter Schemas
export const restaurantIdParamSchema = z.object({
  restaurantId: restaurantIdString,
});

export const leaveTypeIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const leaveRequestIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const leaveApprovalRuleIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const leaveCalendarEventIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const workingDayParamSchema = z.object({
  restaurantId: restaurantIdString,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Complex validation functions
const validateLeaveRequestDates = (
  startDate: string,
  endDate: string,
  minNoticeDays: number = 0,
) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check end date is after start date
  if (end < start) {
    throw new Error("End date must be equal to or after start date");
  }

  // Check minimum notice period
  const daysDifference = Math.floor(
    (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysDifference < minNoticeDays) {
    throw new Error(
      `Leave must be requested at least ${minNoticeDays} days in advance`,
    );
  }

  return true;
};

const validateLeaveBalance = (
  requestedDays: number,
  availableBalance: number,
) => {
  if (requestedDays > availableBalance) {
    throw new Error(
      `Insufficient leave balance. Requested: ${requestedDays} days, Available: ${availableBalance} days`,
    );
  }
  return true;
};

const calculateLeaveDays = (
  startDate: string,
  endDate: string,
  startPeriod: "full" | "am" | "pm",
  endPeriod: "full" | "am" | "pm",
): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate full days between dates
  const daysDifference =
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Adjust for half-day periods
  let adjustedDays = daysDifference;

  // If start is PM only, subtract 0.5 day
  if (startPeriod === "pm") {
    adjustedDays -= 0.5;
  }

  // If end is AM only, subtract 0.5 day
  if (endPeriod === "am") {
    adjustedDays -= 0.5;
  }

  return adjustedDays;
};

const validateConsecutiveDays = (
  requestedDays: number,
  maxConsecutiveDays: number | null,
) => {
  if (maxConsecutiveDays && requestedDays > maxConsecutiveDays) {
    throw new Error(
      `Cannot request more than ${maxConsecutiveDays} consecutive days`,
    );
  }
  return true;
};

// Comprehensive leave request validation
export const validateCompleteLeaveRequest = createLeaveRequestSchema.refine(
  (data) => {
    try {
      const days = calculateLeaveDays(
        data.startDate,
        data.endDate,
        data.startPeriod,
        data.endPeriod,
      );
      return days > 0;
    } catch {
      return false;
    }
  },
  { message: "Invalid date range or period configuration" },
);

// Export all schemas as a single object for easy import
export const leaveSchemas = {
  // Leave Type schemas
  createLeaveType: createLeaveTypeSchema,
  updateLeaveType: updateLeaveTypeSchema,

  // Leave Request schemas
  createLeaveRequest: createLeaveRequestSchema,
  approveLeaveRequest: approveLeaveRequestSchema,
  rejectLeaveRequest: rejectLeaveRequestSchema,
  cancelLeaveRequest: cancelLeaveRequestSchema,

  // Leave Balance schemas
  adjustLeaveBalance: adjustLeaveBalanceSchema,
  accrueLeaveBalances: accrueLeaveBalancesSchema,

  // Leave Approval Rule schemas
  createLeaveApprovalRule: createLeaveApprovalRuleSchema,
  updateLeaveApprovalRule: updateLeaveApprovalRuleSchema,

  // Leave Calendar Event schemas
  createLeaveCalendarEvent: createLeaveCalendarEventSchema,
  updateLeaveCalendarEvent: updateLeaveCalendarEventSchema,

  // Query schemas
  leaveRequestFilters: leaveRequestFiltersSchema,
  leaveBalanceQuery: leaveBalanceQuerySchema,
  holidaysQuery: holidaysQuerySchema,
  statisticsQuery: statisticsQuerySchema,
  upcomingLeavesQuery: upcomingLeavesQuerySchema,
  expiringBalancesQuery: expiringBalancesQuerySchema,

  // Parameter schemas
  restaurantIdParam: restaurantIdParamSchema,
  leaveTypeIdParam: leaveTypeIdParamSchema,
  leaveRequestIdParam: leaveRequestIdParamSchema,
  leaveApprovalRuleIdParam: leaveApprovalRuleIdParamSchema,
  leaveCalendarEventIdParam: leaveCalendarEventIdParamSchema,
  workingDayParam: workingDayParamSchema,

  // Complete validation
  validateCompleteLeaveRequest,
};

// Export validation helper functions
export {
  validateLeaveRequestDates,
  validateLeaveBalance,
  calculateLeaveDays,
  validateConsecutiveDays,
};
