import { OrderStatus, OrderItemStatus } from './order';

// WebSocket 訊息基礎結構
export interface BaseWebSocketMessage {
  type: string;
  timestamp: number;
  id?: string;
}

// 訂單狀態更新訊息
export interface OrderStatusUpdateMessage extends BaseWebSocketMessage {
  type: 'ORDER_STATUS_UPDATE';
  orderId: number;
  status: OrderStatus;
  estimatedTime?: number;
  message?: string;
}

// 訂單項目狀態更新訊息
export interface OrderItemStatusUpdateMessage extends BaseWebSocketMessage {
  type: 'ORDER_ITEM_STATUS_UPDATE';
  orderId: number;
  orderItemId: number;
  status: OrderItemStatus;
}

// 新訂單通知訊息
export interface NewOrderMessage extends BaseWebSocketMessage {
  type: 'NEW_ORDER';
  orderId: number;
  restaurantId: number;
  tableId: number;
  totalAmount: number;
  itemCount: number;
}

// 系統通知訊息
export interface SystemNotificationMessage extends BaseWebSocketMessage {
  type: 'SYSTEM_NOTIFICATION';
  level: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  actionUrl?: string;
}

// 桌台狀態更新訊息
export interface TableStatusUpdateMessage extends BaseWebSocketMessage {
  type: 'TABLE_STATUS_UPDATE';
  tableId: number;
  status: 'available' | 'occupied' | 'reserved';
  customerCount?: number;
}

// 菜單項目可用性更新訊息
export interface MenuAvailabilityUpdateMessage extends BaseWebSocketMessage {
  type: 'MENU_AVAILABILITY_UPDATE';
  menuItemId: number;
  isAvailable: boolean;
  inventoryCount?: number;
}

// 廚房顯示更新訊息
export interface KitchenDisplayUpdateMessage extends BaseWebSocketMessage {
  type: 'KITCHEN_DISPLAY_UPDATE';
  orderId: number;
  action: 'add' | 'update' | 'remove';
  priority?: 'normal' | 'high' | 'urgent';
}

// 心跳響應訊息
export interface PongMessage extends BaseWebSocketMessage {
  type: 'pong';
}

// 訂單更新訊息（前端用）
export interface OrderUpdateMessage extends BaseWebSocketMessage {
  type: 'order_update';
  data: any;
}

// 餐廳狀態更新訊息（前端用）
export interface RestaurantStatusUpdateMessage extends BaseWebSocketMessage {
  type: 'restaurant_status_update';
  data: any;
}

// 通知訊息（前端用）
export interface NotificationMessage extends BaseWebSocketMessage {
  type: 'notification';
  data: any;
}

// 菜單更新訊息（前端用）
export interface MenuUpdateMessage extends BaseWebSocketMessage {
  type: 'menu_update';
  data: any;
}

// 聯合類型：所有WebSocket訊息類型
export type WebSocketMessage = 
  | OrderStatusUpdateMessage
  | OrderItemStatusUpdateMessage
  | NewOrderMessage
  | SystemNotificationMessage
  | TableStatusUpdateMessage
  | MenuAvailabilityUpdateMessage
  | KitchenDisplayUpdateMessage
  | PongMessage
  | OrderUpdateMessage
  | RestaurantStatusUpdateMessage
  | NotificationMessage
  | MenuUpdateMessage;

// WebSocket 連接狀態
export interface WebSocketConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected?: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

// WebSocket 訂閱選項
export interface WebSocketSubscriptionOptions {
  restaurantId: number;
  userRole?: string;
  tableId?: number;
  filters?: {
    messageTypes?: string[];
    priority?: string[];
  };
}

// Frontend WebSocket composable options
export interface UseWebSocketOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

// WebSocket connection return type for composable
export interface UseWebSocketReturn {
  ws: any;
  connectionStatus: string;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (message: any) => void;
  subscribe: (channel: string) => boolean;
  unsubscribe: (channel: string) => boolean;
}