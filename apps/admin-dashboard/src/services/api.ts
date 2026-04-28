import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { createAuthenticatedApiClient } from "@makanmakan/auth-client";
import type { ApiResponse } from "@/types";
import { KitchenErrorHandler } from "@/utils/errorHandler";

const authClient = createAuthenticatedApiClient({
  storageKeyPrefix: "auth",
  storageKeys: {
    token: "auth_token",
    refreshToken: "auth_refresh_token",
    user: "auth_user",
  },
  csrf: true,
  onAuthFailure: () => {
    // Don't hard-redirect here — let the router guard handle navigation
    // via Vue Router to avoid aborting pending requests.
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_refresh_token");
    localStorage.removeItem("auth_user");
  },
  errorHandler: (error: unknown) => {
    const axiosError = error as any;
    return KitchenErrorHandler.handleAPIError(axiosError, {
      url: axiosError.config?.url,
      method: axiosError.config?.method,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
    });
  },
});

// Backward-compatible API object matching the old ApiService class interface.
// 42 files import { api } or { apiClient } from this module.
class ApiServiceCompat {
  get instance() {
    return authClient.instance;
  }

  setAuthToken(token: string | null) {
    authClient.setAuthToken(token);
  }

  async get<T>(
    url: string,
    paramsOrConfig?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return authClient.instance.get(url, this.toGetConfig(paramsOrConfig));
  }

  async post<T>(
    url: string,
    data?: any,
    config?: { headers?: Record<string, string> },
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return authClient.instance.post(url, data, config);
  }

  async put<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return authClient.instance.put(url, data);
  }

  async patch<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return authClient.instance.patch(url, data);
  }

  async delete<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return authClient.instance.delete(url, data ? { data } : undefined);
  }

  async upload(url: string, formData: FormData): Promise<AxiosResponse<any>> {
    return authClient.instance.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  private toGetConfig(paramsOrConfig?: any): AxiosRequestConfig | undefined {
    if (!paramsOrConfig) {
      return undefined;
    }

    if (this.isAxiosConfig(paramsOrConfig)) {
      return paramsOrConfig;
    }

    return { params: paramsOrConfig };
  }

  private isAxiosConfig(value: any): value is AxiosRequestConfig {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    return [
      "params",
      "headers",
      "responseType",
      "signal",
      "timeout",
      "withCredentials",
    ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
  }
}

export const api = new ApiServiceCompat();
export const apiClient = api;
export { authClient };
