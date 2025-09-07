import { ref, onMounted, onUnmounted } from "vue";
import { useRealtime, REALTIME_EVENTS } from "@/services/realtimeService";
import { useAuthStore } from "@/stores/auth";
export function useRealtimePOS() {
  const { subscribe, unsubscribe, connect, connectionStatus } = useRealtime();
  const authStore = useAuthStore();
  // 響應式狀態
  const isConnected = ref(false);
  const transactions = ref([]);
  const cashMovements = ref([]);
  const shiftEvents = ref([]);
  const registerStatuses = ref(new Map());
  const subscriptionIds = ref([]);
  // POS 統計狀態
  const posStats = ref({
    todayTransactions: 0,
    todayRevenue: 0,
    activeRegisters: 0,
    currentShifts: 0,
    lastTransactionTime: null,
  });
  // 交易更新處理函數
  const handleTransactionUpdate = (message) => {
    const transaction = {
      transactionId: message.data.id,
      registerId: message.data.registerId,
      type: message.data.type,
      amount: message.data.amount,
      description: message.data.description,
      operatorId: message.data.operatorId,
      timestamp: message.timestamp,
    };
    transactions.value.unshift(transaction);
    // 更新統計
    updatePOSStats(transaction);
    // 限制歷史記錄長度
    if (transactions.value.length > 100) {
      transactions.value = transactions.value.slice(0, 100);
    }
    console.log("POS transaction received:", transaction);
    // 顯示通知
    showPOSNotification(
      `新交易: ${transaction.type} - RM${Math.abs(transaction.amount).toFixed(2)}`,
      transaction.amount >= 0 ? "success" : "info",
    );
  };
  // 現金異動處理函數
  const handleCashMovement = (message) => {
    const movement = {
      movementId: message.data.id,
      registerId: message.data.registerId,
      type: message.data.type,
      amount: message.data.amount,
      description: message.data.description,
      operatorId: message.data.operatorId,
      timestamp: message.timestamp,
    };
    cashMovements.value.unshift(movement);
    // 限制歷史記錄長度
    if (cashMovements.value.length > 50) {
      cashMovements.value = cashMovements.value.slice(0, 50);
    }
    console.log("Cash movement received:", movement);
    // 顯示通知
    showPOSNotification(
      `現金異動: ${getCashMovementTypeText(movement.type)} - RM${Math.abs(movement.amount).toFixed(2)}`,
      "info",
    );
  };
  // 班次事件處理函數
  const handleShiftEvent = (message) => {
    const shiftEvent = {
      shiftId: message.data.shiftId,
      registerId: message.data.registerId,
      operatorId: message.data.operatorId,
      type: message.type.includes("started") ? "started" : "ended",
      timestamp: message.timestamp,
      data: message.data,
    };
    shiftEvents.value.unshift(shiftEvent);
    // 更新班次統計
    if (shiftEvent.type === "started") {
      posStats.value.currentShifts++;
    } else if (shiftEvent.type === "ended") {
      posStats.value.currentShifts = Math.max(
        0,
        posStats.value.currentShifts - 1,
      );
    }
    // 限制歷史記錄長度
    if (shiftEvents.value.length > 30) {
      shiftEvents.value = shiftEvents.value.slice(0, 30);
    }
    console.log("Shift event received:", shiftEvent);
    // 顯示通知
    showPOSNotification(
      `班次${shiftEvent.type === "started" ? "開始" : "結束"}: 現金櫃 ${shiftEvent.registerId}`,
      "info",
    );
  };
  // 現金櫃狀態處理函數
  const handleRegisterStatus = (message) => {
    const status = {
      registerId: message.data.registerId,
      status: message.data.status,
      currentBalance: message.data.currentBalance,
      lastActivity: message.data.lastActivity,
      timestamp: message.timestamp,
    };
    registerStatuses.value.set(status.registerId, status);
    // 更新活躍現金櫃統計
    const activeCount = Array.from(registerStatuses.value.values()).filter(
      (reg) => reg.status === "active",
    ).length;
    posStats.value.activeRegisters = activeCount;
    console.log("Register status received:", status);
    // 顯示狀態變更通知
    showPOSNotification(
      `現金櫃 ${status.registerId} 狀態: ${getRegisterStatusText(status.status)}`,
      status.status === "active" ? "success" : "warning",
    );
  };
  // 更新 POS 統計
  const updatePOSStats = (transaction) => {
    if (transaction.type === "sale") {
      posStats.value.todayTransactions++;
      posStats.value.todayRevenue += transaction.amount;
    } else if (transaction.type === "refund") {
      posStats.value.todayRevenue -= Math.abs(transaction.amount);
    }
    posStats.value.lastTransactionTime = transaction.timestamp;
  };
  // 獲取現金異動類型文字
  const getCashMovementTypeText = (type) => {
    const texts = {
      cash_in: "現金存入",
      cash_out: "現金取出",
      drawer_count: "盤點調整",
      refund: "退款",
    };
    return texts[type] || type;
  };
  // 獲取現金櫃狀態文字
  const getRegisterStatusText = (status) => {
    const texts = {
      active: "運行中",
      inactive: "未啟用",
      maintenance: "維護中",
    };
    return texts[status] || status;
  };
  // 顯示 POS 通知
  const showPOSNotification = (message, type = "info") => {
    console.log(`[POS ${type.toUpperCase()}] ${message}`);
    // 如果支援瀏覽器通知
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("POS 系統", {
        body: message,
        icon: "/favicon.ico",
        tag: "pos-update",
      });
    }
  };
  // 開始監聽 POS 相關事件
  const startListening = () => {
    if (!authStore.user?.restaurantId) {
      console.warn(
        "No restaurant ID found, cannot start realtime POS listening",
      );
      return;
    }
    // 訂閱 POS 交易事件
    const transactionSubId = subscribe(
      [REALTIME_EVENTS.POS_TRANSACTION],
      handleTransactionUpdate,
      authStore.user.restaurantId.toString(),
    );
    // 訂閱現金異動事件
    const cashMovementSubId = subscribe(
      [REALTIME_EVENTS.CASH_MOVEMENT],
      handleCashMovement,
      authStore.user.restaurantId.toString(),
    );
    // 訂閱班次事件
    const shiftEventTypes = [
      REALTIME_EVENTS.SHIFT_STARTED,
      REALTIME_EVENTS.SHIFT_ENDED,
    ];
    const shiftSubId = subscribe(
      shiftEventTypes,
      handleShiftEvent,
      authStore.user.restaurantId.toString(),
    );
    // 訂閱現金櫃狀態事件
    const registerSubId = subscribe(
      [REALTIME_EVENTS.REGISTER_STATUS_CHANGED],
      handleRegisterStatus,
      authStore.user.restaurantId.toString(),
    );
    subscriptionIds.value = [
      transactionSubId,
      cashMovementSubId,
      shiftSubId,
      registerSubId,
    ];
    console.log("Started listening to realtime POS events");
  };
  // 停止監聽
  const stopListening = () => {
    subscriptionIds.value.forEach((subId) => {
      unsubscribe(subId);
    });
    subscriptionIds.value = [];
    console.log("Stopped listening to realtime POS events");
  };
  // 清除更新歷史
  const clearUpdates = () => {
    transactions.value = [];
    cashMovements.value = [];
    shiftEvents.value = [];
    registerStatuses.value.clear();
  };
  // 重置統計
  const resetStats = () => {
    posStats.value = {
      todayTransactions: 0,
      todayRevenue: 0,
      activeRegisters: 0,
      currentShifts: 0,
      lastTransactionTime: null,
    };
  };
  // 獲取最近交易
  const getRecentTransactions = (limit = 20) => {
    return transactions.value.slice(0, limit);
  };
  // 獲取最近現金異動
  const getRecentCashMovements = (limit = 10) => {
    return cashMovements.value.slice(0, limit);
  };
  // 獲取最近班次事件
  const getRecentShiftEvents = (limit = 10) => {
    return shiftEvents.value.slice(0, limit);
  };
  // 按現金櫃篩選交易
  const getTransactionsByRegister = (registerId) => {
    return transactions.value.filter((tx) => tx.registerId === registerId);
  };
  // 按類型篩選交易
  const getTransactionsByType = (type) => {
    return transactions.value.filter((tx) => tx.type === type);
  };
  // 獲取現金櫃狀態
  const getRegisterStatus = (registerId) => {
    return registerStatuses.value.get(registerId);
  };
  // 獲取所有現金櫃狀態
  const getAllRegisterStatuses = () => {
    return Array.from(registerStatuses.value.values());
  };
  // 計算今日銷售總額
  const getTodaySalesTotal = () => {
    return transactions.value
      .filter((tx) => tx.type === "sale" && isToday(tx.timestamp))
      .reduce((total, tx) => total + tx.amount, 0);
  };
  // 計算今日退款總額
  const getTodayRefundsTotal = () => {
    return Math.abs(
      transactions.value
        .filter((tx) => tx.type === "refund" && isToday(tx.timestamp))
        .reduce((total, tx) => total + tx.amount, 0),
    );
  };
  // 檢查是否是今天
  const isToday = (timestamp) => {
    const today = new Date();
    const date = new Date(timestamp);
    return date.toDateString() === today.toDateString();
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
    transactions,
    cashMovements,
    shiftEvents,
    registerStatuses,
    posStats,
    connectionStatus,
    // 方法
    startListening,
    stopListening,
    clearUpdates,
    resetStats,
    getRecentTransactions,
    getRecentCashMovements,
    getRecentShiftEvents,
    getTransactionsByRegister,
    getTransactionsByType,
    getRegisterStatus,
    getAllRegisterStatuses,
    getTodaySalesTotal,
    getTodayRefundsTotal,
  };
}
export default useRealtimePOS;
