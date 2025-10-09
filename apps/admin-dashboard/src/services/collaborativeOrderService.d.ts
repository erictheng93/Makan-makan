/**
 * 多用戶協作訂單管理服務
 *
 * 提供群組訂單的協作功能，包括實時編輯、權限控制、操作鎖定、
 * 並發衝突解決等核心協作特性
 */
export interface EditLock {
    id: string;
    entityType: "cart_item" | "member_profile" | "group_settings" | "split_bill";
    entityId: string;
    lockedBy: string;
    lockedByName: string;
    lockedAt: number;
    expiresAt: number;
    lockType: "read" | "write" | "exclusive";
}
export interface UserPresence {
    userId: string;
    userName: string;
    sessionId: string;
    isOnline: boolean;
    lastActivity: number;
    currentAction?: string;
    editingEntity?: {
        type: string;
        id: string;
    };
    cursor?: {
        x: number;
        y: number;
    };
}
export interface CollaborativeAction {
    id: string;
    type: "typing" | "selecting" | "editing" | "viewing" | "idle";
    entityType: string;
    entityId: string;
    userId: string;
    userName: string;
    data: any;
    timestamp: number;
}
export interface OperationPermission {
    action: string;
    entityType: string;
    required: Permission[];
    condition?: (user: any, entity: any, context: any) => boolean;
}
export interface Permission {
    type: "role" | "ownership" | "group_admin" | "custom";
    value: any;
}
export interface ConflictAlert {
    id: string;
    type: "edit_conflict" | "permission_conflict" | "version_conflict";
    message: string;
    entities: string[];
    users: string[];
    suggestedActions: string[];
    timestamp: number;
    severity: "low" | "medium" | "high" | "critical";
}
declare class CollaborativeOrderService {
    private activeLocks;
    private userPresences;
    private collaborativeActions;
    private permissionRules;
    private conflictAlerts;
    private readonly LOCK_TIMEOUT;
    private readonly PRESENCE_TIMEOUT;
    private readonly ACTION_HISTORY_LIMIT;
    private readonly CONFLICT_RESOLUTION_TIMEOUT;
    /**
     * 初始化協作環境
     */
    initializeCollaboration(groupOrderId: string, userId: string, userName: string): Promise<void>;
    /**
     * 設置用戶在線狀態
     */
    setUserPresence(groupOrderId: string, presence: Partial<UserPresence>): Promise<void>;
    /**
     * 請求編輯鎖定
     */
    requestEditLock(groupOrderId: string, entityType: EditLock["entityType"], entityId: string, userId: string, userName: string, lockType?: EditLock["lockType"]): Promise<{
        success: boolean;
        lock?: EditLock;
        conflict?: EditLock;
    }>;
    /**
     * 釋放編輯鎖定
     */
    releaseLock(groupOrderId: string, lockId: string): Promise<void>;
    /**
     * 檢查操作權限
     */
    checkPermission(groupOrderId: string, action: string, entityType: string, userId: string, context?: any): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    /**
     * 評估權限規則
     */
    private evaluatePermissionRule;
    /**
     * 檢查單個權限
     */
    private evaluatePermission;
    /**
     * 記錄協作動作
     */
    recordCollaborativeAction(groupOrderId: string, action: CollaborativeAction): Promise<void>;
    /**
     * 處理實時編輯
     */
    handleRealtimeEdit(groupOrderId: string, entityType: string, entityId: string, userId: string, changes: any): Promise<{
        success: boolean;
        conflicts?: any[];
    }>;
    /**
     * 處理衝突警報
     */
    createConflictAlert(groupOrderId: string, type: ConflictAlert["type"], message: string, entities: string[], users: string[], severity?: ConflictAlert["severity"]): Promise<void>;
    /**
     * 獲取建議動作
     */
    private getSuggestedActions;
    /**
     * 解決衝突警報
     */
    resolveConflictAlert(alertId: string): void;
    /**
     * 獲取群組在線用戶
     */
    getOnlineUsers(groupOrderId: string): UserPresence[];
    /**
     * 獲取活躍鎖定
     */
    getActiveLocks(groupOrderId: string): EditLock[];
    /**
     * 獲取協作動作歷史
     */
    getActionHistory(groupOrderId: string, limit?: number): CollaborativeAction[];
    /**
     * 獲取衝突警報
     */
    getConflictAlerts(): ConflictAlert[];
    /**
     * 初始化權限規則
     */
    private initializePermissionRules;
    /**
     * 開始監聽協作事件
     */
    private startCollaborationListening;
    /**
     * 處理協作事件
     */
    private handleCollaborationEvent;
    /**
     * 更新用戶活動狀態
     */
    private updateUserActivity;
    /**
     * 清理協作狀態
     */
    cleanup(groupOrderId: string): void;
}
export declare const collaborativeOrderService: CollaborativeOrderService;
export default collaborativeOrderService;
