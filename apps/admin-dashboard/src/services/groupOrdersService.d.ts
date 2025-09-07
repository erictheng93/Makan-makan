export interface GroupOrderMember {
    id: string;
    groupOrderId: string;
    name: string;
    itemCount: number;
    totalAmount: number;
    paymentStatus: "unpaid" | "pending" | "paid";
    joinedAt: string;
}
export interface GroupOrder {
    id: string;
    shareCode: string;
    masterOrderId: string | null;
    tableNumber: string | null;
    status: "active" | "ready_to_pay" | "completed" | "cancelled";
    hostName: string;
    memberCount: number;
    totalAmount: number;
    subtotal: number;
    serviceCharge: number;
    taxAmount: number;
    itemCount: number;
    members: GroupOrderMember[];
    createdAt: string;
    completedAt: string | null;
    expiresAt: string;
}
export interface GroupCartItem {
    id: string;
    groupOrderId: string;
    memberId: string;
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    customizations?: any;
}
export interface SplitBill {
    id: string;
    groupOrderId: string;
    memberId: string;
    amount: number;
    paymentStatus: "pending" | "paid";
    paymentMethod?: string;
    paidAt?: string;
}
export declare const groupOrdersService: {
    getGroupOrders(params?: {
        status?: GroupOrder["status"];
        restaurantId?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<GroupOrder[]>;
    createGroupOrder(data: {
        tableNumber?: string;
        hostName: string;
        expectedMembers: number;
        restaurantId: string;
        notes?: string;
    }): Promise<GroupOrder>;
    getGroupOrder(shareCode: string): Promise<GroupOrder>;
    joinGroupOrder(shareCode: string, data: {
        memberName: string;
        phoneNumber?: string;
    }): Promise<{
        success: boolean;
        memberId: string;
        groupOrder: GroupOrder;
    }>;
    updateGroupOrder(id: string, data: Partial<GroupOrder>): Promise<GroupOrder>;
    cancelGroupOrder(id: string, reason?: string): Promise<void>;
    addCartItem(groupOrderId: string, data: {
        memberId: string;
        menuItemId: string;
        quantity: number;
        customizations?: any;
    }): Promise<GroupCartItem>;
    updateCartItem(groupOrderId: string, itemId: string, data: {
        quantity: number;
        customizations?: any;
    }): Promise<GroupCartItem>;
    removeCartItem(groupOrderId: string, itemId: string): Promise<void>;
    getCartItems(groupOrderId: string): Promise<GroupCartItem[]>;
    initiateSplit(groupOrderId: string, data: {
        splitType: "equal" | "by_item" | "custom";
        customSplits?: Array<{
            memberId: string;
            amount: number;
        }>;
    }): Promise<SplitBill[]>;
    getSplitBills(groupOrderId: string): Promise<SplitBill[]>;
    processPayment(groupOrderId: string, data: {
        memberId: string;
        splitBillId: string;
        paymentMethod: string;
        amount: number;
    }): Promise<{
        success: boolean;
        paymentId: string;
        receipt?: any;
    }>;
    generateShareCode(restaurantId: string): Promise<{
        shareCode: string;
        shareUrl: string;
        expiresAt: string;
    }>;
    getShareInfo(shareCode: string): Promise<{
        shareCode: string;
        shareUrl: string;
        groupOrder?: GroupOrder;
        isValid: boolean;
        expiresAt: string;
    }>;
    convertToOrder(groupOrderId: string): Promise<{
        success: boolean;
        orderId: string;
        orderNumber: string;
    }>;
    sendNotification(groupOrderId: string, data: {
        type: "join_reminder" | "payment_reminder" | "order_ready";
        memberIds?: string[];
        message?: string;
    }): Promise<void>;
    getGroupOrderStats(params?: {
        restaurantId?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<{
        totalGroupOrders: number;
        activeGroupOrders: number;
        averageGroupSize: number;
        totalRevenue: number;
        completionRate: number;
        popularTimes: Array<{
            hour: number;
            count: number;
        }>;
    }>;
    getMemberStats(groupOrderId: string): Promise<Array<{
        member: GroupOrderMember;
        orderValue: number;
        itemCount: number;
        paymentStatus: string;
    }>>;
    exportGroupOrders(params: {
        restaurantId?: string;
        startDate?: string;
        endDate?: string;
        status?: GroupOrder["status"];
        format: "csv" | "excel";
    }): Promise<Blob>;
    generateQRCode(shareCode: string): Promise<{
        qrCodeUrl: string;
        shareUrl: string;
    }>;
};
export default groupOrdersService;
