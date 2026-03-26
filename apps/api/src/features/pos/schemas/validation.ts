/**
 * POS系統驗證schemas
 */

import { z } from "zod";

export const createRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  restaurantId: z.number().int().positive(),
  hardwareConfig: z.record(z.any()).optional(),
  peripherals: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
});

export const startShiftSchema = z.object({
  registerId: z.string().uuid(),
  operatorId: z.number().int().positive(),
  startAmount: z.number().min(0),
  notes: z.string().max(500).optional(),
});

export const endShiftSchema = z.object({
  actualAmount: z.number().min(0),
  closingNotes: z.string().max(500).optional(),
});

export const cashMovementSchema = z.object({
  type: z.enum([
    "cash_in",
    "cash_out",
    "count",
    "adjustment",
    "payout",
    "deposit",
  ]),
  amount: z.number(),
  description: z.string().min(1).max(200),
  denominationBreakdown: z.record(z.number()).optional(),
  referenceId: z.number().int().positive().optional(),
  referenceType: z.string().optional(),
});

export const printReceiptSchema = z.object({
  orderId: z.number().int().positive(),
  templateName: z.string().optional().default("standard"),
  receiptType: z
    .enum(["customer", "kitchen", "merchant"])
    .optional()
    .default("customer"),
  copies: z.number().int().min(1).max(5).optional().default(1),
});

export const processRefundSchema = z.object({
  originalOrderId: z.number().int().positive(),
  refundType: z.enum(["full", "partial", "item", "service"]),
  refundAmount: z.number().positive(),
  refundMethod: z.string().min(1).max(50),
  reasonCode: z.string().min(1).max(50),
  reasonDescription: z.string().max(500).optional(),
  itemsRefunded: z.array(z.any()).optional(),
  customerSignature: z.string().optional(),
});

export const registerParamsSchema = z.object({
  registerId: z.string().uuid(),
});

export const shiftParamsSchema = z.object({
  shiftId: z.string().uuid(),
});

export const receiptParamsSchema = z.object({
  receiptId: z.string().uuid(),
});

export const queryPaginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
});

export const dateRangeQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const registerQuerySchema = z
  .object({
    restaurantId: z.string().optional(),
  })
  .merge(queryPaginationSchema);

export const movementsQuerySchema = z
  .object({
    type: z
      .enum([
        "sale",
        "refund",
        "cash_in",
        "cash_out",
        "count",
        "opening",
        "closing",
        "adjustment",
        "payout",
        "deposit",
      ])
      .optional(),
  })
  .merge(queryPaginationSchema);

export const statsQuerySchema = z
  .object({
    restaurantId: z.string().optional(),
  })
  .merge(dateRangeQuerySchema);
