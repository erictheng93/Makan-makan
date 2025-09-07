export interface RealtimeOrderUpdate {
    orderId: string;
    orderNumber: string;
    status: string;
    tableNumber?: string;
    totalAmount: number;
    timestamp: string;
    type: "created" | "updated" | "status_changed";
}
export interface RealtimeGroupOrderUpdate {
    groupOrderId: string;
    shareCode: string;
    status: string;
    memberCount: number;
    totalAmount: number;
    timestamp: string;
    type: "created" | "updated" | "member_joined" | "member_left" | "payment_completed";
}
export declare function useRealtimeOrders(): {
    isConnected: import("vue").Ref<boolean, boolean>;
    orderUpdates: import("vue").Ref<{
        orderId: string;
        orderNumber: string;
        status: string;
        tableNumber?: string | undefined;
        totalAmount: number;
        timestamp: string;
        type: "created" | "updated" | "status_changed";
    }[], RealtimeOrderUpdate[] | {
        orderId: string;
        orderNumber: string;
        status: string;
        tableNumber?: string | undefined;
        totalAmount: number;
        timestamp: string;
        type: "created" | "updated" | "status_changed";
    }[]>;
    groupOrderUpdates: import("vue").Ref<{
        groupOrderId: string;
        shareCode: string;
        status: string;
        memberCount: number;
        totalAmount: number;
        timestamp: string;
        type: "created" | "updated" | "member_joined" | "member_left" | "payment_completed";
    }[], RealtimeGroupOrderUpdate[] | {
        groupOrderId: string;
        shareCode: string;
        status: string;
        memberCount: number;
        totalAmount: number;
        timestamp: string;
        type: "created" | "updated" | "member_joined" | "member_left" | "payment_completed";
    }[]>;
    connectionStatus: import("vue").Ref<"error" | "connecting" | "connected" | "disconnected", "error" | "connecting" | "connected" | "disconnected">;
    startListening: () => void;
    stopListening: () => void;
    clearUpdates: () => void;
    getRecentOrderUpdates: (limit?: number) => {
        orderId: string;
        orderNumber: string;
        status: string;
        tableNumber?: string | undefined;
        totalAmount: number;
        timestamp: string;
        type: "created" | "updated" | "status_changed";
    }[];
    getRecentGroupOrderUpdates: (limit?: number) => {
        groupOrderId: string;
        shareCode: string;
        status: string;
        memberCount: number;
        totalAmount: number;
        timestamp: string;
        type: "created" | "updated" | "member_joined" | "member_left" | "payment_completed";
    }[];
    hasOrderUpdate: (orderId: string, since?: Date) => boolean;
    hasGroupOrderUpdate: (groupOrderId: string, since?: Date) => boolean;
};
export default useRealtimeOrders;
