/**
 * Seats Validation Schemas
 * Zod schemas for request validation
 */

import { z } from "zod";

// Batch create seats schema
export const batchCreateSeatsSchema = z.object({
  tableId: z.number().int().positive(),
  seatCount: z.number().int().positive().min(1).max(100),
  numberingStyle: z
    .enum(["numeric", "alphabetic", "custom"])
    .optional()
    .default("numeric"),
  customNumbers: z.array(z.string()).optional(),
  prefix: z.string().max(10).optional(),
});

// Update seat schema
export const updateSeatSchema = z.object({
  seatNumber: z.string().min(1).max(50).optional(),
  seatName: z.string().min(1).max(100).optional(),
  position: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

// Occupy seat schema
export const occupySeatSchema = z.object({
  orderId: z.number().int().positive(),
  occupiedBy: z.string().max(100).optional(),
});

// Seat filter schema (query params)
export const seatFilterSchema = z.object({
  tableId: z.string().regex(/^\d+$/).transform(Number),
  isOccupied: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  seatNumbers: z
    .string()
    .transform((val) => val.split(",").filter(Boolean))
    .optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("50"),
});

// ID param schema
export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

// Table ID param schema
export const tableIdParamSchema = z.object({
  tableId: z.string().regex(/^\d+$/).transform(Number),
});

// QR code param schema
export const qrCodeParamSchema = z.object({
  qrCode: z.string(),
});

// Table ID query schema
export const tableIdQuerySchema = z.object({
  tableId: z.string().regex(/^\d+$/).transform(Number),
});

// Batch regenerate QR schema
export const batchRegenerateQRSchema = z.object({
  tableId: z.number().int().positive(),
});

// Export schema types
export type BatchCreateSeatsInput = z.infer<typeof batchCreateSeatsSchema>;
export type UpdateSeatInput = z.infer<typeof updateSeatSchema>;
export type OccupySeatInput = z.infer<typeof occupySeatSchema>;
export type SeatFilterInput = z.infer<typeof seatFilterSchema>;
