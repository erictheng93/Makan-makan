/**
 * Restaurants Validation Schemas
 * Zod schemas for validating restaurants API requests
 */

import { z } from "zod";
import { VALIDATION_LIMITS } from "../../../shared/constants";

// Business hours validation schema
const businessHoursSchema = z
  .record(
    z.string(),
    z.object({
      open: z
        .string()
        .regex(
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Invalid time format (HH:MM)",
        ),
      close: z
        .string()
        .regex(
          /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
          "Invalid time format (HH:MM)",
        ),
      isOpen: z.boolean(),
    }),
  )
  .optional();

// Restaurant settings validation schema
const restaurantSettingsSchema = z
  .object({
    allowOnlineOrdering: z.boolean().optional(),
    requireAdvanceBooking: z.boolean().optional(),
    deliveryAvailable: z.boolean().optional(),
    pickupAvailable: z.boolean().optional(),
    minOrderAmount: z.number().min(0).optional(),
    maxOrdersPerHour: z.number().int().min(1).optional(),
    autoAcceptOrders: z.boolean().optional(),
    currency: z.string().length(3).optional(), // ISO currency codes are 3 characters
    timezone: z.string().optional(),
    // Takeaway / delivery fulfillment settings
    enableTakeaway: z.boolean().optional(),
    enableDelivery: z.boolean().optional(),
    deliveryFee: z.number().min(0).optional(),
    estimatedPrepTimeMin: z.number().int().min(1).optional(),
    estimatedPrepTimeMax: z.number().int().min(1).optional(),
  })
  .passthrough(); // Allow additional properties

// Common parameter schemas
const idParam = z.object({
  id: z
    .string()
    .transform(Number)
    .refine((val) => Number.isInteger(val) && val > 0, {
      message: "ID must be a positive integer",
    }),
});

const districtParam = z.object({
  district: z.string().min(1, "District is required"),
});

// Restaurant creation schema
const createRestaurantSchema = z.object({
  name: z
    .string()
    .min(1, "Restaurant name is required")
    .max(
      VALIDATION_LIMITS.NAME_MAX_LENGTH,
      `Name must be less than ${VALIDATION_LIMITS.NAME_MAX_LENGTH} characters`,
    ),
  type: z
    .string()
    .min(1, "Restaurant type is required")
    .max(50, "Type must be less than 50 characters"),
  category: z
    .string()
    .min(1, "Category is required")
    .max(50, "Category must be less than 50 characters"),
  description: z
    .string()
    .max(
      VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH,
      `Description must be less than ${VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH} characters`,
    )
    .optional(),
  address: z
    .string()
    .min(1, "Address is required")
    .max(200, "Address must be less than 200 characters"),
  district: z
    .string()
    .min(1, "District is required")
    .max(50, "District must be less than 50 characters"),
  city: z.string().max(50, "City must be less than 50 characters").optional(),
  phone: z
    .string()
    .min(8, "Phone number must be at least 8 characters")
    .max(
      VALIDATION_LIMITS.PHONE_MAX_LENGTH,
      `Phone number must be less than ${VALIDATION_LIMITS.PHONE_MAX_LENGTH} characters`,
    )
    .regex(/^[\d\s\-+()]+$/, "Invalid phone number format"),
  email: z
    .string()
    .email("Invalid email format")
    .max(
      VALIDATION_LIMITS.EMAIL_MAX_LENGTH,
      `Email must be less than ${VALIDATION_LIMITS.EMAIL_MAX_LENGTH} characters`,
    )
    .optional(),
  website: z.string().url("Invalid website URL").optional(),
  businessHours: businessHoursSchema,
  logoUrl: z.string().url("Invalid logo URL").optional(),
  bannerUrl: z.string().url("Invalid banner URL").optional(),
});

// Restaurant update schema (all fields optional except validation rules still apply)
const updateRestaurantSchema = createRestaurantSchema.partial().extend({
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  settings: restaurantSettingsSchema.optional(),
});

// Restaurant list query parameters
const restaurantFilterSchema = z.object({
  page: z
    .string()
    .transform(Number)
    .refine((val) => Number.isInteger(val) && val > 0, {
      message: "Page must be a positive integer",
    })
    .optional(),
  limit: z
    .string()
    .transform(Number)
    .refine((val) => Number.isInteger(val) && val > 0 && val <= 100, {
      message: "Limit must be a positive integer up to 100",
    })
    .optional(),
  type: z
    .string()
    .max(50, "Type filter must be less than 50 characters")
    .optional(),
  district: z
    .string()
    .max(50, "District filter must be less than 50 characters")
    .optional(),
  isAvailable: z
    .string()
    .transform((val) => val === "true")
    .optional(),
});

// Nearby restaurants query parameters
const nearbyQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .transform(Number)
    .refine((val) => val > 0 && val <= 50, {
      message: "Limit must be between 1 and 50",
    })
    .default("10"),
});

// Popular restaurants query parameters
const popularQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .transform(Number)
    .refine((val) => val > 0 && val <= 50, {
      message: "Limit must be between 1 and 50",
    })
    .default("10"),
});

// Shop QR Code validation schemas
const shopQrSettingsSchema = z.object({
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name must be less than 100 characters")
    .optional(),
  instructions: z
    .string()
    .max(500, "Instructions must be less than 500 characters")
    .optional(),
  requirePhone: z.boolean().optional(),
});

const updateShopModeSchema = z.object({
  enabled: z.boolean(),
  settings: shopQrSettingsSchema.optional(),
});

const uploadQrImageSchema = z.object({
  imageUrl: z.string().url("Invalid image URL").min(1, "Image URL is required"),
});

const qrCodeParam = z.object({
  qrCode: z
    .string()
    .min(1, "QR code is required")
    .regex(/^SHOP-\d+-\d+$/, "Invalid shop QR code format"),
});

export const restaurantSchemas = {
  // Parameters
  params: idParam,
  districtParams: districtParam,
  qrCodeParams: qrCodeParam,

  // Restaurant operations
  create: createRestaurantSchema,
  update: updateRestaurantSchema,

  // Query parameters
  list: restaurantFilterSchema,
  nearby: nearbyQuerySchema,
  popular: popularQuerySchema,

  // Shop QR Code operations
  updateShopMode: updateShopModeSchema,
  uploadQrImage: uploadQrImageSchema,
  shopQrSettings: shopQrSettingsSchema,

  // Component schemas (for reuse)
  businessHours: businessHoursSchema,
  settings: restaurantSettingsSchema,
} as const;
