/**
 * ID Validation Schemas
 *
 * Centralized Zod schemas for ID validation across the application.
 * These schemas ensure consistent validation of restaurant IDs and other entity IDs.
 */

import { z } from "zod";

/**
 * UUID schema - validates standard UUID format
 * Accepts UUID v1-v7 (8-4-4-4-12 hexadecimal format)
 */
export const uuidSchema = z.string().uuid("Invalid UUID format");

/**
 * Restaurant ID schema - validates UUID v7 format
 */
export const restaurantIdSchema = z
  .string()
  .uuid("Invalid restaurant ID format");

/**
 * Numeric ID schema - for entity IDs that remain as integers
 * (orders, users, menu items, etc.)
 */
export const numericIdSchema = z
  .number()
  .int()
  .positive("ID must be a positive integer");

/**
 * Numeric ID param schema - for route parameters that come as strings
 * Transforms string to number after validation
 */
export const numericIdParamSchema = z
  .string()
  .regex(/^\d+$/, "ID must be a numeric string")
  .transform(Number);

/**
 * Restaurant ID param schema - for route parameters
 */
export const restaurantIdParamSchema = z
  .string()
  .uuid("Invalid restaurant ID format");

/**
 * Optional restaurant ID schema
 */
export const optionalRestaurantIdSchema = restaurantIdSchema.optional();

/**
 * Optional numeric ID schema
 */
export const optionalNumericIdSchema = numericIdSchema.optional();

// Type exports for TypeScript inference
export type UUID = z.infer<typeof uuidSchema>;
export type RestaurantId = z.infer<typeof restaurantIdSchema>;
export type NumericId = z.infer<typeof numericIdSchema>;
