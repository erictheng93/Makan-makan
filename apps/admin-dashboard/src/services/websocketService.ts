/**
 * WebSocket Service for Admin Dashboard
 * 基於 Cloudflare Durable Objects 的 WebSocket 連接管理
 */

import { ref, computed } from "vue";
import {
  RealtimeEventType,
  type RealtimeEvent,
  type RealtimeAuthTokenResponse,
} from "@makanmakan/shared-types";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface WebSocketConfig {
  /** 重連最大嘗試次數 */
  maxReconnectAttempts?: number;
  /** 重連延遲（毫秒） */
  reconnectDelay?: number;
  /** 心跳間隔（毫秒） */
  heartbeatInterval?: number;
  /** 心跳超時（毫秒） */
  heartbeatTimeout?: number;
}

export interface EventSubscription {
  id: string;
  eventTypes: RealtimeEventType[];
  callback: (event: RealtimeEvent) => void;
  filter?: (event: RealtimeEvent) => boolean;
}

const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
};

import { sanitizeForLog } from "@/utils/sanitize";

class WebSocketService {
  private ws: WebSocket | null = null;
  private connectionStatus = ref<ConnectionStatus>("disconnected");
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private heartbeatTimeoutTimer: number | null = null;
  private lastEventId: string | null = null;
  private subscriptions = new Map<string, EventSubscription>();
  private subscriptionCounter = 0;
  private config: Required<WebSocketConfig>;
  private wsToken: string | null = null;
  private wsUrl: string | null = null;
  private restaurantId: string | null = null;

  constructor(config?: WebSocketConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupVisibilityHandlers();
    this.setupNetworkHandlers();
  }

  /**
   * 獲取 WebSocket Token
   */
  private async getWebSocketToken(
    restaurantId: string,
  ): Promise<RealtimeAuthTokenResponse> {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw new Error("No authentication token found");
    }

    const baseUrl = import.meta.env.VITE_API_URL || "/api";
    const response = await fetch(`${baseUrl}/v1/realtime/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        roomType: "admin",
        roomId: restaurantId,
        restaurantId,
        sessionId: token,
      }),
    });

    if (!response.ok) {
      const error = new Error(
        `Failed to get WebSocket token: ${response.statusText}`,
      );
      (error as any).status = response.status;
      throw error;
    }

    return response.json();
  }

  /**
   * 連接到 WebSocket 服務
   */
  async connect(restaurantId: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    if (this.connectionStatus.value === "connecting") {
      console.log("WebSocket connection already in progress");
      return;
    }

    this.restaurantId = restaurantId;
    this.connectionStatus.value = "connecting";

    try {
      // 獲取 WebSocket Token
      const authResponse = await this.getWebSocketToken(restaurantId);
      this.wsToken = authResponse.token;
      this.wsUrl = authResponse.wsUrl;

      // Validate WebSocket URL and token before connecting
      if (!this.wsUrl || !this.wsToken) {
        console.warn(
          "WebSocket URL or token missing from auth response, aborting connect",
        );
        this.connectionStatus.value = "error";
        return;
      }

      // 建立 WebSocket 連接
      this.ws = new WebSocket(`${this.wsUrl}?token=${this.wsToken}`);

      this.setupWebSocketHandlers();
    } catch (error: any) {
      console.error("Failed to connect to WebSocket:", error);
      this.connectionStatus.value = "error";
      // Don't retry on client errors that won't resolve with retries
      if (
        error.status === 400 ||
        error.status === 401 ||
        error.status === 403 ||
        error.status === 429
      ) {
        console.warn(
          `WebSocket connection aborted (HTTP ${error.status}), not retrying`,
        );
        return;
      }
      this.scheduleReconnect();
    }
  }

  /**
   * 設置 WebSocket 事件處理器
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("✅ WebSocket connected");
      this.connectionStatus.value = "connected";
      this.reconnectAttempts = 0;
      this.startHeartbeat();

      // 如果有 lastEventId，請求遺漏的事件
      if (this.lastEventId) {
        this.requestMissedEvents();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message: RealtimeEvent = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("❌ Failed to parse WebSocket message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      this.connectionStatus.value = "error";
    };

    this.ws.onclose = (event) => {
      console.log("🔌 WebSocket closed:", event.code, event.reason);
      this.connectionStatus.value = "disconnected";
      this.stopHeartbeat();

      // 非正常關閉，嘗試重連
      if (event.code !== 1000 && event.code !== 1001) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * 處理接收到的訊息
   */
  private handleMessage(event: RealtimeEvent): void {
    // 更新 lastEventId
    if (event.eventId) {
      this.lastEventId = event.eventId;
    }

    // 心跳響應
    if (event.type === RealtimeEventType.HEARTBEAT) {
      this.resetHeartbeatTimeout();
      return;
    }

    // 連接確認
    if (event.type === RealtimeEventType.CONNECTION_ACK) {
      console.log("✅ Connection acknowledged:", sanitizeForLog(event.data));
      return;
    }

    // 錯誤事件
    if (event.type === RealtimeEventType.ERROR) {
      console.error("❌ Server error:", sanitizeForLog(event.data));
      return;
    }

    // 分發給訂閱者
    this.subscriptions.forEach((subscription) => {
      if (subscription.eventTypes.includes(event.type as RealtimeEventType)) {
        // 如果有過濾器，檢查是否通過
        if (!subscription.filter || subscription.filter(event)) {
          try {
            subscription.callback(event);
          } catch (error) {
            console.error("❌ Error in subscription callback:", error);
          }
        }
      }
    });
  }

  /**
   * 請求遺漏的事件
   */
  private requestMissedEvents(): void {
    if (!this.ws || !this.lastEventId) return;

    this.send({
      type: "REQUEST_MISSED_EVENTS",
      sinceEventId: this.lastEventId,
    });
  }

  /**
   * 訂閱事件
   */
  subscribe(
    eventTypes: RealtimeEventType[],
    callback: (event: RealtimeEvent) => void,
    filter?: (event: RealtimeEvent) => boolean,
  ): string {
    const id = `sub_${++this.subscriptionCounter}`;
    this.subscriptions.set(id, {
      id,
      eventTypes,
      callback,
      filter,
    });
    return id;
  }

  /**
   * 取消訂閱
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * 發送訊息
   */
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("⚠️ WebSocket not connected, cannot send message");
    }
  }

  /**
   * 開始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping", timestamp: Date.now() });

        // 設置心跳超時
        this.heartbeatTimeoutTimer = window.setTimeout(() => {
          console.warn("⚠️ Heartbeat timeout, closing connection");
          this.ws?.close(1000, "Heartbeat timeout");
        }, this.config.heartbeatTimeout);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * 重置心跳超時
   */
  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * 安排重連
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error("❌ Max reconnect attempts reached");
      this.connectionStatus.value = "error";
      return;
    }

    this.connectionStatus.value = "reconnecting";
    this.reconnectAttempts++;

    const delay = this.config.reconnectDelay * this.reconnectAttempts;

    console.log(
      `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`,
    );

    this.reconnectTimer = window.setTimeout(() => {
      if (this.restaurantId) {
        this.connect(this.restaurantId);
      }
    }, delay);
  }

  /**
   * 斷開連接
   */
  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.connectionStatus.value = "disconnected";
    this.reconnectAttempts = 0;
  }

  /**
   * 設置頁面可見性處理
   */
  private setupVisibilityHandlers(): void {
    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        this.connectionStatus.value === "disconnected" &&
        this.restaurantId
      ) {
        console.log("📱 Page visible, reconnecting...");
        this.connect(this.restaurantId);
      }
    });
  }

  /**
   * 設置網絡狀態處理
   */
  private setupNetworkHandlers(): void {
    window.addEventListener("online", () => {
      if (this.connectionStatus.value === "disconnected" && this.restaurantId) {
        console.log("🌐 Network online, reconnecting...");
        this.connect(this.restaurantId);
      }
    });

    window.addEventListener("offline", () => {
      console.log("🔌 Network offline, disconnecting...");
      this.disconnect();
    });
  }

  /**
   * 獲取連接狀態
   */
  get status() {
    return computed(() => this.connectionStatus.value);
  }

  /**
   * 是否已連接
   */
  get isConnected() {
    return computed(() => this.connectionStatus.value === "connected");
  }
}

// 單例模式
let instance: WebSocketService | null = null;

export function useWebSocketService(
  config?: WebSocketConfig,
): WebSocketService {
  if (!instance) {
    instance = new WebSocketService(config);
  }
  return instance;
}

export default WebSocketService;
