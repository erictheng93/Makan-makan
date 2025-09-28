/**
 * 群組訂單實時狀態廣播服務
 *
 * 負責處理群組訂單的實時同步、狀態廣播、衝突解決等核心功能
 */

// Removed unused ref import
import { realtimeService } from "./realtimeService";

// 狀態同步類型定義
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

class GroupOrderBroadcastService {
  private syncStates = new Map<string, SyncState>();
  private acknowledgments = new Map<string, Set<string>>();
  private operationQueue = new Map<string, StateOperation[]>();
  private conflictResolver = new Map<
    string,
    (conflict: StateOperation[]) => ConflictResolution
  >();

  // 廣播配置
  private readonly BATCH_DELAY = 100; // 批量處理延遲 (ms)
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly ACK_TIMEOUT = 5000; // 確認超時 (ms)

  /**
   * 初始化群組訂單的狀態同步
   */
  async initializeSync(
    groupOrderId: string,
    initialState?: any,
  ): Promise<void> {
    const syncState: SyncState = {
      groupOrderId,
      lastSyncTime: Date.now(),
      pendingOperations: [],
      conflictedOperations: [],
      version: 1,
      checksum: this.calculateChecksum(initialState || {}),
    };

    this.syncStates.set(groupOrderId, syncState);

    console.log(`Initialized sync for group order: ${groupOrderId}`);
  }

  /**
   * 廣播狀態變更操作
   */
  async broadcastOperation(
    groupOrderId: string,
    operation: Omit<StateOperation, "id" | "timestamp" | "version">,
  ): Promise<void> {
    const syncState = this.syncStates.get(groupOrderId);
    if (!syncState) {
      console.warn(`Sync state not found for group: ${groupOrderId}`);
      return;
    }

    // 創建完整的操作記錄
    const fullOperation: StateOperation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      version: syncState.version + 1,
      checksum: this.calculateChecksum(operation.data),
      ...operation,
    };

    // 添加到待處理隊列
    syncState.pendingOperations.push(fullOperation);
    syncState.version++;

    // 批量處理操作
    this.enqueueBatchedOperation(groupOrderId, fullOperation);

    console.log(
      `Broadcasting operation for group ${groupOrderId}:`,
      fullOperation.type,
      fullOperation.entity,
    );
  }

  /**
   * 批量處理操作以提高性能
   */
  private enqueueBatchedOperation(
    groupOrderId: string,
    operation: StateOperation,
  ): void {
    if (!this.operationQueue.has(groupOrderId)) {
      this.operationQueue.set(groupOrderId, []);

      // 延遲批量發送
      setTimeout(() => {
        this.processBatchedOperations(groupOrderId);
      }, this.BATCH_DELAY);
    }

    this.operationQueue.get(groupOrderId)!.push(operation);
  }

  /**
   * 處理批量操作
   */
  private async processBatchedOperations(groupOrderId: string): Promise<void> {
    const operations = this.operationQueue.get(groupOrderId);
    if (!operations || operations.length === 0) return;

    // 清空隊列
    this.operationQueue.delete(groupOrderId);

    // 創建廣播消息
    const message: BroadcastMessage = {
      id: crypto.randomUUID(),
      type: operations.length === 1 ? "single_operation" : "batch_operations",
      groupOrderId,
      data: {
        operations,
        batchSize: operations.length,
        totalChecksum: this.calculateBatchChecksum(operations),
      },
      timestamp: Date.now(),
      senderId: this.getCurrentUserId(),
      requiresAck: true,
      priority: this.determinePriority(operations),
    };

    // 發送廣播
    await this.sendBroadcast(message);

    // 處理確認超時
    this.handleAcknowledgmentTimeout(message.id, groupOrderId);
  }

  /**
   * 發送廣播消息
   */
  private async sendBroadcast(message: BroadcastMessage): Promise<void> {
    try {
      // 通過 SSE 發送
      const success = await realtimeService.broadcastToGroup(
        message.groupOrderId,
        {
          type: "group_order_broadcast",
          data: message,
        },
      );

      if (!success) {
        console.error("Failed to broadcast message:", message.id);
        // 重試邏輯
        this.retryBroadcast(message);
      }
    } catch (error) {
      console.error("Broadcast error:", error);
      this.retryBroadcast(message);
    }
  }

  /**
   * 重試廣播
   */
  private async retryBroadcast(
    message: BroadcastMessage,
    attempt = 1,
  ): Promise<void> {
    if (attempt > this.MAX_RETRY_ATTEMPTS) {
      console.error(`Max retry attempts reached for message: ${message.id}`);
      return;
    }

    const delay = Math.pow(2, attempt) * 1000; // 指數退避
    setTimeout(async () => {
      console.log(`Retrying broadcast (attempt ${attempt}):`, message.id);
      await this.sendBroadcast(message);
    }, delay);
  }

  /**
   * 處理收到的操作
   */
  async handleReceivedOperations(
    groupOrderId: string,
    operations: StateOperation[],
    senderId: string,
  ): Promise<void> {
    const syncState = this.syncStates.get(groupOrderId);
    if (!syncState) return;

    // 檢測衝突
    const conflicts = this.detectConflicts(
      operations,
      syncState.pendingOperations,
    );

    if (conflicts.length > 0) {
      console.warn(`Conflicts detected for group ${groupOrderId}:`, conflicts);
      await this.resolveConflicts(groupOrderId, conflicts);
      return;
    }

    // 應用操作
    for (const operation of operations) {
      await this.applyOperation(groupOrderId, operation);
    }

    // 更新同步狀態
    syncState.lastSyncTime = Date.now();
    syncState.version = Math.max(
      syncState.version,
      ...operations.map((op) => op.version),
    );

    // 發送確認
    await this.sendAcknowledgment(
      groupOrderId,
      operations.map((op) => op.id),
      senderId,
    );

    console.log(
      `Applied ${operations.length} operations for group ${groupOrderId}`,
    );
  }

  /**
   * 衝突檢測
   */
  private detectConflicts(
    incomingOps: StateOperation[],
    pendingOps: StateOperation[],
  ): StateOperation[] {
    const conflicts: StateOperation[] = [];

    for (const incomingOp of incomingOps) {
      for (const pendingOp of pendingOps) {
        if (this.operationsConflict(incomingOp, pendingOp)) {
          conflicts.push(incomingOp);
          break;
        }
      }
    }

    return conflicts;
  }

  /**
   * 判斷操作是否衝突
   */
  private operationsConflict(
    op1: StateOperation,
    op2: StateOperation,
  ): boolean {
    // 同一實體的同時操作
    if (op1.entity === op2.entity && op1.entityId === op2.entityId) {
      // 時間窗口內的衝突（100ms內）
      if (Math.abs(op1.timestamp - op2.timestamp) < 100) {
        return true;
      }

      // 版本衝突
      if (op1.version === op2.version && op1.userId !== op2.userId) {
        return true;
      }
    }

    // 購物車項目的數量衝突
    if (
      op1.entity === "cart_item" &&
      op2.entity === "cart_item" &&
      op1.entityId === op2.entityId
    ) {
      if (op1.type === "update" && op2.type === "update") {
        const data1 = op1.data;
        const data2 = op2.data;
        if (data1.quantity !== undefined && data2.quantity !== undefined) {
          return data1.quantity !== data2.quantity;
        }
      }
    }

    return false;
  }

  /**
   * 解決衝突
   */
  private async resolveConflicts(
    groupOrderId: string,
    conflicts: StateOperation[],
  ): Promise<void> {
    const syncState = this.syncStates.get(groupOrderId);
    if (!syncState) return;

    for (const conflict of conflicts) {
      const resolution = await this.getConflictResolution(
        groupOrderId,
        conflict,
      );

      switch (resolution.resolution) {
        case "accept":
          await this.applyOperation(groupOrderId, conflict);
          break;

        case "reject":
          console.log(`Rejected conflicted operation: ${conflict.id}`);
          break;

        case "merge":
          if (resolution.resolvedData) {
            const mergedOperation: StateOperation = {
              ...conflict,
              data: resolution.resolvedData,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
            };
            await this.applyOperation(groupOrderId, mergedOperation);
          }
          break;

        case "retry":
          // 延遲重試
          setTimeout(() => {
            this.handleReceivedOperations(
              groupOrderId,
              [conflict],
              conflict.userId,
            );
          }, 1000);
          break;
      }
    }
  }

  /**
   * 獲取衝突解決方案
   */
  private async getConflictResolution(
    groupOrderId: string,
    conflict: StateOperation,
  ): Promise<ConflictResolution> {
    // 自定義解決器
    const resolver = this.conflictResolver.get(
      `${groupOrderId}:${conflict.entity}`,
    );
    if (resolver) {
      return resolver([conflict]);
    }

    // 默認解決策略
    return this.getDefaultConflictResolution(conflict);
  }

  /**
   * 默認衝突解決策略
   */
  private getDefaultConflictResolution(
    conflict: StateOperation,
  ): ConflictResolution {
    switch (conflict.entity) {
      case "cart_item":
        if (
          conflict.type === "update" &&
          conflict.data.quantity !== undefined
        ) {
          // 數量衝突：取較大值
          return {
            operationId: conflict.id,
            resolution: "merge",
            resolvedData: {
              ...conflict.data,
              quantity: Math.max(
                conflict.data.quantity,
                conflict.data.originalQuantity || 0,
              ),
            },
            reason: "quantity_max_strategy",
          };
        }
        break;

      case "member":
        // 成員操作：最後寫入獲勝
        return {
          operationId: conflict.id,
          resolution: "accept",
          reason: "last_write_wins",
        };

      case "split_bill":
        // 分帳操作：需要人工介入
        return {
          operationId: conflict.id,
          resolution: "reject",
          reason: "requires_manual_intervention",
        };
    }

    // 默認策略：時間戳較新的獲勝
    return {
      operationId: conflict.id,
      resolution: "accept",
      reason: "timestamp_newer",
    };
  }

  /**
   * 應用操作到狀態
   */
  private async applyOperation(
    groupOrderId: string,
    operation: StateOperation,
  ): Promise<void> {
    // 觸發狀態更新事件
    const eventType = this.getEventTypeFromOperation(operation);

    await realtimeService.broadcastToGroup(groupOrderId, {
      type: eventType,
      data: {
        operation,
        groupOrderId,
      },
    });

    console.log(`Applied operation ${operation.id} for group ${groupOrderId}`);
  }

  /**
   * 根據操作類型獲取事件類型
   */
  private getEventTypeFromOperation(operation: StateOperation): string {
    const entityMap: Record<string, string> = {
      member: "GROUP_MEMBER",
      cart_item: "GROUP_CART_ITEM",
      split_bill: "GROUP_SPLIT_BILL",
      group_setting: "GROUP_ORDER",
    };

    const actionMap: Record<string, string> = {
      add: "ADDED",
      update: "UPDATED",
      remove: "REMOVED",
    };

    const entity = entityMap[operation.entity] || "GROUP_ORDER";
    const action = actionMap[operation.type] || "UPDATED";

    return `${entity}_${action}`;
  }

  /**
   * 發送確認消息
   */
  private async sendAcknowledgment(
    groupOrderId: string,
    operationIds: string[],
    targetUserId: string,
  ): Promise<void> {
    await realtimeService.broadcastToGroup(groupOrderId, {
      type: "operation_acknowledgment",
      data: {
        operationIds,
        acknowledgedBy: this.getCurrentUserId(),
        timestamp: Date.now(),
      },
      excludeSessionId: targetUserId,
    });
  }

  /**
   * 處理確認超時
   */
  private handleAcknowledgmentTimeout(
    messageId: string,
    groupOrderId: string,
  ): void {
    setTimeout(() => {
      const acks = this.acknowledgments.get(messageId);
      if (!acks) {
        console.warn(`No acknowledgments received for message: ${messageId}`);
        // 觸發重同步
        this.triggerResync(groupOrderId);
      }
    }, this.ACK_TIMEOUT);
  }

  /**
   * 觸發重新同步
   */
  async triggerResync(groupOrderId: string): Promise<void> {
    console.log(`Triggering resync for group: ${groupOrderId}`);

    const serverState = await realtimeService.syncGroupState(groupOrderId);
    if (serverState) {
      await this.applyServerState(groupOrderId, serverState);
    }
  }

  /**
   * 應用服務器狀態
   */
  private async applyServerState(
    groupOrderId: string,
    serverState: any,
  ): Promise<void> {
    const syncState = this.syncStates.get(groupOrderId);
    if (!syncState) return;

    // 比較版本
    if (serverState.version > syncState.version) {
      // 觸發狀態同步事件
      await realtimeService.broadcastToGroup(groupOrderId, {
        type: "group_order_state_sync",
        data: {
          groupOrderId,
          serverState,
          previousVersion: syncState.version,
          newVersion: serverState.version,
        },
      });

      // 更新本地同步狀態
      syncState.version = serverState.version;
      syncState.lastSyncTime = Date.now();
      syncState.pendingOperations = [];
      syncState.conflictedOperations = [];
    }
  }

  /**
   * 註冊自定義衝突解決器
   */
  registerConflictResolver(
    groupOrderId: string,
    entity: string,
    resolver: (conflicts: StateOperation[]) => ConflictResolution,
  ): void {
    this.conflictResolver.set(`${groupOrderId}:${entity}`, resolver);
  }

  /**
   * 取消註冊衝突解決器
   */
  unregisterConflictResolver(groupOrderId: string, entity: string): void {
    this.conflictResolver.delete(`${groupOrderId}:${entity}`);
  }

  /**
   * 獲取同步統計信息
   */
  getSyncStats(groupOrderId: string) {
    const syncState = this.syncStates.get(groupOrderId);
    if (!syncState) return null;

    return {
      groupOrderId,
      version: syncState.version,
      lastSyncTime: syncState.lastSyncTime,
      pendingOperationsCount: syncState.pendingOperations.length,
      conflictedOperationsCount: syncState.conflictedOperations.length,
      queuedOperationsCount: this.operationQueue.get(groupOrderId)?.length || 0,
    };
  }

  /**
   * 清理群組同步狀態
   */
  cleanup(groupOrderId: string): void {
    this.syncStates.delete(groupOrderId);
    this.operationQueue.delete(groupOrderId);

    // 清理相關的確認記錄
    for (const [messageId] of this.acknowledgments) {
      if (messageId.startsWith(groupOrderId)) {
        this.acknowledgments.delete(messageId);
      }
    }

    // 清理衝突解決器
    for (const key of this.conflictResolver.keys()) {
      if (key.startsWith(`${groupOrderId}:`)) {
        this.conflictResolver.delete(key);
      }
    }

    console.log(`Cleaned up sync state for group: ${groupOrderId}`);
  }

  /**
   * 工具方法
   */
  private calculateChecksum(data: any): string {
    // 簡單的 checksum 算法，實際應用中可以使用更強健的算法
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 轉換為 32位整數
    }
    return Math.abs(hash).toString(36);
  }

  private calculateBatchChecksum(operations: StateOperation[]): string {
    return this.calculateChecksum(
      operations.map((op) => ({
        id: op.id,
        type: op.type,
        entity: op.entity,
        entityId: op.entityId,
        version: op.version,
      })),
    );
  }

  private determinePriority(
    operations: StateOperation[],
  ): "low" | "normal" | "high" | "urgent" {
    // 根據操作類型確定優先級
    const hasPayment = operations.some((op) => op.entity === "split_bill");
    const hasMemberChange = operations.some((op) => op.entity === "member");
    const hasCartChange = operations.some((op) => op.entity === "cart_item");

    if (hasPayment) return "urgent";
    if (hasMemberChange) return "high";
    if (hasCartChange) return "normal";
    return "low";
  }

  private getCurrentUserId(): string {
    // 從認證狀態獲取當前用戶ID
    return localStorage.getItem("user_id") || "anonymous";
  }
}

// 單例實例
export const groupOrderBroadcastService = new GroupOrderBroadcastService();
export default groupOrderBroadcastService;
