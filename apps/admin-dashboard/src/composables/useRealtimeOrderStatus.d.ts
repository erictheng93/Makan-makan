interface OrderStatusUpdate {
    orderId: string;
    status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    tableNumber?: string;
    customerName?: string;
    timestamp: string;
}
export declare function useRealtimeOrderStatus(): {
    isConnected: import("vue").Ref<boolean, boolean>;
    activeOrders: import("vue").ComputedRef<{
        orderId: string;
        status: "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
        tableNumber?: string | undefined;
        customerName?: string | undefined;
        timestamp: string;
    }[]>;
    pendingOrdersCount: import("vue").ComputedRef<number>;
    connect: (restaurantId: string) => void;
    disconnect: () => void;
    updateOrderStatus: (orderId: string, status: OrderStatusUpdate["status"]) => void;
};
export {};
