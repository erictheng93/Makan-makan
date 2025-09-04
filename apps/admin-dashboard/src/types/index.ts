export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  restaurantId: number;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 0,
  OWNER = 1,
  CHEF = 2,
  SERVICE = 3,
  CASHIER = 4,
}

export interface Restaurant {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  settings: RestaurantSettings;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantSettings {
  timezone: string;
  currency: string;
  language: string;
  operatingHours: OperatingHours;
  orderSettings: OrderSettings;
}

export interface OperatingHours {
  [key: string]: {
    open: string;
    close: string;
    closed: boolean;
  };
}

export interface OrderSettings {
  autoAcceptOrders: boolean;
  estimatedPrepTime: number;
  allowPreOrders: boolean;
  maxOrdersPerHour: number;
}

export interface MenuItem {
  id: number;
  restaurantId: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  prepTime: number;
  customizations: MenuCustomization[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: number;
  restaurantId: number;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCustomization {
  id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  options: CustomizationOption[];
}

export interface CustomizationOption {
  id: string;
  name: string;
  priceModifier: number;
}

export interface Order {
  id: number;
  restaurantId: number;
  tableId?: number;
  status: OrderStatus;
  totalAmount: number;
  items: OrderItem[];
  notes?: string;
  customerInfo?: CustomerInfo;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PREPARING = "preparing",
  READY = "ready",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export interface OrderItem {
  id: number;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  customizations: OrderItemCustomization[];
  notes?: string;
}

export interface OrderItemCustomization {
  customizationId: string;
  optionId: string;
  name: string;
  priceModifier: number;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  email?: string;
}

export interface Table {
  id: number;
  restaurantId: number;
  number: string;
  name?: string;
  capacity: number;
  qrCodeUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  averageOrderValue: number;
  completionRate: number;
  topMenuItems: TopMenuItem[];
  revenueChart: ChartData[];
  ordersChart: ChartData[];
}

export interface TopMenuItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface ChartData {
  label: string;
  value: number;
  date?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface SSEEvent {
  type: "order_update" | "menu_update" | "system_notification";
  data: any;
  timestamp: string;
}

export interface NotificationSettings {
  newOrders: boolean;
  orderStatusChanges: boolean;
  systemAlerts: boolean;
  sound: boolean;
}

export interface SystemNotification {
  id: number;
  type: "urgent_order" | "new_order" | "achievement" | "system_alert";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface UrgentOrderAlert {
  message: string;
}
