/**
 * Unified Timestamp Utilities
 *
 * Provides consistent timestamp generation across the application.
 * Replaces direct use of CURRENT_TIMESTAMP, new Date(), and manual date formatting.
 *
 * WHY: Cloudflare D1 doesn't support CURRENT_TIMESTAMP in SQL.
 * SOLUTION: Generate timestamps in application code before SQL execution.
 */

/**
 * Get current timestamp as ISO 8601 string
 * Format: YYYY-MM-DDTHH:mm:ss.sssZ
 *
 * Use this for:
 * - createdAt fields
 * - updatedAt fields
 * - Any timestamp storage in database
 *
 * @returns ISO 8601 formatted timestamp string
 *
 * @example
 * const now = getCurrentTimestamp()
 * // "2025-11-10T08:30:45.123Z"
 *
 * db.insert(users).values({
 *   username: 'john',
 *   createdAt: now,
 *   updatedAt: now
 * })
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get current timestamp as Unix epoch (seconds)
 *
 * Use this for:
 * - TTL calculations
 * - Expiration times
 * - Performance measurements
 *
 * @returns Unix timestamp in seconds
 *
 * @example
 * const expiresAt = getUnixTimestamp() + 3600 // 1 hour from now
 */
export function getUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current timestamp as Unix epoch (milliseconds)
 *
 * Use this for:
 * - High-precision timing
 * - Performance metrics
 * - Event ordering
 *
 * @returns Unix timestamp in milliseconds
 *
 * @example
 * const startTime = getUnixTimestampMs()
 * // ... do work ...
 * const duration = getUnixTimestampMs() - startTime
 */
export function getUnixTimestampMs(): number {
  return Date.now();
}

/**
 * Convert ISO timestamp to Unix epoch (seconds)
 *
 * @param isoTimestamp - ISO 8601 formatted string
 * @returns Unix timestamp in seconds
 *
 * @example
 * const timestamp = "2025-11-10T08:30:45.123Z"
 * const unix = isoToUnix(timestamp)
 * // 1731225045
 */
export function isoToUnix(isoTimestamp: string): number {
  return Math.floor(new Date(isoTimestamp).getTime() / 1000);
}

/**
 * Convert Unix epoch to ISO timestamp
 *
 * @param unixTimestamp - Unix timestamp in seconds
 * @returns ISO 8601 formatted string
 *
 * @example
 * const unix = 1731225045
 * const iso = unixToIso(unix)
 * // "2025-11-10T08:30:45.000Z"
 */
export function unixToIso(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toISOString();
}

/**
 * Get timestamp for a past/future time
 *
 * @param offsetMs - Milliseconds to add (positive) or subtract (negative)
 * @returns ISO 8601 formatted timestamp string
 *
 * @example
 * // 1 hour ago
 * const oneHourAgo = getTimestampOffset(-60 * 60 * 1000)
 *
 * // 30 days from now
 * const futureDate = getTimestampOffset(30 * 24 * 60 * 60 * 1000)
 */
export function getTimestampOffset(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/**
 * Check if a timestamp is expired
 *
 * @param timestamp - ISO 8601 formatted string or Unix seconds
 * @returns true if timestamp is in the past
 *
 * @example
 * const expired = isExpired("2025-11-09T08:30:45.123Z")
 * // true (if current date is after this)
 *
 * const expiredUnix = isExpired(1731225045)
 * // true (if current time is after this)
 */
export function isExpired(timestamp: string | number): boolean {
  if (typeof timestamp === "string") {
    return new Date(timestamp).getTime() < Date.now();
  }
  return timestamp * 1000 < Date.now();
}

/**
 * Format ISO timestamp for display
 *
 * @param isoTimestamp - ISO 8601 formatted string
 * @param locale - Locale code (default: 'en-US')
 * @returns Human-readable formatted string
 *
 * @example
 * const timestamp = "2025-11-10T08:30:45.123Z"
 *
 * formatTimestamp(timestamp)
 * // "11/10/2025, 8:30:45 AM"
 *
 * formatTimestamp(timestamp, 'zh-TW')
 * // "2025/11/10 上午8:30:45"
 */
export function formatTimestamp(
  isoTimestamp: string,
  locale: string = "en-US",
): string {
  return new Date(isoTimestamp).toLocaleString(locale);
}

/**
 * Calculate time difference in seconds
 *
 * @param start - Start timestamp (ISO or Unix)
 * @param end - End timestamp (ISO or Unix), defaults to now
 * @returns Difference in seconds
 *
 * @example
 * const start = "2025-11-10T08:00:00.000Z"
 * const end = "2025-11-10T08:30:00.000Z"
 * const diff = getTimeDifference(start, end)
 * // 1800 (30 minutes)
 */
export function getTimeDifference(
  start: string | number,
  end?: string | number,
): number {
  const startMs =
    typeof start === "string" ? new Date(start).getTime() : start * 1000;

  const endMs = end
    ? typeof end === "string"
      ? new Date(end).getTime()
      : end * 1000
    : Date.now();

  return Math.floor((endMs - startMs) / 1000);
}

/**
 * Common time offset constants (in milliseconds)
 */
export const TIME_OFFSET = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  ONE_YEAR: 365 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Common time offset constants (in seconds)
 */
export const TIME_OFFSET_SECONDS = {
  ONE_SECOND: 1,
  ONE_MINUTE: 60,
  ONE_HOUR: 60 * 60,
  ONE_DAY: 24 * 60 * 60,
  ONE_WEEK: 7 * 24 * 60 * 60,
  ONE_MONTH: 30 * 24 * 60 * 60,
  ONE_YEAR: 365 * 24 * 60 * 60,
} as const;
