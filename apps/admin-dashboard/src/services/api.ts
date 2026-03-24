import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiResponse } from "@/types";
import { KitchenErrorHandler } from "@/utils/errorHandler";

interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const CSRF_HEADER = "X-CSRF-Token";
const CSRF_PROTECTED_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

class ApiService {
  private instance: AxiosInstance;
  private csrfToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

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

  // Refresh queue: first 401 triggers refresh, subsequent 401s await the same promise
  private async handleTokenRefresh(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const refreshToken = localStorage.getItem("auth_refresh_token");
      if (!refreshToken) return null;

      try {
        const response = await this.instance.post("/auth/refresh", {}, {
          headers: { "X-Refresh-Token": refreshToken },
          _retry: true, // Skip the 401 interceptor for the refresh call itself
        } as any);

        const newToken = response.data?.data?.token;
        const newRefreshToken = response.data?.data?.refreshToken;

        if (newToken) {
          localStorage.setItem("auth_token", newToken);
          if (newRefreshToken) {
            localStorage.setItem("auth_refresh_token", newRefreshToken);
          }
          return newToken;
        }
        return null;
      } catch {
        return null;
      }
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("auth_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        const method = (config.method || "").toUpperCase();
        if (CSRF_PROTECTED_METHODS.includes(method)) {
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
        const csrfToken = response.headers[CSRF_HEADER.toLowerCase()];
        if (csrfToken) {
          this.csrfToken = csrfToken;
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedAxiosRequestConfig;

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          const newToken = await this.handleTokenRefresh();

          if (newToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.instance(originalRequest);
          }

          // Refresh failed — clear tokens and redirect
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_refresh_token");
          localStorage.removeItem("auth_user");
          window.location.href = "/login";
          return Promise.reject(error);
        }

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
