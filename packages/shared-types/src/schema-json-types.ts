/**
 * JSON Field Type Definitions for Database Schema
 * 用於 Drizzle ORM JSON 欄位的型別定義
 */

// ================================================
// Group Orders 相關類型
// ================================================

/**
 * Delivery address for a fulfillmentType: "delivery" group order.
 */
export interface GroupOrderDeliveryAddress {
  line1: string;
  line2?: string;
  contactPhone?: string;
  notes?: string;
}

/**
 * Recorded when a group order's real order was created but splitting the bill
 * afterwards failed, leaving the group in `finalizing_failed`.
 *
 * This is the payload a human needs to resolve that state by hand: the order
 * that already exists, and the two totals that disagreed. It lives in
 * `settings` rather than its own column because it is rare, unindexed, and
 * read only during manual intervention — but it is typed, because untyped
 * recovery data is data nobody can find when they need it.
 */
export interface GroupOrderFinalizeFailure {
  /** e.g. "SPLIT_TOTAL_MISMATCH", or "SPLIT_BILL_FAILED" when unclassified. */
  code: string;
  /** The real order that was already created — never discard this. */
  masterOrderId: string;
  orderTotalCents: number;
  serviceChargeCents: number;
  taxAmountCents: number;
  /** Present for SPLIT_TOTAL_MISMATCH: the two figures that disagreed. */
  expectedTotalCents?: number;
  roundedTotalCents?: number;
  splitError: string;
  /** ISO 8601. */
  failedAt: string;
  /** Diagnostics from later recovery attempts; the original failure stays intact. */
  recoveryErrorDetails?: Array<{
    code: string;
    splitError: string;
    expectedTotalCents?: number;
    roundedTotalCents?: number;
    attemptedAt: string;
  }>;
}

export const GROUP_ORDER_FEE_MODES = ["proportional", "equal", "host"] as const;

export type GroupOrderFeeMode = (typeof GROUP_ORDER_FEE_MODES)[number];

/**
 * Group order settings configuration
 */
export interface GroupOrderSettings {
  maxMembers?: number;
  allowLateJoin?: boolean;
  requireApproval?: boolean;
  expirationMinutes?: number;
  allowSplitBill?: boolean;
  defaultSplitType?: "equal" | "proportional" | "individual" | "custom";
  permissions?: {
    canInviteMembers?: boolean;
    canModifyOthersCart?: boolean;
    canFinalizeOrder?: boolean;
    canSplitBill?: boolean;
    canProcessPayment?: boolean;
  };
  notes?: string | null;
  tableNumber?: string | null;
  fulfillmentType?: "dine_in" | "delivery" | "pickup";
  deliveryAddress?: GroupOrderDeliveryAddress;
  pickupAt?: string;
  autoSubmitOnExpiry?: boolean;
  /**
   * Who carries the service charge and tax — a separate question from
   * `defaultSplitType`, which only divides the food.
   *
   * `proportional` charges each member on what they ordered, `equal` divides
   * the fees by headcount, `host` puts all of them on the host. Absent means
   * `proportional`: it is how every group order behaved before the host could
   * choose.
   */
  feeMode?: GroupOrderFeeMode;
  /** Set only when status is `finalizing_failed`. See the interface docs. */
  finalizeFailure?: GroupOrderFinalizeFailure;
  /**
   * ISO 8601. Written by the expiry sweep when the five-minute warning has
   * been sent, so a cron that runs every five minutes cannot warn the same
   * table repeatedly.
   */
  expiryWarningSentAt?: string;
}

/**
 * Group member permissions
 */
export interface GroupMemberPermissions {
  canAddItems?: boolean;
  canRemoveItems?: boolean;
  canModifyOthers?: boolean;
  canInitiateCheckout?: boolean;
  canInviteMembers?: boolean;
  canRemoveMembers?: boolean;
}

/**
 * Cart item customizations (modifications, add-ons, etc.)
 */
export interface CartItemCustomizations {
  modifiers?: Array<{
    id: string | number;
    name: string;
    price: number;
    quantity?: number;
  }>;
  addOns?: Array<{
    id: string | number;
    name: string;
    price: number;
    quantity?: number;
  }>;
  removedIngredients?: string[];
  size?: string;
  temperature?: "hot" | "cold" | "room";
  spiceLevel?: "none" | "mild" | "medium" | "hot" | "extra_hot";
}

/**
 * Split bill item reference
 */
export interface SplitBillItem {
  cartItemId: string;
  menuItemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * Share code metadata
 */
export interface ShareCodeMetadata {
  purpose?: string;
  restrictions?: string[];
  createdFrom?: "web" | "app" | "qr";
}

/**
 * Group activity log metadata
 */
export interface GroupActivityMetadata {
  itemId?: string;
  itemName?: string;
  quantity?: number;
  amount?: number;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  /** Unix ms. Recorded on `group_expired` activity by the expiry sweep. */
  expiredAt?: number;
}

// ================================================
// Partnerships 相關類型
// ================================================

/**
 * Partnership verification configuration
 */
export interface VerificationConfig {
  requiredFields?: string[];
  validationRules?: Record<string, string>;
  expirationDays?: number;
  autoApprove?: boolean;
  emailDomainValidation?: boolean;
  documentRequired?: boolean;
  maxVerificationAttempts?: number;
}

/**
 * Partnership order item for usage logging
 */
export interface PartnershipOrderItem {
  menuItemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  discountApplied: number;
  originalPrice: number;
  finalPrice: number;
}

/**
 * Partnership time slot configuration
 */
export interface PartnershipTimeSlot {
  start: string; // HH:MM format
  end: string; // HH:MM format
}
