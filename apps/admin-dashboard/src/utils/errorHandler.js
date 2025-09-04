import { useToast } from "vue-toastification";
const toast = useToast();
// 錯誤類型定義
export var ErrorType;
(function (ErrorType) {
  ErrorType["NETWORK"] = "network";
  ErrorType["API"] = "api";
  ErrorType["SSE"] = "sse";
  ErrorType["VALIDATION"] = "validation";
  ErrorType["PERMISSION"] = "permission";
  ErrorType["UNKNOWN"] = "unknown";
})(ErrorType || (ErrorType = {}));
export var ErrorSeverity;
(function (ErrorSeverity) {
  ErrorSeverity["LOW"] = "low";
  ErrorSeverity["MEDIUM"] = "medium";
  ErrorSeverity["HIGH"] = "high";
  ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (ErrorSeverity = {}));
// 離線狀態管理
class OfflineManager {
  constructor() {
    Object.defineProperty(this, "isOnline", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: navigator.onLine,
    });
    Object.defineProperty(this, "callbacks", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: [],
    });
    Object.defineProperty(this, "pendingRequests", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: [],
    });
    this.setupEventListeners();
  }
  setupEventListeners() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.notifyCallbacks();
      this.processPendingRequests();
    });
    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.notifyCallbacks();
    });
  }
  notifyCallbacks() {
    this.callbacks.forEach((callback) => callback(this.isOnline));
  }
  async processPendingRequests() {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    for (const request of requests) {
      try {
        await request();
      } catch (error) {
        console.error("Failed to process pending request:", error);
        // 重新加入失敗的請求
        this.pendingRequests.push(request);
      }
    }
  }
  onStatusChange(callback) {
    this.callbacks.push(callback);
    callback(this.isOnline); // 立即回調當前狀態
  }
  addPendingRequest(request) {
    this.pendingRequests.push(request);
  }
  getStatus() {
    return this.isOnline;
  }
}
// 錯誤上報服務
class ErrorReportingService {
  constructor() {
    Object.defineProperty(this, "REPORT_ENDPOINT", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "/api/v1/system/error-report",
    });
    Object.defineProperty(this, "reportQueue", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: [],
    });
    Object.defineProperty(this, "isReporting", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: false,
    });
  }
  async reportError(error) {
    // 添加到報告隊列
    this.reportQueue.push({
      ...error,
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
    // 如果當前沒有在報告中，開始報告
    if (!this.isReporting) {
      this.processReportQueue();
    }
  }
  async processReportQueue() {
    if (this.reportQueue.length === 0) {
      this.isReporting = false;
      return;
    }
    this.isReporting = true;
    try {
      const errors = [...this.reportQueue];
      this.reportQueue = [];
      const response = await fetch(this.REPORT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ errors }),
      });
      if (!response.ok) {
        // 如果報告失敗，重新加入隊列
        this.reportQueue.unshift(...errors);
        throw new Error(`Report failed: ${response.status}`);
      }
      console.log(`Successfully reported ${errors.length} errors`);
    } catch (error) {
      console.error("Error reporting failed:", error);
      // 延遲重試
      setTimeout(() => void this.processReportQueue(), 30000);
    }
    this.isReporting = false;
  }
}
// 主要錯誤處理器
export class ErrorHandler {
  constructor() {
    Object.defineProperty(this, "offlineManager", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new OfflineManager(),
    });
    Object.defineProperty(this, "reportingService", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new ErrorReportingService(),
    });
    Object.defineProperty(this, "userNotificationEnabled", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: true,
    });
  }
  static getInstance() {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  // 處理一般錯誤
  handleError(error, context) {
    const errorDetails = this.parseError(error, context);
    // 記錄錯誤
    console.error("Error handled:", errorDetails);
    // 上報錯誤（高嚴重性）
    if (
      errorDetails.severity === ErrorSeverity.HIGH ||
      errorDetails.severity === ErrorSeverity.CRITICAL
    ) {
      this.reportingService.reportError(errorDetails);
    }
    // 顯示用戶提示
    if (this.userNotificationEnabled) {
      this.showUserNotification(errorDetails);
    }
    return errorDetails;
  }
  // 解析錯誤
  parseError(error, context) {
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let message = "發生了未知錯誤";
    let code;
    // 根據錯誤類型進行分類
    if (error instanceof TypeError || error instanceof ReferenceError) {
      type = ErrorType.VALIDATION;
      severity = ErrorSeverity.LOW;
      message = "輸入驗證錯誤";
    } else if (
      error?.name === "NetworkError" ||
      error?.code === "NETWORK_ERROR"
    ) {
      type = ErrorType.NETWORK;
      severity = ErrorSeverity.HIGH;
      message = "網絡連接錯誤，請檢查您的網絡連接";
    } else if (error?.response) {
      // API 錯誤
      type = ErrorType.API;
      code = error.response.status;
      message = error.response.data?.error?.message || "服務器錯誤";
      if (typeof code === "number" && code >= 500) {
        severity = ErrorSeverity.HIGH;
      } else if (code === 403 || code === 401) {
        type = ErrorType.PERMISSION;
        severity = ErrorSeverity.MEDIUM;
        message = "權限不足或登入已過期";
      }
    } else if (error?.message) {
      message = error.message;
    }
    return {
      type,
      severity,
      code,
      message,
      originalError: error,
      context,
      timestamp: new Date(),
    };
  }
  // 顯示用戶提示
  showUserNotification(error) {
    const duration = error.severity === ErrorSeverity.HIGH ? 8000 : 4000;
    if (error.severity === ErrorSeverity.CRITICAL) {
      toast.error(`嚴重錯誤: ${error.message}`, { timeout: false });
    } else if (error.severity === ErrorSeverity.HIGH) {
      toast.error(`系統錯誤: ${error.message}`, { timeout: duration });
    } else {
      if (error.severity === ErrorSeverity.LOW) {
        toast.warning(error.message, { timeout: duration });
      } else {
        toast.error(error.message, { timeout: duration });
      }
    }
  }
  // 設置用戶通知狀態
  setUserNotificationEnabled(enabled) {
    this.userNotificationEnabled = enabled;
  }
  // 獲取離線管理器
  getOfflineManager() {
    return this.offlineManager;
  }
}
// 廚房專用錯誤處理器
export class KitchenErrorHandler extends ErrorHandler {
  constructor() {
    super(...arguments);
    Object.defineProperty(this, "sseReconnectAttempts", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(this, "maxReconnectAttempts", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 5,
    });
    Object.defineProperty(this, "reconnectDelay", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 1000,
    }); // 1秒
  }
  static handleSSEError(error, eventSource) {
    const handler = ErrorHandler.getInstance();
    return handler.handleSSEConnectionError(error, eventSource);
  }
  static handleAPIError(error, context) {
    const handler = ErrorHandler.getInstance();
    return handler.handleError(error, context);
  }
  // 處理 SSE 連接錯誤
  handleSSEConnectionError(error, eventSource) {
    const errorDetails = {
      type: ErrorType.SSE,
      severity: ErrorSeverity.HIGH,
      message: "SSE 連接中斷",
      originalError: error,
      context: {
        readyState: eventSource?.readyState,
        url: eventSource?.url,
        reconnectAttempts: this.sseReconnectAttempts,
      },
      timestamp: new Date(),
    };
    console.error("SSE Connection Error:", errorDetails);
    // 上報錯誤
    this.reportingService.reportError(errorDetails);
    // 顯示連接狀態
    if (this.userNotificationEnabled) {
      toast.warning("實時連接中斷，正在嘗試重新連接...", { timeout: 3000 });
    }
    // 自動重連
    this.attemptSSEReconnect(eventSource);
  }
  // SSE 自動重連
  attemptSSEReconnect() {
    if (this.sseReconnectAttempts >= this.maxReconnectAttempts) {
      toast.error("連接失敗: 無法重新建立實時連接，請刷新頁面", {
        timeout: false,
      });
      return;
    }
    this.sseReconnectAttempts++;
    // 指數退避重連策略
    const delay =
      this.reconnectDelay * Math.pow(2, this.sseReconnectAttempts - 1);
    setTimeout(() => {
      try {
        console.log(
          `Attempting SSE reconnection ${this.sseReconnectAttempts}/${this.maxReconnectAttempts}`,
        );
        // 重新建立 SSE 連接的邏輯應該由呼叫方提供
        // 這裡觸發一個自定義事件，讓元件處理重連
        window.dispatchEvent(
          new CustomEvent("sse-reconnect-attempt", {
            detail: {
              attempt: this.sseReconnectAttempts,
              maxAttempts: this.maxReconnectAttempts,
            },
          }),
        );
      } catch (error) {
        console.error("SSE reconnection failed:", error);
        this.attemptSSEReconnect();
      }
    }, delay);
  }
  // 重置 SSE 重連計數
  resetSSEReconnectAttempts() {
    this.sseReconnectAttempts = 0;
  }
  // 設置 SSE 連接成功
  setSSEConnected() {
    // Store event source reference if needed
    this.resetSSEReconnectAttempts();
    if (this.sseReconnectAttempts > 0) {
      toast.success("實時連接已恢復", { timeout: 2000 });
    }
  }
  // 處理 API 請求錯誤
  handleAPIRequest(error, context) {
    const errorDetails = this.handleError(error, context);
    // 如果是網絡錯誤且處於離線狀態
    if (
      errorDetails.type === ErrorType.NETWORK &&
      !this.offlineManager.getStatus()
    ) {
      return this.handleOfflineRequest(error, context);
    }
    // 如果是權限錯誤，嘗試刷新 token
    if (
      errorDetails.type === ErrorType.PERMISSION &&
      errorDetails.code === 401
    ) {
      return this.handleTokenRefresh(error, context);
    }
    return Promise.reject(errorDetails);
  }
  // 處理離線請求
  handleOfflineRequest(_originalError, _context) {
    const toast = useToast();
    toast.warning("當前網絡不可用，請求將在網絡恢復後重新嘗試");
    return new Promise((_resolve, reject) => {
      // 創建重試請求函數
      const retryRequest = async () => {
        try {
          // 這裡應該重新執行原始請求
          // 實際實現需要根據具體的 API 客戶端來決定
          console.log("Retrying request after network recovery:", _context);
          // resolve(retriedResult)
          reject(new Error("Request retry not implemented"));
        } catch (error) {
          reject(error);
        }
      };
      // 添加到離線隊列
      this.offlineManager.addPendingRequest(retryRequest);
    });
  }
  // 處理 Token 刷新
  async handleTokenRefresh() {
    try {
      // 嘗試刷新 token
      const authStore = await import("@/stores/auth").then((m) =>
        m.useAuthStore(),
      );
      const success = await authStore.refreshToken();
      if (success) {
        const toast = useToast();
        toast.info("登入狀態已更新，請重新嘗試");
        // 這裡應該重新執行原始請求
        return Promise.reject(new Error("Please retry the request"));
      } else {
        // Token 刷新失敗，跳轉到登入頁
        toast.error("登入已過期，請重新登入", { timeout: 5000 });
        window.location.href = "/login";
        return Promise.reject(new Error("Authentication failed"));
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      return Promise.reject(error);
    }
  }
}
// 導出單例實例
export const errorHandler = ErrorHandler.getInstance();
export const kitchenErrorHandler = KitchenErrorHandler.getInstance();
// 全局錯誤處理器
export function setupGlobalErrorHandler() {
  // 處理未捕獲的 Promise 錯誤
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    errorHandler.handleError(event.reason, { type: "unhandledRejection" });
    event.preventDefault(); // 防止錯誤在控制台顯示
  });
  // 處理未捕獲的 JavaScript 錯誤
  window.addEventListener("error", (event) => {
    console.error("Unhandled error:", event.error);
    errorHandler.handleError(event.error, {
      type: "globalError",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  // 監聽網絡狀態變化
  errorHandler.getOfflineManager().onStatusChange((isOnline) => {
    if (isOnline) {
      toast.success("網絡連接已恢復", { timeout: 2000 });
    } else {
      toast.warning("網絡連接已斷開，將在離線模式下運行", { timeout: false });
    }
  });
}
export default ErrorHandler;
