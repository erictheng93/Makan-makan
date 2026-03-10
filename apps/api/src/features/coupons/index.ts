/**
 * Coupons Feature Module
 *
 * This module handles all coupon and discount functionality including:
 * - Coupon creation, editing, and management
 * - Coupon validation and application
 * - Discount calculation and enforcement
 * - Usage tracking and analytics
 * - Coupon templates and bulk operations
 * - Promotional campaign management
 */

import routes from "./routes";
export { routes };
export { default as couponsRoutes } from "./routes";
export * from "./services/CouponsService";
export * from "./types";
export * from "./schemas/validation";

export default {
  routes,
};
