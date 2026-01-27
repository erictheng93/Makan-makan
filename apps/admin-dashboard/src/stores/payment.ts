import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import type {
  PaymentRequest,
  PaymentResult,
  PaymentMethod,
  PaymentStatus,
  CountryCode,
  CurrencyCode,
} from "@makanmakan/shared-types";

interface PaymentState {
  // 當前支付流程
  currentPayment: {
    request: PaymentRequest | null;
    result: PaymentResult | null;
    status: PaymentStatus;
    transactionId: string | null;
    clientSecret: string | null;
    step: "idle" | "method" | "details" | "processing" | "completed" | "failed";
  };

  // 支付歷史
  paymentHistory: PaymentTransaction[];

  // 可用的支付方式
  availableMethods: Record<CountryCode, PaymentMethod[]>;

  // 載入狀態
  loading: {
    creating: boolean;
    methods: boolean;
    status: boolean;
  };

  // 錯誤狀態
  errors: {
    payment: string | null;
    validation: Record<string, string>;
  };

  // 設定
  settings: {
    testMode: boolean;
    autoRetry: boolean;
    maxRetries: number;
  };
}

interface PaymentTransaction {
  id: string;
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export const usePaymentStore = defineStore("payment", () => {
  // 狀態
  const state = ref<PaymentState>({
    currentPayment: {
      request: null,
      result: null,
      status: "pending",
      transactionId: null,
      clientSecret: null,
      step: "idle",
    },
    paymentHistory: [],
    availableMethods: {
      TW: ["credit_card", "debit_card"],
      MY: ["credit_card", "debit_card"],
      VN: ["credit_card", "debit_card"],
    },
    loading: {
      creating: false,
      methods: false,
      status: false,
    },
    errors: {
      payment: null,
      validation: {},
    },
    settings: {
      testMode: import.meta.env.NODE_ENV !== "production",
      autoRetry: true,
      maxRetries: 3,
    },
  });

  // Getters (Computed)
  const currentStep = computed(() => state.value.currentPayment.step);

  const isLoading = computed(() =>
    Object.values(state.value.loading).some(Boolean),
  );

  const hasError = computed(
    () =>
      state.value.errors.payment !== null ||
      Object.keys(state.value.errors.validation).length > 0,
  );

  const canRetry = computed(
    () =>
      state.value.currentPayment.status === "failed" &&
      state.value.settings.autoRetry,
  );

  const getAvailableMethodsForCountry = (country: CountryCode) => {
    return state.value.availableMethods[country] || [];
  };

  const getCurrentPayment = computed(() => state.value.currentPayment);

  const getPaymentHistory = computed(() =>
    [...state.value.paymentHistory].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    ),
  );

  // Actions
  const initializePayment = async (request: PaymentRequest) => {
    try {
      clearErrors();

      state.value.currentPayment = {
        request,
        result: null,
        status: "pending",
        transactionId: null,
        clientSecret: null,
        step: "method",
      };

      // 載入該國家的可用支付方式
      await loadPaymentMethods(request.country);
    } catch (error) {
      console.error("Payment initialization failed:", error);
      setError("初始化支付失敗");
    }
  };

  const createPayment = async (
    request: PaymentRequest,
  ): Promise<PaymentResult> => {
    try {
      state.value.loading.creating = true;
      state.value.currentPayment.step = "processing";
      clearErrors();

      // 驗證請求
      const validation = validatePaymentRequest(request);
      if (!validation.valid) {
        state.value.errors.validation = validation.errors;
        throw new Error("Payment request validation failed");
      }

      // 調用 API 創建支付
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Payment creation failed");
      }

      const result: PaymentResult = {
        success: data.success,
        transactionId: data.data.transactionId,
        status: data.data.status as PaymentStatus,
        clientSecret: data.data.clientSecret,
        redirectUrl: data.data.redirectUrl,
        qrCodeData: data.data.qrCodeData,
        metadata: data.data.metadata,
      };

      // 更新狀態
      state.value.currentPayment.result = result;
      state.value.currentPayment.status = result.status;
      state.value.currentPayment.transactionId = result.transactionId;
      state.value.currentPayment.clientSecret = result.clientSecret || null;

      // 添加到歷史記錄
      addToHistory({
        id: result.transactionId,
        orderId: request.orderId,
        amount: request.amount,
        currency: request.currency,
        method: request.method,
        status: result.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 根據結果狀態更新步驟
      if (result.status === "completed") {
        state.value.currentPayment.step = "completed";
      } else if (result.status === "failed") {
        state.value.currentPayment.step = "failed";
        setError(result.error?.message || "Payment failed");
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Payment creation error:", error);

      state.value.currentPayment.step = "failed";
      state.value.currentPayment.status = "failed";
      setError(errorMessage);

      return {
        success: false,
        transactionId: "",
        status: "failed",
        error: {
          code: "CREATION_FAILED",
          message: errorMessage,
        },
      };
    } finally {
      state.value.loading.creating = false;
    }
  };

  const checkPaymentStatus = async (
    transactionId: string,
  ): Promise<PaymentStatus> => {
    try {
      state.value.loading.status = true;

      const response = await fetch(`/api/payments/status/${transactionId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error("Failed to get payment status");
      }

      const status = data.data.status as PaymentStatus;

      // 更新當前支付狀態
      if (state.value.currentPayment.transactionId === transactionId) {
        state.value.currentPayment.status = status;

        if (status === "completed") {
          state.value.currentPayment.step = "completed";
        } else if (status === "failed") {
          state.value.currentPayment.step = "failed";
        }
      }

      // 更新歷史記錄
      updateHistoryStatus(transactionId, status);

      return status;
    } catch (error) {
      console.error("Payment status check failed:", error);
      return "pending";
    } finally {
      state.value.loading.status = false;
    }
  };

  const refundPayment = async (
    transactionId: string,
    amount?: number,
    reason?: string,
  ) => {
    try {
      const response = await fetch("/api/payments/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId,
          amount,
          reason,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Refund failed");
      }

      // 更新歷史記錄狀態
      const refundStatus = amount ? "partial_refunded" : "refunded";
      updateHistoryStatus(transactionId, refundStatus as PaymentStatus);

      return data.data;
    } catch (error) {
      console.error("Refund failed:", error);
      setError(error instanceof Error ? error.message : "Refund failed");
      throw error;
    }
  };

  const loadPaymentMethods = async (country: CountryCode) => {
    try {
      state.value.loading.methods = true;

      const response = await fetch(`/api/payments/methods/${country}`);
      const data = await response.json();

      if (data.success) {
        state.value.availableMethods[country] = data.data.supportedMethods;
      }
    } catch (error) {
      console.error("Failed to load payment methods:", error);
      setError("載入支付方式失敗");
    } finally {
      state.value.loading.methods = false;
    }
  };

  const retryPayment = async (): Promise<PaymentResult | null> => {
    const currentRequest = state.value.currentPayment.request;

    if (!currentRequest || !canRetry.value) {
      return null;
    }

    clearErrors();
    return await createPayment(currentRequest);
  };

  const cancelPayment = () => {
    state.value.currentPayment = {
      request: null,
      result: null,
      status: "cancelled",
      transactionId: null,
      clientSecret: null,
      step: "idle",
    };
    clearErrors();
  };

  const setStep = (step: PaymentState["currentPayment"]["step"]) => {
    state.value.currentPayment.step = step;
  };

  const setError = (error: string) => {
    state.value.errors.payment = error;
  };

  const clearErrors = () => {
    state.value.errors.payment = null;
    state.value.errors.validation = {};
  };

  const addToHistory = (transaction: PaymentTransaction) => {
    const existingIndex = state.value.paymentHistory.findIndex(
      (t) => t.id === transaction.id,
    );

    if (existingIndex >= 0) {
      state.value.paymentHistory[existingIndex] = transaction;
    } else {
      state.value.paymentHistory.push(transaction);
    }
  };

  const updateHistoryStatus = (
    transactionId: string,
    status: PaymentStatus,
    error?: string,
  ) => {
    const transaction = state.value.paymentHistory.find(
      (t) => t.id === transactionId,
    );
    if (transaction) {
      transaction.status = status;
      transaction.updatedAt = new Date();
      if (error) {
        transaction.error = error;
      }
    }
  };

  const validatePaymentRequest = (
    request: PaymentRequest,
  ): {
    valid: boolean;
    errors: Record<string, string>;
  } => {
    const errors: Record<string, string> = {};

    if (!request.orderId) {
      errors.orderId = "訂單 ID 不能為空";
    }

    if (!request.restaurantId) {
      errors.restaurantId = "餐廳 ID 無效";
    }

    if (!request.amount || request.amount <= 0) {
      errors.amount = "金額必須大於 0";
    }

    if (!request.currency) {
      errors.currency = "必須指定貨幣類型";
    }

    if (!request.country) {
      errors.country = "必須指定國家";
    }

    if (!request.method) {
      errors.method = "必須選擇支付方式";
    }

    if (
      request.customerInfo?.email &&
      !isValidEmail(request.customerInfo.email)
    ) {
      errors.email = "電子郵件格式無效";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 格式化金額
  const formatAmount = (amount: number, currency: CurrencyCode): string => {
    const formatters = {
      TWD: new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: "TWD",
        minimumFractionDigits: 0,
      }),
      MYR: new Intl.NumberFormat("ms-MY", {
        style: "currency",
        currency: "MYR",
        minimumFractionDigits: 2,
      }),
      VND: new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        minimumFractionDigits: 0,
      }),
    };

    return formatters[currency].format(amount);
  };

  // 獲取支付統計
  const getPaymentStats = computed(() => {
    const history = state.value.paymentHistory;
    const total = history.length;
    const successful = history.filter((p) => p.status === "completed").length;
    const failed = history.filter((p) => p.status === "failed").length;
    const pending = history.filter(
      (p) => p.status === "processing" || p.status === "pending",
    ).length;

    return {
      total,
      successful,
      failed,
      pending,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
    };
  });

  // 重置 store
  const reset = () => {
    state.value.currentPayment = {
      request: null,
      result: null,
      status: "pending",
      transactionId: null,
      clientSecret: null,
      step: "idle",
    };
    clearErrors();
  };

  // 更新設置
  const updateSettings = (newSettings: Partial<PaymentState["settings"]>) => {
    state.value.settings = { ...state.value.settings, ...newSettings };
  };

  // 輪詢支付狀態
  const pollPaymentStatus = (
    transactionId: string,
    interval = 3000,
    maxAttempts = 10,
  ) => {
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.warn("Payment status polling timeout");
        return;
      }

      const status = await checkPaymentStatus(transactionId);
      attempts++;

      // 如果狀態是最終狀態，停止輪詢
      if (["completed", "failed", "cancelled", "refunded"].includes(status)) {
        return;
      }

      // 繼續輪詢
      setTimeout(poll, interval);
    };

    poll();
  };

  return {
    // State
    state: readonly(state),

    // Getters
    currentStep,
    isLoading,
    hasError,
    canRetry,
    getCurrentPayment,
    getPaymentHistory,
    getPaymentStats,
    getAvailableMethodsForCountry,

    // Actions
    initializePayment,
    createPayment,
    checkPaymentStatus,
    refundPayment,
    loadPaymentMethods,
    retryPayment,
    cancelPayment,
    setStep,
    setError,
    clearErrors,
    formatAmount,
    reset,
    updateSettings,
    pollPaymentStatus,
  };
});

// 型別匯出
export type PaymentStore = ReturnType<typeof usePaymentStore>;
