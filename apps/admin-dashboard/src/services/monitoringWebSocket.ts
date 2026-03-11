/**
 * Monitoring WebSocket Service
 * Real-time alert notifications and metric updates via WebSocket
 */

import { ref, type Ref } from "vue";
import type { SystemMetrics } from "@/types/monitoring";

export type AlertNotificationType = "info" | "warning" | "critical" | "fatal";

export interface AlertNotification {
  id: string;
  type: AlertNotificationType;
  severity: AlertNotificationType;
  title: string;
  message: string;
  timestamp: number;
  ruleId?: string;
  ruleName?: string;
  metricType?: string;
  currentValue?: number;
  threshold?: number;
  acknowledged?: boolean;
}

export interface MetricUpdate {
  timestamp: number;
  metrics: Partial<SystemMetrics>;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  lastConnected: number | null;
  reconnectAttempts: number;
}

type MessageHandler = (data: unknown) => void;

import { sanitizeForLog } from "@/utils/sanitize";

/**
 * Monitoring WebSocket Service Class
 */
class MonitoringWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000; // Start with 3 seconds
  private maxReconnectDelay = 30000; // Max 30 seconds
  private heartbeatInterval = 30000; // 30 seconds

  // Reactive state
  public connectionStatus: Ref<ConnectionStatus> = ref({
    connected: false,
    reconnecting: false,
    lastConnected: null,
    reconnectAttempts: 0,
  });

  public alerts: Ref<AlertNotification[]> = ref([]);
  public latestMetrics: Ref<MetricUpdate | null> = ref(null);

  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();

  /**
   * Connect to WebSocket server
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[MonitoringWS] Already connected");
      return;
    }

    this.disconnect(); // Clean up any existing connection

    try {
      // Use environment variable or default to current host
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = import.meta.env.VITE_WS_HOST || window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/monitoring/ws?token=${token}`;

      console.log("[MonitoringWS] Connecting to:", wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error("[MonitoringWS] Connection error:", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnection
      this.ws.close();
      this.ws = null;
    }

    this.connectionStatus.value.connected = false;
    this.connectionStatus.value.reconnecting = false;
  }

  /**
   * Send message to server
   */
  private send(type: string, data?: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn("[MonitoringWS] Cannot send message, not connected");
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.value.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.send("acknowledge_alert", { alertId });
    }
  }

  /**
   * Clear all alerts
   */
  clearAllAlerts(): void {
    this.alerts.value = [];
  }

  /**
   * Subscribe to specific message type
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log("[MonitoringWS] Connected");
    this.reconnectAttempts = 0;
    this.reconnectDelay = 3000;

    this.connectionStatus.value = {
      connected: true,
      reconnecting: false,
      lastConnected: Date.now(),
      reconnectAttempts: 0,
    };

    // Start heartbeat
    this.startHeartbeat();

    // Subscribe to monitoring alerts
    this.send("subscribe", { channel: "monitoring-alerts" });
    this.send("subscribe", { channel: "monitoring-metrics" });
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log("[MonitoringWS] Disconnected", event.code, event.reason);

    this.connectionStatus.value.connected = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Auto reconnect if not a clean close
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error("[MonitoringWS] Error:", event);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case "alert":
          this.handleAlert(message.data);
          break;
        case "metric_update":
          this.handleMetricUpdate(message.data);
          break;
        case "pong":
          // Heartbeat response
          break;
        default:
          console.log(
            "[MonitoringWS] Unknown message type:",
            sanitizeForLog(message.type),
          );
      }

      // Trigger custom handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach((handler) => handler(message.data));
      }
    } catch (error) {
      console.error("[MonitoringWS] Failed to parse message:", error);
    }
  }

  /**
   * Handle alert notification
   */
  private handleAlert(alert: AlertNotification): void {
    // Add timestamp if not present
    if (!alert.timestamp) {
      alert.timestamp = Date.now();
    }

    // Add to alerts list (keep last 50)
    this.alerts.value = [alert, ...this.alerts.value].slice(0, 50);

    console.log(
      "[MonitoringWS] New alert:",
      sanitizeForLog(JSON.stringify(alert)),
    );
  }

  /**
   * Handle metric update
   */
  private handleMetricUpdate(update: MetricUpdate): void {
    this.latestMetrics.value = update;
    console.log("[MonitoringWS] Metric update received");
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send("ping");
    }, this.heartbeatInterval);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[MonitoringWS] Max reconnection attempts reached");
      this.connectionStatus.value.reconnecting = false;
      return;
    }

    this.connectionStatus.value.reconnecting = true;
    this.reconnectAttempts++;
    this.connectionStatus.value.reconnectAttempts = this.reconnectAttempts;

    console.log(
      `[MonitoringWS] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      // Get token from localStorage or generate new one
      const token = localStorage.getItem("auth_token") || "";
      this.connect(token);

      // Exponential backoff
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 1.5,
        this.maxReconnectDelay,
      );
    }, this.reconnectDelay);
  }
}

// Export singleton instance
export const monitoringWebSocket = new MonitoringWebSocketService();

// Export class for testing
export default MonitoringWebSocketService;
