/**
 * Menu Validation Schemas
 * Zod schemas for validating menu-related requests
 */

import { z } from "zod";

// Base validation schemas
const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().min(0);
const nonEmptyString = z.string().min(1).trim();
const optionalUrl = z.string().url().optional();
const priceSchema = z.number().positive();

// Menu Item Option Schemas
const menuItemSizeSchema = z.object({
  id: z.string(),
  name: nonEmptyString.max(50),
  priceAdjustment: z.number(),
  description: z.string().max(200).optional(),
  isDefault: z.boolean().optional(),
});

const menuItemCustomizationChoiceSchema = z.object({
  id: z.string(),
  name: nonEmptyString.max(100),
  priceAdjustment: z.number().optional(),
  isDefault: z.boolean().optional(),
});

const menuItemCustomizationSchema = z.object({
  id: z.string(),
  name: nonEmptyString.max(100),
  type: z.enum(["single", "multiple"]),
  required: z.boolean(),
  maxSelections: positiveInteger.optional(),
  choices: z.array(menuItemCustomizationChoiceSchema).min(1),
});

const menuItemAddOnSchema = z.object({
  id: z.string(),
  name: nonEmptyString.max(100),
  price: priceSchema,
  description: z.string().max(200).optional(),
  maxQuantity: positiveInteger.optional(),
  category: z.string().max(50).optional(),
});

const menuItemOptionsSchema = z.object({
  sizes: z.array(menuItemSizeSchema).optional(),
  customizations: z.array(menuItemCustomizationSchema).optional(),
  addOns: z.array(menuItemAddOnSchema).optional(),
});

// Dietary Information Schema
const dietaryInfoSchema = z.object({
  vegetarian: z.boolean().optional(),
  vegan: z.boolean().optional(),
  halal: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  dairyFree: z.boolean().optional(),
  nutFree: z.boolean().optional(),
  seafoodFree: z.boolean().optional(),
  organic: z.boolean().optional(),
  localSource: z.boolean().optional(),
});

// Image Variants Schema
const imageVariantsSchema = z.object({
  thumbnail: optionalUrl,
  small: optionalUrl,
  medium: optionalUrl,
  large: optionalUrl,
});

// Available Hours Schema
const availableHoursSchema = z.object({
  start: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  end: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional(),
  days: z.array(z.number().int().min(0).max(6)).optional(),
});

// Menu Item Schemas
export const createMenuItemSchema = z.object({
  categoryId: positiveInteger,
  name: nonEmptyString.max(100),
  description: z.string().max(500).optional(),
  ingredients: z.string().max(200).optional(),
  price: priceSchema,
  originalPrice: priceSchema.optional(),
  imageUrl: optionalUrl,
  imageVariants: imageVariantsSchema.optional(),
  spiceLevel: z.number().int().min(0).max(5).optional().default(0),
  preparationTime: positiveInteger.optional().default(15),
  calories: positiveInteger.optional(),
  dietaryInfo: dietaryInfoSchema.optional(),
  allergens: z.array(z.string()).optional(),
  options: menuItemOptionsSchema.optional(),
  availableHours: availableHoursSchema.optional(),
  tags: z.array(z.string()).optional(),
  keywords: z.string().max(200).optional(),
});

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  sortOrder: nonNegativeInteger.optional(),
  inventoryCount: nonNegativeInteger.optional(),
});

// Category Schemas
export const createCategorySchema = z.object({
  name: nonEmptyString.max(50),
  description: z.string().max(200).optional(),
  sortOrder: nonNegativeInteger.optional().default(0),
  imageUrl: optionalUrl,
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
});

// Search and Filter Schemas
export const menuFilterSchema = z.object({
  categoryId: z.string().regex(/^\d+$/).transform(Number).optional(),
  minPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .optional(),
  maxPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number)
    .optional(),
  spiceLevel: z.string().regex(/^\d+$/).transform(Number).optional(),
  dietaryPreferences: z.string().optional(),
  isAvailable: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  isFeatured: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
});

// Bulk Operation Schemas
export const bulkAvailabilityUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: positiveInteger,
        isAvailable: z.boolean(),
      }),
    )
    .min(1)
    .max(100), // Limit bulk operations to 100 items
});

export const bulkPriceUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: positiveInteger,
        price: priceSchema,
        originalPrice: priceSchema.optional(),
      }),
    )
    .min(1)
    .max(100),
});

export const bulkCategoryMoveSchema = z.object({
  updates: z
    .array(
      z.object({
        id: positiveInteger,
        categoryId: positiveInteger,
      }),
    )
    .min(1)
    .max(100),
});

// Parameter Schemas
export const restaurantIdParamSchema = z.object({
  restaurantId: z.string().min(1),
});

export const menuItemIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const categoryIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

// Query Parameter Schemas
export const featuredItemsQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10"),
});

export const popularItemsQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10"),
});

export const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeDetails: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

// Import/Export Schemas
export const menuImportSchema = z.object({
  categories: z.array(
    createCategorySchema.omit({ sortOrder: true }).extend({
      sortOrder: z.number().int().min(0).optional(),
    }),
  ),
  menuItems: z.array(createMenuItemSchema),
});

export const menuExportQuerySchema = z.object({
  format: z.enum(["json", "csv", "xlsx"]).optional().default("json"),
  includeImages: z
    .string()
    .transform((val) => val === "true")
    .optional()
    .default("false"),
  includeAnalytics: z
    .string()
    .transform((val) => val === "true")
    .optional()
    .default("false"),
  categories: z.string().optional(), // Comma-separated category IDs
});

// Complex validation functions
export const validateMenuItemAvailability = (item: any) => {
  if (!item.isAvailable && item.inventoryCount === 0) {
    return false;
  }
  if (item.availableHours) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    if (item.availableHours.start && item.availableHours.end) {
      const [startHour, startMinute] = item.availableHours.start
        .split(":")
        .map(Number);
      const [endHour, endMinute] = item.availableHours.end
        .split(":")
        .map(Number);
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      if (currentTime < startTime || currentTime > endTime) {
        return false;
      }
    }

    if (
      item.availableHours.days &&
      !item.availableHours.days.includes(now.getDay())
    ) {
      return false;
    }
  }
  return true;
};

export const validatePriceConsistency = (
  price: number,
  originalPrice?: number,
) => {
  if (originalPrice && price > originalPrice) {
    throw new Error("Price cannot be higher than original price");
  }
  return true;
};

export const validateCustomizationOptions = (options: any) => {
  if (!options) return true;

  // Validate that at least one default option is selected for required customizations
  if (options.customizations) {
    for (const customization of options.customizations) {
      if (customization.required && customization.type === "single") {
        const hasDefault = customization.choices.some(
          (choice: any) => choice.isDefault,
        );
        if (!hasDefault) {
          throw new Error(
            `Required customization "${customization.name}" must have a default choice`,
          );
        }
      }
    }
  }

  // Validate size options
  if (options.sizes && options.sizes.length > 1) {
    const defaultSizes = options.sizes.filter((size: any) => size.isDefault);
    if (defaultSizes.length !== 1) {
      throw new Error(
        "Exactly one size must be marked as default when multiple sizes are available",
      );
    }
  }

  return true;
};

// Comprehensive menu validation schema
export const validateCompleteMenuItem = createMenuItemSchema
  .refine((data) => validatePriceConsistency(data.price, data.originalPrice), {
    message: "Price validation failed",
  })
  .refine((data) => validateCustomizationOptions(data.options), {
    message: "Customization options validation failed",
  });

// Export all schemas as a single object for easy import
export const menuSchemas = {
  // Creation schemas
  createMenuItem: createMenuItemSchema,
  updateMenuItem: updateMenuItemSchema,
  createCategory: createCategorySchema,
  updateCategory: updateCategorySchema,

  // Search and filter schemas
  menuFilter: menuFilterSchema,

  // Bulk operation schemas
  bulkAvailabilityUpdate: bulkAvailabilityUpdateSchema,
  bulkPriceUpdate: bulkPriceUpdateSchema,
  bulkCategoryMove: bulkCategoryMoveSchema,

  // Parameter schemas
  restaurantIdParam: restaurantIdParamSchema,
  menuItemIdParam: menuItemIdParamSchema,
  categoryIdParam: categoryIdParamSchema,

  // Query schemas
  featuredItemsQuery: featuredItemsQuerySchema,
  popularItemsQuery: popularItemsQuerySchema,
  analyticsQuery: analyticsQuerySchema,

  // Import/Export schemas
  menuImport: menuImportSchema,
  menuExportQuery: menuExportQuerySchema,

  // Complete validation
  validateCompleteMenuItem,
};
