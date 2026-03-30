/**
 * Scheduling API Response Contracts
 */

import { z } from "zod";
import {
  successWithMessage,
  messageOnlyResponse,
  PaginationSchema,
  TimestampFields,
} from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const ShiftTemplateSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    name: z.string(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    ...TimestampFields,
  })
  .passthrough();

export const ScheduleSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    userId: z.union([z.number(), z.string()]),
    shiftTemplateId: z.union([z.number(), z.string()]).optional(),
    date: z.union([z.string(), z.number(), z.date()]),
    status: z.string().optional(),
    clockInAt: z
      .union([z.string(), z.number(), z.date()])
      .optional()
      .nullable(),
    clockOutAt: z
      .union([z.string(), z.number(), z.date()])
      .optional()
      .nullable(),
    ...TimestampFields,
  })
  .passthrough();

export const SwapRequestSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    requesterId: z.union([z.number(), z.string()]),
    targetId: z.union([z.number(), z.string()]).optional(),
    status: z.string(),
    ...TimestampFields,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const ListTemplatesResponse = z.object({
  success: z.literal(true),
  data: z.array(ShiftTemplateSchema),
});

export const GetTemplateResponse = z.object({
  success: z.literal(true),
  data: ShiftTemplateSchema,
});

export const CreateTemplateResponse = successWithMessage(ShiftTemplateSchema);
export const UpdateTemplateResponse = successWithMessage(ShiftTemplateSchema);
export const DeleteTemplateResponse = messageOnlyResponse;

export const ListSchedulesResponse = z.object({
  success: z.literal(true),
  data: z.array(ScheduleSchema),
  pagination: PaginationSchema.optional(),
});

export const GetScheduleResponse = z.object({
  success: z.literal(true),
  data: ScheduleSchema,
});

export const CreateScheduleResponse = successWithMessage(ScheduleSchema);
export const ClockInResponse = successWithMessage(ScheduleSchema);
export const ClockOutResponse = successWithMessage(ScheduleSchema);

export const ListSwapRequestsResponse = z.object({
  success: z.literal(true),
  data: z.array(SwapRequestSchema),
  pagination: PaginationSchema.optional(),
});

export const SwapRequestResponse = successWithMessage(SwapRequestSchema);
export const AttendanceReportResponse = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
});
