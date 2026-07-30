/**
 * POS系統驗證schemas
 */

import { z } from "zod";
import { isCentAlignedAmount } from "../../../shared/utils/money";

const idString = z.preprocess((value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return value;
}, z.string().trim().min(1));

export const createRegisterSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  restaurantId: z.string().min(1),
  hardwareConfig: z.record(z.string(), z.any()).optional(),
  peripherals: z.record(z.string(), z.any()).optional(),
  settings: z.record(z.string(), z.any()).optional(),
});

export const startShiftSchema = z.object({
  registerId: z.string().uuid(),
  operatorId: idString,
  startAmount: z.number().min(0).refine(isCentAlignedAmount, {
    message: "startAmount must not have more than two decimal places",
  }),
  notes: z.string().max(500).optional(),
});

export const endShiftSchema = z.object({
  actualAmount: z.number().min(0).refine(isCentAlignedAmount, {
    message: "actualAmount must not have more than two decimal places",
  }),
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
  amount: z.number().refine(isCentAlignedAmount, {
    message: "amount must not have more than two decimal places",
  }),
  description: z.string().min(1).max(200),
  denominationBreakdown: z.record(z.string(), z.number()).optional(),
  referenceId: z.number().int().positive().optional(),
  referenceType: z.string().optional(),
});

export const printReceiptSchema = z.object({
  orderId: idString,
  templateName: z.string().optional().default("standard"),
  receiptType: z
    .enum(["customer", "kitchen", "merchant"])
    .optional()
    .default("customer"),
  copies: z.number().int().min(1).max(5).optional().default(1),
});

export const processRefundSchema = z.object({
  originalOrderId: idString,
  refundType: z.enum(["full", "partial", "item", "service"]),
  refundAmount: z.number().positive().refine(isCentAlignedAmount, {
    message: "refundAmount must not have more than two decimal places",
  }),
  refundMethod: z.string().min(1).max(50),
  reasonCode: z.string().min(1).max(50),
  reasonDescription: z.string().max(500).optional(),
  itemsRefunded: z.array(z.any()).optional(),
  customerSignature: z.string().optional(),
});

export const marketCheckoutPosPaymentSchema = z.object({
  registerId: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
  paymentMethod: z.enum(["cash", "card", "digital_wallet"]).default("cash"),
  country: z.enum(["TW", "MY", "VN"]).optional().default("TW"),
  currency: z.enum(["TWD", "MYR", "VND"]).optional().default("TWD"),
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
  page: z.string().regex(/^\d+$/).transform(Number).optional().prefault("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().prefault("20"),
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
