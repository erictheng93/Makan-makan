/**
 * @makanmakan/utils
 *
 * Shared utilities for MakanMakan platform
 */
export { RequestDeduplicator, getDeduplicator, resetDeduplicator, deduplicate, withDeduplication, batchDedupe, type RequestCacheEntry, type RequestDeduplicationOptions, } from "./request-deduplication";
export { installAxiosDeduplication, skipDedup, withDedupTTL, combineConfigs, } from "./axios-deduplication-interceptor";
export { ErrorTracker, getErrorTracker, resetErrorTracker, type ErrorSeverity, type ErrorCategory, type ErrorContext, type ErrorBreadcrumb, type TrackedError, type ErrorTrackingOptions, } from "./error-tracking";
export { PerformanceMonitor, getPerformanceMonitor, resetPerformanceMonitor, type PerformanceMetric, type WebVitals, type ResourceTiming, type PerformanceReport, type PerformanceMonitorOptions, } from "./performance-monitor";
export { generateUUID, isValidUUID, extractUUIDTimestamp } from "./uuid";
export { uuidSchema, restaurantIdSchema, numericIdSchema, numericIdParamSchema, restaurantIdParamSchema, optionalRestaurantIdSchema, optionalNumericIdSchema, type UUID, type RestaurantId, type NumericId, } from "./validation";
export { ensureMilliseconds, ensureSeconds, nowMs, nowSeconds, toMs, toSeconds, fromMs, fromSeconds, isMilliseconds, isSeconds, } from "./timestamp";
