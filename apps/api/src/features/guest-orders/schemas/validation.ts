/**
 * Guest Orders Validation Schemas
 * Zod validation for guest (unauthenticated) order endpoints
 */

import { z } from "zod";

// Reusable schemas
const selectedCustomizationsSchema = z
  .object({
    size: z
      .object({
        id: z.string(),
        name: z.string(),
        priceAdjustment: z.number().optional(),
      })
      .optional(),
    options: z
      .array(
        z.object({
          id: z.string(),
          optionName: z.string(),
          choiceId: z.string(),
          choiceName: z.string(),
          priceAdjustment: z.number().optional(),
        }),
      )
      .optional(),
    addOns: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          unitPrice: z.number().positive(),
          quantity: z.number().int().positive(),
          totalPrice: z.number().positive(),
        }),
      )
      .optional(),
    specialInstructions: z.string().max(200).optional(),
  })
  .optional();

const guestOrderItemSchema = z.object({
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().positive().max(99),
  customizations: selectedCustomizationsSchema,
  notes: z.string().max(200).optional(),
});

export const createGuestOrderSchema = z
  .object({
    restaurantId: z.string().min(1),
    guestName: z.string().min(1).max(50),
    phoneLastDigits: z.string().regex(/^\d{3}$/, "Must be exactly 3 digits"),
    orderType: z.enum(["shop", "table", "seat"]),
    tableId: z.number().int().positive().optional(),
    seatId: z.number().int().positive().optional(),
    items: z.array(guestOrderItemSchema).min(1).max(20),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.orderType === "table" || data.orderType === "seat") {
        return data.tableId != null;
      }
      return true;
    },
    {
      message: "tableId is required for table/seat order types",
      path: ["tableId"],
    },
  )
  .refine(
    (data) => {
      if (data.orderType === "seat") {
        return data.seatId != null;
      }
      return true;
    },
    { message: "seatId is required for seat order type", path: ["seatId"] },
  );

export const addGuestOrderItemsSchema = z.object({
  items: z.array(guestOrderItemSchema).min(1).max(20),
});

export type CreateGuestOrderInput = z.infer<typeof createGuestOrderSchema>;
export type AddGuestOrderItemsInput = z.infer<typeof addGuestOrderItemsSchema>;
