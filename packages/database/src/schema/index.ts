// 匯出所有 schema 定義
export * from "./restaurants";
export * from "./users";
export * from "./customers";
export * from "./categories";
export * from "./menu-items";
export * from "./tables";
export * from "./seats";
export * from "./orders";
export * from "./order-items";
export * from "./sessions";
export * from "./audit-logs";
export * from "./error-reports";
export * from "./qr-codes";
export * from "./images";
export * from "./coupons";
export * from "./leaves";
export * from "./scheduling";
export * from "./pos";
export * from "./group-orders";
export * from "./partnerships";
export * from "./verification";
export * from "./platform-integrations";
export * from "./platform-orders";
export * from "./platform-menu-mappings";
export * from "./platform-webhook-logs";
export * from "./forecast";

// 匯出所有關聯定義
export { restaurantRelations } from "./restaurants";
export { userRelations } from "./users";
export { customersRelations } from "./customers";
export { categoryRelations } from "./categories";
export { menuItemRelations } from "./menu-items";
export { tableRelations } from "./tables";
export { seatRelations } from "./seats";
export { orderRelations } from "./orders";
export { orderItemRelations } from "./order-items";
export { sessionRelations } from "./sessions";
export { auditLogRelations } from "./audit-logs";
export { errorReportsRelations, systemAlertsRelations } from "./error-reports";
export {
  couponsRelations,
  couponUsageRelations,
  couponDistributionsRelations,
  couponTemplatesRelations,
} from "./coupons";
export {
  leaveTypesRelations,
  employeeLeaveBalancesRelations,
  leaveRequestsRelations,
  leaveApprovalRulesRelations,
  leaveCalendarEventsRelations,
} from "./leaves";
export {
  shiftTemplatesRelations,
  employeeSchedulesRelations,
  schedulingRulesRelations,
  schedulingConflictsRelations,
  scheduleSwapRequestsRelations,
  employeeAvailabilityRelations,
} from "./scheduling";
export {
  cashRegistersRelations,
  cashShiftsRelations,
  cashMovementsRelations,
  receiptsRelations,
  refundsRelations,
  shiftReportsRelations,
} from "./pos";
export {
  groupOrdersRelations,
  groupMembersRelations,
  groupCartItemsRelations,
  splitBillsRelations,
  shareCodesRelations,
  groupActivityLogsRelations,
} from "./group-orders";
export {
  partnershipsRelations,
  partnershipPlansRelations,
  verifiedMembersRelations,
  partnershipUsageLogsRelations,
} from "./partnerships";
export {
  passwordResetTokenRelations,
  emailVerificationTokenRelations,
  phoneVerificationTokenRelations,
  passwordChangeLogRelations,
} from "./verification";
export { platformIntegrationsRelations } from "./platform-integrations";
export { platformOrdersRelations } from "./platform-orders";
export { platformMenuMappingsRelations } from "./platform-menu-mappings";
export {
  forecastCacheRelations,
  ingredientDefinitionsRelations,
  menuItemIngredientsRelations,
} from "./forecast";

// 重新匯出類型
export type { UserRole } from "./users";
export type { OrderStatus, PaymentMethod } from "./orders";
export type { AuditAction } from "./audit-logs";
export type {
  DiscountType,
  DistributionType,
  TargetType,
  UsageStatus,
} from "./coupons";
export type {
  PartnerType,
  VerificationMethod,
  PartnershipStatus,
  MemberType,
  MemberStatus,
  PlanDiscountType,
  UsageLogStatus,
  UsageChannel,
} from "./partnerships";

// 匯出常數
export { USER_ROLES } from "./users";
export { ORDER_STATUS, PAYMENT_METHODS } from "./orders";
export { AUDIT_ACTIONS } from "./audit-logs";
export { ERROR_TYPES, SEVERITY_LEVELS, ALERT_TYPES } from "./error-reports";
export {
  DISCOUNT_TYPE,
  DISTRIBUTION_TYPE,
  TARGET_TYPE,
  USAGE_STATUS,
} from "./coupons";
export {
  PARTNER_TYPES,
  VERIFICATION_METHODS,
  PARTNERSHIP_STATUS,
  MEMBER_TYPES,
  MEMBER_STATUS,
  PLAN_DISCOUNT_TYPES,
  USAGE_LOG_STATUS,
  USAGE_CHANNELS,
} from "./partnerships";
export { PLATFORM_TYPES, MENU_SYNC_STATUS } from "./platform-integrations";
export type { PlatformType, MenuSyncStatus } from "./platform-integrations";
export { MENU_MAPPING_SYNC_STATUS } from "./platform-menu-mappings";
export type { MenuMappingSyncStatus } from "./platform-menu-mappings";
export { WEBHOOK_LOG_STATUS } from "./platform-webhook-logs";
export type { WebhookLogStatus } from "./platform-webhook-logs";
