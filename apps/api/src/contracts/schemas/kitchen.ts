/**
 * Kitchen API Response Contracts
 */

import { z } from "zod";
import { successWithMessage } from "../helpers";

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

export const KitchenConnectionsResponse = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
});

export const BroadcastTestResponse = z.object({
  success: z.literal(true),
  data: z
    .object({
      message: z.string().optional(),
      sentCount: z.number().optional(),
      event: z.string().optional(),
    })
    .passthrough(),
  message: z.string().optional(),
});
