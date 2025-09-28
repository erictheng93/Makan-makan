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

// User Roles (from CLAUDE.md)
export const USER_ROLES = {
  ADMIN: 0,
  SHOP_OWNER: 1,
  CHEF: 2,
  SERVICE_CREW: 3,
  CASHIER: 4
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

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