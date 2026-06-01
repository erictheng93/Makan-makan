/**
 * Kitchen Feature Module Types
 */

export interface KitchenOrder {
  id: number;
  orderNumber: string;
  tableId: number;
  tableName: string;
  status: string; // OrderStatus (canonical string union)
  orderSource?:
    | "direct"
    | "market_checkout"
    | "uber_eats"
    | "foodpanda"
    | "grabfood";
  items: KitchenOrderItem[];
  customerName?: string;
  notes?: string;
  createdAt: number; // Unix ms — matches Order wire contract
  totalItems: number;
  priority: "normal" | "high" | "urgent";
  elapsedTime: number;
}

export interface KitchenOrderItem {
  id: number;
  name: string;
  quantity: number;
  status: "pending" | "preparing" | "ready" | "completed";
  notes?: string;
  priority: "normal" | "high" | "urgent";
  estimatedTime: number;
  startedAt?: string;
}

export interface KitchenStats {
  pendingCount: number;
  preparingCount: number;
  readyCount: number;
  completedToday: number;
  averageCookingTime: number;
  averageWaitingTime: number;
  efficiency: number;
  urgentOrders: number;
}

export interface KitchenOrdersResponse {
  pending: KitchenOrder[];
  preparing: KitchenOrder[];
  ready: KitchenOrder[];
  stats: KitchenStats;
}

export interface OrderItemStatusUpdate {
  status: "pending" | "preparing" | "ready" | "completed";
  notes?: string;
}

// Service Interface
export interface IKitchenService {
  // Kitchen Operations
  getKitchenOrders(
    restaurantId: string,
    userId?: number,
  ): Promise<KitchenOrdersResponse>;
  updateOrderItemStatus(
    restaurantId: string,
    orderId: number,
    itemId: number,
    statusUpdate: OrderItemStatusUpdate,
    userId: number,
  ): Promise<{
    orderId: number;
    itemId: number;
    status: string;
    updatedAt: string;
  }>;

  validateChefAccess(
    userId: number,
    userRole: number,
    restaurantId: string,
  ): boolean;
}
