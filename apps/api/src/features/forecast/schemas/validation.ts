// apps/api/src/features/forecast/schemas/validation.ts
import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");

export const generateForecastSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    type: z.enum(["item_level", "ingredient_level"]).default("item_level"),
    useAI: z.boolean().default(false),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
  });

export const getForecastQuerySchema = z
  .object({
    date: dateStringSchema.optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    type: z.enum(["item_level", "ingredient_level"]).optional(),
  })
  .refine((data) => data.date || (data.startDate && data.endDate), {
    message: "Either 'date' or both 'startDate' and 'endDate' are required",
  });

export const accuracyQuerySchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
  });

export const ingredientForecastQuerySchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
  });

export const restaurantIdParamSchema = z.object({
  restaurantId: z.string().min(1, "restaurantId is required"),
});
