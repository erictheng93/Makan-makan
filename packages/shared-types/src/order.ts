import { BaseEntity } from './common';
import { MenuItem, MenuItemOptions } from './menu';

export interface Order extends BaseEntity {
  restaurantId: number;
  tableId: number;
  customerId?: number;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerInfo?: any;
  subtotal: number; // in cents
  taxAmount?: number; // in cents
  serviceCharge?: number; // in cents
  discountAmount?: number; // in cents
  totalAmount: number; // in cents
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  internalNotes?: string;
  estimatedPrepTime?: number; // minutes
  actualPrepTime?: number; // minutes
  confirmedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  rating?: number;
  reviewComment?: string;
  items?: OrderItem[];
  restaurant?: any;
  table?: any;
  customer?: any;
}

export enum OrderStatus {
  PENDING = 0,
  CONFIRMED = 1,
  PREPARING = 2,
  READY = 3,
  DELIVERED = 4,
  PAID = 5,
  CANCELLED = 6
}

export enum PaymentStatus {
  PENDING = 0,
  PAID = 1,
  FAILED = 2
}

export type PaymentMethod = 'cash' | 'card' | 'online' | 'ewallet';

export interface OrderItem extends BaseEntity {
  orderId: number;
  menuItemId: number;
  quantity: number;
  unitPrice: number; // in cents, price at time of order
  totalPrice: number; // in cents
  customizations?: SelectedCustomizations;
  notes?: string;
  status: OrderItemStatus;
  menuItem?: MenuItem; // populated when needed
}

export enum OrderItemStatus {
  PENDING = 0,
  PREPARING = 1,
  READY = 2,
  DELIVERED = 3
}

export interface SelectedCustomizations {
  size?: {
    id: string;
    name: string;
    priceAdjustment?: number;
  };
  options?: {
    id: string;
    optionName: string;    // option category name (e.g., "spice level")
    choiceId: string;
    choiceName: string;    // selected choice name (e.g., "medium spicy")
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
  restaurantId: number;
  tableId: number;
  customerName?: string;
  customerPhone?: string;
  items: CreateOrderItemRequest[];
  notes?: string;
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
  paymentStatus?: PaymentStatus[];
  tableId?: number;
  customerPhone?: string;
  dateFrom?: string;
  dateTo?: string;
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
  restaurantId?: number;
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
  type: 'single' | 'multiple';
  required?: boolean;
  multiple?: boolean;
  options: CustomizationOption[];
  choices?: string[]; // for selected values
}