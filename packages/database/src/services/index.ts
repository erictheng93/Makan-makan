// 匯出所有服務類別
export { BaseService } from "./base";
export { USER_ROLES } from "../schema";
export { RestaurantService } from "./restaurant";
export { MenuService } from "./menu";
export { OrderService } from "./order";
export { AuthService } from "./auth";
export { UserService } from "./user";
export { SessionService } from "./session";
export { TableService } from "./table";
export { SeatService } from "./seat";
export { AnalyticsService } from "./analytics";
export { ErrorReportingService } from "./error-reporting";
export { QRCodeService } from "./qrcode";
export { GroupOrderService } from "./GroupOrderService";
export { POSService } from "./POSService";
export { ImageService } from "./image";
export { CouponService } from "./coupon";
export { LeaveService } from "./LeaveService";
export { SchedulingService } from "./SchedulingService";
export type {
  ShiftTemplate,
  EmployeeSchedule,
  SchedulingConflict,
  ScheduleSwapRequest,
  ConflictCheckResult,
  ScheduleFilters,
  BulkScheduleData,
  ClockInData,
  ClockOutData,
} from "./SchedulingService";
export { ReservationService } from "./ReservationService";
export { WaitingListService } from "./WaitingListService";
export {
  CustomerWebPushService,
  type CustomerPushDispatchResult,
} from "./CustomerWebPushService";
export {
  NotificationService,
  type NotificationCategory,
  type NotificationPayload,
} from "./NotificationService";
export { ExportService } from "./ExportService";
export { LeaveAnalyticsService } from "./LeaveAnalyticsService";
// export { QueueService } from '@makanmakan/queue-service' // Temporarily disabled - using UnifiedQueueService
export { PartnershipService } from "./PartnershipService";
export { VerificationService } from "./VerificationService";
export { FeedbackService } from "./FeedbackService";
export { businessNumber, prefixedUuid } from "./id-generation";

// Realtime broadcast: bridge to apps/realtime Durable Object
export {
  RealtimeBroadcastService,
  type BroadcastResult,
} from "./RealtimeBroadcastService";

// Ticket-primitives: shared utilities for waiting-list and queue ticket flows
export {
  WAITING_TRANSITIONS,
  isValidWaitingTransition,
  assertWaitingTransition,
} from "./ticket-primitives";

// 匯出類型定義
export type { CreateRestaurantData, UpdateRestaurantData } from "./restaurant";

export type {
  CreateMenuItemData,
  UpdateMenuItemData,
  MenuFilters,
} from "./menu";

export type {
  CreateOrderData,
  UpdateOrderStatusData,
  OrderFilters,
} from "./order";

export type {
  CreateErrorReportData,
  ErrorReportFilters,
  ErrorStats,
} from "./error-reporting";

export type {
  CreateQRCodeData,
  CreateQRTemplateData,
  QRStyleData,
  QRCodeStats,
} from "./qrcode";

export type {
  GroupOrder,
  GroupMember,
  GroupCartItem,
  SplitBill,
  CreateGroupOrderRequest,
  CreateGroupOrderResponse,
  JoinGroupRequest,
  JoinGroupResponse,
} from "./GroupOrderService";

export type {
  CashRegister,
  CashShift,
  CashMovement,
  Receipt,
  Refund,
  CreateRegisterRequest,
  StartShiftRequest,
  EndShiftRequest,
  CashMovementRequest,
  PrintReceiptRequest,
  ProcessRefundRequest,
} from "./POSService";

export type {
  ImageAnalyticsOptions,
  StorageAnalytics,
  UsageAnalytics,
  PerformanceAnalytics,
  CreateImageData,
} from "./image";

export type {
  CouponValidationResult,
  CreateCouponData,
  UseCouponData,
  CouponFilters,
} from "./coupon";

export type {
  CreateTableData,
  UpdateTableData,
  TableFilters,
  QRCodeOptions,
  TableStats,
} from "./table";

export type {
  CreateSeatData,
  UpdateSeatData,
  SeatFilters,
  SeatNumberingOptions,
  SeatStats,
} from "./seat";

export type {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestWithRelations,
  LeaveBalanceWithType,
  CreateLeaveTypeData,
  UpdateLeaveTypeData,
  CreateLeaveRequestData,
  LeaveRequestFilters,
  LeaveBalanceAdjustment,
} from "./LeaveService";

export type {
  PartnershipFilters,
  PlanFilters,
  MemberFilters,
  PlanValidationResult,
  MemberVerificationRequest,
  UsageStatistics,
} from "./PartnershipService";

export type {
  CreateFeedbackData,
  FeedbackFilters,
  FeedbackStats,
} from "./FeedbackService";
