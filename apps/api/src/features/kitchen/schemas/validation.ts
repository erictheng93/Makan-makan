/**
 * Kitchen Feature Module Validation Schemas
 * Zod schemas for request validation
 */

import { z } from "zod";

// Order Item Status Update Schema
export const orderItemStatusUpdateSchema = z.object({
  status: z.enum(["pending", "preparing", "ready", "completed"], {
    invalid_type_error:
      "Status must be one of: pending, preparing, ready, completed",
  }),
  notes: z.string().optional().default(""),
});

// Broadcast Test Event Schema (for development)
export const broadcastTestEventSchema = z.object({
  type: z
    .enum([
      "NEW_ORDER",
      "ORDER_STATUS_UPDATE",
      "ORDER_CANCELLED",
      "PRIORITY_UPDATE",
    ])
    .optional(),
  payload: z.any().optional(),
});

// SSE Event Schema
export const kitchenSSEEventSchema = z.object({
  id: z.string().optional(),
  event: z.string().optional(),
  data: z.object({
    type: z.enum([
      "NEW_ORDER",
      "ORDER_STATUS_UPDATE",
      "ORDER_CANCELLED",
      "PRIORITY_UPDATE",
      "HEARTBEAT",
    ]),
    orderId: z.number().optional(),
    payload: z.any().optional(),
    timestamp: z.string(),
    restaurantId: z.number(),
  }),
});

// Route Parameter Schemas
export const restaurantIdSchema = z.object({
  restaurantId: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Restaurant ID must be a positive integer",
          path: ["restaurantId"],
        },
      ]);
    }
    return num;
  }),
});

export const orderItemParamsSchema = z.object({
  restaurantId: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Restaurant ID must be a positive integer",
          path: ["restaurantId"],
        },
      ]);
    }
    return num;
  }),
  orderId: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Order ID must be a positive integer",
          path: ["orderId"],
        },
      ]);
    }
    return num;
  }),
  itemId: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: "Item ID must be a positive integer",
          path: ["itemId"],
        },
      ]);
    }
    return num;
  }),
});

// Query Parameter Schemas
export const kitchenOrdersQuerySchema = z.object({
  includeHistory: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 50;
      const num = parseInt(val, 10);
      return isNaN(num) ? 50 : Math.min(Math.max(num, 1), 200);
    }),
});

// Type exports for use in routes
export type OrderItemStatusUpdate = z.infer<typeof orderItemStatusUpdateSchema>;
export type BroadcastTestEvent = z.infer<typeof broadcastTestEventSchema>;
export type KitchenSSEEvent = z.infer<typeof kitchenSSEEventSchema>;
export type RestaurantIdParams = z.infer<typeof restaurantIdSchema>;
export type OrderItemParams = z.infer<typeof orderItemParamsSchema>;
export type KitchenOrdersQuery = z.infer<typeof kitchenOrdersQuerySchema>;
