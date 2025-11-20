/**
 * 即時通訊事件型別定義
 *
 * 此檔案定義了所有 WebSocket 即時通訊的事件型別，
 * 確保前端、後端和即時服務之間的型別安全。
 */
import type { OrderStatus, OrderItemStatus } from './order';
import type { MenuItem } from './menu';
/**
 * WebSocket 連線的房間類型
 */
export type RoomType = 'customer' | 'kitchen' | 'admin' | 'restaurant';
/**
 * 房間 ID 格式
 * - customer: tableId (e.g., "T1") 或 restaurantId (e.g., "R123")
 * - kitchen: restaurantId (e.g., "R123")
 * - admin: restaurantId (e.g., "R123")
 * - restaurant: restaurantId (e.g., "R123")
 */
export type RoomId = string;
/**
 * WebSocket 連線授權資訊
 */
export interface RealtimeAuthPayload {
    /** 房間類型 */
    roomType: RoomType;
    /** 房間 ID */
    roomId: RoomId;
    /** 餐廳 ID */
    restaurantId: string;
    /** 使用者角色 */
    role: 'customer' | 'staff' | 'admin';
    /** 桌號 ID（顧客連線時使用） */
    tableId?: string;
    /** 座位 ID（座位級別連線時使用） */
    seatId?: string;
    /** 使用者 ID（已登入使用者） */
    userId?: number;
    /** Token 過期時間（Unix timestamp） */
    exp: number;
    /** Token 發行時間（Unix timestamp） */
    iat: number;
}
/**
 * 請求 WebSocket 授權 Token 的參數
 */
export interface RealtimeAuthTokenRequest {
    /** 房間類型 */
    roomType: RoomType;
    /** 房間 ID */
    roomId: RoomId;
    /** 餐廳 ID */
    restaurantId: string;
    /** 桌號 ID（可選） */
    tableId?: string;
    /** 座位 ID（可選） */
    seatId?: string;
    /** 使用者會話 ID（已登入使用者） */
    sessionId?: string;
}
/**
 * WebSocket 授權 Token 回應
 */
export interface RealtimeAuthTokenResponse {
    /** JWT Token */
    token: string;
    /** Token 過期時間（秒） */
    expiresIn: number;
    /** WebSocket 連線 URL */
    wsUrl: string;
}
/**
 * 事件類型列舉
 */
export declare enum RealtimeEventType {
    NEW_ORDER = "new_order",
    ORDER_STATUS_UPDATE = "order_status_update",
    ORDER_ITEM_STATUS_UPDATE = "order_item_status_update",
    ORDER_CANCELLED = "order_cancelled",
    KITCHEN_ITEM_STATUS = "kitchen_item_status",
    KITCHEN_QUEUE_UPDATE = "kitchen_queue_update",
    TABLE_STATUS_UPDATE = "table_status_update",
    TABLE_CALL_SERVICE = "table_call_service",
    MENU_AVAILABILITY_UPDATE = "menu_availability_update",
    MENU_ITEM_UPDATE = "menu_item_update",
    SYSTEM_NOTIFICATION = "system_notification",
    CONNECTION_ACK = "connection_ack",
    HEARTBEAT = "heartbeat",
    ERROR = "error",
    RESTAURANT_STATUS_UPDATE = "restaurant_status_update"
}
/**
 * 基礎即時訊息介面
 */
export interface BaseRealtimeEvent {
    /** 事件類型 */
    type: RealtimeEventType;
    /** 事件 ID（用於去重和追蹤） */
    eventId: string;
    /** 事件時間戳（Unix timestamp） */
    timestamp: number;
    /** 餐廳 ID */
    restaurantId: string;
}
/**
 * 新訂單事件
 */
export interface NewOrderEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.NEW_ORDER;
    data: {
        /** 訂單 ID */
        orderId: number;
        /** 訂單編號 */
        orderNumber: string;
        /** 桌號 ID */
        tableId?: string;
        /** 桌號名稱 */
        tableName?: string;
        /** 座位 ID */
        seatId?: string;
        /** 訂單項目 */
        items: Array<{
            orderItemId: number;
            menuItemId: number;
            menuItemName: string;
            quantity: number;
            price: number;
            notes?: string;
        }>;
        /** 訂單總金額 */
        totalAmount: number;
        /** 訂單備註 */
        notes?: string;
        /** 顧客資訊 */
        customer?: {
            name?: string;
            phone?: string;
        };
    };
}
/**
 * 訂單狀態更新事件
 */
export interface OrderStatusUpdateEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.ORDER_STATUS_UPDATE;
    data: {
        /** 訂單 ID */
        orderId: number;
        /** 訂單編號 */
        orderNumber: string;
        /** 新狀態 */
        status: OrderStatus;
        /** 舊狀態 */
        previousStatus: OrderStatus;
        /** 預估完成時間（分鐘） */
        estimatedTime?: number;
        /** 更新訊息 */
        message?: string;
        /** 更新者 */
        updatedBy?: {
            userId: number;
            userName: string;
            role: string;
        };
    };
}
/**
 * 訂單項目狀態更新事件
 */
export interface OrderItemStatusUpdateEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.ORDER_ITEM_STATUS_UPDATE;
    data: {
        /** 訂單 ID */
        orderId: number;
        /** 訂單項目 ID */
        orderItemId: number;
        /** 菜單項目 ID */
        menuItemId: number;
        /** 菜單項目名稱 */
        menuItemName: string;
        /** 新狀態 */
        status: OrderItemStatus;
        /** 舊狀態 */
        previousStatus: OrderItemStatus;
        /** 更新時間 */
        updatedAt: number;
    };
}
/**
 * 訂單取消事件
 */
export interface OrderCancelledEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.ORDER_CANCELLED;
    data: {
        /** 訂單 ID */
        orderId: number;
        /** 訂單編號 */
        orderNumber: string;
        /** 取消原因 */
        reason: string;
        /** 取消者 */
        cancelledBy: {
            userId: number;
            userName: string;
            role: string;
        };
    };
}
/**
 * 廚房項目狀態事件
 */
export interface KitchenItemStatusEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.KITCHEN_ITEM_STATUS;
    data: {
        /** 訂單 ID */
        orderId: number;
        /** 訂單項目 ID */
        orderItemId: number;
        /** 菜單項目名稱 */
        menuItemName: string;
        /** 狀態 */
        status: 'pending' | 'cooking' | 'ready' | 'served';
        /** 桌號名稱 */
        tableName?: string;
        /** 優先級 */
        priority?: 'normal' | 'high' | 'urgent';
        /** 等待時間（分鐘） */
        waitingTime?: number;
    };
}
/**
 * 廚房佇列更新事件
 */
export interface KitchenQueueUpdateEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.KITCHEN_QUEUE_UPDATE;
    data: {
        /** 待處理訂單數量 */
        pendingCount: number;
        /** 烹飪中訂單數量 */
        cookingCount: number;
        /** 已完成訂單數量 */
        readyCount: number;
        /** 平均等待時間（分鐘） */
        averageWaitTime: number;
        /** 最舊的待處理訂單（分鐘前） */
        oldestPendingMinutes?: number;
    };
}
/**
 * 桌台狀態更新事件
 */
export interface TableStatusUpdateEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.TABLE_STATUS_UPDATE;
    data: {
        /** 桌號 ID */
        tableId: string;
        /** 桌號名稱 */
        tableName: string;
        /** 狀態 */
        status: 'available' | 'occupied' | 'reserved' | 'cleaning';
        /** 顧客數量 */
        customerCount?: number;
        /** 當前訂單 ID */
        currentOrderId?: number;
    };
}
/**
 * 桌台呼叫服務事件
 */
export interface TableCallServiceEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.TABLE_CALL_SERVICE;
    data: {
        /** 桌號 ID */
        tableId: string;
        /** 桌號名稱 */
        tableName: string;
        /** 服務類型 */
        serviceType: 'water' | 'utensils' | 'help' | 'bill' | 'other';
        /** 備註 */
        notes?: string;
        /** 緊急程度 */
        urgency: 'low' | 'normal' | 'high';
    };
}
/**
 * 菜單可用性更新事件
 */
export interface MenuAvailabilityUpdateEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.MENU_AVAILABILITY_UPDATE;
    data: {
        /** 菜單項目 ID */
        menuItemId: number;
        /** 菜單項目名稱 */
        menuItemName: string;
        /** 是否可用 */
        isAvailable: boolean;
        /** 庫存數量 */
        inventoryCount?: number;
        /** 原因 */
        reason?: string;
    };
}
/**
 * 菜單項目更新事件
 */
export interface MenuItemUpdateEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.MENU_ITEM_UPDATE;
    data: {
        /** 菜單項目 ID */
        menuItemId: number;
        /** 更新動作 */
        action: 'added' | 'updated' | 'removed';
        /** 菜單項目資料（新增或更新時） */
        menuItem?: Partial<MenuItem>;
    };
}
/**
 * 系統通知事件
 */
export interface SystemNotificationEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.SYSTEM_NOTIFICATION;
    data: {
        /** 通知 ID */
        notificationId: string;
        /** 通知等級 */
        level: 'info' | 'success' | 'warning' | 'error';
        /** 標題 */
        title: string;
        /** 訊息內容 */
        message: string;
        /** 動作 URL */
        actionUrl?: string;
        /** 是否持續顯示直到已讀 */
        persistUntilRead?: boolean;
    };
}
/**
 * 連線確認事件
 */
export interface ConnectionAckEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.CONNECTION_ACK;
    data: {
        /** 連線 ID */
        connectionId: string;
        /** 房間類型 */
        roomType: RoomType;
        /** 房間 ID */
        roomId: RoomId;
        /** 連線時間 */
        connectedAt: number;
        /** 當前房間內的連線數 */
        activeConnections: number;
    };
}
/**
 * 心跳事件
 */
export interface HeartbeatEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.HEARTBEAT;
    data: {
        /** 伺服器時間 */
        serverTime: number;
    };
}
/**
 * 錯誤事件
 */
export interface ErrorEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.ERROR;
    data: {
        /** 錯誤代碼 */
        code: string;
        /** 錯誤訊息 */
        message: string;
        /** 錯誤詳情 */
        details?: Record<string, unknown>;
    };
}
/**
 * 餐廳狀態更新事件
 */
export interface RestaurantStatusUpdateEvent extends BaseRealtimeEvent {
    type: RealtimeEventType.RESTAURANT_STATUS_UPDATE;
    data: {
        /** 是否營業中 */
        isOpen: boolean;
        /** 容納人數 */
        capacity?: number;
        /** 當前訂單數 */
        currentOrders?: number;
        /** 平均等待時間（分鐘） */
        averageWaitTime?: number;
    };
}
/**
 * 所有即時事件的聯合型別
 */
export type RealtimeEvent = NewOrderEvent | OrderStatusUpdateEvent | OrderItemStatusUpdateEvent | OrderCancelledEvent | KitchenItemStatusEvent | KitchenQueueUpdateEvent | TableStatusUpdateEvent | TableCallServiceEvent | MenuAvailabilityUpdateEvent | MenuItemUpdateEvent | SystemNotificationEvent | ConnectionAckEvent | HeartbeatEvent | ErrorEvent | RestaurantStatusUpdateEvent;
/**
 * 檢查是否為新訂單事件
 */
export declare function isNewOrderEvent(event: RealtimeEvent): event is NewOrderEvent;
/**
 * 檢查是否為訂單狀態更新事件
 */
export declare function isOrderStatusUpdateEvent(event: RealtimeEvent): event is OrderStatusUpdateEvent;
/**
 * 檢查是否為訂單項目狀態更新事件
 */
export declare function isOrderItemStatusUpdateEvent(event: RealtimeEvent): event is OrderItemStatusUpdateEvent;
/**
 * 檢查是否為訂單取消事件
 */
export declare function isOrderCancelledEvent(event: RealtimeEvent): event is OrderCancelledEvent;
/**
 * 檢查是否為廚房項目狀態事件
 */
export declare function isKitchenItemStatusEvent(event: RealtimeEvent): event is KitchenItemStatusEvent;
/**
 * 檢查是否為廚房佇列更新事件
 */
export declare function isKitchenQueueUpdateEvent(event: RealtimeEvent): event is KitchenQueueUpdateEvent;
/**
 * 檢查是否為桌台狀態更新事件
 */
export declare function isTableStatusUpdateEvent(event: RealtimeEvent): event is TableStatusUpdateEvent;
/**
 * 檢查是否為桌台呼叫服務事件
 */
export declare function isTableCallServiceEvent(event: RealtimeEvent): event is TableCallServiceEvent;
/**
 * 檢查是否為菜單可用性更新事件
 */
export declare function isMenuAvailabilityUpdateEvent(event: RealtimeEvent): event is MenuAvailabilityUpdateEvent;
/**
 * 檢查是否為菜單項目更新事件
 */
export declare function isMenuItemUpdateEvent(event: RealtimeEvent): event is MenuItemUpdateEvent;
/**
 * 檢查是否為系統通知事件
 */
export declare function isSystemNotificationEvent(event: RealtimeEvent): event is SystemNotificationEvent;
/**
 * 檢查是否為連線確認事件
 */
export declare function isConnectionAckEvent(event: RealtimeEvent): event is ConnectionAckEvent;
/**
 * 檢查是否為心跳事件
 */
export declare function isHeartbeatEvent(event: RealtimeEvent): event is HeartbeatEvent;
/**
 * 檢查是否為錯誤事件
 */
export declare function isErrorEvent(event: RealtimeEvent): event is ErrorEvent;
/**
 * 檢查是否為餐廳狀態更新事件
 */
export declare function isRestaurantStatusUpdateEvent(event: RealtimeEvent): event is RestaurantStatusUpdateEvent;
/**
 * WebSocket 連線狀態
 */
export interface RealtimeConnectionState {
    /** 連線狀態 */
    status: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';
    /** 連線 ID */
    connectionId?: string;
    /** 房間類型 */
    roomType?: RoomType;
    /** 房間 ID */
    roomId?: RoomId;
    /** 最後連線時間 */
    lastConnected?: number;
    /** 重連次數 */
    reconnectAttempts: number;
    /** 最大重連次數 */
    maxReconnectAttempts: number;
    /** 錯誤訊息 */
    error?: string;
}
/**
 * 客戶端發送的訊息（心跳、訂閱等）
 */
export interface ClientMessage {
    /** 訊息類型 */
    type: 'ping' | 'subscribe' | 'unsubscribe';
    /** 時間戳 */
    timestamp: number;
    /** 附加資料 */
    data?: Record<string, unknown>;
}
