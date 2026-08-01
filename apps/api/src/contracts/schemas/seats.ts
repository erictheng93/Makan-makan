/**
 * Seats API Response Contracts
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

export const SeatSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    tableId: z.union([z.number(), z.string()]),
    restaurantId: z.string().optional(),
    seatNumber: z.number(),
    seatName: z.string().optional().nullable(),
    qrCode: z.string().optional().nullable(),
    pendingQrCode: z.string().optional().nullable(),
    pendingQrCodeVersion: z.number().optional().nullable(),
    pendingQrPreparedAt: z
      .union([z.string(), z.number()])
      .optional()
      .nullable(),
    isActive: z.union([z.boolean(), z.number()]).optional(),
    isOccupied: z.union([z.boolean(), z.number()]).optional(),
    capacity: z.number().optional(),
    orderId: z.union([z.number(), z.string()]).optional().nullable(),
    ...TimestampFields,
  })
  .loose();

export const PublicSeatInfoSchema = z.object({
  id: z.union([z.number(), z.string()]),
  tableId: z.union([z.number(), z.string()]),
  tableNumber: z.string().optional(),
  restaurantId: z.string(),
  restaurantName: z.string().optional(),
  seatNumber: z.number(),
  seatName: z.string().optional().nullable(),
  isActive: z.union([z.boolean(), z.number()]),
  isOccupied: z.union([z.boolean(), z.number()]),
  capacity: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const ListSeatsResponse = z.object({
  success: z.literal(true),
  data: z.array(SeatSchema),
  total: z.number().optional(),
  pagination: PaginationSchema.optional(),
});

export const GetSeatResponse = successEnvelope(SeatSchema);
export const GetPublicSeatResponse = successEnvelope(PublicSeatInfoSchema);
export const BatchCreateSeatsResponse = z.object({
  success: z.literal(true),
  data: z.array(SeatSchema),
  message: z.string().optional(),
});
export const UpdateSeatResponse = successWithMessage(SeatSchema);
export const DeleteSeatResponse = messageOnlyResponse;
export const OccupySeatResponse = messageOnlyResponse;
export const ReleaseSeatResponse = messageOnlyResponse;
export const RegenerateQRResponse = z.object({
  success: z.literal(true),
  data: z.object({ qrCode: z.string() }).loose(),
  message: z.string().optional(),
});

export const SeatStatsResponse = successEnvelope(z.unknown());

export const SEAT_SENSITIVE_FIELDS = [
  "qrCode",
  "qrCodeImageUrl",
  "qrCodeVersion",
  "pendingQrCode",
  "pendingQrCodeVersion",
  "pendingQrPreparedAt",
  "currentOrderId",
  "occupiedAt",
  "occupiedBy",
  "totalUsage",
  "position",
];
