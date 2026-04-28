import { ref, readonly } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useNotificationStore } from "@/stores/notification";
import { useOrderStore } from "@/stores/order";
import type { SSEEvent } from "@/types";
import { isTokenExpired } from "@makanmakan/utils";
import { apiPath } from "@/services/api-url";

const eventSource = ref<EventSource | null>(null);
const isConnected = ref(false);
const reconnectAttempts = ref(0);
const maxReconnectAttempts = 5;
const reconnectDelay = ref(1000); // Start with 1 second

export function useSSE() {
  const authStore = useAuthStore();
  const notificationStore = useNotificationStore();
  const orderStore = useOrderStore();

  const connect = async () => {
    if (
      !authStore.isAuthenticated ||
      !authStore.restaurantId ||
      eventSource.value
    ) {
      return;
    }

    try {
      let token = authStore.token;
      if (!token) {
        console.warn("SSE: No auth token available, skipping connection");
        return;
      }

      // If token is expired or about to expire, refresh first
      if (isTokenExpired(token, 30)) {
        const refreshed = await authStore.refreshToken();
        if (!refreshed) {
          console.warn(
            "SSE: Token expired and refresh failed, skipping connection",
          );
          return;
        }
        token = authStore.token;
        if (!token) return;
      }

      const url = `${apiPath("/sse/events")}?restaurant_id=${authStore.restaurantId}&token=${encodeURIComponent(token)}`;
      eventSource.value = new EventSource(url);

      eventSource.value.onopen = () => {
        console.log("SSE Connected");
        isConnected.value = true;
        reconnectAttempts.value = 0;
        reconnectDelay.value = 1000;
      };

      eventSource.value.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);
          handleSSEEvent(data);
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      };

      eventSource.value.onerror = (error) => {
        console.error("SSE Error:", error);
        isConnected.value = false;

        if (eventSource.value?.readyState === EventSource.CLOSED) {
          handleReconnect();
        }
      };
    } catch (error) {
      console.error("Error creating EventSource:", error);
      handleReconnect();
    }
  };

  const disconnect = () => {
    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
    }
    isConnected.value = false;
    reconnectAttempts.value = 0;
  };

  const handleReconnect = () => {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      notificationStore.addNotification({
        type: "error",
        title: "連線中斷",
        message: "無法連接到伺服器，請重新整理頁面",
      });
      return;
    }

    disconnect();

    setTimeout(async () => {
      reconnectAttempts.value++;
      reconnectDelay.value = Math.min(reconnectDelay.value * 2, 30000);
      console.log(
        `Attempting to reconnect... (${reconnectAttempts.value}/${maxReconnectAttempts})`,
      );
      await connect();
    }, reconnectDelay.value);
  };

  const handleSSEEvent = (event: SSEEvent) => {
    switch (event.type) {
      case "order_update":
        handleOrderUpdate(event.data);
        break;
      case "menu_update":
        handleMenuUpdate(event.data);
        break;
      case "system_notification":
        handleSystemNotification(event.data);
        break;
      default:
        console.log("Unknown SSE event type:", event.type);
    }
  };

  const handleOrderUpdate = (data: any) => {
    // Update order store
    orderStore.updateOrder(data.order);

    // Show notification based on user role and order status
    const authStore = useAuthStore();
    const userRole = authStore.userRole;

    if (
      data.order.status === "pending" &&
      (userRole === 0 || userRole === 1 || userRole === 2)
    ) {
      // Admin, Owner, or Chef
      notificationStore.addNotification({
        type: "info",
        title: "新訂單",
        message: `桌號 ${data.order.tableNumber} 有新訂單 #${data.order.id}`,
        sound: true,
      });
    }

    if (
      data.order.status === "ready" &&
      (userRole === 0 || userRole === 1 || userRole === 3)
    ) {
      // Admin, Owner, or Service
      notificationStore.addNotification({
        type: "success",
        title: "訂單完成",
        message: `訂單 #${data.order.id} 已準備完成`,
        sound: true,
      });
    }
  };

  const handleMenuUpdate = (_data: any) => {
    // Refresh menu data if needed
    notificationStore.addNotification({
      type: "info",
      title: "菜單更新",
      message: "菜單已更新，請確認最新內容",
    });
  };

  const handleSystemNotification = (data: any) => {
    notificationStore.addNotification({
      type: data.level || "info",
      title: data.title || "系統通知",
      message: data.message,
      persistent: data.persistent || false,
    });
  };

  return {
    isConnected: readonly(isConnected),
    connect,
    disconnect,
    reconnectAttempts: readonly(reconnectAttempts),
  };
}
