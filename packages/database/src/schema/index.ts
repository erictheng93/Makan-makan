// 匯出所有 schema 定義
export * from './restaurants'
export * from './users'
export * from './categories'
export * from './menu-items'
export * from './tables'
export * from './seats'
export * from './orders'
export * from './order-items'
export * from './sessions'
export * from './audit-logs'
export * from './error-reports'
export * from './qr-codes'
export * from './images'
export * from './coupons'
export * from './leaves'
export * from './scheduling'
export * from './verification'

// 匯出所有關聯定義
export { restaurantRelations } from './restaurants'
export { userRelations } from './users'
export { categoryRelations } from './categories'
export { menuItemRelations } from './menu-items'
export { tableRelations } from './tables'
export { seatRelations } from './seats'
export { orderRelations } from './orders'
export { orderItemRelations } from './order-items'
export { sessionRelations } from './sessions'
export { auditLogRelations } from './audit-logs'
export { errorReportsRelations, systemAlertsRelations } from './error-reports'
export { couponsRelations, couponUsageRelations, couponDistributionsRelations, couponTemplatesRelations } from './coupons'
export {
  leaveTypesRelations,
  employeeLeaveBalancesRelations,
  leaveRequestsRelations,
  leaveApprovalRulesRelations,
  leaveCalendarEventsRelations
} from './leaves'
export {
  shiftTemplatesRelations,
  employeeSchedulesRelations,
  schedulingRulesRelations,
  schedulingConflictsRelations,
  scheduleSwapRequestsRelations,
  employeeAvailabilityRelations
} from './scheduling'
export {
  passwordResetTokenRelations,
  emailVerificationTokenRelations,
  phoneVerificationTokenRelations,
  passwordChangeLogRelations
} from './verification'

// 重新匯出類型
export type { UserRole } from './users'
export type { OrderStatus, PaymentMethod } from './orders'
export type { AuditAction } from './audit-logs'
export type { DiscountType, DistributionType, TargetType, UsageStatus } from './coupons'

// 匯出常數
export { USER_ROLES } from './users'
export { ORDER_STATUS, PAYMENT_METHODS } from './orders'
export { AUDIT_ACTIONS } from './audit-logs'
export { ERROR_TYPES, SEVERITY_LEVELS, ALERT_TYPES } from './error-reports'
export { DISCOUNT_TYPE, DISTRIBUTION_TYPE, TARGET_TYPE, USAGE_STATUS } from './coupons'