import { z } from "zod";

const unknownRecord = z.record(z.string(), z.unknown());
const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "paid",
  "cancelled",
  "refunded",
]);
const estimatedTimesSchema = z
  .object({
    preparation: z.number().nonnegative().optional(),
    ready: z.number().nonnegative().optional(),
    completion: z.number().nonnegative().optional(),
  })
  .strict();

const basicClientMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ping"),
      timestamp: z.number().int().nonnegative().optional(),
      data: unknownRecord.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("subscribe"),
      timestamp: z.number().int().nonnegative().optional(),
      channel: z.string().min(1).optional(),
      data: unknownRecord.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("unsubscribe"),
      timestamp: z.number().int().nonnegative().optional(),
      channel: z.string().min(1).optional(),
      data: unknownRecord.optional(),
    })
    .strict(),
]);

const groupOrderData = {
  groupOrderId: z.string().min(1),
};

const advancedClientMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("subscribe"),
      data: unknownRecord.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("order_state_change"),
      data: z
        .object({
          orderId: z.string().min(1),
          newState: orderStatusSchema,
          metadata: unknownRecord.optional(),
          estimatedTimes: estimatedTimesSchema.optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("broadcast"),
      data: unknownRecord,
    })
    .strict(),
  z.object({ type: z.literal("heartbeat") }).strict(),
  z
    .object({
      type: z.literal("request_state_sync"),
      data: unknownRecord.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("join_group_order"),
      data: z
        .object({
          shareCode: z.string().min(1),
          memberName: z.string().min(1).max(120),
          phone: z.string().min(1).max(32).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("leave_group_order"),
      data: z
        .object({
          ...groupOrderData,
          memberId: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("add_cart_item"),
      data: z
        .object({
          ...groupOrderData,
          memberId: z.string().min(1),
          menuItemId: z.number().int().positive(),
          menuItemName: z.string().min(1).max(200),
          quantity: z.number().int().positive().max(99),
          unitPrice: z.number().nonnegative(),
          customizations: unknownRecord.optional(),
          specialInstructions: z.string().max(500).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("update_cart_item"),
      data: z
        .object({
          ...groupOrderData,
          itemId: z.string().min(1),
          quantity: z.number().int().positive().max(99).optional(),
          customizations: unknownRecord.optional(),
          specialInstructions: z.string().max(500).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("remove_cart_item"),
      data: z
        .object({
          ...groupOrderData,
          itemId: z.string().min(1),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("initiate_split_bill"),
      data: z
        .object({
          ...groupOrderData,
          splitType: z.enum(["equal", "proportional", "individual", "custom"]),
          customSplits: z
            .array(
              z
                .object({
                  memberId: z.string().min(1),
                  amount: z.number().nonnegative(),
                  items: z.array(z.string().min(1)),
                })
                .strict(),
            )
            .optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("process_payment"),
      data: z
        .object({
          ...groupOrderData,
          memberId: z.string().min(1),
          paymentMethod: z.string().min(1).max(80),
          amount: z.number().positive(),
          transactionId: z.string().min(1).max(160).optional(),
        })
        .strict(),
    })
    .strict(),
]);

export type BasicClientMessage = z.infer<typeof basicClientMessageSchema>;
export type AdvancedClientMessage = z.infer<typeof advancedClientMessageSchema>;

export function parseJsonMessage(data: string | ArrayBuffer): unknown {
  const raw = typeof data === "string" ? data : new TextDecoder().decode(data);
  return JSON.parse(raw) as unknown;
}

export function validateBasicClientMessage(data: unknown) {
  return basicClientMessageSchema.safeParse(data);
}

export function validateAdvancedClientMessage(data: unknown) {
  return advancedClientMessageSchema.safeParse(data);
}

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "message";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
