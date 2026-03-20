import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiResponse } from "@/types";
import { KitchenErrorHandler } from "@/utils/errorHandler";

// Extend AxiosRequestConfig to include retry property
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const CSRF_HEADER = "X-CSRF-Token";
const CSRF_PROTECTED_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

class ApiService {
  private instance: AxiosInstance;
  private csrfToken: string | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: "/api/v1",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("auth_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Attach CSRF token to state-changing requests (double-submit cookie pattern)
        const method = (config.method || "").toUpperCase();
        if (CSRF_PROTECTED_METHODS.includes(method)) {
          // Prefer in-memory token; fall back to reading from cookie
          const csrf =
            this.csrfToken || document.cookie.match(/csrf_token=([^;]+)/)?.[1];
          if (csrf) {
            config.headers[CSRF_HEADER] = csrf;
          }
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Capture CSRF token from any response that provides one
        const csrfToken = response.headers[CSRF_HEADER.toLowerCase()];
        if (csrfToken) {
          this.csrfToken = csrfToken;
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedAxiosRequestConfig;

        // 處理 401 未授權錯誤的自動 token 刷新
        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          try {
            const refreshResponse = await this.instance.post("/auth/refresh");
            const newToken = refreshResponse.data.data.token;

            localStorage.setItem("auth_token", newToken);
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;

            return this.instance(originalRequest);
          } catch (refreshError) {
            localStorage.removeItem("auth_token");
            window.location.href = "/login";
            return Promise.reject(refreshError);
          }
        }

        // 使用增強的錯誤處理器處理所有其他錯誤
        const errorDetails = KitchenErrorHandler.handleAPIError(error, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        });

        return Promise.reject(errorDetails);
      },
    );
  }

  setAuthToken(token: string | null) {
    if (token) {
      this.instance.defaults.headers.common["Authorization"] =
        `Bearer ${token}`;
    } else {
      delete this.instance.defaults.headers.common["Authorization"];
    }
  }

  async get<T>(
    url: string,
    params?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.get(url, { params });
  }

  async post<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.post(url, data);
  }

  async put<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.put(url, data);
  }

  async patch<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.patch(url, data);
  }

  async delete<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.delete(url, data ? { data } : undefined);
  }

  async upload(url: string, formData: FormData): Promise<AxiosResponse<any>> {
    return this.instance.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }
}

export const api = new ApiService();
export const apiClient = api;
