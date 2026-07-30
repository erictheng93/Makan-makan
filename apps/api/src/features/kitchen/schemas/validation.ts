/**
 * Kitchen Feature Module Validation Schemas
 * Zod schemas for request validation
 */

import { z } from "zod";

// Order Item Status Update Schema
export const orderItemStatusUpdateSchema = z.object({
  status: z.enum(["pending", "preparing", "ready", "completed"], {
    error: "Status must be one of: pending, preparing, ready, completed",
  }),
  notes: z.string().optional().default(""),
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
export type RestaurantIdParams = z.infer<typeof restaurantIdSchema>;
export type OrderItemParams = z.infer<typeof orderItemParamsSchema>;
export type KitchenOrdersQuery = z.infer<typeof kitchenOrdersQuerySchema>;
