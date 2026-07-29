/**
 * Realtime Validation Schemas
 * Zod schemas for validating realtime API requests
 */

import { z } from "zod";

/**
 * WebSocket 授權 Token 請求 Schema
 */
export const webSocketTokenRequestSchema = z.object({
  roomType: z.enum(["customer", "kitchen", "admin", "restaurant"], {
    errorMap: () => ({ message: "Invalid room type" }),
  }),
  roomId: z.string().min(1, "Room ID is required"),
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  tableId: z.string().optional(),
  seatId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const guestRealtimeTokenRequestSchema = z
  .object({
    restaurantId: z.string().min(1, "Restaurant ID is required"),
    guestToken: z
      .string()
      .regex(/^gt_[0-9a-f]{64}$/i)
      .optional(),
    tableId: z.coerce.string().min(1, "Table ID is required").optional(),
    seatId: z.coerce.string().min(1, "Seat ID is required").optional(),
    orderId: z.coerce.string().min(1, "Order ID is required").optional(),
    qrCode: z.string().url("A signed QR URL is required").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.guestToken && !data.orderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["orderId"],
        message: "Order ID is required for guest token exchange",
      });
    }

    if (!data.guestToken && ((!data.tableId && !data.seatId) || !data.qrCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Either guestToken or signed table/seat QR details are required",
      });
    }
  });

/**
 * 導出 schemas 集合
 */
export const realtimeSchemas = {
  webSocketTokenRequest: webSocketTokenRequestSchema,
  guestRealtimeTokenRequest: guestRealtimeTokenRequestSchema,
};
