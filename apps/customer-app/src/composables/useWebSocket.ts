import { ref, onMounted, onUnmounted } from "vue";
import type {
  NotificationData,
  OrderUpdateData,
  RestaurantStatusData,
  WebSocketMessage,
} from "@makanmasak/shared-types";

interface UseWebSocketOptions {
  url?: string;
  getUrl?: () => Promise<string>;
  protocols?: string | string[];
  restaurantId?: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onAuthFailure?: () => Promise<void> | void;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = "",
    getUrl,
    protocols,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    heartbeatInterval = 30000,
    onMessage,
    onError,
    onOpen,
    onClose,
    onAuthFailure,
  } = options;

  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const lastError = ref<Event | null>(null);
  const reconnectCount = ref(0);
  const connectionStatus = ref<ConnectionStatus>("disconnected");

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let manualDisconnect = false;
  let attemptedUrl = "";

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws.value?.readyState === WebSocket.OPEN) {
        send({ type: "ping", timestamp: Date.now() });
      }
    }, heartbeatInterval);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const resolveUrl = async (overrideUrl?: string): Promise<string> => {
    if (overrideUrl) {
      return overrideUrl;
    }
    if (getUrl) {
      return getUrl();
    }
    return url;
  };

  const scheduleReconnect = (reason: "network" | "auth" = "network") => {
    if (manualDisconnect || reconnectCount.value >= reconnectAttempts) {
      connectionStatus.value = "error";
      return;
    }

    clearReconnectTimer();
    reconnectCount.value += 1;

    const attempt = reconnectCount.value;
    const delay = reconnectInterval * 2 ** (attempt - 1);

    reconnectTimer = setTimeout(async () => {
      if (reason === "auth" && onAuthFailure) {
        await onAuthFailure();
      }
      void connect();
    }, delay);
  };

  const connect = async (wsUrl?: string) => {
    if (
      ws.value?.readyState === WebSocket.CONNECTING ||
      ws.value?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    manualDisconnect = false;
    isConnecting.value = true;
    connectionStatus.value = "connecting";
    lastError.value = null;

    try {
      const targetUrl = await resolveUrl(wsUrl);
      if (!targetUrl) {
        throw new Error("WebSocket URL is required");
      }

      attemptedUrl = targetUrl;
      ws.value = new WebSocket(targetUrl, protocols);

      ws.value.onopen = (event) => {
        isConnected.value = true;
        isConnecting.value = false;
        reconnectCount.value = 0;
        connectionStatus.value = "connected";
        startHeartbeat();
        onOpen?.(event);
      };

      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          onMessage?.(data);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.value.onerror = (event) => {
        lastError.value = event;
        connectionStatus.value = "error";
        onError?.(event);
      };

      ws.value.onclose = (event) => {
        isConnected.value = false;
        isConnecting.value = false;
        stopHeartbeat();
        connectionStatus.value = event.wasClean ? "disconnected" : "error";
        onClose?.(event);

        if (manualDisconnect) {
          return;
        }

        const authRejected =
          attemptedUrl.includes("token=") &&
          (event.code === 1008 || event.code === 4001 || event.code === 1006);

        scheduleReconnect(authRejected ? "auth" : "network");
      };
    } catch (error) {
      isConnecting.value = false;
      connectionStatus.value = "error";
      console.error("Failed to create WebSocket connection:", error);
      scheduleReconnect("auth");
    }
  };

  const disconnect = () => {
    manualDisconnect = true;
    clearReconnectTimer();
    stopHeartbeat();

    if (ws.value) {
      ws.value.close(1000, "Manual disconnect");
      ws.value = null;
    }

    isConnected.value = false;
    isConnecting.value = false;
    connectionStatus.value = "disconnected";
    reconnectCount.value = 0;
  };

  const reconnect = async () => {
    disconnect();
    manualDisconnect = false;
    await connect();
  };

  const send = (data: any) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      ws.value.send(message);
      return true;
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      return false;
    }
  };

  const subscribe = (channel: string, data?: any) =>
    send({
      type: "subscribe",
      channel,
      data,
      timestamp: Date.now(),
    });

  const unsubscribe = (channel: string) =>
    send({
      type: "unsubscribe",
      channel,
      timestamp: Date.now(),
    });

  onUnmounted(() => {
    disconnect();
  });

  return {
    ws,
    isConnected,
    isConnecting,
    lastError,
    reconnectCount,
    connectionStatus,
    connect,
    disconnect,
    reconnect,
    send,
    subscribe,
    unsubscribe,
  };
}

export function useOrderTracking(orderId: number) {
  const orderUpdates = ref<OrderUpdateData[]>([]);
  const currentStatus = ref<string>("");

  const { isConnected, isConnecting, connect, disconnect } = useWebSocket({
    url: `${import.meta.env.VITE_WS_BASE_URL}/orders/${orderId}/tracking`,
    onMessage: (data: WebSocketMessage) => {
      if (data.type === "order_update" && data.data) {
        orderUpdates.value.push(data.data);
        if (data.data.status !== undefined) {
          currentStatus.value = String(data.data.status);
        }
      }
    },
  });

  onMounted(() => {
    if (orderId) {
      void connect();
    }
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    orderUpdates,
    currentStatus,
    isConnected,
    isConnecting,
    reconnect: () => connect(),
  };
}

export function useRestaurantStatus(restaurantId: string, tableId?: number) {
  const restaurantStatus = ref<Partial<RestaurantStatusData>>({});
  const notifications = ref<NotificationData[]>([]);

  const { isConnected, isConnecting, connect, disconnect } = useWebSocket({
    url: `${import.meta.env.VITE_WS_BASE_URL}/restaurants/${restaurantId}/status`,
    onMessage: (data: WebSocketMessage) => {
      switch (data.type) {
        case "restaurant_status_update":
          restaurantStatus.value = {
            ...restaurantStatus.value,
            ...data.data,
          };
          break;
        case "notification":
          notifications.value.push(data.data);
          break;
      }
    },
  });

  const clearNotification = (index: number) => {
    notifications.value.splice(index, 1);
  };

  onMounted(() => {
    if (restaurantId) {
      void connect();
    }
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    restaurantStatus,
    notifications,
    isConnected,
    isConnecting,
    clearNotification,
    reconnect: () => connect(),
    tableId,
  };
}

export default useWebSocket;
