// Server-Sent Events (SSE) composable for real-time statistics updates
import { ref, onMounted, onUnmounted } from "vue";
import { statisticsService } from "@/services/statisticsService";
export function useStatisticsSocket(options = {}) {
  const {
    url = `${import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8787"}/statistics`,
    autoConnect = true,
    retryAttempts = 5,
    retryDelay = 3000,
  } = options;
  // Reactive state
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const error = ref(null);
  const lastMessage = ref(null);
  const connectionAttempts = ref(0);
  // WebSocket instance
  let ws = null;
  let reconnectTimeout = null;
  // Connection management
  const connect = () => {
    if (ws?.readyState === WebSocket.OPEN) {
      return;
    }
    isConnecting.value = true;
    error.value = null;
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        console.log("Statistics WebSocket connected");
        isConnected.value = true;
        isConnecting.value = false;
        connectionAttempts.value = 0;
        error.value = null;
        // Send initial subscription message
        send({
          type: "subscribe",
          data: {
            events: [
              "order_created",
              "order_updated",
              "order_completed",
              "order_cancelled",
              "statistics_update",
            ],
          },
        });
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          lastMessage.value = message;
          handleMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
      ws.onclose = (event) => {
        console.log(
          "Statistics WebSocket disconnected:",
          event.code,
          event.reason,
        );
        isConnected.value = false;
        isConnecting.value = false;
        // Attempt reconnection if not manually closed
        if (event.code !== 1000 && connectionAttempts.value < retryAttempts) {
          scheduleReconnect();
        }
      };
      ws.onerror = (event) => {
        console.error("Statistics WebSocket error:", event);
        error.value = "WebSocket connection error";
        isConnecting.value = false;
      };
    } catch (err) {
      console.error("Failed to create WebSocket connection:", err);
      error.value =
        err instanceof Error
          ? err.message
          : "Failed to create WebSocket connection";
      isConnecting.value = false;
    }
  };
  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (ws) {
      ws.close(1000, "Manual disconnect");
      ws = null;
    }
    isConnected.value = false;
    isConnecting.value = false;
  };
  const scheduleReconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    connectionAttempts.value++;
    const delay = retryDelay * Math.pow(1.5, connectionAttempts.value - 1); // Exponential backoff
    console.log(
      `Scheduling reconnect attempt ${connectionAttempts.value}/${retryAttempts} in ${delay}ms`,
    );
    reconnectTimeout = setTimeout(() => {
      if (connectionAttempts.value <= retryAttempts) {
        connect();
      } else {
        error.value = "Max reconnection attempts reached";
      }
    }, delay);
  };
  const send = (message) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    } else {
      console.warn("WebSocket is not connected");
      return false;
    }
  };
  // Message handlers
  const handleMessage = (message) => {
    switch (message.type) {
      case "order_created":
      case "order_updated":
      case "order_completed":
      case "order_cancelled":
        // 當收到訂單相關事件時，刷新統計數據
        handleOrderEvent(message);
        break;
      case "statistics_update":
        // 直接更新統計數據
        handleStatisticsUpdate(message);
        break;
      default:
        console.log("Unknown message type:", message.type);
    }
  };
  const handleOrderEvent = () => {
    // 訂單事件發生時，觸發統計數據刷新
    setTimeout(() => {
      statisticsService.fetchDashboardData();
    }, 1000); // 延遲1秒以確保數據已更新
  };
  const handleStatisticsUpdate = (message) => {
    // 直接更新統計服務的數據
    if (message.data) {
      try {
        // 更新實時統計數據
        if (message.data.realtime_stats) {
          Object.assign(
            statisticsService.dashboardData.realtime_stats,
            message.data.realtime_stats,
          );
        }
        // 更新KPI指標
        if (message.data.kpis) {
          Object.assign(
            statisticsService.dashboardData.kpis,
            message.data.kpis,
          );
        }
        // 更新系統負載
        if (message.data.system_load) {
          Object.assign(
            statisticsService.dashboardData.system_load,
            message.data.system_load,
          );
        }
        // 更新活躍訂單
        if (message.data.active_orders) {
          statisticsService.dashboardData.active_orders =
            message.data.active_orders;
        }
        // 更新最後更新時間
        statisticsService.lastUpdated.value = new Date();
      } catch (error) {
        console.error(
          "Failed to update statistics from WebSocket message:",
          error,
        );
      }
    }
  };
  // 發送心跳檢測
  const sendHeartbeat = () => {
    send({
      type: "heartbeat",
      timestamp: new Date().toISOString(),
    });
  };
  // 設置心跳定時器
  let heartbeatInterval = null;
  const startHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(() => {
      if (isConnected.value) {
        sendHeartbeat();
      }
    }, 30000); // 每30秒發送一次心跳
  };
  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };
  // 訂閱特定事件
  const subscribe = (events) => {
    send({
      type: "subscribe",
      data: { events },
    });
  };
  const unsubscribe = (events) => {
    send({
      type: "unsubscribe",
      data: { events },
    });
  };
  // 手動重連
  const reconnect = () => {
    disconnect();
    connectionAttempts.value = 0;
    setTimeout(connect, 1000);
  };
  // Lifecycle hooks
  onMounted(() => {
    if (autoConnect) {
      connect();
      startHeartbeat();
    }
  });
  onUnmounted(() => {
    stopHeartbeat();
    disconnect();
  });
  // 返回接口
  return {
    // State
    isConnected,
    isConnecting,
    error,
    lastMessage,
    connectionAttempts,
    // Methods
    connect,
    disconnect,
    reconnect,
    send,
    subscribe,
    unsubscribe,
    // Helpers
    sendHeartbeat,
  };
}
export default useStatisticsSocket;
