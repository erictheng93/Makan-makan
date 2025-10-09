export interface GroupOrderMember {
    id: string;
    sessionId: string;
    name: string;
    phone?: string;
    role: "creator" | "admin" | "member";
    joinedAt: number;
    lastActiveAt: number;
    isOnline: boolean;
    totalAmount: number;
    itemCount: number;
    paymentStatus: "unpaid" | "pending" | "paid";
}
export interface GroupOrderCartItem {
    id: string;
    memberId: string;
    menuItemId: number;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    customizations: Record<string, any>;
    specialInstructions?: string;
    addedAt: number;
    updatedAt: number;
    version: number;
}
export interface GroupOrderSplitBill {
    id: string;
    memberId: string;
    subtotal: number;
    taxAmount: number;
    serviceCharge: number;
    totalAmount: number;
    items: string[];
    paymentStatus: "pending" | "processing" | "paid" | "failed";
    paymentMethod?: string;
    paidAt?: number;
}
export interface GroupOrderState {
    id: string;
    shareCode: string;
    status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
    restaurantId: number;
    members: GroupOrderMember[];
    cart: GroupOrderCartItem[];
    splitBills: GroupOrderSplitBill[];
    host: GroupOrderMember;
    settings: {
        maxMembers: number;
        allowEditOthers: boolean;
        splitType: "equal" | "proportional" | "individual" | "custom";
    };
    totalAmount: number;
    lastActivity: number;
    createdAt: number;
    expiresAt: number;
}
export interface GroupOrderEvent {
    type: string;
    groupOrderId: string;
    timestamp: number;
    data: any;
}
export interface RealtimeGroupOrderUpdate {
    groupOrderId: string;
    shareCode: string;
    event: GroupOrderEvent;
    groupOrder: GroupOrderState;
}
/**
 * 群組訂單實時同步組合式函數
 * 提供完整的群組訂單實時功能，包括成員管理、購物車同步、分帳處理等
 */
export declare function useRealtimeGroupOrders(): {
    isConnected: import("vue").Ref<boolean, boolean>;
    wsConnectionStatus: import("vue").Ref<"error" | "connected" | "disconnected" | "connecting", "error" | "connected" | "disconnected" | "connecting">;
    activeGroupOrders: import("vue").Ref<Map<string, {
        id: string;
        shareCode: string;
        status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
        restaurantId: number;
        members: {
            id: string;
            sessionId: string;
            name: string;
            phone?: string | undefined;
            role: "creator" | "admin" | "member";
            joinedAt: number;
            lastActiveAt: number;
            isOnline: boolean;
            totalAmount: number;
            itemCount: number;
            paymentStatus: "unpaid" | "pending" | "paid";
        }[];
        cart: {
            id: string;
            memberId: string;
            menuItemId: number;
            menuItemName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            customizations: Record<string, any>;
            specialInstructions?: string | undefined;
            addedAt: number;
            updatedAt: number;
            version: number;
        }[];
        splitBills: {
            id: string;
            memberId: string;
            subtotal: number;
            taxAmount: number;
            serviceCharge: number;
            totalAmount: number;
            items: string[];
            paymentStatus: "pending" | "processing" | "paid" | "failed";
            paymentMethod?: string | undefined;
            paidAt?: number | undefined;
        }[];
        host: {
            id: string;
            sessionId: string;
            name: string;
            phone?: string | undefined;
            role: "creator" | "admin" | "member";
            joinedAt: number;
            lastActiveAt: number;
            isOnline: boolean;
            totalAmount: number;
            itemCount: number;
            paymentStatus: "unpaid" | "pending" | "paid";
        };
        settings: {
            maxMembers: number;
            allowEditOthers: boolean;
            splitType: "equal" | "proportional" | "individual" | "custom";
        };
        totalAmount: number;
        lastActivity: number;
        createdAt: number;
        expiresAt: number;
    }> & Omit<Map<string, GroupOrderState>, keyof Map<any, any>>, Map<string, GroupOrderState> | (Map<string, {
        id: string;
        shareCode: string;
        status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
        restaurantId: number;
        members: {
            id: string;
            sessionId: string;
            name: string;
            phone?: string | undefined;
            role: "creator" | "admin" | "member";
            joinedAt: number;
            lastActiveAt: number;
            isOnline: boolean;
            totalAmount: number;
            itemCount: number;
            paymentStatus: "unpaid" | "pending" | "paid";
        }[];
        cart: {
            id: string;
            memberId: string;
            menuItemId: number;
            menuItemName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            customizations: Record<string, any>;
            specialInstructions?: string | undefined;
            addedAt: number;
            updatedAt: number;
            version: number;
        }[];
        splitBills: {
            id: string;
            memberId: string;
            subtotal: number;
            taxAmount: number;
            serviceCharge: number;
            totalAmount: number;
            items: string[];
            paymentStatus: "pending" | "processing" | "paid" | "failed";
            paymentMethod?: string | undefined;
            paidAt?: number | undefined;
        }[];
        host: {
            id: string;
            sessionId: string;
            name: string;
            phone?: string | undefined;
            role: "creator" | "admin" | "member";
            joinedAt: number;
            lastActiveAt: number;
            isOnline: boolean;
            totalAmount: number;
            itemCount: number;
            paymentStatus: "unpaid" | "pending" | "paid";
        };
        settings: {
            maxMembers: number;
            allowEditOthers: boolean;
            splitType: "equal" | "proportional" | "individual" | "custom";
        };
        totalAmount: number;
        lastActivity: number;
        createdAt: number;
        expiresAt: number;
    }> & Omit<Map<string, GroupOrderState>, keyof Map<any, any>>)>;
    currentGroupOrder: import("vue").Ref<{
        id: string;
        shareCode: string;
        status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
        restaurantId: number;
        members: {
            id: string;
            sessionId: string;
            name: string;
            phone?: string | undefined;
            role: "creator" | "admin" | "member";
            joinedAt: number;
            lastActiveAt: number;
            isOnline: boolean;
            totalAmount: number;
            itemCount: number;
            paymentStatus: "unpaid" | "pending" | "paid";
        }[];
        cart: {
            id: string;
            memberId: string;
            menuItemId: number;
            menuItemName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            customizations: Record<string, any>;
            specialInstructions?: string | undefined;
            addedAt: number;
            updatedAt: number;
            version: number;
        }[];
        splitBills: {
            id: string;
            memberId: string;
            subtotal: number;
            taxAmount: number;
            serviceCharge: number;
            totalAmount: number;
            items: string[];
            paymentStatus: "pending" | "processing" | "paid" | "failed";
            paymentMethod?: string | undefined;
            paidAt?: number | undefined;
        }[];
        host: {
            id: string;
            sessionId: string;
            name: string;
            phone?: string | undefined;
            role: "creator" | "admin" | "member";
            joinedAt: number;
            lastActiveAt: number;
            isOnline: boolean;
            totalAmount: number;
            itemCount: number;
            paymentStatus: "unpaid" | "pending" | "paid";
        };
        settings: {
            maxMembers: number;
            allowEditOthers: boolean;
            splitType: "equal" | "proportional" | "individual" | "custom";
        };
        totalAmount: number;
        lastActivity: number;
        createdAt: number;
        expiresAt: number;
    } | null, GroupOrderState | {
        id: string;
        shareCode: string;
        status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
        restaurantId: number;
        members: {
            id: string;
            sessionId: string;
            name: string;
            phone?: string | undefined;
            role: "creator" | "admin" | "member";
            joinedAt: number;
            lastActiveAt: number;
            isOnline: boolean;
            totalAmount: number;
            itemCount: number;
            paymentStatus: "unpaid" | "pending" | "paid";
        }[];
        cart: {
            id: string;
            memberId: string;
            menuItemId: number;
            menuItemName: string;
            quantity: number;
            unitPrice: number;
            totalPrice: number;
            customizations: Record<string, any>;
            specialInstructions?: string | undefined;
            addedAt: number;
            updatedAt: number;
            version: number;
        }[];
        splitBills: {
            id: string;
            memberId: string;
            subtotal: number;
            taxAmount: number;
            serviceCharge: number;
            totalAmount: number;
            items: string[];
            paymentStatus: "pending" | "processing" | "paid" | "failed";
            paymentMethod?: string | undefined;
            paidAt?: number | undefined;
        }[];
        host: {
            id: string;
            sessionId: string;
            name: string;
            phone?: string | undefined;
            role: "creator" | "admin" | "member";
            joinedAt: number;
            lastActiveAt: number;
            isOnline: boolean;
            totalAmount: number;
            itemCount: number;
            paymentStatus: "unpaid" | "pending" | "paid";
        };
        settings: {
            maxMembers: number;
            allowEditOthers: boolean;
            splitType: "equal" | "proportional" | "individual" | "custom";
        };
        totalAmount: number;
        lastActivity: number;
        createdAt: number;
        expiresAt: number;
    } | null>;
    myMemberId: import("vue").Ref<string | null, string | null>;
    myMember: import("vue").ComputedRef<{
        id: string;
        sessionId: string;
        name: string;
        phone?: string | undefined;
        role: "creator" | "admin" | "member";
        joinedAt: number;
        lastActiveAt: number;
        isOnline: boolean;
        totalAmount: number;
        itemCount: number;
        paymentStatus: "unpaid" | "pending" | "paid";
    } | null>;
    recentEvents: import("vue").Ref<{
        type: string;
        groupOrderId: string;
        timestamp: number;
        data: any;
    }[], GroupOrderEvent[] | {
        type: string;
        groupOrderId: string;
        timestamp: number;
        data: any;
    }[]>;
    notifications: import("vue").Ref<{
        id: string;
        type: string;
        message: string;
        timestamp: number;
        read: boolean;
    }[], {
        id: string;
        type: string;
        message: string;
        timestamp: number;
        read: boolean;
    }[] | {
        id: string;
        type: string;
        message: string;
        timestamp: number;
        read: boolean;
    }[]>;
    canEditCart: import("vue").ComputedRef<boolean>;
    canInitiateSplit: import("vue").ComputedRef<boolean>;
    allMembersPaid: import("vue").ComputedRef<boolean>;
    connectWebSocket: (groupOrderId?: string) => Promise<void>;
    disconnectWebSocket: () => void;
    joinGroupOrder: (shareCode: string, memberName: string, phone?: string) => Promise<boolean>;
    leaveGroupOrder: () => Promise<boolean>;
    addCartItem: (item: {
        menuItemId: number;
        menuItemName: string;
        quantity: number;
        unitPrice: number;
        customizations?: Record<string, any>;
        specialInstructions?: string;
    }) => Promise<boolean>;
    updateCartItem: (itemId: string, updates: {
        quantity?: number;
        customizations?: Record<string, any>;
        specialInstructions?: string;
    }) => Promise<boolean>;
    removeCartItem: (itemId: string) => Promise<boolean>;
    initiateSplitBill: (splitType: "equal" | "proportional" | "individual" | "custom", customSplits?: Array<{
        memberId: string;
        amount: number;
        items: string[];
    }>) => Promise<boolean>;
    processPayment: (paymentMethod: string, amount: number, transactionId?: string) => Promise<boolean>;
    markNotificationAsRead: (notificationId: string) => void;
    markAllNotificationsAsRead: () => void;
    clearNotifications: () => void;
    getGroupOrderById: (groupOrderId: string) => GroupOrderState | null;
    getRecentEvents: (limit?: number) => GroupOrderEvent[];
    getUnreadNotifications: () => {
        id: string;
        type: string;
        message: string;
        timestamp: number;
        read: boolean;
    }[];
    getMemberById: (memberId: string) => GroupOrderMember | null;
    getCartItemsByMember: (memberId: string) => GroupOrderCartItem[];
    getMyCartItems: () => GroupOrderCartItem[];
    getMySplitBill: () => GroupOrderSplitBill | null;
    startListening: () => void;
    stopListening: () => void;
};
export default useRealtimeGroupOrders;
