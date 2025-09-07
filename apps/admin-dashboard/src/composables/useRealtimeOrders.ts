import { ref, onMounted, onUnmounted } from "vue";
import {
  useRealtime,
  REALTIME_EVENTS,
  type SSEMessage,
} from "@/services/realtimeService";
import { useAuthStore } from "@/stores/auth";

export interface RealtimeOrderUpdate {
  orderId: string;
  orderNumber: string;
  status: string;
  tableNumber?: string;
  totalAmount: number;
  timestamp: string;
  type: "created" | "updated" | "status_changed";
}

export interface RealtimeGroupOrderUpdate {
  groupOrderId: string;
  shareCode: string;
  status: string;
  memberCount: number;
  totalAmount: number;
  timestamp: string;
  type:
    | "created"
    | "updated"
    | "member_joined"
    | "member_left"
    | "payment_completed";
}

export function useRealtimeOrders() {
  const { subscribe, unsubscribe, connect, connectionStatus } = useRealtime();
  const authStore = useAuthStore();

  // 響應式狀態
  const isConnected = ref(false);
  const orderUpdates = ref<RealtimeOrderUpdate[]>([]);
  const groupOrderUpdates = ref<RealtimeGroupOrderUpdate[]>([]);
  const subscriptionIds = ref<string[]>([]);

  // 訂單更新處理函數
  const handleOrderUpdate = (message: SSEMessage) => {
    const update: RealtimeOrderUpdate = {
      orderId: message.data.id,
      orderNumber: message.data.orderNumber,
      status: message.data.status,
      tableNumber: message.data.tableNumber,
      totalAmount: message.data.totalAmount,
      timestamp: message.timestamp,
      type: message.type.includes("created")
        ? "created"
        : message.type.includes("status")
          ? "status_changed"
          : "updated",
    };

    orderUpdates.value.unshift(update);

    // 限制更新歷史長度
    if (orderUpdates.value.length > 50) {
      orderUpdates.value = orderUpdates.value.slice(0, 50);
    }

    console.log("Order update received:", update);
  };

  // 團體訂單更新處理函數
  const handleGroupOrderUpdate = (message: SSEMessage) => {
    const update: RealtimeGroupOrderUpdate = {
      groupOrderId: message.data.id,
      shareCode: message.data.shareCode,
      status: message.data.status,
      memberCount: message.data.memberCount,
      totalAmount: message.data.totalAmount,
      timestamp: message.timestamp,
      type: message.type.includes("created")
        ? "created"
        : message.type.includes("member_joined")
          ? "member_joined"
          : message.type.includes("member_left")
            ? "member_left"
            : message.type.includes("payment")
              ? "payment_completed"
              : "updated",
    };

    groupOrderUpdates.value.unshift(update);

    // 限制更新歷史長度
    if (groupOrderUpdates.value.length > 50) {
      groupOrderUpdates.value = groupOrderUpdates.value.slice(0, 50);
    }

    console.log("Group order update received:", update);
  };

  // 開始監聽訂單相關事件
  const startListening = () => {
    if (!authStore.user?.restaurantId) {
      console.warn(
        "No restaurant ID found, cannot start realtime orders listening",
      );
      return;
    }

    // 訂閱訂單相關事件
    const orderEventTypes = [
      REALTIME_EVENTS.ORDER_CREATED,
      REALTIME_EVENTS.ORDER_UPDATED,
      REALTIME_EVENTS.ORDER_STATUS_CHANGED,
    ];

    const orderSubId = subscribe(
      orderEventTypes,
      handleOrderUpdate,
      authStore.user.restaurantId.toString(),
    );

    // 訂閱團體訂單相關事件
    const groupOrderEventTypes = [
      REALTIME_EVENTS.GROUP_ORDER_CREATED,
      REALTIME_EVENTS.GROUP_ORDER_UPDATED,
      REALTIME_EVENTS.GROUP_MEMBER_JOINED,
      REALTIME_EVENTS.GROUP_MEMBER_LEFT,
      REALTIME_EVENTS.GROUP_PAYMENT_COMPLETED,
    ];

    const groupOrderSubId = subscribe(
      groupOrderEventTypes,
      handleGroupOrderUpdate,
      authStore.user.restaurantId.toString(),
    );

    subscriptionIds.value = [orderSubId, groupOrderSubId];
    console.log("Started listening to realtime order events");
  };

  // 停止監聽
  const stopListening = () => {
    subscriptionIds.value.forEach((subId) => {
      unsubscribe(subId);
    });
    subscriptionIds.value = [];
    console.log("Stopped listening to realtime order events");
  };

  // 清除更新歷史
  const clearUpdates = () => {
    orderUpdates.value = [];
    groupOrderUpdates.value = [];
  };

  // 獲取最近的訂單更新
  const getRecentOrderUpdates = (limit = 10) => {
    return orderUpdates.value.slice(0, limit);
  };

  // 獲取最近的團體訂單更新
  const getRecentGroupOrderUpdates = (limit = 10) => {
    return groupOrderUpdates.value.slice(0, limit);
  };

  // 檢查特定訂單是否有更新
  const hasOrderUpdate = (orderId: string, since?: Date) => {
    return orderUpdates.value.some((update) => {
      const matchesId = update.orderId === orderId;
      const matchesTime = since ? new Date(update.timestamp) > since : true;
      return matchesId && matchesTime;
    });
  };

  // 檢查特定團體訂單是否有更新
  const hasGroupOrderUpdate = (groupOrderId: string, since?: Date) => {
    return groupOrderUpdates.value.some((update) => {
      const matchesId = update.groupOrderId === groupOrderId;
      const matchesTime = since ? new Date(update.timestamp) > since : true;
      return matchesId && matchesTime;
    });
  };

  // 生命週期管理
  onMounted(async () => {
    // 確保已連接到實時服務
    if (connectionStatus.value !== "connected") {
      await connect(authStore.user?.restaurantId?.toString());
    }

    // 開始監聽
    startListening();

    // 監聽連接狀態變化
    const checkConnection = () => {
      isConnected.value = connectionStatus.value === "connected";
    };

    checkConnection();
    // 每秒檢查一次連接狀態
    const connectionChecker = setInterval(checkConnection, 1000);

    onUnmounted(() => {
      clearInterval(connectionChecker);
    });
  });

  onUnmounted(() => {
    stopListening();
  });

  return {
    // 狀態
    isConnected,
    orderUpdates,
    groupOrderUpdates,
    connectionStatus,

    // 方法
    startListening,
    stopListening,
    clearUpdates,
    getRecentOrderUpdates,
    getRecentGroupOrderUpdates,
    hasOrderUpdate,
    hasGroupOrderUpdate,
  };
}

export default useRealtimeOrders;
