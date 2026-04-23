import { z } from "zod";

const moneySchema = z.number().finite().nonnegative();

const partialPaymentSchema = z.object({
  method: z.string().min(1).max(50),
  amount: moneySchema,
});

export const paymentRequestSchema = z
  .object({
    orderId: z.number().int().positive(),
    paymentMode: z.enum(["full", "partial"]).optional().default("full"),
    expectedTotal: moneySchema,
    payments: z.array(partialPaymentSchema).min(1).max(20).optional(),
    closeOrder: z.boolean().optional(),
    method: z.string().min(1).max(50).optional(),
    amount: moneySchema.optional(),
    gateway: z.string().min(1).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.paymentMode === "partial" && !value.payments?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payments"],
        message: "payments are required for partial payment mode",
      });
    }

    if (value.paymentMode === "full" && value.amount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "amount is required for full payment mode",
      });
    }
  });

export const paymentSchemas = {
  processPayment: paymentRequestSchema,
};

export type PaymentRequestInput = z.infer<typeof paymentRequestSchema>;
