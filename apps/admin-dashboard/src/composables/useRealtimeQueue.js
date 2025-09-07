import { ref, onMounted, onUnmounted } from "vue";
import { useRealtime, REALTIME_EVENTS } from "@/services/realtimeService";
import { useAuthStore } from "@/stores/auth";
export function useRealtimeQueue() {
  const { subscribe, unsubscribe, connect, connectionStatus } = useRealtime();
  const authStore = useAuthStore();
  // 響應式狀態
  const isConnected = ref(false);
  const queueUpdates = ref([]);
  const tableUpdates = ref([]);
  const subscriptionIds = ref([]);
  // 統計狀態
  const queueStats = ref({
    currentWaiting: 0,
    totalServedToday: 0,
    averageWaitTime: 0,
    peakWaitTime: 0,
  });
  // 候位更新處理函數
  const handleQueueUpdate = (message) => {
    const update = {
      queueId: message.data.id,
      queueNumber: message.data.queueNumber,
      customerName: message.data.customerName,
      partySize: message.data.partySize,
      status: message.data.status,
      waitTime: message.data.waitTime,
      tableNumber: message.data.tableNumber,
      timestamp: message.timestamp,
      type: message.type.includes("joined")
        ? "joined"
        : message.type.includes("called")
          ? "called"
          : message.type.includes("seated")
            ? "seated"
            : message.type.includes("no_show")
              ? "no_show"
              : "cancelled",
    };
    queueUpdates.value.unshift(update);
    // 更新統計
    updateQueueStats(update);
    // 限制更新歷史長度
    if (queueUpdates.value.length > 100) {
      queueUpdates.value = queueUpdates.value.slice(0, 100);
    }
    console.log("Queue update received:", update);
    // 觸發通知（可選）
    if (update.type === "joined") {
      showQueueNotification(
        `新顧客加入排隊: ${update.customerName || `排號 ${update.queueNumber}`}`,
      );
    } else if (update.type === "no_show") {
      showQueueNotification(
        `未到場: ${update.customerName || `排號 ${update.queueNumber}`}`,
        "warning",
      );
    }
  };
  // 桌位更新處理函數
  const handleTableUpdate = (message) => {
    const update = {
      tableId: message.data.id,
      tableNumber: message.data.number,
      status: message.data.status,
      capacity: message.data.capacity,
      occupiedSince: message.data.occupiedSince,
      timestamp: message.timestamp,
      type: message.type.includes("occupied")
        ? "occupied"
        : message.type.includes("available")
          ? "available"
          : message.type.includes("reserved")
            ? "reserved"
            : "cleaning",
    };
    tableUpdates.value.unshift(update);
    // 限制更新歷史長度
    if (tableUpdates.value.length > 50) {
      tableUpdates.value = tableUpdates.value.slice(0, 50);
    }
    console.log("Table update received:", update);
    // 觸發通知
    if (update.type === "available") {
      showQueueNotification(`桌位 ${update.tableNumber} 現已可用`);
    }
  };
  // 更新候位統計
  const updateQueueStats = (update) => {
    switch (update.type) {
      case "joined":
        queueStats.value.currentWaiting++;
        break;
      case "seated":
        queueStats.value.currentWaiting = Math.max(
          0,
          queueStats.value.currentWaiting - 1,
        );
        queueStats.value.totalServedToday++;
        if (update.waitTime) {
          // 計算平均等待時間
          const currentAvg = queueStats.value.averageWaitTime;
          const totalServed = queueStats.value.totalServedToday;
          queueStats.value.averageWaitTime = Math.round(
            (currentAvg * (totalServed - 1) + update.waitTime) / totalServed,
          );
          // 更新最長等待時間
          if (update.waitTime > queueStats.value.peakWaitTime) {
            queueStats.value.peakWaitTime = update.waitTime;
          }
        }
        break;
      case "cancelled":
      case "no_show":
        queueStats.value.currentWaiting = Math.max(
          0,
          queueStats.value.currentWaiting - 1,
        );
        break;
    }
  };
  // 顯示通知
  const showQueueNotification = (message, type = "info") => {
    // 這裡可以整合到通知系統中
    console.log(`[${type.toUpperCase()}] ${message}`);
    // 如果支援瀏覽器通知
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("候位系統", {
        body: message,
        icon: "/favicon.ico",
        tag: "queue-update",
      });
    }
  };
  // 開始監聽候位相關事件
  const startListening = () => {
    if (!authStore.user?.restaurantId) {
      console.warn(
        "No restaurant ID found, cannot start realtime queue listening",
      );
      return;
    }
    // 訂閱候位相關事件
    const queueEventTypes = [
      REALTIME_EVENTS.QUEUE_JOINED,
      REALTIME_EVENTS.QUEUE_CALLED,
      REALTIME_EVENTS.QUEUE_SEATED,
      REALTIME_EVENTS.QUEUE_NO_SHOW,
      REALTIME_EVENTS.QUEUE_CANCELLED,
    ];
    const queueSubId = subscribe(
      queueEventTypes,
      handleQueueUpdate,
      authStore.user.restaurantId.toString(),
    );
    // 訂閱桌位相關事件
    const tableEventTypes = [
      REALTIME_EVENTS.TABLE_OCCUPIED,
      REALTIME_EVENTS.TABLE_AVAILABLE,
      REALTIME_EVENTS.TABLE_RESERVED,
      REALTIME_EVENTS.TABLE_CLEANING,
    ];
    const tableSubId = subscribe(
      tableEventTypes,
      handleTableUpdate,
      authStore.user.restaurantId.toString(),
    );
    subscriptionIds.value = [queueSubId, tableSubId];
    console.log("Started listening to realtime queue events");
  };
  // 停止監聽
  const stopListening = () => {
    subscriptionIds.value.forEach((subId) => {
      unsubscribe(subId);
    });
    subscriptionIds.value = [];
    console.log("Stopped listening to realtime queue events");
  };
  // 清除更新歷史
  const clearUpdates = () => {
    queueUpdates.value = [];
    tableUpdates.value = [];
  };
  // 重置統計
  const resetStats = () => {
    queueStats.value = {
      currentWaiting: 0,
      totalServedToday: 0,
      averageWaitTime: 0,
      peakWaitTime: 0,
    };
  };
  // 獲取最近的候位更新
  const getRecentQueueUpdates = (limit = 20) => {
    return queueUpdates.value.slice(0, limit);
  };
  // 獲取最近的桌位更新
  const getRecentTableUpdates = (limit = 10) => {
    return tableUpdates.value.slice(0, limit);
  };
  // 按狀態篩選候位更新
  const getUpdatesByStatus = (status) => {
    return queueUpdates.value.filter((update) => update.status === status);
  };
  // 按桌位號篩選桌位更新
  const getTableUpdatesByNumber = (tableNumber) => {
    return tableUpdates.value.filter(
      (update) => update.tableNumber === tableNumber,
    );
  };
  // 檢查是否有待處理的叫號
  const hasPendingCalls = () => {
    return queueUpdates.value.some(
      (update) =>
        update.type === "called" &&
        new Date().getTime() - new Date(update.timestamp).getTime() < 300000,
    );
  };
  // 獲取可用桌位數量
  const getAvailableTablesCount = () => {
    const recentTableUpdates = tableUpdates.value.slice(0, 20);
    const availableUpdates = recentTableUpdates.filter(
      (update) => update.type === "available",
    );
    return availableUpdates.length;
  };
  // 請求瀏覽器通知權限
  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
    return Notification.permission === "granted";
  };
  // 生命週期管理
  onMounted(async () => {
    // 確保已連接到實時服務
    if (connectionStatus.value !== "connected") {
      await connect(authStore.user?.restaurantId?.toString());
    }
    // 請求通知權限
    await requestNotificationPermission();
    // 開始監聽
    startListening();
    // 監聽連接狀態變化
    const checkConnection = () => {
      isConnected.value = connectionStatus.value === "connected";
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
    queueUpdates,
    tableUpdates,
    queueStats,
    connectionStatus,
    // 方法
    startListening,
    stopListening,
    clearUpdates,
    resetStats,
    getRecentQueueUpdates,
    getRecentTableUpdates,
    getUpdatesByStatus,
    getTableUpdatesByNumber,
    hasPendingCalls,
    getAvailableTablesCount,
    requestNotificationPermission,
  };
}
export default useRealtimeQueue;
