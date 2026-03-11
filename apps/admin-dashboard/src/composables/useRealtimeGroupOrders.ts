import { ref, onMounted, onUnmounted, computed } from "vue";

/** Sanitize values for safe logging (prevent log injection) */
function sanitizeForLog(value: unknown): string {
  return String(value)
    .replace(/[\r\n\t]/g, " ")
    .slice(0, 500);
}
import { useRealtime, type SSEMessage } from "@/services/realtimeService";
import { useAuthStore } from "@/stores/auth";

// Type definitions for group orders
export interface GroupOrderMember {
  id: string;
  sessionId: string;
  name: string;
  phone?: string;
  role: "creator" | "admin" | "member";
  joinedAt: number;
  lastActiveAt: number;
  isOnline: boolean;
  totalAmount: number;
  itemCount: number;
  paymentStatus: "unpaid" | "pending" | "paid";
}

export interface GroupOrderCartItem {
  id: string;
  memberId: string;
  menuItemId: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations: Record<string, any>;
  specialInstructions?: string;
  addedAt: number;
  updatedAt: number;
  version: number;
}

export interface GroupOrderSplitBill {
  id: string;
  memberId: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  totalAmount: number;
  items: string[];
  paymentStatus: "pending" | "processing" | "paid" | "failed";
  paymentMethod?: string;
  paidAt?: number;
}

export interface GroupOrderState {
  id: string;
  shareCode: string;
  status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
  restaurantId: string;
  members: GroupOrderMember[];
  cart: GroupOrderCartItem[];
  splitBills: GroupOrderSplitBill[];
  host: GroupOrderMember;
  settings: {
    maxMembers: number;
    allowEditOthers: boolean;
    splitType: "equal" | "proportional" | "individual" | "custom";
  };
  totalAmount: number;
  lastActivity: number;
  createdAt: number;
  expiresAt: number;
}

export interface GroupOrderEvent {
  type: string;
  groupOrderId: string;
  timestamp: number;
  data: any;
}

export interface RealtimeGroupOrderUpdate {
  groupOrderId: string;
  shareCode: string;
  event: GroupOrderEvent;
  groupOrder: GroupOrderState;
}

/**
 * 群組訂單實時同步組合式函數
 * 提供完整的群組訂單實時功能，包括成員管理、購物車同步、分帳處理等
 */
export function useRealtimeGroupOrders() {
  const { subscribe, unsubscribe, connect, connectionStatus } = useRealtime();
  const authStore = useAuthStore();

  // 響應式狀態
  const isConnected = ref(false);
  const activeGroupOrders = ref<Map<string, GroupOrderState>>(new Map());
  const currentGroupOrder = ref<GroupOrderState | null>(null);
  const myMemberId = ref<string | null>(null);

  // 事件歷史和通知
  const recentEvents = ref<GroupOrderEvent[]>([]);
  const notifications = ref<
    Array<{
      id: string;
      type: string;
      message: string;
      timestamp: number;
      read: boolean;
    }>
  >([]);

  // 訂閱管理
  const subscriptionIds = ref<string[]>([]);

  // WebSocket 連接狀態
  const wsConnection = ref<WebSocket | null>(null);
  const wsConnectionStatus = ref<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");

  // 計算屬性
  const myMember = computed(() => {
    if (!currentGroupOrder.value || !myMemberId.value) return null;
    return (
      currentGroupOrder.value.members.find((m) => m.id === myMemberId.value) ||
      null
    );
  });

  const canEditCart = computed(() => {
    if (!currentGroupOrder.value) return false;
    return (
      currentGroupOrder.value.status === "active" ||
      currentGroupOrder.value.status === "ordering"
    );
  });

  const canInitiateSplit = computed(() => {
    if (!myMember.value || !currentGroupOrder.value) return false;
    return (
      (myMember.value.role === "creator" || myMember.value.role === "admin") &&
      currentGroupOrder.value.status === "active" &&
      currentGroupOrder.value.cart.length > 0
    );
  });

  const allMembersPaid = computed(() => {
    if (!currentGroupOrder.value) return false;
    return currentGroupOrder.value.members.every(
      (m) => m.paymentStatus === "paid",
    );
  });

  /**
   * WebSocket 連接管理
   */
  const connectWebSocket = async (groupOrderId?: string): Promise<void> => {
    if (wsConnection.value?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      wsConnectionStatus.value = "connecting";

      const token = localStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // 構建WebSocket URL
      const baseUrl = import.meta.env.VITE_WS_URL;
      if (!baseUrl) {
        throw new Error(
          "[Config Error] VITE_WS_URL is required for WebSocket connection. " +
            "Please set this environment variable in your .env file.",
        );
      }
      const params = new URLSearchParams({
        userId: authStore.user?.id?.toString() || "0",
        restaurantId: authStore.user?.restaurantId?.toString() || "0",
        role: authStore.user?.role?.toString() || "0",
      });

      if (groupOrderId) {
        params.append("groupOrderId", groupOrderId);
      }

      const wsUrl = `${baseUrl}/websocket?${params.toString()}`;
      wsConnection.value = new WebSocket(wsUrl);

      wsConnection.value.onopen = () => {
        console.log("WebSocket connected for group orders");
        wsConnectionStatus.value = "connected";

        // 發送心跳
        startHeartbeat();
      };

      wsConnection.value.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      wsConnection.value.onclose = () => {
        console.log("WebSocket disconnected");
        wsConnectionStatus.value = "disconnected";
        stopHeartbeat();

        // 自動重連
        setTimeout(() => {
          if (wsConnectionStatus.value === "disconnected") {
            connectWebSocket(groupOrderId);
          }
        }, 3000);
      };

      wsConnection.value.onerror = (error) => {
        console.error("WebSocket error:", error);
        wsConnectionStatus.value = "error";
      };
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
      wsConnectionStatus.value = "error";
    }
  };

  const disconnectWebSocket = (): void => {
    if (wsConnection.value) {
      wsConnection.value.close();
      wsConnection.value = null;
    }
    wsConnectionStatus.value = "disconnected";
    stopHeartbeat();
  };

  /**
   * 心跳機制
   */
  let heartbeatInterval: number | null = null;

  const startHeartbeat = (): void => {
    heartbeatInterval = window.setInterval(() => {
      if (wsConnection.value?.readyState === WebSocket.OPEN) {
        sendWebSocketMessage({
          type: "heartbeat",
          timestamp: Date.now(),
        });
      }
    }, 30000); // 每30秒發送心跳
  };

  const stopHeartbeat = (): void => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  /**
   * WebSocket 消息處理
   */
  const sendWebSocketMessage = (message: any): void => {
    if (wsConnection.value?.readyState === WebSocket.OPEN) {
      wsConnection.value.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected, message not sent:", message);
    }
  };

  const handleWebSocketMessage = (message: any): void => {
    switch (message.type) {
      case "group_order_event":
        handleGroupOrderEvent(message);
        break;

      case "group_order_joined":
        handleGroupOrderJoined(message);
        break;

      case "error":
        handleWebSocketError(message);
        break;

      case "heartbeat_ack":
        // 心跳確認，不需要處理
        break;

      default:
        console.log(
          "Unhandled WebSocket message:",
          sanitizeForLog(JSON.stringify(message)),
        );
    }
  };

  /**
   * 群組訂單事件處理
   */
  const handleGroupOrderEvent = (message: any): void => {
    const { groupOrderId, event, groupOrder } = message;

    // 更新群組訂單狀態
    if (groupOrder) {
      activeGroupOrders.value.set(groupOrderId, groupOrder);

      if (currentGroupOrder.value?.id === groupOrderId) {
        currentGroupOrder.value = groupOrder;
      }
    }

    // 記錄事件
    recentEvents.value.unshift({
      type: event.type,
      groupOrderId,
      timestamp: event.timestamp,
      data: event,
    });

    // 限制事件歷史長度
    if (recentEvents.value.length > 100) {
      recentEvents.value = recentEvents.value.slice(0, 100);
    }

    // 生成通知
    createNotification(event, groupOrder);

    console.log(
      "Group order event received:",
      sanitizeForLog(JSON.stringify(event)),
    );
  };

  const handleGroupOrderJoined = (message: any): void => {
    const { groupOrder, memberId, success } = message;

    if (success && groupOrder) {
      currentGroupOrder.value = groupOrder;
      myMemberId.value = memberId;
      activeGroupOrders.value.set(groupOrder.id, groupOrder);

      createNotification({
        type: "joined_group",
        message: `已成功加入團體訂單 ${groupOrder.shareCode}`,
      });
    }
  };

  const handleWebSocketError = (message: any): void => {
    console.error(
      "WebSocket error message:",
      sanitizeForLog(JSON.stringify(message)),
    );

    createNotification({
      type: "error",
      message: message.error || "發生未知錯誤",
    });
  };

  /**
   * SSE 事件處理
   */
  const handleSSEGroupOrderUpdate = (message: SSEMessage): void => {
    const update: RealtimeGroupOrderUpdate = {
      groupOrderId: message.data.groupOrderId,
      shareCode: message.data.shareCode,
      event: message.data.event,
      groupOrder: message.data.groupOrder,
    };

    // 更新本地狀態
    if (update.groupOrder) {
      activeGroupOrders.value.set(update.groupOrderId, update.groupOrder);

      if (currentGroupOrder.value?.id === update.groupOrderId) {
        currentGroupOrder.value = update.groupOrder;
      }
    }

    // 記錄事件
    recentEvents.value.unshift(update.event);

    console.log("SSE group order update received:", update);
  };

  /**
   * 群組訂單操作方法
   */
  const joinGroupOrder = async (
    shareCode: string,
    memberName: string,
    phone?: string,
  ): Promise<boolean> => {
    try {
      // 首先建立WebSocket連接
      await connectWebSocket();

      // 發送加入請求
      sendWebSocketMessage({
        type: "join_group_order",
        data: {
          shareCode,
          memberName,
          phone,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to join group order:", error);
      return false;
    }
  };

  const leaveGroupOrder = async (): Promise<boolean> => {
    if (!currentGroupOrder.value || !myMemberId.value) return false;

    try {
      sendWebSocketMessage({
        type: "leave_group_order",
        data: {
          groupOrderId: currentGroupOrder.value.id,
          memberId: myMemberId.value,
        },
      });

      // 清理本地狀態
      currentGroupOrder.value = null;
      myMemberId.value = null;

      return true;
    } catch (error) {
      console.error("Failed to leave group order:", error);
      return false;
    }
  };

  const addCartItem = async (item: {
    menuItemId: number;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    customizations?: Record<string, any>;
    specialInstructions?: string;
  }): Promise<boolean> => {
    if (!currentGroupOrder.value || !myMemberId.value) return false;

    try {
      sendWebSocketMessage({
        type: "add_cart_item",
        data: {
          groupOrderId: currentGroupOrder.value.id,
          memberId: myMemberId.value,
          ...item,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to add cart item:", error);
      return false;
    }
  };

  const updateCartItem = async (
    itemId: string,
    updates: {
      quantity?: number;
      customizations?: Record<string, any>;
      specialInstructions?: string;
    },
  ): Promise<boolean> => {
    if (!currentGroupOrder.value) return false;

    try {
      sendWebSocketMessage({
        type: "update_cart_item",
        data: {
          groupOrderId: currentGroupOrder.value.id,
          itemId,
          ...updates,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to update cart item:", error);
      return false;
    }
  };

  const removeCartItem = async (itemId: string): Promise<boolean> => {
    if (!currentGroupOrder.value) return false;

    try {
      sendWebSocketMessage({
        type: "remove_cart_item",
        data: {
          groupOrderId: currentGroupOrder.value.id,
          itemId,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to remove cart item:", error);
      return false;
    }
  };

  const initiateSplitBill = async (
    splitType: "equal" | "proportional" | "individual" | "custom",
    customSplits?: Array<{
      memberId: string;
      amount: number;
      items: string[];
    }>,
  ): Promise<boolean> => {
    if (!currentGroupOrder.value || !canInitiateSplit.value) return false;

    try {
      sendWebSocketMessage({
        type: "initiate_split_bill",
        data: {
          groupOrderId: currentGroupOrder.value.id,
          splitType,
          customSplits,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to initiate split bill:", error);
      return false;
    }
  };

  const processPayment = async (
    paymentMethod: string,
    amount: number,
    transactionId?: string,
  ): Promise<boolean> => {
    if (!currentGroupOrder.value || !myMemberId.value) return false;

    try {
      sendWebSocketMessage({
        type: "process_payment",
        data: {
          groupOrderId: currentGroupOrder.value.id,
          memberId: myMemberId.value,
          paymentMethod,
          amount,
          transactionId,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to process payment:", error);
      return false;
    }
  };

  /**
   * 通知管理
   */
  const createNotification = (
    event: any,
    _groupOrder?: GroupOrderState,
  ): void => {
    let message = "";

    switch (event.type) {
      case "member_joined":
        message = `${event.member?.name || "新成員"} 加入了團單`;
        break;
      case "member_left":
        message = `${event.memberName || "成員"} 離開了團單`;
        break;
      case "cart_item_added":
        message = `${event.member?.name || "成員"} 添加了 ${event.item?.menuItemName || "商品"}`;
        break;
      case "cart_item_updated":
        message = `${event.member?.name || "成員"} 更新了 ${event.item?.menuItemName || "商品"}`;
        break;
      case "cart_item_removed":
        message = `${event.member?.name || "成員"} 移除了 ${event.item?.menuItemName || "商品"}`;
        break;
      case "split_bill_initiated":
        message = `${event.initiatedBy?.name || "主持人"} 發起了分帳`;
        break;
      case "payment_completed":
        message = `${event.member?.name || "成員"} 完成了付款`;
        if (event.allPaid) {
          message += "，所有成員已付款完成！";
        }
        break;
      default:
        message = event.message || "群組訂單有新更新";
    }

    notifications.value.unshift({
      id: crypto.randomUUID(),
      type: event.type,
      message,
      timestamp: event.timestamp || Date.now(),
      read: false,
    });

    // 限制通知數量
    if (notifications.value.length > 50) {
      notifications.value = notifications.value.slice(0, 50);
    }
  };

  const markNotificationAsRead = (notificationId: string): void => {
    const notification = notifications.value.find(
      (n) => n.id === notificationId,
    );
    if (notification) {
      notification.read = true;
    }
  };

  const markAllNotificationsAsRead = (): void => {
    notifications.value.forEach((n) => (n.read = true));
  };

  const clearNotifications = (): void => {
    notifications.value = [];
  };

  /**
   * 實用工具方法
   */
  const getGroupOrderById = (groupOrderId: string): GroupOrderState | null => {
    return activeGroupOrders.value.get(groupOrderId) || null;
  };

  const getRecentEvents = (limit = 20): GroupOrderEvent[] => {
    return recentEvents.value.slice(0, limit);
  };

  const getUnreadNotifications = () => {
    return notifications.value.filter((n) => !n.read);
  };

  const getMemberById = (memberId: string): GroupOrderMember | null => {
    if (!currentGroupOrder.value) return null;
    return (
      currentGroupOrder.value.members.find((m) => m.id === memberId) || null
    );
  };

  const getCartItemsByMember = (memberId: string): GroupOrderCartItem[] => {
    if (!currentGroupOrder.value) return [];
    return currentGroupOrder.value.cart.filter(
      (item) => item.memberId === memberId,
    );
  };

  const getMyCartItems = (): GroupOrderCartItem[] => {
    if (!myMemberId.value) return [];
    return getCartItemsByMember(myMemberId.value);
  };

  const getMySplitBill = (): GroupOrderSplitBill | null => {
    if (!currentGroupOrder.value || !myMemberId.value) return null;
    return (
      currentGroupOrder.value.splitBills.find(
        (bill) => bill.memberId === myMemberId.value,
      ) || null
    );
  };

  /**
   * 開始監聽群組訂單事件
   */
  const startListening = (): void => {
    if (!authStore.user?.restaurantId) {
      console.warn(
        "No restaurant ID found, cannot start group order listening",
      );
      return;
    }

    // SSE訂閱群組訂單事件
    const groupOrderEventTypes = [
      "group_order_created",
      "group_order_updated",
      "group_member_joined",
      "group_member_left",
      "group_cart_updated",
      "group_split_initiated",
      "group_payment_completed",
    ];

    const sseSubId = subscribe(
      groupOrderEventTypes,
      handleSSEGroupOrderUpdate,
      authStore.user.restaurantId.toString(),
    );

    subscriptionIds.value = [sseSubId];
    console.log("Started listening to group order events");
  };

  const stopListening = (): void => {
    subscriptionIds.value.forEach((subId) => {
      unsubscribe(subId);
    });
    subscriptionIds.value = [];

    disconnectWebSocket();
    console.log("Stopped listening to group order events");
  };

  /**
   * 生命週期管理
   */
  onMounted(async () => {
    // 確保已連接到實時服務
    if (connectionStatus.value !== "connected") {
      await connect(authStore.user?.restaurantId?.toString());
    }

    // 開始監聽
    startListening();

    // 監聽連接狀態變化
    const checkConnection = () => {
      isConnected.value =
        connectionStatus.value === "connected" &&
        wsConnectionStatus.value === "connected";
    };

    checkConnection();
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
    wsConnectionStatus,
    activeGroupOrders,
    currentGroupOrder,
    myMemberId,
    myMember,
    recentEvents,
    notifications,

    // 計算屬性
    canEditCart,
    canInitiateSplit,
    allMembersPaid,

    // WebSocket 連接
    connectWebSocket,
    disconnectWebSocket,

    // 群組訂單操作
    joinGroupOrder,
    leaveGroupOrder,
    addCartItem,
    updateCartItem,
    removeCartItem,
    initiateSplitBill,
    processPayment,

    // 通知管理
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,

    // 工具方法
    getGroupOrderById,
    getRecentEvents,
    getUnreadNotifications,
    getMemberById,
    getCartItemsByMember,
    getMyCartItems,
    getMySplitBill,

    // 監聽管理
    startListening,
    stopListening,
  };
}

export default useRealtimeGroupOrders;
