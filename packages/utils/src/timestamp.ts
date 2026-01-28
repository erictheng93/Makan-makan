/**
 * Timestamp Utilities
 *
 * Utility functions for handling timestamps in the MakanMakan platform.
 * All timestamps should be stored in milliseconds (timestamp_ms mode in Drizzle).
 */

/**
 * Threshold for distinguishing between seconds and milliseconds.
 * Timestamps below this value (2001-09-09) are assumed to be in seconds.
 */
const SECONDS_THRESHOLD = 1e12;

/**
 * Ensures a timestamp is in milliseconds format.
 * If the input appears to be in seconds (< 1e12), it will be converted to milliseconds.
 *
 * @param timestamp - The timestamp value (could be seconds or milliseconds)
 * @returns The timestamp in milliseconds
 *
 * @example
 * ensureMilliseconds(1609459200) // Returns 1609459200000 (seconds to ms)
 * ensureMilliseconds(1609459200000) // Returns 1609459200000 (already ms)
 */
export function ensureMilliseconds(timestamp: number): number {
  return timestamp < SECONDS_THRESHOLD ? timestamp * 1000 : timestamp;
}

/**
 * Ensures a timestamp is in seconds format.
 * If the input appears to be in milliseconds (>= 1e12), it will be converted to seconds.
 *
 * @param timestamp - The timestamp value (could be seconds or milliseconds)
 * @returns The timestamp in seconds
 *
 * @example
 * ensureSeconds(1609459200000) // Returns 1609459200 (ms to seconds)
 * ensureSeconds(1609459200) // Returns 1609459200 (already seconds)
 */
export function ensureSeconds(timestamp: number): number {
  return timestamp >= SECONDS_THRESHOLD
    ? Math.floor(timestamp / 1000)
    : timestamp;
}

/**
 * Creates the current timestamp in milliseconds.
 *
 * @returns Current time as Unix timestamp in milliseconds
 *
 * @example
 * const now = nowMs() // Returns current timestamp like 1609459200000
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * Creates the current timestamp in seconds.
 *
 * @returns Current time as Unix timestamp in seconds
 *
 * @example
 * const now = nowSeconds() // Returns current timestamp like 1609459200
 */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Converts a Date object to milliseconds timestamp.
 *
 * @param date - The Date object to convert
 * @returns Unix timestamp in milliseconds
 *
 * @example
 * toMs(new Date('2021-01-01')) // Returns 1609459200000
 */
export function toMs(date: Date): number {
  return date.getTime();
}

/**
 * Converts a Date object to seconds timestamp.
 *
 * @param date - The Date object to convert
 * @returns Unix timestamp in seconds
 *
 * @example
 * toSeconds(new Date('2021-01-01')) // Returns 1609459200
 */
export function toSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Converts a milliseconds timestamp to a Date object.
 *
 * @param ms - Unix timestamp in milliseconds
 * @returns Date object
 *
 * @example
 * fromMs(1609459200000) // Returns Date object for 2021-01-01
 */
export function fromMs(ms: number): Date {
  return new Date(ms);
}

/**
 * Converts a seconds timestamp to a Date object.
 *
 * @param seconds - Unix timestamp in seconds
 * @returns Date object
 *
 * @example
 * fromSeconds(1609459200) // Returns Date object for 2021-01-01
 */
export function fromSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}

/**
 * Checks if a value appears to be a milliseconds timestamp.
 *
 * @param value - The value to check
 * @returns true if the value appears to be in milliseconds
 */
export function isMilliseconds(value: number): boolean {
  return value >= SECONDS_THRESHOLD;
}

/**
 * Checks if a value appears to be a seconds timestamp.
 *
 * @param value - The value to check
 * @returns true if the value appears to be in seconds
 */
export function isSeconds(value: number): boolean {
  return value < SECONDS_THRESHOLD;
}
