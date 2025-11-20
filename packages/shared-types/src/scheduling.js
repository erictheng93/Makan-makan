/**
 * Employee Scheduling Types
 * Shared type definitions for employee work scheduling management
 */
// ========================================
// Enums & Constants
// ========================================
export const SHIFT_TYPES = ['regular', 'split', 'overnight'];
export const SCHEDULE_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
export const CONFLICT_TYPES = [
    'overlapping_shifts',
    'insufficient_rest',
    'max_hours_exceeded',
    'consecutive_days_exceeded',
    'skill_mismatch',
    'leave_conflict',
    'availability_conflict',
];
export const CONFLICT_SEVERITIES = ['error', 'warning', 'info'];
export const CONFLICT_STATUSES = ['unresolved', 'acknowledged', 'resolved', 'ignored'];
export const SWAP_REQUEST_TYPES = ['swap', 'cover', 'drop', 'open'];
export const SWAP_REQUEST_URGENCY = ['low', 'normal', 'high', 'urgent'];
export const SWAP_REQUEST_STATUSES = [
    'pending',
    'accepted',
    'approved',
    'rejected',
    'cancelled',
    'expired',
];
export const RULE_TYPES = [
    'max_hours_per_day',
    'max_hours_per_week',
    'min_rest_period',
    'max_consecutive_days',
    'skill_requirement',
    'availability_check',
];
export const AVAILABILITY_TYPES = ['preferred', 'unavailable', 'flexible'];
