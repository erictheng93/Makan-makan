/**
 * @makanmakan/utils
 *
 * Shared utilities for MakanMakan platform
 */
// Request deduplication
export { RequestDeduplicator, getDeduplicator, resetDeduplicator, deduplicate, withDeduplication, batchDedupe, } from "./request-deduplication";
// Axios deduplication interceptor
export { installAxiosDeduplication, skipDedup, withDedupTTL, combineConfigs, } from "./axios-deduplication-interceptor";
// Error tracking
export { ErrorTracker, getErrorTracker, resetErrorTracker, } from "./error-tracking";
// Performance monitoring
export { PerformanceMonitor, getPerformanceMonitor, resetPerformanceMonitor, } from "./performance-monitor";
// UUID utilities
export { generateUUID, isValidUUID, extractUUIDTimestamp } from "./uuid";
// Validation schemas
export { uuidSchema, restaurantIdSchema, numericIdSchema, numericIdParamSchema, restaurantIdParamSchema, optionalRestaurantIdSchema, optionalNumericIdSchema, } from "./validation";
// Timestamp utilities
export { ensureMilliseconds, ensureSeconds, nowMs, nowSeconds, toMs, toSeconds, fromMs, fromSeconds, isMilliseconds, isSeconds, } from "./timestamp";
