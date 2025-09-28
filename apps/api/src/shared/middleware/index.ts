/**
 * Shared Middleware
 * Re-export middleware functions for use across all feature modules
 */

// Re-export existing middleware
export * from '../../middleware/auth'
export * from '../../middleware/validation'

// Placeholder for future shared middleware
export type { MiddlewareHandler } from 'hono'