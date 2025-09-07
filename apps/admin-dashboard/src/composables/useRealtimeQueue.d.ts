export interface RealtimeQueueUpdate {
    queueId: string;
    queueNumber: number;
    customerName?: string;
    partySize: number;
    status: string;
    waitTime?: number;
    tableNumber?: string;
    timestamp: string;
    type: "joined" | "called" | "seated" | "no_show" | "cancelled";
}
export interface RealtimeTableUpdate {
    tableId: string;
    tableNumber: string;
    status: string;
    capacity: number;
    occupiedSince?: string;
    timestamp: string;
    type: "occupied" | "available" | "reserved" | "cleaning";
}
export declare function useRealtimeQueue(): {
    isConnected: import("vue").Ref<boolean, boolean>;
    queueUpdates: import("vue").Ref<{
        queueId: string;
        queueNumber: number;
        customerName?: string | undefined;
        partySize: number;
        status: string;
        waitTime?: number | undefined;
        tableNumber?: string | undefined;
        timestamp: string;
        type: "joined" | "called" | "seated" | "no_show" | "cancelled";
    }[], RealtimeQueueUpdate[] | {
        queueId: string;
        queueNumber: number;
        customerName?: string | undefined;
        partySize: number;
        status: string;
        waitTime?: number | undefined;
        tableNumber?: string | undefined;
        timestamp: string;
        type: "joined" | "called" | "seated" | "no_show" | "cancelled";
    }[]>;
    tableUpdates: import("vue").Ref<{
        tableId: string;
        tableNumber: string;
        status: string;
        capacity: number;
        occupiedSince?: string | undefined;
        timestamp: string;
        type: "occupied" | "available" | "reserved" | "cleaning";
    }[], RealtimeTableUpdate[] | {
        tableId: string;
        tableNumber: string;
        status: string;
        capacity: number;
        occupiedSince?: string | undefined;
        timestamp: string;
        type: "occupied" | "available" | "reserved" | "cleaning";
    }[]>;
    queueStats: import("vue").Ref<{
        currentWaiting: number;
        totalServedToday: number;
        averageWaitTime: number;
        peakWaitTime: number;
    }, {
        currentWaiting: number;
        totalServedToday: number;
        averageWaitTime: number;
        peakWaitTime: number;
    } | {
        currentWaiting: number;
        totalServedToday: number;
        averageWaitTime: number;
        peakWaitTime: number;
    }>;
    connectionStatus: import("vue").Ref<"error" | "connecting" | "connected" | "disconnected", "error" | "connecting" | "connected" | "disconnected">;
    startListening: () => void;
    stopListening: () => void;
    clearUpdates: () => void;
    resetStats: () => void;
    getRecentQueueUpdates: (limit?: number) => {
        queueId: string;
        queueNumber: number;
        customerName?: string | undefined;
        partySize: number;
        status: string;
        waitTime?: number | undefined;
        tableNumber?: string | undefined;
        timestamp: string;
        type: "joined" | "called" | "seated" | "no_show" | "cancelled";
    }[];
    getRecentTableUpdates: (limit?: number) => {
        tableId: string;
        tableNumber: string;
        status: string;
        capacity: number;
        occupiedSince?: string | undefined;
        timestamp: string;
        type: "occupied" | "available" | "reserved" | "cleaning";
    }[];
    getUpdatesByStatus: (status: string) => {
        queueId: string;
        queueNumber: number;
        customerName?: string | undefined;
        partySize: number;
        status: string;
        waitTime?: number | undefined;
        tableNumber?: string | undefined;
        timestamp: string;
        type: "joined" | "called" | "seated" | "no_show" | "cancelled";
    }[];
    getTableUpdatesByNumber: (tableNumber: string) => {
        tableId: string;
        tableNumber: string;
        status: string;
        capacity: number;
        occupiedSince?: string | undefined;
        timestamp: string;
        type: "occupied" | "available" | "reserved" | "cleaning";
    }[];
    hasPendingCalls: () => boolean;
    getAvailableTablesCount: () => number;
    requestNotificationPermission: () => Promise<boolean>;
};
export default useRealtimeQueue;
