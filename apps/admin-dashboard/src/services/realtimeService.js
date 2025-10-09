// Real-time service using Server-Sent Events (SSE) and WebSocket fallback
import { ref } from "vue";
class RealtimeService {
    constructor() {
        Object.defineProperty(this, "eventSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "subscriptions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "connectionStatus", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ref("disconnected")
        });
        Object.defineProperty(this, "reconnectAttempts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "maxReconnectAttempts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 5
        });
        Object.defineProperty(this, "reconnectDelay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1000
        });
        Object.defineProperty(this, "heartbeatInterval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastEventId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ref(null)
        });
        Object.defineProperty(this, "messageBuffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxBufferSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 100
        });
        // 監聽頁面可見性變化，自動重連
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" &&
                this.connectionStatus.value === "disconnected") {
                this.connect();
            }
        });
        // 監聽網絡狀態變化
        window.addEventListener("online", () => {
            if (this.connectionStatus.value === "disconnected") {
                this.connect();
            }
        });
        window.addEventListener("offline", () => {
            this.disconnect();
        });
    }
    // 建立 SSE 連接
    async connect(restaurantId) {
        if (this.eventSource) {
            this.disconnect();
        }
        this.connectionStatus.value = "connecting";
        try {
            const token = localStorage.getItem("auth_token");
            if (!token) {
                throw new Error("No authentication token found");
            }
            // 構建 SSE URL
            const baseUrl = import.meta.env.VITE_API_URL || "/api";
            let sseUrl = `${baseUrl}/v1/sse/connect`;
            const params = new URLSearchParams();
            if (restaurantId) {
                params.append("restaurantId", restaurantId);
            }
            if (this.lastEventId.value) {
                params.append("lastEventId", this.lastEventId.value);
            }
            if (params.toString()) {
                sseUrl += `?${params.toString()}`;
            }
            // 創建 EventSource
            this.eventSource = new EventSource(sseUrl);
            // 設定事件監聽器
            this.setupEventListeners();
            // 開始心跳檢測
            this.startHeartbeat();
        }
        catch (error) {
            console.error("Failed to connect to realtime service:", error);
            this.connectionStatus.value = "error";
            this.scheduleReconnect();
        }
    }
    // 設定事件監聽器
    setupEventListeners() {
        if (!this.eventSource)
            return;
        this.eventSource.onopen = () => {
            console.log("SSE connection established");
            this.connectionStatus.value = "connected";
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
        };
        this.eventSource.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            }
            catch (error) {
                console.error("Failed to parse SSE message:", error);
            }
        };
        this.eventSource.onerror = (event) => {
            console.error("SSE connection error:", event);
            this.connectionStatus.value = "error";
            if (this.eventSource?.readyState === EventSource.CLOSED) {
                this.scheduleReconnect();
            }
        };
        // 監聽特定事件類型
        const eventTypes = [
            // 訂單相關
            "order_created",
            "order_updated",
            "order_status_changed",
            // 群組訂單相關
            "group_order_created",
            "group_order_updated",
            "group_order_expired",
            "group_order_completed",
            "group_order_cancelled",
            // 群組成員相關
            "group_member_joined",
            "group_member_left",
            "group_member_promoted",
            "group_member_activity",
            // 群組購物車相關
            "group_cart_item_added",
            "group_cart_item_updated",
            "group_cart_item_removed",
            "group_cart_conflict",
            "group_cart_synced",
            // 群組分帳相關
            "group_split_initiated",
            "group_split_updated",
            "group_payment_completed",
            "group_payment_failed",
            "group_payment_reminder",
            // 候位系統相關
            "queue_joined",
            "queue_called",
            "queue_notified",
            "queue_seated",
            "queue_no_show",
            "queue_cancelled",
            // POS 系統相關
            "pos_transaction",
            "cash_movement",
            "shift_started",
            "shift_ended",
            "register_status_changed",
            // 桌位相關
            "table_occupied",
            "table_available",
            "table_reserved",
            "table_cleaning",
            // 系統相關
            "menu_updated",
            "user_activity",
            "system_notification",
            "connection_status",
            "heartbeat",
        ];
        eventTypes.forEach((eventType) => {
            this.eventSource.addEventListener(eventType, (event) => {
                try {
                    const customEvent = event;
                    const message = {
                        id: customEvent.lastEventId || Date.now().toString(),
                        type: eventType,
                        data: JSON.parse(customEvent.data),
                        timestamp: new Date().toISOString(),
                        restaurantId: customEvent.data.restaurantId,
                    };
                    this.handleMessage(message);
                }
                catch (error) {
                    console.error(`Failed to parse ${eventType} event:`, error);
                }
            });
        });
    }
    // 處理收到的消息
    handleMessage(message) {
        // 更新最後事件 ID
        this.lastEventId.value = message.id;
        // 加入消息緩衝區
        this.messageBuffer.push(message);
        if (this.messageBuffer.length > this.maxBufferSize) {
            this.messageBuffer.shift();
        }
        // 分發消息給訂閱者
        this.subscriptions.forEach((subscription) => {
            if (this.shouldNotifySubscription(subscription, message)) {
                try {
                    subscription.callback(message);
                }
                catch (error) {
                    console.error("Error in subscription callback:", error);
                }
            }
        });
        console.log("Received realtime message:", message);
    }
    // 檢查是否應該通知訂閱者
    shouldNotifySubscription(subscription, message) {
        // 檢查事件類型
        const typeMatch = subscription.types.includes("*") ||
            subscription.types.includes(message.type);
        // 檢查餐廳 ID（如果指定）
        const restaurantMatch = !subscription.restaurantId ||
            !message.restaurantId ||
            subscription.restaurantId === message.restaurantId;
        return typeMatch && restaurantMatch;
    }
    // 訂閱特定類型的事件
    subscribe(types, callback, restaurantId) {
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const subscription = {
            id: subscriptionId,
            types: Array.isArray(types) ? types : [types],
            callback,
            restaurantId,
        };
        this.subscriptions.set(subscriptionId, subscription);
        console.log(`Created subscription ${subscriptionId} for types:`, subscription.types);
        return subscriptionId;
    }
    // 取消訂閱
    unsubscribe(subscriptionId) {
        const result = this.subscriptions.delete(subscriptionId);
        console.log(`Unsubscribed ${subscriptionId}:`, result);
        return result;
    }
    // 斷開連接
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.connectionStatus.value = "disconnected";
        console.log("SSE connection closed");
    }
    // 安排重連
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("Max reconnection attempts reached");
            return;
        }
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;
        console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => {
            if (this.connectionStatus.value !== "connected") {
                this.connect();
            }
        }, delay);
    }
    // 心跳檢測
    startHeartbeat() {
        this.heartbeatInterval = window.setInterval(() => {
            if (this.connectionStatus.value === "connected" && this.eventSource) {
                // 檢查連接是否還活著
                if (this.eventSource.readyState !== EventSource.OPEN) {
                    console.warn("SSE connection lost, attempting reconnect");
                    this.scheduleReconnect();
                }
            }
        }, 30000); // 每30秒檢查一次
    }
    // 獲取連接狀態
    getConnectionStatus() {
        return this.connectionStatus;
    }
    // 獲取消息緩衝區
    getMessageBuffer() {
        return [...this.messageBuffer];
    }
    // 手動觸發重連
    reconnect() {
        this.disconnect();
        this.reconnectAttempts = 0;
        this.connect();
    }
    // 發送 ping 測試連接
    async ping() {
        try {
            const response = await fetch("/api/v1/sse/ping", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                },
            });
            return response.ok;
        }
        catch (error) {
            return false;
        }
    }
    // 獲取伺服器時間（用於同步）
    async getServerTime() {
        try {
            const response = await fetch("/api/v1/sse/time");
            const data = await response.json();
            return new Date(data.timestamp);
        }
        catch (error) {
            return new Date(); // 退回到客戶端時間
        }
    }
    // 廣播群組事件到特定群組
    async broadcastToGroup(groupOrderId, event) {
        try {
            const response = await fetch("/api/v1/sse/broadcast/group", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                },
                body: JSON.stringify({
                    groupOrderId,
                    event,
                }),
            });
            return response.ok;
        }
        catch (error) {
            console.error("Failed to broadcast to group:", error);
            return false;
        }
    }
    // 發送群組通知
    async sendGroupNotification(groupOrderId, notification) {
        try {
            const response = await fetch("/api/v1/sse/notify/group", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                },
                body: JSON.stringify({
                    groupOrderId,
                    notification: {
                        ...notification,
                        timestamp: Date.now(),
                        id: crypto.randomUUID(),
                    },
                }),
            });
            return response.ok;
        }
        catch (error) {
            console.error("Failed to send group notification:", error);
            return false;
        }
    }
    // 檢查群組連接狀態
    async checkGroupConnectionHealth(groupOrderId) {
        try {
            const response = await fetch(`/api/v1/sse/group/${groupOrderId}/health`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                },
            });
            if (response.ok) {
                return await response.json();
            }
            return {
                connected: false,
                memberCount: 0,
                activeMembers: 0,
                lastActivity: 0,
            };
        }
        catch (error) {
            console.error("Failed to check group connection health:", error);
            return {
                connected: false,
                memberCount: 0,
                activeMembers: 0,
                lastActivity: 0,
            };
        }
    }
    // 同步群組狀態
    async syncGroupState(groupOrderId, lastSyncTime) {
        try {
            const params = new URLSearchParams();
            if (lastSyncTime) {
                params.append("lastSync", lastSyncTime.toString());
            }
            const response = await fetch(`/api/v1/sse/group/${groupOrderId}/sync?${params}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
                },
            });
            if (response.ok) {
                return await response.json();
            }
            return null;
        }
        catch (error) {
            console.error("Failed to sync group state:", error);
            return null;
        }
    }
    // 監控消息延遲
    getMessageLatency() {
        const lastMessage = this.messageBuffer[this.messageBuffer.length - 1];
        if (!lastMessage)
            return 0;
        const messageTime = new Date(lastMessage.timestamp).getTime();
        const receivedTime = Date.now();
        return Math.max(0, receivedTime - messageTime);
    }
    // 獲取連接統計信息
    getConnectionStats() {
        return {
            status: this.connectionStatus.value,
            totalMessages: this.messageBuffer.length,
            subscriptions: this.subscriptions.size,
            lastEventId: this.lastEventId.value,
            reconnectAttempts: this.reconnectAttempts,
            latency: this.getMessageLatency(),
        };
    }
    // 清理資源
    cleanup() {
        this.disconnect();
        this.subscriptions.clear();
        this.messageBuffer = [];
        document.removeEventListener("visibilitychange", () => { });
        window.removeEventListener("online", () => { });
        window.removeEventListener("offline", () => { });
    }
}
// 單例實例
export const realtimeService = new RealtimeService();
// Vue 組合式函數
export function useRealtime() {
    return {
        connectionStatus: realtimeService.getConnectionStatus(),
        connect: (restaurantId) => realtimeService.connect(restaurantId),
        disconnect: () => realtimeService.disconnect(),
        subscribe: (types, callback, restaurantId) => realtimeService.subscribe(types, callback, restaurantId),
        unsubscribe: (subscriptionId) => realtimeService.unsubscribe(subscriptionId),
        reconnect: () => realtimeService.reconnect(),
        ping: () => realtimeService.ping(),
        getMessageBuffer: () => realtimeService.getMessageBuffer(),
    };
}
// 專用的事件類型常量
export const REALTIME_EVENTS = {
    // 訂單相關
    ORDER_CREATED: "order_created",
    ORDER_UPDATED: "order_updated",
    ORDER_STATUS_CHANGED: "order_status_changed",
    // 群組訂單核心事件
    GROUP_ORDER_CREATED: "group_order_created",
    GROUP_ORDER_UPDATED: "group_order_updated",
    GROUP_ORDER_EXPIRED: "group_order_expired",
    GROUP_ORDER_COMPLETED: "group_order_completed",
    GROUP_ORDER_CANCELLED: "group_order_cancelled",
    // 群組成員管理事件
    GROUP_MEMBER_JOINED: "group_member_joined",
    GROUP_MEMBER_LEFT: "group_member_left",
    GROUP_MEMBER_PROMOTED: "group_member_promoted", // 角色提升（admin等）
    GROUP_MEMBER_ACTIVITY: "group_member_activity", // 成員活動狀態
    // 群組購物車協作事件
    GROUP_CART_ITEM_ADDED: "group_cart_item_added",
    GROUP_CART_ITEM_UPDATED: "group_cart_item_updated",
    GROUP_CART_ITEM_REMOVED: "group_cart_item_removed",
    GROUP_CART_CONFLICT: "group_cart_conflict", // 併發編輯衝突
    GROUP_CART_SYNCED: "group_cart_synced", // 購物車同步完成
    // 群組分帳系統事件
    GROUP_SPLIT_INITIATED: "group_split_initiated",
    GROUP_SPLIT_UPDATED: "group_split_updated",
    GROUP_PAYMENT_COMPLETED: "group_payment_completed",
    GROUP_PAYMENT_FAILED: "group_payment_failed",
    GROUP_PAYMENT_REMINDER: "group_payment_reminder",
    // 候位系統相關
    QUEUE_JOINED: "queue_joined",
    QUEUE_CALLED: "queue_called",
    QUEUE_NOTIFIED: "queue_notified",
    QUEUE_SEATED: "queue_seated",
    QUEUE_NO_SHOW: "queue_no_show",
    QUEUE_CANCELLED: "queue_cancelled",
    // POS 系統相關
    POS_TRANSACTION: "pos_transaction",
    CASH_MOVEMENT: "cash_movement",
    SHIFT_STARTED: "shift_started",
    SHIFT_ENDED: "shift_ended",
    REGISTER_STATUS_CHANGED: "register_status_changed",
    // 桌位相關
    TABLE_OCCUPIED: "table_occupied",
    TABLE_AVAILABLE: "table_available",
    TABLE_RESERVED: "table_reserved",
    TABLE_CLEANING: "table_cleaning",
    // 系統相關
    MENU_UPDATED: "menu_updated",
    USER_ACTIVITY: "user_activity",
    SYSTEM_NOTIFICATION: "system_notification",
    CONNECTION_STATUS: "connection_status",
    HEARTBEAT: "heartbeat",
    // 通用事件
    ALL: "*",
};
export default realtimeService;
