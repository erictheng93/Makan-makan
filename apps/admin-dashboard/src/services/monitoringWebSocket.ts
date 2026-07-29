/**
 * Monitoring Polling Service
 * Alert notifications via periodic polling (replaces broken WebSocket)
 *
 * NOTE: Export name kept as `monitoringWebSocket` to avoid changing all import sites.
 */

import { ref, type Ref } from "vue";
import type { SystemMetrics } from "@/types/monitoring";
import { monitoringService } from "@/services/monitoringService";

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

/**
 * How often /monitoring/alerts/recent is polled. Each poll is one Worker
 * request and one KV read against a key that only changes when an alert
 * actually fires, so the previous 15s cadence spent four reads a minute to
 * observe something that is usually unchanged for hours. 30s keeps alert
 * latency well inside the operator's reaction time at half the cost.
 */
const ALERT_POLL_INTERVAL_MS = 30_000;

/**
 * Monitoring Polling Service Class
 * Polls /monitoring/alerts/recent on ALERT_POLL_INTERVAL_MS
 */
class MonitoringPollingService {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollInterval = ALERT_POLL_INTERVAL_MS;
  private lastPollTimestamp = 0;
  private isPolling = false;

  // Reactive state (same interface as the old WebSocket service)
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
   * Bound so add/removeEventListener see the same reference. Polls once on the
   * way back to the foreground so returning to the tab does not mean waiting
   * out the remainder of an interval that was skipped while hidden.
   */
  private readonly handleVisibilityChange = (): void => {
    if (!document.hidden) {
      this.poll();
    }
  };

  /**
   * Start polling for alerts
   * @param _token Auth token (not needed — api service handles auth headers)
   */
  connect(_token?: string): void {
    if (this.pollTimer) {
      console.log("[MonitoringPolling] Already polling");
      return;
    }

    this.connectionStatus.value = {
      connected: true,
      reconnecting: false,
      lastConnected: Date.now(),
      reconnectAttempts: 0,
    };

    // Initial fetch
    this.poll();

    // Start periodic polling
    this.pollTimer = setInterval(() => this.poll(), this.pollInterval);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    console.log(
      `[MonitoringPolling] Started polling every ${this.pollInterval}ms`,
    );
  }

  /**
   * Stop polling
   */
  disconnect(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.connectionStatus.value.connected = false;
    this.connectionStatus.value.reconnecting = false;
    console.log("[MonitoringPolling] Stopped polling");
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.value.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
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
   * Poll for recent alerts
   */
  private async poll(): Promise<void> {
    if (this.isPolling) return; // Guard against overlapping polls
    // A hidden tab has nobody to show an alert to, and browsers keep firing
    // the interval (throttled) for as long as it stays open. Skipping costs
    // nothing: handleVisibilityChange polls immediately on the way back.
    if (document.hidden) return;
    this.isPolling = true;

    try {
      const recentAlerts = await monitoringService.getRecentAlerts(
        this.lastPollTimestamp || undefined,
      );

      if (recentAlerts.length > 0) {
        // Merge new alerts (dedup by id)
        const existingIds = new Set(this.alerts.value.map((a) => a.id));
        const newAlerts = recentAlerts.filter(
          (a: any) => !existingIds.has(a.id),
        );

        if (newAlerts.length > 0) {
          // Map backend alert format to AlertNotification
          const mapped: AlertNotification[] = newAlerts.map((a: any) => ({
            id: a.id,
            type: a.severity || "info",
            severity: a.severity || "info",
            title: a.title || "",
            message: a.message || "",
            timestamp: a.timestamp || Date.now(),
            acknowledged: false,
          }));

          this.alerts.value = [...mapped, ...this.alerts.value].slice(0, 50);

          // Trigger custom handlers
          const handlers = this.messageHandlers.get("alert");
          if (handlers) {
            mapped.forEach((alert) => {
              handlers.forEach((handler) => handler(alert));
            });
          }
        }
      }

      this.lastPollTimestamp = Date.now();
      this.connectionStatus.value.lastConnected = Date.now();
    } catch (error) {
      // Transient failures are OK for polling — don't disconnect
      console.error("[MonitoringPolling] Poll failed:", error);
    } finally {
      this.isPolling = false;
    }
  }
}

// Export singleton instance (name kept for backward compatibility)
export const monitoringWebSocket = new MonitoringPollingService();

// Export class for testing
export default MonitoringPollingService;
