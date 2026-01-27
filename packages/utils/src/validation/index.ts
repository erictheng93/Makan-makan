/**
 * Validation schemas index
 *
 * Re-exports all validation schemas for easy importing
 */

export {
  uuidSchema,
  restaurantIdSchema,
  numericIdSchema,
  numericIdParamSchema,
  restaurantIdParamSchema,
  optionalRestaurantIdSchema,
  optionalNumericIdSchema,
  type UUID,
  type RestaurantId,
  type NumericId,
} from "./id-schemas";
