import { BaseEntity } from "./common";
import { MenuItem } from "./menu";
export type PlatformSource = "direct" | "uber_eats" | "foodpanda" | "grabfood";
export interface DeliveryInfo {
    type: "dine_in" | "takeaway" | "delivery";
    address?: string;
    phone?: string;
    instructions?: string;
    deliveryFee?: number;
    estimatedDeliveryTime?: number;
}
export interface CustomerInfo {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    preferences?: Record<string, unknown>;
}
export interface TableInfo {
    id: number;
    number: string;
    seats: number;
    location?: string;
    qrCode?: string;
}
export interface RestaurantInfo {
    id: number;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    businessHours?: Record<string, unknown>;
}
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
export interface Order extends BaseEntity {
    restaurantId: string;
    tableId: number;
    customerId?: number;
    orderNumber: string;
    customerName?: string;
    customerPhone?: string;
    customerInfo?: CustomerInfo;
    subtotal: number;
    taxAmount?: number;
    serviceCharge?: number;
    discountAmount?: number;
    totalAmount: number;
    status: OrderStatus;
    paymentStatus: OrderPaymentStatus;
    paymentMethod?: OrderPaymentMethod;
    notes?: string;
    internalNotes?: string;
    estimatedPrepTime?: number;
    actualPrepTime?: number;
    confirmedAt?: string;
    preparingAt?: string;
    readyAt?: string;
    deliveredAt?: string;
    paidAt?: string;
    cancelledAt?: string;
    rating?: number;
    reviewComment?: string;
    orderSource?: PlatformSource;
    deliveryInfo?: DeliveryInfo;
    items?: OrderItem[];
    restaurant?: RestaurantInfo;
    table?: TableInfo;
    customer?: CustomerProfile;
}
export declare enum OrderStatus {
    PENDING = 0,
    CONFIRMED = 1,
    PREPARING = 2,
    READY = 3,
    DELIVERED = 4,
    PAID = 5,
    CANCELLED = 6
}
export declare enum OrderPaymentStatus {
    PENDING = 0,
    PAID = 1,
    FAILED = 2
}
export type OrderPaymentMethod = "cash" | "card" | "online" | "ewallet";
export interface OrderItem extends BaseEntity {
    orderId: number;
    menuItemId: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    customizations?: SelectedCustomizations;
    notes?: string;
    status: OrderItemStatus;
    menuItem?: MenuItem;
}
export declare enum OrderItemStatus {
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
        optionName: string;
        choiceId: string;
        choiceName: string;
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
    couponCode?: string;
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
    subtotal: number;
    tax?: number;
    serviceCharge?: number;
    discount?: number;
    total: number;
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
    totalRevenue: number;
    averageOrderValue: number;
    averagePreparationTime: number;
}
export interface CartItem {
    id: string;
    menuItem: MenuItem;
    quantity: number;
    customizations?: SelectedCustomizations;
    notes?: string;
    price: number;
    totalPrice: number;
}
export interface CartState {
    items: CartItem[];
    restaurantId?: string;
    tableId?: number;
    total: number;
    itemCount: number;
}
export interface CustomizationOption {
    id: string;
    name: string;
    priceModifier: number;
    description?: string;
    priceAdjustment?: number;
}
export interface CustomizationGroup {
    id: string;
    name: string;
    type: "single" | "multiple";
    required?: boolean;
    multiple?: boolean;
    options: CustomizationOption[];
    choices?: string[];
}
