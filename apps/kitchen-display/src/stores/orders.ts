import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { kitchenApi } from "@/services/kitchenApi";
import type { KitchenOrder, KitchenStats, KitchenSSEEvent } from "@/types";

export const useOrdersStore = defineStore("orders", () => {
  // State
  const orders = ref<KitchenOrder[]>([]);
  const stats = ref<KitchenStats>({
    pendingCount: 0,
    preparingCount: 0,
    readyCount: 0,
    completedToday: 0,
    averageCookingTime: 0,
    averageWaitingTime: 0,
    efficiency: 0,
    urgentOrders: 0,
  });
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Computed
  const pendingOrders = computed(
    () => orders.value.filter((order) => order.status === 1), // CONFIRMED
  );

  const preparingOrders = computed(
    () => orders.value.filter((order) => order.status === 2), // PREPARING
  );

  const readyOrders = computed(
    () => orders.value.filter((order) => order.status === 3), // READY
  );

  const urgentOrders = computed(() =>
    orders.value.filter((order) => order.priority === "urgent"),
  );

  const totalOrders = computed(() => orders.value.length);

  /**
   * 從 API 獲取訂單資料
   */
  const fetchOrders = async (restaurantId: number) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await kitchenApi.getOrders(restaurantId);

      if (response.success && response.data) {
        // 合併所有狀態的訂單
        const allOrders = [
          ...response.data.pending,
          ...response.data.preparing,
          ...response.data.ready,
        ];

        orders.value = allOrders;
        stats.value = response.data.stats;
        lastUpdated.value = new Date();

        console.log(
          `Loaded ${allOrders.length} orders for restaurant ${restaurantId}`,
        );
      } else {
        throw new Error(response.error || "載入訂單失敗");
      }
    } catch (err: any) {
      error.value = err.message;
      console.error("Failed to fetch orders:", err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 處理 SSE 事件
   */
  const handleSSEEvent = (event: KitchenSSEEvent) => {
    switch (event.type) {
      case "NEW_ORDER":
        handleNewOrder(event);
        break;
      case "ORDER_STATUS_UPDATE":
        handleOrderStatusUpdate(event);
        break;
      case "ORDER_CANCELLED":
        handleOrderCancelled(event);
        break;
      case "PRIORITY_UPDATE":
        handlePriorityUpdate(event);
        break;
    }

    // 重新計算統計
    updateStats();
  };

  /**
   * 處理新訂單事件
   */
  const handleNewOrder = (event: KitchenSSEEvent) => {
    if (event.payload && event.payload.order) {
      const newOrder: KitchenOrder = event.payload.order;

      // 檢查訂單是否已存在
      const existingOrderIndex = orders.value.findIndex(
        (o) => o.id === newOrder.id,
      );

      if (existingOrderIndex === -1) {
        orders.value.unshift(newOrder); // 新訂單插入到最前面
        console.log(`New order added: ${newOrder.orderNumber}`);
      } else {
        // 更新現有訂單
        orders.value[existingOrderIndex] = newOrder;
        console.log(`Existing order updated: ${newOrder.orderNumber}`);
      }
    }
  };

  /**
   * 處理訂單狀態更新事件
   */
  const handleOrderStatusUpdate = (event: KitchenSSEEvent) => {
    if (event.orderId && event.payload) {
      const orderId = event.orderId;
      const { itemId, status, updatedAt, notes } = event.payload;

      const orderIndex = orders.value.findIndex((o) => o.id === orderId);
      if (orderIndex !== -1) {
        const order = orders.value[orderIndex];

        if (itemId) {
          // 更新特定項目狀態
          const itemIndex = order.items.findIndex((i) => i.id === itemId);
          if (itemIndex !== -1) {
            order.items[itemIndex].status = status;

            if (status === "preparing" && !order.items[itemIndex].startedAt) {
              order.items[itemIndex].startedAt = updatedAt;
            } else if (
              status === "ready" &&
              !order.items[itemIndex].completedAt
            ) {
              order.items[itemIndex].completedAt = updatedAt;
            }

            if (notes) {
              order.items[itemIndex].notes = notes;
            }

            console.log(
              `Order ${orderId} item ${itemId} status updated to ${status}`,
            );
          }
        }

        // 檢查是否需要更新訂單整體狀態
        updateOrderStatus(order);

        // 觸發響應式更新
        orders.value[orderIndex] = { ...order };
      }
    }
  };

  /**
   * 處理訂單取消事件
   */
  const handleOrderCancelled = (event: KitchenSSEEvent) => {
    if (event.orderId) {
      const orderIndex = orders.value.findIndex((o) => o.id === event.orderId);
      if (orderIndex !== -1) {
        // 移除已取消的訂單
        orders.value.splice(orderIndex, 1);
        console.log(`Order ${event.orderId} cancelled and removed`);
      }
    }
  };

  /**
   * 處理優先級更新事件
   */
  const handlePriorityUpdate = (event: KitchenSSEEvent) => {
    if (event.orderId && event.payload) {
      const orderId = event.orderId;
      const { priority } = event.payload;

      const orderIndex = orders.value.findIndex((o) => o.id === orderId);
      if (orderIndex !== -1) {
        orders.value[orderIndex].priority = priority;
        console.log(`Order ${orderId} priority updated to ${priority}`);
      }
    }
  };

  /**
   * 更新訂單整體狀態
   */
  const updateOrderStatus = (order: KitchenOrder) => {
    const itemStatuses = order.items.map((item) => item.status);

    if (
      itemStatuses.every(
        (status) => status === "ready" || status === "completed",
      )
    ) {
      order.status = 3; // READY
    } else if (itemStatuses.some((status) => status === "preparing")) {
      order.status = 2; // PREPARING
    } else {
      order.status = 1; // CONFIRMED
    }
  };

  /**
   * 重新計算統計資料
   */
  const updateStats = () => {
    stats.value = {
      pendingCount: pendingOrders.value.length,
      preparingCount: preparingOrders.value.length,
      readyCount: readyOrders.value.length,
      completedToday: stats.value.completedToday, // 保持原有值
      averageCookingTime: calculateAverageCookingTime(),
      averageWaitingTime: calculateAverageWaitingTime(),
      efficiency: stats.value.efficiency, // 保持原有值
      urgentOrders: urgentOrders.value.length,
    };
  };

  /**
   * 計算平均製作時間
   */
  const calculateAverageCookingTime = (): number => {
    const cookingOrders = orders.value.filter((order) =>
      order.items.some((item) => item.startedAt && item.completedAt),
    );

    if (cookingOrders.length === 0) return 0;

    let totalTime = 0;
    let count = 0;

    cookingOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.startedAt && item.completedAt) {
          const startTime = new Date(item.startedAt).getTime();
          const endTime = new Date(item.completedAt).getTime();
          totalTime += (endTime - startTime) / 60000; // 轉換為分鐘
          count++;
        }
      });
    });

    return Math.round(totalTime / count);
  };

  /**
   * 計算平均等待時間
   */
  const calculateAverageWaitingTime = (): number => {
    const waitingOrders = orders.value.filter((order) => order.status <= 2);

    if (waitingOrders.length === 0) return 0;

    const totalWaitingTime = waitingOrders.reduce(
      (sum, order) => sum + order.elapsedTime,
      0,
    );

    return Math.round(totalWaitingTime / waitingOrders.length);
  };

  /**
   * 開始製作訂單項目
   */
  const startCooking = async (
    restaurantId: number,
    orderId: number,
    itemId: number,
  ) => {
    try {
      const response = await kitchenApi.startCooking(
        restaurantId,
        orderId,
        itemId,
      );

      if (response.success) {
        // 樂觀更新本地狀態
        const orderIndex = orders.value.findIndex((o) => o.id === orderId);
        if (orderIndex !== -1) {
          const itemIndex = orders.value[orderIndex].items.findIndex(
            (i) => i.id === itemId,
          );
          if (itemIndex !== -1) {
            orders.value[orderIndex].items[itemIndex].status = "preparing";
            orders.value[orderIndex].items[itemIndex].startedAt =
              new Date().toISOString();
            updateOrderStatus(orders.value[orderIndex]);
            updateStats();
          }
        }
      } else {
        throw new Error(response.error || "開始製作失敗");
      }
    } catch (error: any) {
      console.error("Failed to start cooking:", error);
      throw error;
    }
  };

  /**
   * 標記項目完成
   */
  const markReady = async (
    restaurantId: number,
    orderId: number,
    itemId: number,
  ) => {
    try {
      const response = await kitchenApi.markItemReady(
        restaurantId,
        orderId,
        itemId,
      );

      if (response.success) {
        // 樂觀更新本地狀態
        const orderIndex = orders.value.findIndex((o) => o.id === orderId);
        if (orderIndex !== -1) {
          const itemIndex = orders.value[orderIndex].items.findIndex(
            (i) => i.id === itemId,
          );
          if (itemIndex !== -1) {
            orders.value[orderIndex].items[itemIndex].status = "ready";
            orders.value[orderIndex].items[itemIndex].completedAt =
              new Date().toISOString();
            updateOrderStatus(orders.value[orderIndex]);
            updateStats();
          }
        }
      } else {
        throw new Error(response.error || "標記完成失敗");
      }
    } catch (error: any) {
      console.error("Failed to mark ready:", error);
      throw error;
    }
  };

  /**
   * 批量開始製作訂單所有項目
   */
  const startAllItems = async (restaurantId: number, orderId: number) => {
    const order = orders.value.find((o) => o.id === orderId);
    if (!order) return;

    const pendingItemIds = order.items
      .filter((item) => item.status === "pending")
      .map((item) => item.id);

    if (pendingItemIds.length === 0) return;

    try {
      const response = await kitchenApi.startAllItems(
        restaurantId,
        orderId,
        pendingItemIds,
      );

      if (!response.success) {
        throw new Error(response.error || "批量開始製作失敗");
      }
    } catch (error: any) {
      console.error("Failed to start all items:", error);
      throw error;
    }
  };

  /**
   * 批量標記訂單所有項目完成
   */
  const markAllReady = async (restaurantId: number, orderId: number) => {
    const order = orders.value.find((o) => o.id === orderId);
    if (!order) return;

    const preparingItemIds = order.items
      .filter((item) => item.status === "preparing")
      .map((item) => item.id);

    if (preparingItemIds.length === 0) return;

    try {
      const response = await kitchenApi.markAllItemsReady(
        restaurantId,
        orderId,
        preparingItemIds,
      );

      if (!response.success) {
        throw new Error(response.error || "批量標記完成失敗");
      }
    } catch (error: any) {
      console.error("Failed to mark all ready:", error);
      throw error;
    }
  };

  /**
   * 根據 ID 獲取訂單
   */
  const getOrderById = (orderId: number) => {
    return orders.value.find((order) => order.id === orderId);
  };

  /**
   * 清除錯誤狀態
   */
  const clearError = () => {
    error.value = null;
  };

  /**
   * 重置 store 狀態
   */
  const reset = () => {
    orders.value = [];
    stats.value = {
      pendingCount: 0,
      preparingCount: 0,
      readyCount: 0,
      completedToday: 0,
      averageCookingTime: 0,
      averageWaitingTime: 0,
      efficiency: 0,
      urgentOrders: 0,
    };
    loading.value = false;
    error.value = null;
    lastUpdated.value = null;
  };

  return {
    // State
    orders,
    stats,
    loading,
    error,
    lastUpdated,

    // Computed
    pendingOrders,
    preparingOrders,
    readyOrders,
    urgentOrders,
    totalOrders,

    // Actions
    fetchOrders,
    handleSSEEvent,
    startCooking,
    markReady,
    startAllItems,
    markAllReady,
    getOrderById,
    clearError,
    reset,
  };
});
