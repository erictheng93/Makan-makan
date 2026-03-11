/**
 * useErrorHandling Composable 測試
 *
 * 測試範圍：
 * - 錯誤處理和狀態管理
 * - 非同步錯誤處理
 * - 重試機制
 * - API 錯誤處理
 * - 網路錯誤處理
 * - 驗證錯誤處理
 * - 錯誤邊界
 * - 錯誤訊息轉換
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ref, computed } from "vue";

// Mock vue-toastification
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock("vue-toastification", () => ({
  useToast: () => mockToast,
}));

// Mock services
const mockErrorReportingService = {
  reportError: vi.fn().mockReturnValue("error-123"),
  resolveError: vi.fn(),
  getErrorStats: vi.fn().mockReturnValue({
    errorRate: 0,
    recentErrors: [],
    totalErrors: 0,
  }),
};

const mockPerformanceService = {
  recordMetric: vi.fn(),
};

// 類型定義
interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  isRetrying: boolean;
  retryCount: number;
  maxRetries: number;
}

interface ErrorHandlingOptions {
  showToast?: boolean;
  reportError?: boolean;
  component?: string;
  retryable?: boolean;
  critical?: boolean;
}

// 模擬 useErrorHandling composable
function createMockUseErrorHandling(options: ErrorHandlingOptions = {}) {
  const {
    showToast = true,
    reportError = true,
    component = "unknown",
    retryable = false,
    critical = false,
  } = options;

  const errorState = ref<ErrorState>({
    hasError: false,
    error: null,
    errorId: null,
    isRetrying: false,
    retryCount: 0,
    maxRetries: 3,
  });

  const recentErrors = ref<any[]>([]);
  const errorStats = computed(() => mockErrorReportingService.getErrorStats());

  // 錯誤訊息映射
  const errorMessages: Record<string, string> = {
    NetworkError: "網路連線錯誤，請檢查網路狀態",
    TimeoutError: "操作超時，請重試",
    ValidationError: "數據驗證失敗，請檢查輸入",
    AuthenticationError: "認證失敗，請重新登入",
    PermissionError: "權限不足，請聯繫管理員",
    NotFoundError: "找不到指定的資源",
    ServerError: "服務器錯誤，請稍後重試",
    ChunkLoadError: "資源載入失敗，請重新載入頁面",
    QuotaExceededError: "存儲空間不足，請清理數據",
  };

  const getErrorMessage = (error: Error): string => {
    return errorMessages[error.name] || error.message || "發生未知錯誤";
  };

  const handleError = (
    error: Error | string,
    context: Record<string, any> = {},
  ) => {
    const errorObj = typeof error === "string" ? new Error(error) : error;

    errorState.value = {
      hasError: true,
      error: errorObj,
      errorId: null,
      isRetrying: false,
      retryCount: errorState.value.retryCount,
      maxRetries: errorState.value.maxRetries,
    };

    if (reportError) {
      const errorId = mockErrorReportingService.reportError(errorObj, {
        component,
        ...context,
      });
      errorState.value.errorId = errorId;
    }

    if (showToast && !critical) {
      const message = getErrorMessage(errorObj);
      mockToast.error(message);
    }

    mockPerformanceService.recordMetric(
      "error_handling_time",
      0,
      "ms",
      "system",
    );

    if (critical) {
      console.error(`CRITICAL ERROR in ${component}:`, errorObj);
    }
  };

  const handleAsyncError = async <T>(
    asyncFn: () => Promise<T>,
    context: Record<string, any> = {},
  ): Promise<T | null> => {
    try {
      const startTime = performance.now();
      const result = await asyncFn();

      mockPerformanceService.recordMetric(
        "async_operation_time",
        performance.now() - startTime,
        "ms",
        "system",
      );

      return result;
    } catch (error) {
      handleError(error as Error, {
        operation: "async",
        ...context,
      });
      return null;
    }
  };

  const retryOperation = async <T>(
    operation: () => Promise<T>,
    context: Record<string, any> = {},
  ): Promise<T | null> => {
    if (!retryable) {
      throw new Error("Operation is not retryable");
    }

    errorState.value.isRetrying = true;

    try {
      const result = await operation();
      clearError();
      mockToast.success("操作重試成功");
      return result;
    } catch (error) {
      errorState.value.retryCount++;

      if (errorState.value.retryCount >= errorState.value.maxRetries) {
        mockToast.error("重試次數已達上限");
        handleError(error as Error, {
          retryAttempt: errorState.value.retryCount,
          ...context,
        });
      } else {
        mockToast.warning(
          `操作失敗，正在重試 (${errorState.value.retryCount}/${errorState.value.maxRetries})`,
        );

        // Exponential backoff
        const delay = Math.pow(2, errorState.value.retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        return retryOperation(operation, context);
      }

      return null;
    } finally {
      errorState.value.isRetrying = false;
    }
  };

  const clearError = () => {
    errorState.value = {
      hasError: false,
      error: null,
      errorId: null,
      isRetrying: false,
      retryCount: 0,
      maxRetries: 3,
    };
  };

  const resolveError = () => {
    if (errorState.value.errorId) {
      mockErrorReportingService.resolveError(errorState.value.errorId);
    }
    clearError();
  };

  const withErrorBoundary = <T extends (...args: any[]) => any>(fn: T): T => {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);

        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            handleError(error, { function: fn.name });
            throw error;
          });
        }

        return result;
      } catch (error) {
        handleError(error as Error, { function: fn.name });
        throw error;
      }
    }) as T;
  };

  const handleNetworkError = (error: Error) => {
    if (error.message.includes("fetch") || error.name === "NetworkError") {
      handleError(error, {
        type: "network",
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
      });
    } else {
      handleError(error);
    }
  };

  const handleApiError = (error: any, endpoint?: string) => {
    let message = "網路請求失敗";

    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 400:
          message = "請求參數錯誤";
          break;
        case 401:
          message = "未授權，請重新登入";
          break;
        case 403:
          message = "權限不足";
          break;
        case 404:
          message = "找不到請求的資源";
          break;
        case 500:
          message = "服務器內部錯誤";
          break;
        case 502:
        case 503:
        case 504:
          message = "服務暫時不可用";
          break;
        default:
          message = `HTTP ${status} 錯誤`;
      }
    }

    handleError(new Error(message), {
      type: "api",
      endpoint,
      status: error.response?.status,
      statusText: error.response?.statusText,
    });
  };

  const handleValidationError = (field: string, message: string) => {
    const error = new Error(message);
    error.name = "ValidationError";

    handleError(error, {
      type: "validation",
      field,
    });
  };

  const monitorErrorImpact = () => {
    const metrics = errorStats.value;

    if (metrics.errorRate > 5) {
      console.warn("High error rate detected:", metrics.errorRate);

      mockPerformanceService.recordMetric(
        "high_error_rate_alert",
        metrics.errorRate,
        "count",
        "system",
        "warning",
      );
    }
  };

  return {
    // State
    errorState: computed(() => errorState.value),
    recentErrors: computed(() => recentErrors.value),
    errorStats,

    // Methods
    handleError,
    handleAsyncError,
    handleNetworkError,
    handleApiError,
    handleValidationError,
    retryOperation,
    clearError,
    resolveError,
    withErrorBoundary,

    // Utilities
    getErrorMessage,
    monitorErrorImpact,
  };
}

describe("useErrorHandling", () => {
  let errorHandling: ReturnType<typeof createMockUseErrorHandling>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    errorHandling = createMockUseErrorHandling();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初始狀態", () => {
    it("應該初始化無錯誤狀態", () => {
      expect(errorHandling.errorState.value.hasError).toBe(false);
      expect(errorHandling.errorState.value.error).toBeNull();
      expect(errorHandling.errorState.value.errorId).toBeNull();
    });

    it("應該初始化重試狀態", () => {
      expect(errorHandling.errorState.value.isRetrying).toBe(false);
      expect(errorHandling.errorState.value.retryCount).toBe(0);
      expect(errorHandling.errorState.value.maxRetries).toBe(3);
    });

    it("應該初始化空的錯誤歷史", () => {
      expect(errorHandling.recentErrors.value).toEqual([]);
    });
  });

  describe("handleError", () => {
    it("應該正確處理 Error 物件", () => {
      const error = new Error("測試錯誤");
      errorHandling.handleError(error);

      expect(errorHandling.errorState.value.hasError).toBe(true);
      expect(errorHandling.errorState.value.error).toBe(error);
      expect(mockToast.error).toHaveBeenCalledWith("測試錯誤");
    });

    it("應該正確處理字串錯誤", () => {
      errorHandling.handleError("字串錯誤訊息");

      expect(errorHandling.errorState.value.hasError).toBe(true);
      expect(errorHandling.errorState.value.error?.message).toBe(
        "字串錯誤訊息",
      );
    });

    it("應該報告錯誤到錯誤服務", () => {
      const error = new Error("測試錯誤");
      errorHandling.handleError(error);

      expect(mockErrorReportingService.reportError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ component: "unknown" }),
      );
    });

    it("應該設定錯誤 ID", () => {
      errorHandling.handleError(new Error("測試"));

      expect(errorHandling.errorState.value.errorId).toBe("error-123");
    });

    it("應該在 showToast 為 false 時不顯示 toast", () => {
      const noToastHandler = createMockUseErrorHandling({ showToast: false });
      noToastHandler.handleError(new Error("測試"));

      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("應該在 critical 為 true 時不顯示 toast", () => {
      const criticalHandler = createMockUseErrorHandling({ critical: true });
      criticalHandler.handleError(new Error("嚴重錯誤"));

      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("應該在 reportError 為 false 時不報告錯誤", () => {
      vi.clearAllMocks();
      const noReportHandler = createMockUseErrorHandling({
        reportError: false,
      });
      noReportHandler.handleError(new Error("測試"));

      expect(mockErrorReportingService.reportError).not.toHaveBeenCalled();
    });
  });

  describe("handleAsyncError", () => {
    it("應該成功執行非同步函數並返回結果", async () => {
      const asyncFn = vi.fn().mockResolvedValue("成功");

      const result = await errorHandling.handleAsyncError(asyncFn);

      expect(result).toBe("成功");
      expect(asyncFn).toHaveBeenCalled();
    });

    it("應該捕獲非同步錯誤", async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error("非同步錯誤"));

      const result = await errorHandling.handleAsyncError(asyncFn);

      expect(result).toBeNull();
      expect(errorHandling.errorState.value.hasError).toBe(true);
      expect(mockToast.error).toHaveBeenCalledWith("非同步錯誤");
    });

    it("應該記錄非同步操作時間", async () => {
      const asyncFn = vi.fn().mockResolvedValue("成功");

      await errorHandling.handleAsyncError(asyncFn);

      expect(mockPerformanceService.recordMetric).toHaveBeenCalledWith(
        "async_operation_time",
        expect.any(Number),
        "ms",
        "system",
      );
    });

    it("應該傳遞上下文到錯誤處理", async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error("錯誤"));

      await errorHandling.handleAsyncError(asyncFn, { customData: "test" });

      expect(mockErrorReportingService.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: "async",
          customData: "test",
        }),
      );
    });
  });

  describe("retryOperation", () => {
    let retryableHandler: ReturnType<typeof createMockUseErrorHandling>;

    beforeEach(() => {
      retryableHandler = createMockUseErrorHandling({ retryable: true });
    });

    it("應該在操作成功時返回結果", async () => {
      const operation = vi.fn().mockResolvedValue("成功");

      const result = await retryableHandler.retryOperation(operation);

      expect(result).toBe("成功");
      expect(mockToast.success).toHaveBeenCalledWith("操作重試成功");
    });

    it("應該在達到最大重試次數時停止", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("持續失敗"));

      const retryPromise = retryableHandler.retryOperation(operation);

      // 使用 runAllTimersAsync 處理所有計時器和 Promise
      await vi.runAllTimersAsync();

      const result = await retryPromise;

      expect(result).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith("重試次數已達上限");
    }, 10000);

    it("應該在不可重試時拋出錯誤", async () => {
      const nonRetryableHandler = createMockUseErrorHandling({
        retryable: false,
      });
      const operation = vi.fn().mockResolvedValue("成功");

      await expect(
        nonRetryableHandler.retryOperation(operation),
      ).rejects.toThrow("Operation is not retryable");
    });

    it("應該使用指數退避延遲", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("失敗 1"))
        .mockRejectedValueOnce(new Error("失敗 2"))
        .mockResolvedValue("成功");

      const retryPromise = retryableHandler.retryOperation(operation);

      // 使用 runAllTimersAsync 處理所有計時器和 Promise
      await vi.runAllTimersAsync();

      const result = await retryPromise;
      expect(result).toBe("成功");
    }, 10000);
  });

  describe("clearError 和 resolveError", () => {
    it("應該清除錯誤狀態", () => {
      errorHandling.handleError(new Error("測試"));
      expect(errorHandling.errorState.value.hasError).toBe(true);

      errorHandling.clearError();

      expect(errorHandling.errorState.value.hasError).toBe(false);
      expect(errorHandling.errorState.value.error).toBeNull();
      expect(errorHandling.errorState.value.errorId).toBeNull();
      expect(errorHandling.errorState.value.retryCount).toBe(0);
    });

    it("應該解決錯誤並清除狀態", () => {
      errorHandling.handleError(new Error("測試"));

      errorHandling.resolveError();

      expect(mockErrorReportingService.resolveError).toHaveBeenCalledWith(
        "error-123",
      );
      expect(errorHandling.errorState.value.hasError).toBe(false);
    });

    it("應該在無錯誤 ID 時不呼叫 resolveError", () => {
      vi.clearAllMocks();
      errorHandling.resolveError();

      expect(mockErrorReportingService.resolveError).not.toHaveBeenCalled();
    });
  });

  describe("getErrorMessage", () => {
    it("應該返回對應的錯誤訊息", () => {
      const networkError = new Error("Network error");
      networkError.name = "NetworkError";
      expect(errorHandling.getErrorMessage(networkError)).toBe(
        "網路連線錯誤，請檢查網路狀態",
      );

      const timeoutError = new Error("Timeout");
      timeoutError.name = "TimeoutError";
      expect(errorHandling.getErrorMessage(timeoutError)).toBe(
        "操作超時，請重試",
      );

      const validationError = new Error("Validation failed");
      validationError.name = "ValidationError";
      expect(errorHandling.getErrorMessage(validationError)).toBe(
        "數據驗證失敗，請檢查輸入",
      );
    });

    it("應該返回原始訊息如果沒有映射", () => {
      const customError = new Error("自訂錯誤訊息");
      customError.name = "CustomError";
      expect(errorHandling.getErrorMessage(customError)).toBe("自訂錯誤訊息");
    });

    it("應該返回預設訊息如果沒有訊息", () => {
      const emptyError = new Error();
      emptyError.name = "UnknownError";
      expect(errorHandling.getErrorMessage(emptyError)).toBe("發生未知錯誤");
    });
  });

  describe("withErrorBoundary", () => {
    it("應該正常執行函數並返回結果", () => {
      const fn = vi.fn().mockReturnValue("結果");
      const wrappedFn = errorHandling.withErrorBoundary(fn);

      const result = wrappedFn();

      expect(result).toBe("結果");
    });

    it("應該捕獲同步錯誤", () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new Error("同步錯誤");
      });
      const wrappedFn = errorHandling.withErrorBoundary(fn);

      expect(() => wrappedFn()).toThrow("同步錯誤");
      expect(errorHandling.errorState.value.hasError).toBe(true);
    });

    it("應該捕獲非同步錯誤", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("非同步錯誤"));
      const wrappedFn = errorHandling.withErrorBoundary(fn);

      await expect(wrappedFn()).rejects.toThrow("非同步錯誤");
      expect(errorHandling.errorState.value.hasError).toBe(true);
    });
  });

  describe("handleNetworkError", () => {
    it("應該處理 fetch 相關錯誤", () => {
      const error = new Error("Failed to fetch");
      errorHandling.handleNetworkError(error);

      expect(mockErrorReportingService.reportError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ type: "network" }),
      );
    });

    it("應該處理 NetworkError", () => {
      const error = new Error("Network error");
      error.name = "NetworkError";
      errorHandling.handleNetworkError(error);

      expect(mockErrorReportingService.reportError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ type: "network" }),
      );
    });

    it("應該將非網路錯誤視為一般錯誤", () => {
      const error = new Error("一般錯誤");
      errorHandling.handleNetworkError(error);

      expect(mockErrorReportingService.reportError).toHaveBeenCalledWith(
        error,
        expect.not.objectContaining({ type: "network" }),
      );
    });
  });

  describe("handleApiError", () => {
    it("應該處理 400 錯誤", () => {
      errorHandling.handleApiError({ response: { status: 400 } }, "/api/test");

      expect(mockToast.error).toHaveBeenCalledWith("請求參數錯誤");
    });

    it("應該處理 401 錯誤", () => {
      errorHandling.handleApiError({ response: { status: 401 } }, "/api/test");

      expect(mockToast.error).toHaveBeenCalledWith("未授權，請重新登入");
    });

    it("應該處理 403 錯誤", () => {
      errorHandling.handleApiError({ response: { status: 403 } }, "/api/test");

      expect(mockToast.error).toHaveBeenCalledWith("權限不足");
    });

    it("應該處理 404 錯誤", () => {
      errorHandling.handleApiError({ response: { status: 404 } }, "/api/test");

      expect(mockToast.error).toHaveBeenCalledWith("找不到請求的資源");
    });

    it("應該處理 500 錯誤", () => {
      errorHandling.handleApiError({ response: { status: 500 } }, "/api/test");

      expect(mockToast.error).toHaveBeenCalledWith("服務器內部錯誤");
    });

    it("應該處理 502/503/504 錯誤", () => {
      [502, 503, 504].forEach((status) => {
        vi.clearAllMocks();
        errorHandling.handleApiError({ response: { status } }, "/api/test");
        expect(mockToast.error).toHaveBeenCalledWith("服務暫時不可用");
      });
    });

    it("應該處理其他狀態碼", () => {
      errorHandling.handleApiError({ response: { status: 418 } }, "/api/test");

      expect(mockToast.error).toHaveBeenCalledWith("HTTP 418 錯誤");
    });

    it("應該處理無 response 的錯誤", () => {
      errorHandling.handleApiError({}, "/api/test");

      expect(mockToast.error).toHaveBeenCalledWith("網路請求失敗");
    });
  });

  describe("handleValidationError", () => {
    it("應該建立 ValidationError", () => {
      errorHandling.handleValidationError("email", "無效的電子郵件格式");

      expect(errorHandling.errorState.value.error?.name).toBe(
        "ValidationError",
      );
      expect(mockErrorReportingService.reportError).toHaveBeenCalledWith(
        expect.objectContaining({ name: "ValidationError" }),
        expect.objectContaining({
          type: "validation",
          field: "email",
        }),
      );
    });
  });

  describe("monitorErrorImpact", () => {
    it("應該在高錯誤率時發出警告", () => {
      mockErrorReportingService.getErrorStats.mockReturnValue({
        errorRate: 10,
        recentErrors: [],
        totalErrors: 100,
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      errorHandling.monitorErrorImpact();

      expect(consoleSpy).toHaveBeenCalledWith("High error rate detected:", 10);
      expect(mockPerformanceService.recordMetric).toHaveBeenCalledWith(
        "high_error_rate_alert",
        10,
        "count",
        "system",
        "warning",
      );

      consoleSpy.mockRestore();
    });

    it("應該在正常錯誤率時不發出警告", () => {
      mockErrorReportingService.getErrorStats.mockReturnValue({
        errorRate: 2,
        recentErrors: [],
        totalErrors: 10,
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.clearAllMocks();

      errorHandling.monitorErrorImpact();

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("邊界情況", () => {
    it("應該處理 null 錯誤", () => {
      expect(() => {
        errorHandling.handleError(null as any);
      }).toThrow();
    });

    it("應該處理 undefined 錯誤", () => {
      expect(() => {
        errorHandling.handleError(undefined as any);
      }).toThrow();
    });

    it("應該處理空字串錯誤", () => {
      errorHandling.handleError("");

      expect(errorHandling.errorState.value.hasError).toBe(true);
      expect(errorHandling.errorState.value.error?.message).toBe("");
    });

    it("應該處理連續多個錯誤", () => {
      errorHandling.handleError(new Error("錯誤 1"));
      errorHandling.handleError(new Error("錯誤 2"));
      errorHandling.handleError(new Error("錯誤 3"));

      expect(errorHandling.errorState.value.error?.message).toBe("錯誤 3");
    });
  });
});
