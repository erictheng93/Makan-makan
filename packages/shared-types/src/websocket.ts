import { OrderStatus, OrderItemStatus, Order } from "./order";

// ============================================================================
// ⚠️ LEGACY WEBSOCKET MESSAGE SYSTEM (bug-inventory #23)
//
// The interfaces in this file use UPPER_SNAKE / ad-hoc `type` discriminants
// (e.g. "ORDER_STATUS_UPDATE", "NEW_ORDER"). They are NOT the wire format the
// realtime pipeline (apps/realtime + RealtimeBroadcastService) actually speaks —
// that pipeline uses `RealtimeEventType` from `./realtime-events.ts`, whose
// values are lower_snake (e.g. "order_status_update", "new_order").
//
// Do NOT reach for these types in new code. They remain only because the
// customer-app WebSocket composables still consume them. Every exported member
// below is marked `@deprecated`; four previously-unused types
// (WebSocketConnectionState, WebSocketSubscriptionOptions, UseWebSocketOptions,
// UseWebSocketReturn) had zero references and have been removed.
// ============================================================================

/**
 * @deprecated Part of the legacy WebSocketMessage system; NOT understood by the
 * realtime pipeline. Use the event data shapes from `realtime-events.ts`.
 */
// Order update data structure
export interface OrderUpdateData {
  order: Partial<Order>;
  restaurantId: string;
  status?: OrderStatus;
  previousStatus?: OrderStatus;
  estimatedTime?: number;
  message?: string;
}

/**
 * @deprecated Part of the legacy WebSocketMessage system; NOT understood by the
 * realtime pipeline. Use the event data shapes from `realtime-events.ts`.
 */
// Restaurant status data structure
export interface RestaurantStatusData {
  restaurantId: string;
  isOpen: boolean;
  capacity?: number;
  currentOrders?: number;
  averageWaitTime?: number;
}

/**
 * @deprecated Part of the legacy WebSocketMessage system; NOT understood by the
 * realtime pipeline. Use the event data shapes from `realtime-events.ts`.
 */
// Notification data structure
export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: number;
  actionUrl?: string;
  persistUntilRead?: boolean;
}

/**
 * @deprecated Part of the legacy WebSocketMessage system; NOT understood by the
 * realtime pipeline. Use the event data shapes from `realtime-events.ts`.
 */
// Menu update data structure
export interface MenuUpdateData {
  restaurantId: string;
  menuItemId: number;
  action: "added" | "updated" | "removed" | "availability_changed";
  isAvailable?: boolean;
  price?: number;
  name?: string;
  description?: string;
}

/**
 * @deprecated Legacy WebSocket base message. Use `RealtimeEventType` /
 * `BaseRealtimeEvent` from `realtime-events.ts` (lower_snake) instead; these
 * message types are NOT understood by the realtime pipeline.
 */
// WebSocket 訊息基礎結構
export interface BaseWebSocketMessage {
  type: string;
  timestamp: number;
  id?: string;
}

/**
 * @deprecated Use `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 訂單狀態更新訊息
export interface OrderStatusUpdateMessage extends BaseWebSocketMessage {
  type: "ORDER_STATUS_UPDATE";
  orderId: string;
  status: OrderStatus;
  estimatedTime?: number;
  message?: string;
}

/**
 * @deprecated Use `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 訂單項目狀態更新訊息
export interface OrderItemStatusUpdateMessage extends BaseWebSocketMessage {
  type: "ORDER_ITEM_STATUS_UPDATE";
  orderId: string;
  orderItemId: number;
  status: OrderItemStatus;
}

/**
 * @deprecated Use `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 新訂單通知訊息
export interface NewOrderMessage extends BaseWebSocketMessage {
  type: "NEW_ORDER";
  orderId: string;
  restaurantId: string;
  tableId: number;
  totalAmount: number;
  itemCount: number;
}

/**
 * @deprecated Use `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 系統通知訊息
export interface SystemNotificationMessage extends BaseWebSocketMessage {
  type: "SYSTEM_NOTIFICATION";
  level: "info" | "warning" | "error";
  title: string;
  message: string;
  actionUrl?: string;
}

/**
 * @deprecated Use `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 桌台狀態更新訊息
export interface TableStatusUpdateMessage extends BaseWebSocketMessage {
  type: "TABLE_STATUS_UPDATE";
  tableId: number;
  status: "available" | "occupied" | "reserved";
  customerCount?: number;
}

/**
 * @deprecated Use `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 菜單項目可用性更新訊息
export interface MenuAvailabilityUpdateMessage extends BaseWebSocketMessage {
  type: "MENU_AVAILABILITY_UPDATE";
  menuItemId: number;
  isAvailable: boolean;
  inventoryCount?: number;
}

/**
 * @deprecated Use `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 廚房顯示更新訊息
export interface KitchenDisplayUpdateMessage extends BaseWebSocketMessage {
  type: "KITCHEN_DISPLAY_UPDATE";
  orderId: string;
  action: "add" | "update" | "remove";
  priority?: "normal" | "high" | "urgent";
}

/**
 * @deprecated Use `RealtimeEventType.HEARTBEAT` from `realtime-events.ts`
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 心跳響應訊息
export interface PongMessage extends BaseWebSocketMessage {
  type: "pong";
}

/**
 * @deprecated Use `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 訂單更新訊息（前端用）
export interface OrderUpdateMessage extends BaseWebSocketMessage {
  type: "order_update";
  data: OrderUpdateData;
}

/**
 * @deprecated Use `RealtimeEventType.RESTAURANT_STATUS_UPDATE` from
 * `realtime-events.ts` instead; this constant is NOT understood by the realtime
 * pipeline.
 */
// 餐廳狀態更新訊息（前端用）
export interface RestaurantStatusUpdateMessage extends BaseWebSocketMessage {
  type: "restaurant_status_update";
  data: RestaurantStatusData;
}

/**
 * @deprecated Use `RealtimeEventType.SYSTEM_NOTIFICATION` from
 * `realtime-events.ts` instead; this constant is NOT understood by the realtime
 * pipeline.
 */
// 通知訊息（前端用）
export interface NotificationMessage extends BaseWebSocketMessage {
  type: "notification";
  data: NotificationData;
}

/**
 * @deprecated Use `RealtimeEventType.MENU_ITEM_UPDATE` from `realtime-events.ts`
 * instead; this constant is NOT understood by the realtime pipeline.
 */
// 菜單更新訊息（前端用）
export interface MenuUpdateMessage extends BaseWebSocketMessage {
  type: "menu_update";
  data: MenuUpdateData;
}

/**
 * @deprecated Legacy union of UPPER_SNAKE / ad-hoc WebSocket messages. Use
 * `RealtimeEvent` / `RealtimeEventType` from `realtime-events.ts` (lower_snake)
 * instead; none of these message types are understood by the realtime pipeline.
 */
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
