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

export const guestRealtimeTokenRequestSchema = z.object({
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  tableId: z.coerce.string().min(1, "Table ID is required"),
  orderId: z.coerce.string().min(1).optional(),
  qrCode: z.string().url("A signed QR URL is required"),
});

/**
 * 導出 schemas 集合
 */
export const realtimeSchemas = {
  webSocketTokenRequest: webSocketTokenRequestSchema,
  guestRealtimeTokenRequest: guestRealtimeTokenRequestSchema,
};
