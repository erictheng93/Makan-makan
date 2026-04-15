/**
 * Kitchen API Response Contracts
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const GetKitchenOrdersResponse = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
});

export const UpdateItemStatusResponse = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
});
