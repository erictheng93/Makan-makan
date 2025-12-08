/**
 * Shared Constants
 * Application-wide constants and configuration
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
} as const

// User Roles - matches @makanmakan/shared-types UserRole enum
// Includes both shared-types naming (OWNER, SERVICE) and legacy naming (SHOP_OWNER, SERVICE_CREW)
export const USER_ROLES = {
  ADMIN: 0,
  OWNER: 1,
  SHOP_OWNER: 1,    // Alias for OWNER (legacy naming)
  CHEF: 2,
  SERVICE: 3,
  SERVICE_CREW: 3,  // Alias for SERVICE (legacy naming)
  CASHIER: 4,
  CUSTOMER: 5
} as const

export type UserRole = 0 | 1 | 2 | 3 | 4 | 5

// Common validation limits
export const VALIDATION_LIMITS = {
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  PHONE_MAX_LENGTH: 20,
  EMAIL_MAX_LENGTH: 255,
  MIN_PASSWORD_LENGTH: 6
} as const

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  SHORT: 300,    // 5 minutes
  MEDIUM: 1800,  // 30 minutes
  LONG: 3600     // 1 hour
} as const

// Feature module names
export const FEATURE_MODULES = {
  AUTH: 'auth',
  ORDERS: 'orders',
  MENU: 'menu',
  QR_CODES: 'qr-codes',
  ANALYTICS: 'analytics',
  TABLES: 'tables',
  USERS: 'users',
  PAYMENTS: 'payments'
} as const