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
    getConnectionStatus(): import("vue").Ref<"error" | "connecting" | "connected" | "disconnected", "error" | "connecting" | "connected" | "disconnected">;
    getMessageBuffer(): SSEMessage[];
    reconnect(): void;
    ping(): Promise<boolean>;
    getServerTime(): Promise<Date>;
    cleanup(): void;
}
export declare const realtimeService: RealtimeService;
export declare function useRealtime(): {
    connectionStatus: import("vue").Ref<"error" | "connecting" | "connected" | "disconnected", "error" | "connecting" | "connected" | "disconnected">;
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
    readonly GROUP_MEMBER_JOINED: "member_joined";
    readonly GROUP_MEMBER_LEFT: "member_left";
    readonly GROUP_PAYMENT_COMPLETED: "group_payment_completed";
    readonly QUEUE_JOINED: "queue_joined";
    readonly QUEUE_CALLED: "queue_called";
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
    readonly ALL: "*";
};
export default realtimeService;
