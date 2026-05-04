import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import type {
  ApiResponse,
  ApiErrorCode,
  PaginatedResponse,
} from "@makanmasak/shared-types";
import { translate } from "@/utils/i18n";

// API 配置
const getApiBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "[Config Error] VITE_API_BASE_URL is required. " +
        "Please set this environment variable in your .env file.",
    );
  }
  return baseUrl;
};

const API_CONFIG = {
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
};

// API 錯誤類
export class ApiException extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: any,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiException";
  }
}

// API 客戶端類
class ApiClient {
  private instance: AxiosInstance;
  private requestInterceptorId?: number;
  private responseInterceptorId?: number;

  constructor() {
    this.instance = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: {
        "Content-Type": "application/json",
        "X-Client-Version": "2.0.0",
        "X-Client-Platform": "web",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // 請求攔截器
    this.requestInterceptorId = this.instance.interceptors.request.use(
      (config) => {
        // 添加認證 token (customer_auth_token for customer app)
        const token = localStorage.getItem("customer_auth_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          // Fallback to guest token for shop ordering
          const guestToken = localStorage.getItem("guest_auth_token");
          if (guestToken) {
            config.headers.Authorization = `Bearer ${guestToken}`;
          }
        }

        // 添加請求 ID
        config.headers["X-Request-ID"] = crypto.randomUUID();

        // 添加餐廳上下文
        const context = localStorage.getItem("makanmasak_restaurant_context");
        if (context) {
          try {
            const { restaurant, tableId } = JSON.parse(context);
            config.headers["X-Restaurant-ID"] = restaurant.id.toString();
            config.headers["X-Table-ID"] = tableId.toString();
          } catch (error) {
            console.warn("Failed to parse restaurant context:", error);
          }
        }

        console.log(
          `🚀 API請求: ${config.method?.toUpperCase()} ${config.url}`,
          {
            params: config.params,
            data: config.data,
          },
        );

        return config;
      },
      (error) => {
        console.error("❌ API請求攔截器錯誤:", error);
        return Promise.reject(error);
      },
    );

    // 響應攔截器
    this.responseInterceptorId = this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        console.log(`✅ API響應: ${response.status}`, response.data);

        // 檢查業務邏輯錯誤
        if (!response.data.success && response.data.error) {
          const apiError = this.normalizeApiError(
            response.data.error,
            response.status,
          );
          throw new ApiException(
            apiError.code,
            apiError.message,
            apiError.details,
            response.status,
          );
        }

        return response;
      },
      async (error) => {
        console.error("❌ API響應錯誤:", error);

        // 處理網路錯誤
        if (!error.response) {
          throw new ApiException(
            "NETWORK_ERROR" as ApiErrorCode,
            translate("messages.networkError"),
            error.message,
          );
        }

        const { status, data } = error.response;

        // 處理認證錯誤
        if (status === 401) {
          await this.handleAuthError();
          throw new ApiException(
            "UNAUTHORIZED" as ApiErrorCode,
            translate("messages.sessionExpired"),
            data,
            status,
          );
        }

        // 處理其他HTTP錯誤
        const apiError = this.normalizeApiError(data?.error, status);

        throw new ApiException(
          apiError.code,
          apiError.message,
          apiError.details,
          status,
        );
      },
    );
  }

  private normalizeApiError(
    error: unknown,
    status: number,
  ): { code: ApiErrorCode; message: string; details?: any } {
    if (typeof error === "string" && error.trim()) {
      return {
        code: "INVALID_REQUEST" as ApiErrorCode,
        message: error,
      };
    }

    if (error && typeof error === "object") {
      const apiError = error as {
        code?: unknown;
        message?: unknown;
        error?: unknown;
        details?: any;
      };

      return {
        code:
          typeof apiError.code === "string"
            ? (apiError.code as ApiErrorCode)
            : ("INTERNAL_SERVER_ERROR" as ApiErrorCode),
        message:
          typeof apiError.message === "string"
            ? apiError.message
            : typeof apiError.error === "string"
              ? apiError.error
              : this.getErrorMessage(status),
        details: apiError.details,
      };
    }

    return {
      code: "INTERNAL_SERVER_ERROR" as ApiErrorCode,
      message: this.getErrorMessage(status),
    };
  }

  private async handleAuthError() {
    // 清除認證資訊 (customer tokens only)
    // Note: Do NOT clear guest_auth_token here — guest tokens are
    // independent from customer auth and should persist for order tracking.
    // 401 errors from SSE/polling should not invalidate guest sessions.
    localStorage.removeItem("customer_auth_token");
    localStorage.removeItem("customer_refresh_token");
  }

  private getErrorMessage(status: number): string {
    const messages: Record<number, string> = {
      400: translate("errors.badRequest"),
      403: translate("errors.forbidden"),
      404: translate("errors.notFoundResource"),
      409: translate("errors.conflict"),
      429: translate("errors.tooManyRequests"),
      500: translate("errors.internalServerError"),
      502: translate("errors.badGateway"),
      503: translate("errors.serviceUnavailable"),
      504: translate("errors.gatewayTimeout"),
    };
    return messages[status] || translate("errors.unknown");
  }

  // 通用請求方法
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.instance.request<ApiResponse<T>>(config);
      return "data" in response.data
        ? (response.data.data as T)
        : (response.data as unknown as T);
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        "INTERNAL_SERVER_ERROR" as ApiErrorCode,
        translate("errors.requestFailed"),
        error,
      );
    }
  }

  // GET 請求
  async get<T = any>(url: string, params?: any): Promise<T> {
    return this.request<T>({ method: "GET", url, params });
  }

  // POST 請求
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>({ method: "POST", url, data, ...config });
  }

  // PUT 請求
  async put<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({ method: "PUT", url, data });
  }

  // DELETE 請求
  async delete<T = any>(url: string): Promise<T> {
    return this.request<T>({ method: "DELETE", url });
  }

  // PATCH 請求
  async patch<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({ method: "PATCH", url, data });
  }

  // 分頁請求
  async getPaginated<T = any>(
    url: string,
    params?: any,
  ): Promise<PaginatedResponse<T>> {
    const response = await this.instance.get<PaginatedResponse<T>>(url, {
      params,
    });
    return response.data;
  }

  // 文件上傳
  async uploadFile(
    url: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    return this.request({
      method: "POST",
      url,
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          onProgress(progress);
        }
      },
    });
  }

  // 清理攔截器
  destroy() {
    if (this.requestInterceptorId !== undefined) {
      this.instance.interceptors.request.eject(this.requestInterceptorId);
    }
    if (this.responseInterceptorId !== undefined) {
      this.instance.interceptors.response.eject(this.responseInterceptorId);
    }
  }
}

// 創建全域 API 實例
export const apiClient = new ApiClient();

// 響應式 API 狀態 Hook
export const useApiState = () => {
  const isOnline = navigator.onLine;
  const hasToken = !!localStorage.getItem("customer_auth_token");

  return {
    isOnline,
    hasToken,
    isReady: isOnline && hasToken,
  };
};

// 錯誤處理工具函數
export const handleApiError = (error: unknown): string => {
  if (error instanceof ApiException) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return translate("errors.unknown");
};
