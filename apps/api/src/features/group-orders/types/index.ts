/**
 * Group Orders Types
 * TypeScript type definitions for the group orders feature
 */

import type { BaseEntity } from "../../../shared/types";
import type {
  CartItemCustomizations,
  GroupActivityMetadata,
} from "@makanmakan/shared-types";

// Core Group Order Types
export interface GroupOrder extends Omit<BaseEntity, "id"> {
  // Group order tables use TEXT UUID primary keys, not numeric ids.
  id: string;
  groupOrderId: string;
  restaurantId: string;
  tableId?: number;
  shareCode: string;
  createdBy: string | null;
  status: GroupOrderStatus;
  expiresAt: Date;
  maxMembers: number;
  permissions: GroupOrderPermissions;
  totalAmount: number;
  finalizedAt?: Date;
  paidAt?: Date;
}

export interface GroupOrderMember extends Omit<BaseEntity, "id"> {
  // UUID primary key (see GroupOrder.id).
  id: string;
  memberId: string;
  groupOrderId: string;
  memberName: string;
  phone?: string;
  email?: string;
  isHost: boolean;
  joinedAt: Date;
  leftAt?: Date;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
}

export interface GroupOrderCartItem extends Omit<BaseEntity, "id"> {
  // UUID primary key (see GroupOrder.id).
  id: string;
  itemId: string;
  groupOrderId: string;
  memberId: string;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitPriceCents?: number | null;
  totalPriceCents?: number | null;
  customizations: CartItemCustomizations;
  specialInstructions?: string;
}

// Enums

/**
 * The only status values `group_orders.status` is ever written with.
 *
 * `"locked"`, `"finalized"` and `"expired"` were removed: nothing ever wrote
 * them, and a status type that lists values the service cannot produce sends
 * every reader looking for handling that doesn't exist. `"ordering"` was in
 * the same category — read in two places, written nowhere — and was removed
 * from those reads rather than added here (production `group_orders` was
 * confirmed empty, so no row carries it).
 */
export const GROUP_ORDER_STATUSES = [
  "active", // 活躍，可以加入和修改
  "finalizing", // 正在轉成真實訂單，作為 finalize 互斥鎖
  "finalizing_failed", // 真實訂單已成立但分帳/收斂失敗，需人工介入
  "checkout", // 分帳中，已鎖定不能再改購物車
  "completed", // 已完成
  "cancelled", // 已取消
] as const;

export type GroupOrderStatus = (typeof GROUP_ORDER_STATUSES)[number];

/**
 * Narrow a raw `group_orders.status` string from the database.
 *
 * The column is plain `text`, so a bare `as GroupOrderStatus` compiles no
 * matter what the row actually holds — the assertion would simply lie. This
 * checks, and callers decide what to do with an unexpected value.
 */
export function parseGroupOrderStatus(
  value: string,
): GroupOrderStatus | undefined {
  return (GROUP_ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as GroupOrderStatus)
    : undefined;
}

export type PaymentStatus =
  | "pending" // 等待付款
  | "partial" // 部分付款
  | "paid" // 已付款
  | "refunded"; // 已退款

export interface GroupOrderPermissions {
  canInviteMembers: boolean;
  canModifyOthersCart: boolean;
  canFinalizeOrder: boolean;
  canSplitBill: boolean;
  canProcessPayment: boolean;
}

// Request/Response Types
export interface CreateGroupOrderRequest {
  restaurantId: string;
  tableId?: number;
  expirationHours?: number;
  expirationMinutes?: number;
  maxMembers?: number;
  expectedMembers?: number;
  hostName?: string;
  notes?: string;
  tableNumber?: string;
  permissions?: Partial<GroupOrderPermissions>;
  fulfillmentType?: "dine_in" | "delivery" | "pickup";
  deliveryAddress?: {
    line1: string;
    line2?: string;
    contactPhone?: string;
    notes?: string;
  };
  pickupAt?: string;
  autoSubmitOnExpiry?: boolean;
}

export interface CreateGroupOrderResponse {
  groupOrderId: string;
  shareCode: string;
  expiresAt: Date;
  host: GroupOrderMember;
  /**
   * The host's own membership credential (`group_members.session_id`).
   *
   * Secret, and returned exactly once — to the caller who created the group.
   * It is the proof exchanged at POST /realtime/auth/group-token for a realtime
   * token. Never put it on `GroupOrderMember`: that type is used for member
   * *listings*, which would hand every member everyone else's credential.
   */
  memberToken: string;
  recoveryCode: string;
}

export interface GroupOrderJoinPreview {
  groupOrderId: string;
  restaurantId: string;
  hostName: string;
  memberCount: number;
  fulfillmentType: "dine_in" | "delivery" | "pickup";
  expiresAt: Date;
  status: GroupOrderStatus;
}

export interface JoinGroupRequest {
  memberName: string;
  phone?: string;
  email?: string;
}

export interface JoinGroupResponse {
  member: GroupOrderMember;
  groupOrder: GroupOrder;
  /** See CreateGroupOrderResponse.memberToken — secret, returned once. */
  memberToken: string;
}

export interface AddCartItemRequest {
  memberId: string;
  menuItemId: number;
  quantity: number;
  customizations?: Record<string, unknown>;
  specialInstructions?: string;
}

export interface UpdateCartItemRequest {
  quantity?: number;
  customizations?: Record<string, unknown>;
  specialInstructions?: string;
}

export interface SplitBillRequest {
  splitType: "equal" | "proportional" | "individual" | "by_item" | "custom";
  serviceChargeRate?: number;
  taxRate?: number;
  sharedServiceChargeCents?: number;
  sharedTaxCents?: number;
  orderTotalCents?: number;
  customSplits?: Array<{
    memberId: string;
    amount: number;
    items: unknown[];
  }>;
  customAmounts?: Array<{
    memberId: string;
    amount: number;
  }>;
}

export interface ProcessPaymentRequest {
  paymentMethod: string;
  amount?: number; // Optional - will use amount from split_bills if not provided
  transactionId?: string;
  paymentDetails?: Record<string, unknown>; // Additional payment details (card info, etc.)
}

// Response Types
export interface GroupOrderSummary {
  groupOrder: GroupOrder;
  members: GroupOrderMember[];
  cartItems: (GroupOrderCartItem & {
    menuItem: {
      id: number;
      name: string;
      price: number;
      imageUrl?: string;
    };
  })[];
  totalAmount: number;
  activities: GroupOrderActivity[];
}

export interface GroupOrderActivity extends Omit<BaseEntity, "id"> {
  // UUID primary key (see GroupOrder.id).
  id: string;
  activityId: string;
  groupOrderId: string;
  memberId?: string;
  memberName?: string;
  type: ActivityType;
  description: string;
  metadata?: GroupActivityMetadata;
  timestamp: Date;
}

export type ActivityType =
  | "group_created"
  | "member_joined"
  | "member_left"
  | "item_added"
  | "item_updated"
  | "item_removed"
  | "bill_split"
  | "payment_made"
  | "order_finalized"
  | "order_cancelled"
  | "group_expired";

// Statistics and Analytics
export interface GroupOrderStatistics {
  totalGroupOrders: number;
  activeGroupOrders: number;
  averageGroupSize: number;
  averageOrderValue: number;
  popularTimeSlots: Array<{
    hour: number;
    count: number;
  }>;
  conversionRate: number;
  paymentMethodDistribution: Record<string, number>;
}

// Service Interface
export interface IGroupOrderService {
  // Core operations
  createGroupOrder(
    data: CreateGroupOrderRequest,
    hostId: string | null,
  ): Promise<{
    success: boolean;
    data?: CreateGroupOrderResponse;
    error?: string;
  }>;
  joinGroup(
    shareCode: string,
    memberData: JoinGroupRequest,
  ): Promise<{ success: boolean; data?: JoinGroupResponse; error?: string }>;
  getGroupOrder(groupOrderId: string): Promise<GroupOrderSummary | null>;

  // Cart operations
  addCartItem(
    groupOrderId: string,
    itemData: AddCartItemRequest,
  ): Promise<{ success: boolean; data?: GroupOrderCartItem; error?: string }>;
  updateCartItem(
    groupOrderId: string,
    itemId: string,
    updateData: UpdateCartItemRequest,
  ): Promise<{ success: boolean; data?: GroupOrderCartItem; error?: string }>;
  removeCartItem(
    groupOrderId: string,
    itemId: string,
    memberId: string,
  ): Promise<{ success: boolean; error?: string }>;

  // Bill and payment operations
  splitBill(
    groupOrderId: string,
    splitData: SplitBillRequest,
  ): Promise<{ success: boolean; data?: unknown; error?: string }>;
  finalizeGroupOrder(groupOrderId: string): Promise<{
    success: boolean;
    data?: { masterOrderId: string; status: "completed" };
    error?: string;
  }>;
  processPayment(
    groupOrderId: string,
    memberId: string,
    paymentData: ProcessPaymentRequest,
  ): Promise<{ success: boolean; data?: unknown; error?: string }>;

  // Group management
  leaveGroup(
    groupOrderId: string,
    memberId: string,
  ): Promise<{ success: boolean; error?: string }>;
  getActivities(groupOrderId: string): Promise<GroupOrderActivity[]>;

  // Maintenance
  cleanupExpiredGroups(): Promise<{ cleaned: number; errors: string[] }>;

  // Statistics
  getStatistics(
    restaurantId?: string,
    timeRange?: string,
  ): Promise<GroupOrderStatistics>;
}

// Error Types
export interface GroupOrderError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export const GROUP_ORDER_ERROR_CODES = {
  GROUP_NOT_FOUND: "GROUP_NOT_FOUND",
  GROUP_EXPIRED: "GROUP_EXPIRED",
  GROUP_FULL: "GROUP_FULL",
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",
  MEMBER_ALREADY_EXISTS: "MEMBER_ALREADY_EXISTS",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  INVALID_SHARE_CODE: "INVALID_SHARE_CODE",
  CART_ITEM_NOT_FOUND: "CART_ITEM_NOT_FOUND",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  GROUP_LOCKED: "GROUP_LOCKED",
  GROUP_FINALIZED: "GROUP_FINALIZED",
} as const;

export type GroupOrderErrorCode =
  (typeof GROUP_ORDER_ERROR_CODES)[keyof typeof GROUP_ORDER_ERROR_CODES];

// Events for real-time updates
export type GroupOrderEvent =
  | {
      type: "GROUP_CREATED";
      payload: { groupOrderId: string; shareCode: string };
    }
  | {
      type: "MEMBER_JOINED";
      payload: { groupOrderId: string; member: GroupOrderMember };
    }
  | { type: "MEMBER_LEFT"; payload: { groupOrderId: string; memberId: string } }
  | {
      type: "CART_UPDATED";
      payload: {
        groupOrderId: string;
        item: GroupOrderCartItem;
        action: "added" | "updated" | "removed";
      };
    }
  | {
      type: "BILL_SPLIT";
      payload: { groupOrderId: string; splitData: unknown };
    }
  | {
      type: "PAYMENT_MADE";
      payload: { groupOrderId: string; memberId: string; amount: number };
    }
  | {
      type: "ORDER_FINALIZED";
      payload: { groupOrderId: string; totalAmount: number };
    }
  | {
      type: "ORDER_CANCELLED";
      payload: { groupOrderId: string; reason: string };
    };
