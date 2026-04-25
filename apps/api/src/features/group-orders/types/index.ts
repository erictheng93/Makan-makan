/**
 * Group Orders Types
 * TypeScript type definitions for the group orders feature
 */

import type { BaseEntity } from "../../../shared/types";

// Core Group Order Types
export interface GroupOrder extends BaseEntity {
  groupOrderId: string;
  restaurantId: string;
  tableId?: number;
  shareCode: string;
  createdBy: number;
  status: GroupOrderStatus;
  expiresAt: Date;
  maxMembers: number;
  permissions: GroupOrderPermissions;
  totalAmount: number;
  finalizedAt?: Date;
  paidAt?: Date;
}

export interface GroupOrderMember extends BaseEntity {
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

export interface GroupOrderCartItem extends BaseEntity {
  itemId: string;
  groupOrderId: string;
  memberId: string;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations: Record<string, unknown>;
  specialInstructions?: string;
}

// Enums
export type GroupOrderStatus =
  | "active" // 活躍，可以加入和修改
  | "locked" // 鎖定，不能修改但可以付款
  | "finalized" // 最終確認，準備下單
  | "completed" // 已完成
  | "cancelled" // 已取消
  | "expired"; // 已過期

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
  maxMembers?: number;
  permissions?: Partial<GroupOrderPermissions>;
}

export interface CreateGroupOrderResponse {
  groupOrderId: string;
  shareCode: string;
  expiresAt: Date;
  host: GroupOrderMember;
}

export interface JoinGroupRequest {
  memberName: string;
  phone?: string;
  email?: string;
}

export interface JoinGroupResponse {
  member: GroupOrderMember;
  groupOrder: GroupOrder;
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

export interface GroupOrderActivity extends BaseEntity {
  activityId: string;
  groupOrderId: string;
  memberId?: string;
  memberName?: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
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
  | "order_cancelled";

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
    hostId: number,
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
