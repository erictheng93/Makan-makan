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
