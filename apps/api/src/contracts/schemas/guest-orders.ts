/**
 * Guest Orders API Response Contracts
 *
 * Defines the STABLE response shapes for guest order endpoints.
 * Customer app (non-authenticated) depends on these.
 */

import { z } from "zod";
import { OrderSchema } from "./orders";

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const CreateGuestOrderResponse = z.object({
  success: z.literal(true),
  data: z.object({
    order: OrderSchema,
    guestToken: z.string(),
    tokenExpiresAt: z.union([z.string(), z.number()]).optional(),
  }),
});

export const GetGuestOrderResponse = z.object({
  success: z.literal(true),
  data: z.object({
    order: OrderSchema,
  }),
});

export const AddGuestItemsResponse = z.object({
  success: z.literal(true),
  data: z.object({
    order: OrderSchema,
  }),
  message: z.string().optional(),
});

export const CancelGuestOrderResponse = z.object({
  success: z.literal(true),
  data: z.object({
    order: OrderSchema,
  }),
  message: z.string().optional(),
});

/** Error responses specific to guest orders */
export const GuestOrderValidationError = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.unknown().optional(),
});

export const GuestOrderRateLimitError = z.object({
  success: z.literal(false),
  error: z.string(),
});

// ---------------------------------------------------------------------------
// Sensitive fields that MUST NOT appear in guest order responses
// ---------------------------------------------------------------------------

export const GUEST_ORDER_SENSITIVE_FIELDS = [
  "internalNotes",
  "staffNotes",
  "costPrice",
  "profitMargin",
];
