/**
 * Restaurant ID Generator
 * Generates UUID v7 for restaurant identification
 */

import { v7 as uuidv7 } from "uuid";

// UUID regex pattern
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RestaurantIdGenerator {
  /**
   * Generate a new restaurant ID using UUID v7
   * UUID v7 is time-sortable and globally unique
   * @returns UUID v7 string
   */
  generateId(): string {
    return uuidv7();
  }

  /**
   * Validate if a string is a valid restaurant ID (UUID format)
   * @param id - The ID to validate
   * @returns true if valid UUID
   */
  static validateFormat(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  /**
   * Extract timestamp from UUID v7
   * UUID v7 encodes creation timestamp in the first 48 bits
   * @param uuid - UUID v7 string
   * @returns Date object or null if not a valid UUID
   */
  static extractTimestamp(uuid: string): Date | null {
    if (!UUID_REGEX.test(uuid)) {
      return null;
    }

    // UUID v7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
    // First 48 bits (12 hex chars) contain Unix timestamp in milliseconds
    const hex = uuid.replace(/-/g, "").substring(0, 12);
    const timestamp = parseInt(hex, 16);

    return new Date(timestamp);
  }
}

/**
 * Usage Examples:
 *
 * const generator = new RestaurantIdGenerator();
 * const id = generator.generateId();
 * // Returns: "019416c4-e9b0-7000-8000-000000000000"
 *
 * // Validation
 * RestaurantIdGenerator.validateFormat("019416c4-e9b0-7000-8000-000000000000"); // true
 * RestaurantIdGenerator.validateFormat("INVALID"); // false
 *
 * // Extract timestamp from UUID v7
 * const date = RestaurantIdGenerator.extractTimestamp("019416c4-e9b0-7000-8000-000000000000");
 */
