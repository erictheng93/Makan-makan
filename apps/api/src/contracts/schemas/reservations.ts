/**
 * Reservations API Response Contracts
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

export const ReservationSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    customerEmail: z.string().optional().nullable(),
    partySize: z.number(),
    status: z.string(),
    reservationDate: z.union([z.string(), z.number(), z.date()]),
    reservationTime: z.string().optional(),
    tableId: z.union([z.number(), z.string()]).optional().nullable(),
    confirmationCode: z.string().optional(),
    notes: z.string().optional().nullable(),
    ...TimestampFields,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const CreateReservationResponse = z.object({
  success: z.literal(true),
  data: ReservationSchema,
  message: z.string().optional(),
});

export const VerifyReservationResponse = successEnvelope(ReservationSchema);
export const CheckAvailabilityResponse = successEnvelope(z.unknown());

export const ListReservationsResponse = z.object({
  success: z.literal(true),
  data: z.array(ReservationSchema),
  pagination: PaginationSchema.optional(),
});

export const GetReservationResponse = successEnvelope(ReservationSchema);
export const UpdateReservationResponse = successWithMessage(ReservationSchema);
export const ConfirmReservationResponse = successWithMessage(ReservationSchema);
export const CancelReservationResponse = successWithMessage(ReservationSchema);

export const ReservationStatsResponse = successEnvelope(z.unknown());
