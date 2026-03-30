/**
 * Leaves API Response Contracts
 */

import { z } from "zod";
import {
  successEnvelope,
  successWithMessage,
  messageOnlyResponse,
  PaginationSchema,
  TimestampFields,
} from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const LeaveTypeSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    name: z.string(),
    maxDays: z.number().optional(),
    isPaid: z.union([z.boolean(), z.number()]).optional(),
    ...TimestampFields,
  })
  .passthrough();

export const LeaveBalanceSchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    userId: z.union([z.number(), z.string()]),
    leaveTypeId: z.union([z.number(), z.string()]),
    balance: z.number(),
    used: z.number().optional(),
    ...TimestampFields,
  })
  .passthrough();

export const LeaveRequestSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    userId: z.union([z.number(), z.string()]),
    leaveTypeId: z.union([z.number(), z.string()]),
    startDate: z.union([z.string(), z.number(), z.date()]),
    endDate: z.union([z.string(), z.number(), z.date()]),
    status: z.string(),
    reason: z.string().optional().nullable(),
    ...TimestampFields,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const ListLeaveTypesResponse = z.object({
  success: z.literal(true),
  data: z.array(LeaveTypeSchema),
});

export const GetLeaveTypeResponse = z.object({
  success: z.literal(true),
  data: LeaveTypeSchema,
});

export const CreateLeaveTypeResponse = successWithMessage(LeaveTypeSchema);
export const UpdateLeaveTypeResponse = successWithMessage(LeaveTypeSchema);
export const DeleteLeaveTypeResponse = messageOnlyResponse;

export const GetBalancesResponse = z.object({
  success: z.literal(true),
  data: z.array(LeaveBalanceSchema),
});

export const AdjustBalanceResponse = successWithMessage(LeaveBalanceSchema);

export const ListLeaveRequestsResponse = z.object({
  success: z.literal(true),
  data: z.array(LeaveRequestSchema),
  pagination: PaginationSchema.optional(),
});

export const GetLeaveRequestResponse = z.object({
  success: z.literal(true),
  data: LeaveRequestSchema,
});

export const CreateLeaveRequestResponse =
  successWithMessage(LeaveRequestSchema);
export const ApproveLeaveResponse = successWithMessage(LeaveRequestSchema);
export const RejectLeaveResponse = successWithMessage(LeaveRequestSchema);
export const CancelLeaveResponse = successWithMessage(LeaveRequestSchema);
