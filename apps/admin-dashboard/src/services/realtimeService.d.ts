export interface SSEMessage {
    id: string;
    type: string;
    data: any;
    timestamp: string;
    restaurantId?: string;
}
export interface RealtimeSubscription {
    id: string;
    types: string[];
    callback: (message: SSEMessage) => void;
    restaurantId?: string;
}
declare class RealtimeService {
    private eventSource;
    private subscriptions;
    private connectionStatus;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private heartbeatInterval;
    private lastEventId;
    private messageBuffer;
    private maxBufferSize;
    constructor();
    connect(restaurantId?: string): Promise<void>;
    private setupEventListeners;
    private handleMessage;
    private shouldNotifySubscription;
    subscribe(types: string | string[], callback: (message: SSEMessage) => void, restaurantId?: string): string;
    unsubscribe(subscriptionId: string): boolean;
    disconnect(): void;
    private scheduleReconnect;
    private startHeartbeat;
    getConnectionStatus(): import("vue").Ref<"error" | "connected" | "disconnected" | "connecting", "error" | "connected" | "disconnected" | "connecting">;
    getMessageBuffer(): SSEMessage[];
    reconnect(): void;
    ping(): Promise<boolean>;
    getServerTime(): Promise<Date>;
    broadcastToGroup(groupOrderId: string, event: {
        type: string;
        data: any;
        excludeSessionId?: string;
    }): Promise<boolean>;
    sendGroupNotification(groupOrderId: string, notification: {
        type: string;
        title: string;
        message: string;
        targetMembers?: string[];
        priority?: "low" | "normal" | "high" | "urgent";
    }): Promise<boolean>;
    checkGroupConnectionHealth(groupOrderId: string): Promise<{
        connected: boolean;
        memberCount: number;
        activeMembers: number;
        lastActivity: number;
    }>;
    syncGroupState(groupOrderId: string, lastSyncTime?: number): Promise<any>;
    getMessageLatency(): number;
    getConnectionStats(): {
        status: "error" | "connected" | "disconnected" | "connecting";
        totalMessages: number;
        subscriptions: number;
        lastEventId: string | null;
        reconnectAttempts: number;
        latency: number;
    };
    cleanup(): void;
}
export declare const realtimeService: RealtimeService;
export declare function useRealtime(): {
    connectionStatus: import("vue").Ref<"error" | "connected" | "disconnected" | "connecting", "error" | "connected" | "disconnected" | "connecting">;
    connect: (restaurantId?: string) => Promise<void>;
    disconnect: () => void;
    subscribe: (types: string | string[], callback: (message: SSEMessage) => void, restaurantId?: string) => string;
    unsubscribe: (subscriptionId: string) => boolean;
    reconnect: () => void;
    ping: () => Promise<boolean>;
    getMessageBuffer: () => SSEMessage[];
};
export declare const REALTIME_EVENTS: {
    readonly ORDER_CREATED: "order_created";
    readonly ORDER_UPDATED: "order_updated";
    readonly ORDER_STATUS_CHANGED: "order_status_changed";
    readonly GROUP_ORDER_CREATED: "group_order_created";
    readonly GROUP_ORDER_UPDATED: "group_order_updated";
    readonly GROUP_ORDER_EXPIRED: "group_order_expired";
    readonly GROUP_ORDER_COMPLETED: "group_order_completed";
    readonly GROUP_ORDER_CANCELLED: "group_order_cancelled";
    readonly GROUP_MEMBER_JOINED: "group_member_joined";
    readonly GROUP_MEMBER_LEFT: "group_member_left";
    readonly GROUP_MEMBER_PROMOTED: "group_member_promoted";
    readonly GROUP_MEMBER_ACTIVITY: "group_member_activity";
    readonly GROUP_CART_ITEM_ADDED: "group_cart_item_added";
    readonly GROUP_CART_ITEM_UPDATED: "group_cart_item_updated";
    readonly GROUP_CART_ITEM_REMOVED: "group_cart_item_removed";
    readonly GROUP_CART_CONFLICT: "group_cart_conflict";
    readonly GROUP_CART_SYNCED: "group_cart_synced";
    readonly GROUP_SPLIT_INITIATED: "group_split_initiated";
    readonly GROUP_SPLIT_UPDATED: "group_split_updated";
    readonly GROUP_PAYMENT_COMPLETED: "group_payment_completed";
    readonly GROUP_PAYMENT_FAILED: "group_payment_failed";
    readonly GROUP_PAYMENT_REMINDER: "group_payment_reminder";
    readonly QUEUE_JOINED: "queue_joined";
    readonly QUEUE_CALLED: "queue_called";
    readonly QUEUE_NOTIFIED: "queue_notified";
    readonly QUEUE_SEATED: "queue_seated";
    readonly QUEUE_NO_SHOW: "queue_no_show";
    readonly QUEUE_CANCELLED: "queue_cancelled";
    readonly POS_TRANSACTION: "pos_transaction";
    readonly CASH_MOVEMENT: "cash_movement";
    readonly SHIFT_STARTED: "shift_started";
    readonly SHIFT_ENDED: "shift_ended";
    readonly REGISTER_STATUS_CHANGED: "register_status_changed";
    readonly TABLE_OCCUPIED: "table_occupied";
    readonly TABLE_AVAILABLE: "table_available";
    readonly TABLE_RESERVED: "table_reserved";
    readonly TABLE_CLEANING: "table_cleaning";
    readonly MENU_UPDATED: "menu_updated";
    readonly USER_ACTIVITY: "user_activity";
    readonly SYSTEM_NOTIFICATION: "system_notification";
    readonly CONNECTION_STATUS: "connection_status";
    readonly HEARTBEAT: "heartbeat";
    readonly ALL: "*";
};
export default realtimeService;
