/**
 * 多用戶協作訂單管理服務
 *
 * 提供群組訂單的協作功能，包括實時編輯、權限控制、操作鎖定、
 * 並發衝突解決等核心協作特性
 */
import { ref } from "vue";
import { groupOrderBroadcastService } from "./groupOrderBroadcastService";
import { realtimeService, REALTIME_EVENTS } from "./realtimeService";
class CollaborativeOrderService {
    constructor() {
        // 狀態管理
        Object.defineProperty(this, "activeLocks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "userPresences", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "collaborativeActions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "permissionRules", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "conflictAlerts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ref([])
        });
        // 配置
        Object.defineProperty(this, "LOCK_TIMEOUT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 30000
        }); // 鎖定超時 30秒
        Object.defineProperty(this, "PRESENCE_TIMEOUT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 10000
        }); // 在線狀態超時 10秒
        Object.defineProperty(this, "ACTION_HISTORY_LIMIT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 100
        });
        Object.defineProperty(this, "CONFLICT_RESOLUTION_TIMEOUT", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 15000
        }); // 衝突解決超時 15秒
    }
    /**
     * 初始化協作環境
     */
    async initializeCollaboration(groupOrderId, userId, userName) {
        // 設置用戶在線狀態
        await this.setUserPresence(groupOrderId, {
            userId,
            userName,
            sessionId: crypto.randomUUID(),
            isOnline: true,
            lastActivity: Date.now(),
            currentAction: "joined",
        });
        // 初始化權限規則
        this.initializePermissionRules(groupOrderId);
        // 開始監聽協作事件
        this.startCollaborationListening(groupOrderId);
        console.log(`Initialized collaboration for group ${groupOrderId}, user ${userName}`);
    }
    /**
     * 設置用戶在線狀態
     */
    async setUserPresence(groupOrderId, presence) {
        const fullPresence = {
            userId: presence.userId,
            userName: presence.userName,
            sessionId: presence.sessionId || crypto.randomUUID(),
            isOnline: true,
            lastActivity: Date.now(),
            ...presence,
        };
        this.userPresences.set(`${groupOrderId}:${presence.userId}`, fullPresence);
        // 廣播在線狀態變更
        await realtimeService.broadcastToGroup(groupOrderId, {
            type: REALTIME_EVENTS.GROUP_MEMBER_ACTIVITY,
            data: {
                type: "presence_update",
                presence: fullPresence,
                groupOrderId,
            },
        });
    }
    /**
     * 請求編輯鎖定
     */
    async requestEditLock(groupOrderId, entityType, entityId, userId, userName, lockType = "write") {
        const lockKey = `${groupOrderId}:${entityType}:${entityId}`;
        const existingLock = this.activeLocks.get(lockKey);
        // 檢查現有鎖定
        if (existingLock && existingLock.lockedBy !== userId) {
            if (existingLock.expiresAt > Date.now()) {
                // 鎖定仍有效，返回衝突
                return {
                    success: false,
                    conflict: existingLock,
                };
            }
            else {
                // 鎖定已過期，清理
                await this.releaseLock(groupOrderId, existingLock.id);
            }
        }
        // 創建新鎖定
        const lock = {
            id: crypto.randomUUID(),
            entityType,
            entityId,
            lockedBy: userId,
            lockedByName: userName,
            lockedAt: Date.now(),
            expiresAt: Date.now() + this.LOCK_TIMEOUT,
            lockType,
        };
        this.activeLocks.set(lockKey, lock);
        // 廣播鎖定事件
        await realtimeService.broadcastToGroup(groupOrderId, {
            type: "edit_lock_acquired",
            data: {
                lock,
                groupOrderId,
            },
        });
        // 設置自動釋放
        setTimeout(() => {
            this.releaseLock(groupOrderId, lock.id);
        }, this.LOCK_TIMEOUT);
        return { success: true, lock };
    }
    /**
     * 釋放編輯鎖定
     */
    async releaseLock(groupOrderId, lockId) {
        let releasedLock;
        for (const [key, lock] of this.activeLocks) {
            if (lock.id === lockId) {
                releasedLock = lock;
                this.activeLocks.delete(key);
                break;
            }
        }
        if (releasedLock) {
            // 廣播鎖定釋放事件
            await realtimeService.broadcastToGroup(groupOrderId, {
                type: "edit_lock_released",
                data: {
                    lock: releasedLock,
                    groupOrderId,
                },
            });
            console.log(`Released lock ${lockId} for ${releasedLock.entityType}:${releasedLock.entityId}`);
        }
    }
    /**
     * 檢查操作權限
     */
    async checkPermission(groupOrderId, action, entityType, userId, context = {}) {
        const rules = this.permissionRules.get(groupOrderId) || [];
        const applicableRules = rules.filter((rule) => rule.action === action && rule.entityType === entityType);
        if (applicableRules.length === 0) {
            // 沒有特定規則，默認允許
            return { allowed: true };
        }
        // 獲取用戶信息
        const userPresence = this.userPresences.get(`${groupOrderId}:${userId}`);
        if (!userPresence) {
            return { allowed: false, reason: "User not found in group" };
        }
        // 檢查所有適用規則
        for (const rule of applicableRules) {
            const result = await this.evaluatePermissionRule(rule, userPresence, context);
            if (!result.allowed) {
                return result;
            }
        }
        return { allowed: true };
    }
    /**
     * 評估權限規則
     */
    async evaluatePermissionRule(rule, user, context) {
        // 檢查必需權限
        for (const permission of rule.required) {
            const result = this.evaluatePermission(permission, user, context);
            if (!result) {
                return {
                    allowed: false,
                    reason: `Missing permission: ${permission.type}`,
                };
            }
        }
        // 檢查條件函數
        if (rule.condition) {
            const conditionResult = rule.condition(user, context.entity, context);
            if (!conditionResult) {
                return {
                    allowed: false,
                    reason: "Condition check failed",
                };
            }
        }
        return { allowed: true };
    }
    /**
     * 檢查單個權限
     */
    evaluatePermission(permission, user, context) {
        switch (permission.type) {
            case "role":
                return user.role === permission.value;
            case "ownership":
                return (context.entity?.createdBy === user.userId ||
                    context.entity?.memberId === user.userId);
            case "group_admin":
                return user.role === "creator" || user.role === "admin";
            case "custom":
                if (typeof permission.value === "function") {
                    return permission.value(user, context);
                }
                return false;
            default:
                return false;
        }
    }
    /**
     * 記錄協作動作
     */
    async recordCollaborativeAction(groupOrderId, action) {
        const actionsKey = `${groupOrderId}:actions`;
        if (!this.collaborativeActions.has(actionsKey)) {
            this.collaborativeActions.set(actionsKey, []);
        }
        const actions = this.collaborativeActions.get(actionsKey);
        actions.unshift(action);
        // 限制歷史記錄長度
        if (actions.length > this.ACTION_HISTORY_LIMIT) {
            actions.splice(this.ACTION_HISTORY_LIMIT);
        }
        // 廣播動作事件
        await realtimeService.broadcastToGroup(groupOrderId, {
            type: "collaborative_action",
            data: {
                action,
                groupOrderId,
            },
        });
        // 更新用戶在線狀態
        const presence = this.userPresences.get(`${groupOrderId}:${action.userId}`);
        if (presence) {
            presence.lastActivity = Date.now();
            presence.currentAction = action.type;
            presence.editingEntity = {
                type: action.entityType,
                id: action.entityId,
            };
            await this.setUserPresence(groupOrderId, presence);
        }
    }
    /**
     * 處理實時編輯
     */
    async handleRealtimeEdit(groupOrderId, entityType, entityId, userId, changes) {
        // 檢查編輯鎖定
        const lockKey = `${groupOrderId}:${entityType}:${entityId}`;
        const lock = this.activeLocks.get(lockKey);
        if (lock && lock.lockedBy !== userId) {
            return {
                success: false,
                conflicts: [
                    {
                        type: "lock_conflict",
                        message: `Entity is locked by ${lock.lockedByName}`,
                        lockedBy: lock.lockedBy,
                    },
                ],
            };
        }
        // 檢查權限
        const permissionCheck = await this.checkPermission(groupOrderId, "edit", entityType, userId, { changes });
        if (!permissionCheck.allowed) {
            return {
                success: false,
                conflicts: [
                    {
                        type: "permission_conflict",
                        message: permissionCheck.reason || "Permission denied",
                    },
                ],
            };
        }
        // 記錄編輯動作
        await this.recordCollaborativeAction(groupOrderId, {
            id: crypto.randomUUID(),
            type: "editing",
            entityType,
            entityId,
            userId,
            userName: this.userPresences.get(`${groupOrderId}:${userId}`)?.userName ||
                "Unknown",
            data: changes,
            timestamp: Date.now(),
        });
        // 廣播編輯變更
        await groupOrderBroadcastService.broadcastOperation(groupOrderId, {
            type: "update",
            entity: entityType,
            entityId,
            data: changes,
            userId,
        });
        return { success: true };
    }
    /**
     * 處理衝突警報
     */
    async createConflictAlert(groupOrderId, type, message, entities, users, severity = "medium") {
        const alert = {
            id: crypto.randomUUID(),
            type,
            message,
            entities,
            users,
            suggestedActions: this.getSuggestedActions(type, entities, users),
            timestamp: Date.now(),
            severity,
        };
        this.conflictAlerts.value.unshift(alert);
        // 廣播衝突警報
        await realtimeService.broadcastToGroup(groupOrderId, {
            type: "conflict_alert",
            data: {
                alert,
                groupOrderId,
            },
        });
        // 設置自動清理
        setTimeout(() => {
            this.resolveConflictAlert(alert.id);
        }, this.CONFLICT_RESOLUTION_TIMEOUT);
    }
    /**
     * 獲取建議動作
     */
    getSuggestedActions(type, _entities, _users) {
        switch (type) {
            case "edit_conflict":
                return [
                    "Communicate with other editors",
                    "Take turns editing",
                    "Merge changes manually",
                    "Use conflict resolution tools",
                ];
            case "permission_conflict":
                return [
                    "Check user permissions",
                    "Contact group administrator",
                    "Request elevated access",
                    "Switch to read-only mode",
                ];
            case "version_conflict":
                return [
                    "Refresh to latest version",
                    "Compare changes",
                    "Merge conflicting versions",
                    "Revert to last known good state",
                ];
            default:
                return ["Contact support", "Refresh page", "Try again later"];
        }
    }
    /**
     * 解決衝突警報
     */
    resolveConflictAlert(alertId) {
        const index = this.conflictAlerts.value.findIndex((alert) => alert.id === alertId);
        if (index !== -1) {
            this.conflictAlerts.value.splice(index, 1);
        }
    }
    /**
     * 獲取群組在線用戶
     */
    getOnlineUsers(groupOrderId) {
        const onlineUsers = [];
        const now = Date.now();
        for (const [key, presence] of this.userPresences) {
            if (key.startsWith(`${groupOrderId}:`) && presence.isOnline) {
                // 檢查在線狀態是否過期
                if (now - presence.lastActivity < this.PRESENCE_TIMEOUT) {
                    onlineUsers.push(presence);
                }
                else {
                    // 標記為離線
                    presence.isOnline = false;
                }
            }
        }
        return onlineUsers.sort((a, b) => b.lastActivity - a.lastActivity);
    }
    /**
     * 獲取活躍鎖定
     */
    getActiveLocks(groupOrderId) {
        const now = Date.now();
        const activeLocks = [];
        for (const [key, lock] of this.activeLocks) {
            if (key.startsWith(`${groupOrderId}:`) && lock.expiresAt > now) {
                activeLocks.push(lock);
            }
        }
        return activeLocks;
    }
    /**
     * 獲取協作動作歷史
     */
    getActionHistory(groupOrderId, limit = 20) {
        const actionsKey = `${groupOrderId}:actions`;
        const actions = this.collaborativeActions.get(actionsKey) || [];
        return actions.slice(0, limit);
    }
    /**
     * 獲取衝突警報
     */
    getConflictAlerts() {
        return [...this.conflictAlerts.value];
    }
    /**
     * 初始化權限規則
     */
    initializePermissionRules(groupOrderId) {
        const rules = [
            // 購物車編輯權限
            {
                action: "edit",
                entityType: "cart_item",
                required: [{ type: "ownership", value: true }],
                condition: (user, entity, _context) => {
                    // 允許編輯自己的商品，或群組管理員
                    return (entity.memberId === user.userId ||
                        user.role === "creator" ||
                        user.role === "admin");
                },
            },
            // 分帳發起權限
            {
                action: "initiate_split",
                entityType: "split_bill",
                required: [{ type: "group_admin", value: true }],
            },
            // 群組設定修改權限
            {
                action: "edit",
                entityType: "group_settings",
                required: [{ type: "role", value: "creator" }],
            },
            // 成員管理權限
            {
                action: "manage",
                entityType: "member",
                required: [{ type: "group_admin", value: true }],
            },
        ];
        this.permissionRules.set(groupOrderId, rules);
    }
    /**
     * 開始監聽協作事件
     */
    startCollaborationListening(groupOrderId) {
        // 監聽編輯鎖定事件
        realtimeService.subscribe([
            "edit_lock_acquired",
            "edit_lock_released",
            "collaborative_action",
            "conflict_alert",
        ], (message) => {
            this.handleCollaborationEvent(message);
        }, groupOrderId);
    }
    /**
     * 處理協作事件
     */
    handleCollaborationEvent(message) {
        switch (message.type) {
            case "edit_lock_acquired": {
                const lock = message.data.lock;
                const lockKey = `${message.data.groupOrderId}:${lock.entityType}:${lock.entityId}`;
                this.activeLocks.set(lockKey, lock);
                break;
            }
            case "edit_lock_released": {
                const releasedLock = message.data.lock;
                const releasedKey = `${message.data.groupOrderId}:${releasedLock.entityType}:${releasedLock.entityId}`;
                this.activeLocks.delete(releasedKey);
                break;
            }
            case "collaborative_action":
                // 更新動作歷史和用戶狀態
                this.updateUserActivity(message.data.groupOrderId, message.data.action);
                break;
            case "conflict_alert":
                // 添加衝突警報
                if (!this.conflictAlerts.value.find((a) => a.id === message.data.alert.id)) {
                    this.conflictAlerts.value.unshift(message.data.alert);
                }
                break;
        }
    }
    /**
     * 更新用戶活動狀態
     */
    updateUserActivity(groupOrderId, action) {
        const presence = this.userPresences.get(`${groupOrderId}:${action.userId}`);
        if (presence) {
            presence.lastActivity = Date.now();
            presence.currentAction = action.type;
            presence.editingEntity = {
                type: action.entityType,
                id: action.entityId,
            };
        }
    }
    /**
     * 清理協作狀態
     */
    cleanup(groupOrderId) {
        // 清理用戶在線狀態
        for (const key of this.userPresences.keys()) {
            if (key.startsWith(`${groupOrderId}:`)) {
                this.userPresences.delete(key);
            }
        }
        // 清理活躍鎖定
        for (const key of this.activeLocks.keys()) {
            if (key.startsWith(`${groupOrderId}:`)) {
                this.activeLocks.delete(key);
            }
        }
        // 清理動作歷史
        this.collaborativeActions.delete(`${groupOrderId}:actions`);
        // 清理權限規則
        this.permissionRules.delete(groupOrderId);
        // 清理衝突警報
        this.conflictAlerts.value = this.conflictAlerts.value.filter((alert) => !alert.entities.some((entity) => entity.startsWith(groupOrderId)));
        console.log(`Cleaned up collaboration state for group: ${groupOrderId}`);
    }
}
// 單例實例
export const collaborativeOrderService = new CollaborativeOrderService();
export default collaborativeOrderService;
