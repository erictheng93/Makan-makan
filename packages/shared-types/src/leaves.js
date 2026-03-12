/**
 * Leave Management Types
 * Shared type definitions for employee leave/time-off management
 */
// ========================================
// Enums & Constants
// ========================================
export const LEAVE_STATUSES = [
    "draft",
    "pending",
    "approved",
    "rejected",
    "cancelled",
    "withdrawn",
];
export const LEAVE_ACCRUAL_TYPES = [
    "yearly",
    "monthly",
    "per_service_year",
    "manual",
];
export const HALF_DAY_TYPES = ["morning", "afternoon"];
