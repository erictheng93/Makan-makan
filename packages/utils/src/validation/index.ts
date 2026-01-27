/**
 * Validation schemas index
 *
 * Re-exports all validation schemas for easy importing
 */

export {
  uuidSchema,
  restaurantIdSchema,
  restaurantIdSchemaCompat,
  numericIdSchema,
  numericIdParamSchema,
  restaurantIdParamSchema,
  restaurantIdParamSchemaCompat,
  optionalRestaurantIdSchema,
  optionalNumericIdSchema,
  type UUID,
  type RestaurantId,
  type NumericId,
} from "./id-schemas";
