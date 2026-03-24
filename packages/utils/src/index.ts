/**
 * @makanmakan/utils
 *
 * Shared utilities for MakanMakan platform
 */

// Request deduplication
export {
  RequestDeduplicator,
  getDeduplicator,
  resetDeduplicator,
  deduplicate,
  withDeduplication,
  batchDedupe,
  type RequestCacheEntry,
  type RequestDeduplicationOptions,
} from "./request-deduplication";

// Axios deduplication interceptor
export {
  installAxiosDeduplication,
  skipDedup,
  withDedupTTL,
  combineConfigs,
} from "./axios-deduplication-interceptor";

// Error tracking
export {
  ErrorTracker,
  getErrorTracker,
  resetErrorTracker,
  type ErrorSeverity,
  type ErrorCategory,
  type ErrorContext,
  type ErrorBreadcrumb,
  type TrackedError,
  type ErrorTrackingOptions,
} from "./error-tracking";

// Performance monitoring
export {
  PerformanceMonitor,
  getPerformanceMonitor,
  resetPerformanceMonitor,
  type PerformanceMetric,
  type WebVitals,
  type ResourceTiming,
  type PerformanceReport,
  type PerformanceMonitorOptions,
} from "./performance-monitor";

// UUID utilities
export { generateUUID, isValidUUID, extractUUIDTimestamp } from "./uuid";

// Validation schemas
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
} from "./validation";

// Timestamp utilities
export {
  ensureMilliseconds,
  ensureSeconds,
  nowMs,
  nowSeconds,
  toMs,
  toSeconds,
  fromMs,
  fromSeconds,
  isMilliseconds,
  isSeconds,
} from "./timestamp";

// Encryption utilities
export { encrypt, decrypt } from "./encryption";

// API Error utilities
export {
  ApiError,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
} from "./api-error";

// Currency utilities
export {
  formatCurrency,
  getCurrencySymbol,
  getCurrencyConfig,
  CURRENCY_CONFIGS,
  DEFAULT_CURRENCY,
  type CurrencyFormatConfig,
  type CurrencyCode,
} from "./currency";

// Token utilities
export {
  decodeJwtPayload,
  isTokenExpired,
  getRefreshDelay,
  getTimeUntilExpiry,
} from "./token";
