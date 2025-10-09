/**
 * 測試模擬數據工具
 * 用於生成測試所需的群組訂單相關數據
 */
import type { GroupOrderState, GroupOrderMember, GroupOrderCartItem, GroupOrderSplitBill } from "@/composables/useRealtimeGroupOrders";
export declare function createMockGroupOrder(id?: string, options?: Partial<GroupOrderState>): GroupOrderState;
export declare function createMockMember(id?: string, name?: string, role?: GroupOrderMember["role"], options?: Partial<GroupOrderMember>): GroupOrderMember;
export declare function createMockCartItem(id?: string, memberId?: string, options?: Partial<GroupOrderCartItem>): GroupOrderCartItem;
export declare function createMockSplitBill(id?: string, memberId?: string, options?: Partial<GroupOrderSplitBill>): GroupOrderSplitBill;
export declare function createMockOperation(type?: "add" | "update" | "remove", entity?: "member" | "cart_item" | "split_bill" | "group_setting", options?: any): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: "add" | "update" | "remove";
    entity: "member" | "cart_item" | "split_bill" | "group_setting";
    entityId: any;
    data: any;
    timestamp: number;
    userId: any;
    version: any;
    checksum: string;
};
export declare function createMockCollaborativeAction(type?: "typing" | "selecting" | "editing" | "viewing" | "idle", entityType?: string, options?: any): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: "idle" | "typing" | "selecting" | "editing" | "viewing";
    entityType: string;
    entityId: any;
    userId: any;
    userName: any;
    data: any;
    timestamp: number;
};
export declare function createMockError(type?: "connection" | "sync" | "permission" | "data" | "network" | "server" | "client", severity?: "low" | "medium" | "high" | "critical", options?: any): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: "data" | "network" | "permission" | "connection" | "sync" | "server" | "client";
    severity: "critical" | "high" | "medium" | "low";
    message: any;
    details: any;
    timestamp: number;
    groupOrderId: any;
    userId: any;
    recovered: boolean;
    recoveryAttempts: number;
};
export declare function createMockConflictAlert(type?: "edit_conflict" | "permission_conflict" | "version_conflict", options?: any): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: "edit_conflict" | "permission_conflict" | "version_conflict";
    message: any;
    entities: any;
    users: any;
    suggestedActions: any;
    timestamp: number;
    severity: any;
};
export declare function createBulkMockData(count: number, type: "members" | "cartItems" | "splitBills"): (GroupOrderMember | GroupOrderCartItem | GroupOrderSplitBill)[];
export declare function createMockGroupOrderWithStatus(status: GroupOrderState["status"]): GroupOrderState;
export declare const mockScenarios: {
    smallGroup: () => GroupOrderState;
    largeGroup: () => GroupOrderState;
    readyForSplit: () => GroupOrderState;
    completedGroup: () => GroupOrderState;
    cancelledGroup: () => GroupOrderState;
};
declare const _default: {
    createMockGroupOrder: typeof createMockGroupOrder;
    createMockMember: typeof createMockMember;
    createMockCartItem: typeof createMockCartItem;
    createMockSplitBill: typeof createMockSplitBill;
    createMockOperation: typeof createMockOperation;
    createMockCollaborativeAction: typeof createMockCollaborativeAction;
    createMockError: typeof createMockError;
    createMockConflictAlert: typeof createMockConflictAlert;
    createBulkMockData: typeof createBulkMockData;
    createMockGroupOrderWithStatus: typeof createMockGroupOrderWithStatus;
    mockScenarios: {
        smallGroup: () => GroupOrderState;
        largeGroup: () => GroupOrderState;
        readyForSplit: () => GroupOrderState;
        completedGroup: () => GroupOrderState;
        cancelledGroup: () => GroupOrderState;
    };
};
export default _default;
