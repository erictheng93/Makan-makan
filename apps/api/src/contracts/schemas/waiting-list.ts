/**
 * Waiting List API Response Contracts
 */

import { z } from "zod";
import {
  successEnvelope,
  successWithMessage,
  PaginationSchema,
  TimestampFields,
} from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const WaitingListEntrySchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    partySize: z.number().optional(),
    status: z.string(),
    position: z.number().optional(),
    estimatedWaitMinutes: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
    ...TimestampFields,
  })
  .loose();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const JoinQueueResponse = z.object({
  success: z.literal(true),
  data: WaitingListEntrySchema,
  message: z.string().optional(),
});

export const GetEntryResponse = successEnvelope(WaitingListEntrySchema);

export const QueueStatusResponse = successEnvelope(
  z
    .object({
      totalWaiting: z.number().optional(),
      estimatedWait: z.number().optional(),
    })
    .loose(),
);

export const EstimateWaitResponse = successEnvelope(z.unknown());

export const ListWaitingResponse = z.object({
  success: z.literal(true),
  data: z.array(WaitingListEntrySchema),
  pagination: PaginationSchema.optional(),
});

export const CallNextResponse = successWithMessage(WaitingListEntrySchema);
export const SeatEntryResponse = successWithMessage(WaitingListEntrySchema);
export const ExpireEntryResponse = successWithMessage(WaitingListEntrySchema);
export const CancelEntryResponse = successWithMessage(WaitingListEntrySchema);

export const WaitingStatsResponse = successEnvelope(z.unknown());
