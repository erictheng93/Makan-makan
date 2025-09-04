// Server-Sent Events (SSE) composable for real-time statistics updates
import { ref, onMounted, onUnmounted } from "vue";
import { statisticsService } from "@/services/statisticsService";
import { KitchenErrorHandler } from "@/utils/errorHandler";
export function useStatisticsSSE(options = {}) {
  const {
    url = `${import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") || "http://localhost:8787"}/api/v1/analytics/sse`,
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
  const lastEventId = ref(null);
  // EventSource instance
  let eventSource = null;
  let reconnectTimeout = null;
  let heartbeatTimeout = null;
  // Connection management
  const connect = () => {
    if (eventSource && eventSource.readyState === EventSource.OPEN) {
      return;
    }
    isConnecting.value = true;
    error.value = null;
    try {
      // Construct URL with parameters
      const sseUrl = new URL(url);
      if (lastEventId.value) {
        sseUrl.searchParams.set("lastEventId", lastEventId.value);
      }
      eventSource = new EventSource(sseUrl.toString());
      eventSource.onopen = () => {
        console.log("Statistics SSE connected");
        isConnected.value = true;
        isConnecting.value = false;
        connectionAttempts.value = 0;
        error.value = null;
        startHeartbeatCheck();
      };
      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          message.id = event.lastEventId;
          lastMessage.value = message;
          lastEventId.value = event.lastEventId;
          handleMessage(message);
          resetHeartbeatCheck();
        } catch (error) {
          console.error("Failed to parse SSE message:", error);
        }
      };
      // 監聽特定事件類型
      eventSource.addEventListener("order_created", (event) => {
        handleSSEEvent(event, "order_created");
      });
      eventSource.addEventListener("order_updated", (event) => {
        handleSSEEvent(event, "order_updated");
      });
      eventSource.addEventListener("order_completed", (event) => {
        handleSSEEvent(event, "order_completed");
      });
      eventSource.addEventListener("order_cancelled", (event) => {
        handleSSEEvent(event, "order_cancelled");
      });
      eventSource.addEventListener("statistics_update", (event) => {
        handleSSEEvent(event, "statistics_update");
      });
      eventSource.addEventListener("heartbeat", (event) => {
        handleSSEEvent(event, "heartbeat");
      });
      eventSource.onerror = (event) => {
        console.error("Statistics SSE error:", event);
        isConnected.value = false;
        isConnecting.value = false;
        stopHeartbeatCheck();
        // 使用錯誤處理器處理 SSE 錯誤
        KitchenErrorHandler.handleSSEError(event, eventSource || undefined);
        // 檢查是否需要重連
        if (
          eventSource?.readyState === EventSource.CLOSED ||
          eventSource?.readyState === EventSource.CONNECTING
        ) {
          scheduleReconnect();
        }
      };
    } catch (err) {
      console.error("Failed to create SSE connection:", err);
      error.value =
        err instanceof Error ? err.message : "Failed to create SSE connection";
      isConnecting.value = false;
      // 使用錯誤處理器處理連接創建錯誤
      KitchenErrorHandler.handleAPIError(err, {
        context: "SSE connection creation",
      });
    }
  };
  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    stopHeartbeatCheck();
    if (eventSource) {
      eventSource.close();
      eventSource = null;
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
      `Scheduling SSE reconnect attempt ${connectionAttempts.value}/${retryAttempts} in ${delay}ms`,
    );
    if (connectionAttempts.value <= retryAttempts) {
      error.value = `連線中斷，將在 ${Math.ceil(delay / 1000)} 秒後重試 (${connectionAttempts.value}/${retryAttempts})`;
      reconnectTimeout = setTimeout(() => {
        connect();
      }, delay);
    } else {
      error.value = "SSE 連線失敗，已達最大重試次數";
    }
  };
  const handleSSEEvent = (event, eventType) => {
    try {
      const data = event.data ? JSON.parse(event.data) : null;
      const message = {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
        id: event.lastEventId,
      };
      lastMessage.value = message;
      if (event.lastEventId) {
        lastEventId.value = event.lastEventId;
      }
      handleMessage(message);
      resetHeartbeatCheck();
    } catch (error) {
      console.error(`Failed to parse SSE ${eventType} event:`, error);
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
      case "heartbeat":
        // 心跳事件，保持連線活躍
        console.log("SSE heartbeat received");
        break;
      default:
        console.log("Unknown SSE message type:", message.type);
    }
  };
  const handleOrderEvent = (message) => {
    // 訂單事件發生時，觸發統計數據刷新
    console.log(`Order event received: ${message.type}`, message.data);
    // 延遲刷新以確保數據庫已更新
    setTimeout(() => {
      statisticsService.fetchDashboardData();
    }, 1000);
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
        // 更新每小時完成率
        if (message.data.hourly_completion_rate) {
          statisticsService.dashboardData.hourly_completion_rate =
            message.data.hourly_completion_rate;
        }
        // 更新分類平均時間
        if (message.data.avg_time_by_category) {
          statisticsService.dashboardData.avg_time_by_category =
            message.data.avg_time_by_category;
        }
        // 更新績效趨勢
        if (message.data.performance_trend) {
          statisticsService.dashboardData.performance_trend =
            message.data.performance_trend;
        }
        // 更新最後更新時間
        statisticsService.lastUpdated.value = new Date();
        console.log("Statistics updated from SSE message");
      } catch (error) {
        console.error("Failed to update statistics from SSE message:", error);
      }
    }
  };
  // 心跳檢測
  const startHeartbeatCheck = () => {
    resetHeartbeatCheck();
  };
  const resetHeartbeatCheck = () => {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
    }
    // 如果 60 秒內沒有收到任何消息，視為連線異常
    heartbeatTimeout = setTimeout(() => {
      console.log("SSE heartbeat timeout, reconnecting...");
      error.value = "連線超時，正在重新連線...";
      disconnect();
      scheduleReconnect();
    }, 60000);
  };
  const stopHeartbeatCheck = () => {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
  };
  // 手動重連
  const reconnect = () => {
    disconnect();
    connectionAttempts.value = 0;
    setTimeout(connect, 1000);
  };
  // 獲取連線狀態
  const getConnectionState = () => {
    if (!eventSource) return "CLOSED";
    switch (eventSource.readyState) {
      case EventSource.CONNECTING:
        return "CONNECTING";
      case EventSource.OPEN:
        return "OPEN";
      case EventSource.CLOSED:
        return "CLOSED";
      default:
        return "UNKNOWN";
    }
  };
  // Lifecycle hooks
  onMounted(() => {
    if (autoConnect) {
      connect();
    }
  });
  onUnmounted(() => {
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
    lastEventId,
    // Methods
    connect,
    disconnect,
    reconnect,
    getConnectionState,
  };
}
export default useStatisticsSSE;
