import { ref, computed, onUnmounted } from "vue";
import { useToast, POSITION } from "vue-toastification";
export function useRealtimeOrderStatus() {
  const isConnected = ref(false);
  const wsConnection = ref(null);
  const activeOrders = ref(new Map());
  const toast = useToast();
  const ordersArray = computed(() => Array.from(activeOrders.value.values()));
  const pendingOrdersCount = computed(
    () =>
      ordersArray.value.filter((order) => order.status === "pending").length,
  );
  const connect = (restaurantId) => {
    const wsUrl = `${import.meta.env.VITE_REALTIME_WS_URL || "wss://realtime.makanmakan.com"}/admin/${restaurantId}`;
    try {
      wsConnection.value = new WebSocket(wsUrl);
      wsConnection.value.onopen = () => {
        isConnected.value = true;
        console.log("Connected to admin realtime service");
      };
      wsConnection.value.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "new_order") {
            handleNewOrder(message);
          } else if (message.type === "order_update") {
            handleOrderUpdate(message);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
      wsConnection.value.onclose = () => {
        isConnected.value = false;
        console.log("Disconnected from admin realtime service");
        // Attempt reconnection
        setTimeout(() => {
          if (!isConnected.value) connect(restaurantId);
        }, 5000);
      };
    } catch (error) {
      console.error("Failed to connect to admin WebSocket:", error);
    }
  };
  const handleNewOrder = (notification) => {
    const orderUpdate = {
      orderId: notification.orderId,
      status: "pending",
      tableNumber: notification.tableNumber,
      timestamp: new Date().toISOString(),
    };
    activeOrders.value.set(notification.orderId, orderUpdate);
    toast.success(`新訂單！桌號 ${notification.tableNumber}`, {
      position: POSITION.TOP_RIGHT,
      timeout: 8000,
    });
    // Play notification sound
    playNotificationSound();
  };
  const handleOrderUpdate = (update) => {
    activeOrders.value.set(update.orderId, update);
    if (update.status === "delivered" || update.status === "cancelled") {
      // Remove from active orders after 30 seconds
      setTimeout(() => {
        activeOrders.value.delete(update.orderId);
      }, 30000);
    }
  };
  const updateOrderStatus = (orderId, status) => {
    const order = activeOrders.value.get(orderId);
    if (order) {
      const updatedOrder = {
        ...order,
        status,
        timestamp: new Date().toISOString(),
      };
      activeOrders.value.set(orderId, updatedOrder);
      // Send update to server
      if (
        wsConnection.value &&
        wsConnection.value.readyState === WebSocket.OPEN
      ) {
        wsConnection.value.send(
          JSON.stringify({
            type: "status_update",
            orderId,
            status,
          }),
        );
      }
    }
  };
  const playNotificationSound = () => {
    const audio = new Audio("/notification.mp3");
    audio
      .play()
      .catch((e) => console.log("Could not play notification sound:", e));
  };
  const disconnect = () => {
    if (wsConnection.value) {
      wsConnection.value.close();
      wsConnection.value = null;
      isConnected.value = false;
    }
  };
  onUnmounted(() => {
    disconnect();
  });
  return {
    isConnected,
    activeOrders: ordersArray,
    pendingOrdersCount,
    connect,
    disconnect,
    updateOrderStatus,
  };
}
