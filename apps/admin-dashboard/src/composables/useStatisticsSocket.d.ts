export interface StatisticsSocketEvent {
    type: 'order_created' | 'order_updated' | 'order_completed' | 'order_cancelled' | 'statistics_update';
    data: any;
    timestamp: string;
}
export declare function useStatisticsSocket(options?: {
    url?: string;
    autoConnect?: boolean;
    retryAttempts?: number;
    retryDelay?: number;
}): {
    isConnected: import("vue").Ref<boolean, boolean>;
    isConnecting: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    lastMessage: import("vue").Ref<{
        type: "order_created" | "order_updated" | "order_completed" | "order_cancelled" | "statistics_update";
        data: any;
        timestamp: string;
    } | null, StatisticsSocketEvent | {
        type: "order_created" | "order_updated" | "order_completed" | "order_cancelled" | "statistics_update";
        data: any;
        timestamp: string;
    } | null>;
    connectionAttempts: import("vue").Ref<number, number>;
    connect: () => void;
    disconnect: () => void;
    reconnect: () => void;
    send: (message: any) => boolean;
    subscribe: (events: string[]) => void;
    unsubscribe: (events: string[]) => void;
    sendHeartbeat: () => void;
};
export default useStatisticsSocket;
