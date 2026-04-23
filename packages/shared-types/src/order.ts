import { BaseEntity } from "./common";
import { MenuItem } from "./menu";

// Platform source for orders
export type PlatformSource = "direct" | "uber_eats" | "foodpanda" | "grabfood";

// Delivery/fulfillment information interface
export interface DeliveryInfo {
  type: "dine_in" | "takeaway" | "delivery";
  address?: string;
  phone?: string;
  instructions?: string;
  deliveryFee?: number;
  estimatedDeliveryTime?: number;
}

// Customer information interface
export interface CustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  preferences?: Record<string, unknown>;
}

// Table information interface
export interface TableInfo {
  id: number;
  number: string;
  seats: number;
  location?: string;
  qrCode?: string;
}

// Restaurant information interface
export interface RestaurantInfo {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  businessHours?: Record<string, unknown>;
}

// Customer profile interface
export interface CustomerProfile {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  address?: string;
  profileImageUrl?: string;
  preferences?: Record<string, unknown>;
}

// Order overrides BaseEntity's `createdAt`/`updatedAt` (declared as string there)
// to the Unix-ms integer wire contract. See packages/database/src/services/order.ts
// `toMillis` and apps/api/src/__tests__/integration/orders.real.integration.test.ts
// for the enforcement point.
export interface Order extends Omit<BaseEntity, "createdAt" | "updatedAt"> {
  restaurantId: string;
  tableId: number;
  customerId?: number;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerInfo?: CustomerInfo;
  subtotal: number; // in cents
  taxAmount?: number; // in cents
  serviceCharge?: number; // in cents
  discountAmount?: number; // in cents
  totalAmount: number; // in cents
  status: OrderStatus;
  version?: number;
  paymentStatus: OrderPaymentStatus;
  paymentMethod?: OrderPaymentMethod;
  notes?: string;
  internalNotes?: string;
  estimatedPrepTime?: number; // minutes
  actualPrepTime?: number; // minutes
  createdAt: number; // Unix ms
  updatedAt: number; // Unix ms
  confirmedAt: number | null;
  preparingAt: number | null;
  readyAt: number | null;
  deliveredAt: number | null;
  paidAt: number | null;
  cancelledAt: number | null;
  rating?: number;
  reviewComment?: string;
  orderSource?: PlatformSource;
  deliveryInfo?: DeliveryInfo;
  pickupNumber?: string;
  fulfillmentType?: "dine-in" | "takeaway" | "delivery";
  items?: OrderItem[];
  restaurant?: RestaurantInfo;
  table?: TableInfo;
  customer?: CustomerProfile;
}

/**
 * Canonical OrderStatus — matches the DB schema in
 * `packages/database/src/schema/orders.ts` exactly. Do not re-introduce a
 * numeric variant. See `docs/investigations/2026-04-09-orderstatus-surface-audit.md`
 * for the full history of why this is a string union and
 * `docs/superpowers/plans/2026-04-09-orderstatus-unification.md` Issue #9
 * for the migration plan.
 */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "paid",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export enum OrderPaymentStatus {
  PENDING = 0,
  PAID = 1,
  FAILED = 2,
}

export type OrderPaymentMethod = "cash" | "card" | "online" | "ewallet";

export interface OrderItem extends BaseEntity {
  orderId: number;
  menuItemId: number;
  quantity: number;
  unitPrice: number; // in cents, price at time of order
  totalPrice: number; // in cents
  customizations?: SelectedCustomizations;
  itemSnapshot?: OrderItemSnapshot;
  notes?: string;
  status: OrderItemStatus;
  menuItem?: MenuItem; // populated when needed
}

export interface OrderItemSnapshot {
  name: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  price?: number;
  unitPrice?: number;
  customizations?: SelectedCustomizations;
}

export enum OrderItemStatus {
  PENDING = 0,
  PREPARING = 1,
  READY = 2,
  DELIVERED = 3,
}

export interface SelectedCustomizations {
  size?: {
    id: string;
    name: string;
    priceAdjustment?: number;
  };
  options?: {
    id: string;
    optionName: string; // option category name (e.g., "spice level")
    choiceId: string;
    choiceName: string; // selected choice name (e.g., "medium spicy")
    priceAdjustment?: number;
  }[];
  addOns?: {
    id: string;
    name: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  }[];
  specialInstructions?: string;
}

export interface CreateOrderRequest {
  restaurantId: string;
  tableId: number;
  customerName?: string;
  customerPhone?: string;
  items: CreateOrderItemRequest[];
  notes?: string;
  couponCode?: string; // 優惠券代碼
}

export interface CreateOrderItemRequest {
  menuItemId: number;
  quantity: number;
  customizations?: SelectedCustomizations;
  notes?: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  notes?: string;
}

export interface UpdateOrderItemStatusRequest {
  status: OrderItemStatus;
}

export interface OrderSummary {
  subtotal: number; // in cents
  tax?: number; // in cents
  serviceCharge?: number; // in cents
  discount?: number; // in cents
  total: number; // in cents
}

export interface OrderFilters {
  status?: OrderStatus[];
  paymentStatus?: OrderPaymentStatus[];
  tableId?: number;
  customerPhone?: string;
  dateFrom?: string;
  dateTo?: string;
  orderSource?: PlatformSource[];
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number; // in cents
  averageOrderValue: number; // in cents
  averagePreparationTime: number; // minutes
}

// Cart-related types for frontend
export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  customizations?: SelectedCustomizations;
  notes?: string;
  price: number; // in cents, base price per item
  totalPrice: number; // in cents, calculated price including customizations
}

export interface CartState {
  items: CartItem[];
  restaurantId?: string;
  tableId?: number;
  total: number; // in cents
  itemCount: number;
}

export interface CustomizationOption {
  id: string;
  name: string;
  priceModifier: number; // in cents
  description?: string;
  priceAdjustment?: number; // for compatibility
}

export interface CustomizationGroup {
  id: string;
  name: string;
  type: "single" | "multiple";
  required?: boolean;
  multiple?: boolean;
  options: CustomizationOption[];
  choices?: string[]; // for selected values
}
