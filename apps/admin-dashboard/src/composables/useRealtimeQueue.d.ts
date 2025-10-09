export interface RealtimeQueueUpdate {
    queueId: string;
    queueNumber: number;
    customerName?: string;
    partySize: number;
    status: "waiting" | "called" | "notified" | "seated" | "no_show" | "cancelled" | "expired";
    waitTime?: number;
    tableNumber?: string;
    timestamp: string;
    type: "joined" | "called" | "notified" | "seated" | "no_show" | "cancelled";
    estimatedWaitMinutes?: number;
    actualWaitMinutes?: number;
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
        status: "waiting" | "called" | "notified" | "seated" | "no_show" | "cancelled" | "expired";
        waitTime?: number | undefined;
        tableNumber?: string | undefined;
        timestamp: string;
        type: "joined" | "called" | "notified" | "seated" | "no_show" | "cancelled";
        estimatedWaitMinutes?: number | undefined;
        actualWaitMinutes?: number | undefined;
    }[], RealtimeQueueUpdate[] | {
        queueId: string;
        queueNumber: number;
        customerName?: string | undefined;
        partySize: number;
        status: "waiting" | "called" | "notified" | "seated" | "no_show" | "cancelled" | "expired";
        waitTime?: number | undefined;
        tableNumber?: string | undefined;
        timestamp: string;
        type: "joined" | "called" | "notified" | "seated" | "no_show" | "cancelled";
        estimatedWaitMinutes?: number | undefined;
        actualWaitMinutes?: number | undefined;
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
    connectionStatus: import("vue").Ref<"error" | "connected" | "disconnected" | "connecting", "error" | "connected" | "disconnected" | "connecting">;
    startListening: () => void;
    stopListening: () => void;
    clearUpdates: () => void;
    resetStats: () => void;
    getRecentQueueUpdates: (limit?: number) => {
        queueId: string;
        queueNumber: number;
        customerName?: string | undefined;
        partySize: number;
        status: "waiting" | "called" | "notified" | "seated" | "no_show" | "cancelled" | "expired";
        waitTime?: number | undefined;
        tableNumber?: string | undefined;
        timestamp: string;
        type: "joined" | "called" | "notified" | "seated" | "no_show" | "cancelled";
        estimatedWaitMinutes?: number | undefined;
        actualWaitMinutes?: number | undefined;
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
        status: "waiting" | "called" | "notified" | "seated" | "no_show" | "cancelled" | "expired";
        waitTime?: number | undefined;
        tableNumber?: string | undefined;
        timestamp: string;
        type: "joined" | "called" | "notified" | "seated" | "no_show" | "cancelled";
        estimatedWaitMinutes?: number | undefined;
        actualWaitMinutes?: number | undefined;
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
    getUpdateCountByStatus: (status: string) => number;
    getAverageWaitTime: () => number;
    requestNotificationPermission: () => Promise<boolean>;
};
export default useRealtimeQueue;
