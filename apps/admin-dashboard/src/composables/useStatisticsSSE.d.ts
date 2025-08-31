export interface StatisticsSSEEvent {
    type: 'order_created' | 'order_updated' | 'order_completed' | 'order_cancelled' | 'statistics_update' | 'heartbeat';
    data: any;
    timestamp: string;
    id?: string;
}
export declare function useStatisticsSSE(options?: {
    url?: string;
    autoConnect?: boolean;
    retryAttempts?: number;
    retryDelay?: number;
}): {
    isConnected: import("vue").Ref<boolean, boolean>;
    isConnecting: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    lastMessage: import("vue").Ref<{
        type: "order_created" | "order_updated" | "order_completed" | "order_cancelled" | "statistics_update" | "heartbeat";
        data: any;
        timestamp: string;
        id?: string | undefined;
    } | null, StatisticsSSEEvent | {
        type: "order_created" | "order_updated" | "order_completed" | "order_cancelled" | "statistics_update" | "heartbeat";
        data: any;
        timestamp: string;
        id?: string | undefined;
    } | null>;
    connectionAttempts: import("vue").Ref<number, number>;
    lastEventId: import("vue").Ref<string | null, string | null>;
    connect: () => void;
    disconnect: () => void;
    reconnect: () => void;
    getConnectionState: () => "CLOSED" | "CONNECTING" | "OPEN" | "UNKNOWN";
};
export default useStatisticsSSE;
