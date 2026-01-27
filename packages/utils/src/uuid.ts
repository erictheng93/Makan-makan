/**
 * UUID v7 Utilities
 *
 * UUID v7 is time-sortable and globally unique, making it ideal for distributed systems.
 * - Time-sortable: preserves insertion order
 * - Globally unique: safe for distributed systems
 * - Non-enumerable: more secure than sequential IDs
 * - Standard format: no custom validation needed
 */

import { v7 as uuidv7 } from "uuid";

/**
 * Generates a new UUID v7
 * UUID v7 includes a timestamp component, making it time-sortable
 * @returns A new UUID v7 string
 */
export const generateUUID = (): string => uuidv7();

/**
 * Validates whether a string is a valid UUID format
 * Supports UUID v1-v7 (standard 8-4-4-4-12 format)
 * @param id - The string to validate
 * @returns true if the string is a valid UUID
 */
export const isValidUUID = (id: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Legacy restaurant ID format pattern (S-YYYYMMDD-NNN)
 */
const LEGACY_RESTAURANT_ID_PATTERN = /^S-\d{8}-\d{3}$/;

/**
 * Validates a restaurant ID (backward compatible during migration)
 * Accepts both UUID v7 and legacy S-YYYYMMDD-NNN format
 * @param id - The restaurant ID to validate
 * @returns true if the ID is valid (either UUID or legacy format)
 */
export const isValidRestaurantId = (id: string): boolean => {
  return isValidUUID(id) || LEGACY_RESTAURANT_ID_PATTERN.test(id);
};

/**
 * Checks if a restaurant ID is in the legacy format
 * @param id - The restaurant ID to check
 * @returns true if the ID is in legacy S-YYYYMMDD-NNN format
 */
export const isLegacyRestaurantId = (id: string): boolean => {
  return LEGACY_RESTAURANT_ID_PATTERN.test(id);
};

/**
 * Extracts the timestamp from a UUID v7
 * UUID v7 contains a Unix timestamp in the first 48 bits
 * @param uuid - The UUID v7 string
 * @returns Date object or null if invalid
 */
export const extractUUIDTimestamp = (uuid: string): Date | null => {
  if (!isValidUUID(uuid)) {
    return null;
  }

  try {
    // UUID v7 stores timestamp in first 48 bits (12 hex chars)
    const hexTimestamp = uuid.replace(/-/g, "").substring(0, 12);
    const timestamp = parseInt(hexTimestamp, 16);
    return new Date(timestamp);
  } catch {
    return null;
  }
};
