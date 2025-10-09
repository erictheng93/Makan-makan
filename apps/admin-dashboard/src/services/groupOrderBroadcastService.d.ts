/**
 * 群組訂單實時狀態廣播服務
 *
 * 負責處理群組訂單的實時同步、狀態廣播、衝突解決等核心功能
 */
export interface StateOperation {
    id: string;
    type: "add" | "update" | "remove";
    entity: "member" | "cart_item" | "split_bill" | "group_setting";
    entityId: string;
    data: any;
    timestamp: number;
    userId: string;
    version: number;
    checksum?: string;
}
export interface ConflictResolution {
    operationId: string;
    resolution: "accept" | "reject" | "merge" | "retry";
    resolvedData?: any;
    reason: string;
}
export interface SyncState {
    groupOrderId: string;
    lastSyncTime: number;
    pendingOperations: StateOperation[];
    conflictedOperations: StateOperation[];
    version: number;
    checksum: string;
}
export interface BroadcastMessage {
    id: string;
    type: string;
    groupOrderId: string;
    operation?: StateOperation;
    data: any;
    timestamp: number;
    senderId: string;
    targetMembers?: string[];
    requiresAck?: boolean;
    priority: "low" | "normal" | "high" | "urgent";
}
declare class GroupOrderBroadcastService {
    private syncStates;
    private acknowledgments;
    private operationQueue;
    private conflictResolver;
    private readonly BATCH_DELAY;
    private readonly MAX_RETRY_ATTEMPTS;
    private readonly ACK_TIMEOUT;
    /**
     * 初始化群組訂單的狀態同步
     */
    initializeSync(groupOrderId: string, initialState?: any): Promise<void>;
    /**
     * 廣播狀態變更操作
     */
    broadcastOperation(groupOrderId: string, operation: Omit<StateOperation, "id" | "timestamp" | "version">): Promise<void>;
    /**
     * 批量處理操作以提高性能
     */
    private enqueueBatchedOperation;
    /**
     * 處理批量操作
     */
    private processBatchedOperations;
    /**
     * 發送廣播消息
     */
    private sendBroadcast;
    /**
     * 重試廣播
     */
    private retryBroadcast;
    /**
     * 處理收到的操作
     */
    handleReceivedOperations(groupOrderId: string, operations: StateOperation[], senderId: string): Promise<void>;
    /**
     * 衝突檢測
     */
    private detectConflicts;
    /**
     * 判斷操作是否衝突
     */
    private operationsConflict;
    /**
     * 解決衝突
     */
    private resolveConflicts;
    /**
     * 獲取衝突解決方案
     */
    private getConflictResolution;
    /**
     * 默認衝突解決策略
     */
    private getDefaultConflictResolution;
    /**
     * 應用操作到狀態
     */
    private applyOperation;
    /**
     * 根據操作類型獲取事件類型
     */
    private getEventTypeFromOperation;
    /**
     * 發送確認消息
     */
    private sendAcknowledgment;
    /**
     * 處理確認超時
     */
    private handleAcknowledgmentTimeout;
    /**
     * 觸發重新同步
     */
    triggerResync(groupOrderId: string): Promise<void>;
    /**
     * 應用服務器狀態
     */
    private applyServerState;
    /**
     * 註冊自定義衝突解決器
     */
    registerConflictResolver(groupOrderId: string, entity: string, resolver: (conflicts: StateOperation[]) => ConflictResolution): void;
    /**
     * 取消註冊衝突解決器
     */
    unregisterConflictResolver(groupOrderId: string, entity: string): void;
    /**
     * 獲取同步統計信息
     */
    getSyncStats(groupOrderId: string): {
        groupOrderId: string;
        version: number;
        lastSyncTime: number;
        pendingOperationsCount: number;
        conflictedOperationsCount: number;
        queuedOperationsCount: number;
    } | null;
    /**
     * 清理群組同步狀態
     */
    cleanup(groupOrderId: string): void;
    /**
     * 工具方法
     */
    private calculateChecksum;
    private calculateBatchChecksum;
    private determinePriority;
    private getCurrentUserId;
}
export declare const groupOrderBroadcastService: GroupOrderBroadcastService;
export default groupOrderBroadcastService;
