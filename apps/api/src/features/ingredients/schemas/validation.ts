import { z } from "zod";

export const restaurantIdParamSchema = z.object({
  restaurantId: z.string().min(1, "restaurantId is required"),
});

export const ingredientIdParamSchema = z.object({
  restaurantId: z.string().min(1, "restaurantId is required"),
  id: z.string().regex(/^\d+$/, "id must be numeric").transform(Number),
});

export const menuItemIdParamSchema = z.object({
  restaurantId: z.string().min(1, "restaurantId is required"),
  menuItemId: z
    .string()
    .regex(/^\d+$/, "menuItemId must be numeric")
    .transform(Number),
});

export const createIngredientSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  unit: z.string().min(1, "Unit is required").max(50),
  category: z.string().max(100).optional(),
  costPerUnit: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  minStockLevel: z.number().min(0).optional(),
  currentStock: z.number().min(0).optional(),
});

export const updateIngredientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  unit: z.string().min(1).max(50).optional(),
  category: z.string().max(100).optional(),
  costPerUnit: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  minStockLevel: z.number().min(0).optional(),
  currentStock: z.number().min(0).optional(),
});

export const bulkImportSchema = z.object({
  ingredients: z
    .array(createIngredientSchema)
    .min(1, "At least one ingredient is required")
    .max(500, "Maximum 500 ingredients per import"),
});

export const updateStockSchema = z.object({
  quantity: z.number().min(0, "Quantity must be non-negative"),
});

export const setRecipeSchema = z.object({
  ingredients: z
    .array(
      z.object({
        ingredientId: z.number().int().positive(),
        quantityPerServing: z.number().positive(),
        unit: z.string().min(1).max(50),
        isOptional: z.boolean().optional().default(false),
      }),
    )
    .min(1, "At least one ingredient is required"),
});

export const ingredientListQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("50"),
  category: z.string().optional(),
  search: z.string().optional(),
  includeInactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});
