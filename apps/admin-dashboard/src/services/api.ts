import {
  isAxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import {
  createAuthenticatedApiClient,
  type TokenStorageMode,
} from "@makanmakan/auth-client";
import type { ApiResponse } from "@/types";
import { KitchenErrorHandler } from "@/utils/errorHandler";
import { setAuthTokenProvider } from "@/utils/authTokenProvider";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function unwrapApiPayload<T>(payload: unknown): T {
  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export function unwrapApiData<T>(response: { data: unknown }): T {
  return unwrapApiPayload<T>(response.data);
}

export function unwrapApiList<T>(payload: unknown): T[] {
  const data = unwrapApiPayload<unknown>(payload);
  return Array.isArray(data) ? (data as T[]) : [];
}

export function getAdminTokenStorageMode(
  env: Pick<ImportMetaEnv, "DEV"> = import.meta.env,
): TokenStorageMode {
  // Development only: survive Vite full reloads while keeping production tokens
  // out of browser storage.
  return env.DEV ? "sessionStorage" : "memory";
}

const ADMIN_AUTH_STORAGE_KEYS = [
  "auth_token",
  "auth_refresh_token",
  "auth_user",
] as const;

let loginRedirectRequested = false;

interface AuthFailureLocation {
  pathname: string;
  assign(url: string): void;
}

export function clearAdminAuthStorage(): void {
  for (const key of ADMIN_AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

export function handleAdminAuthFailure(
  location: AuthFailureLocation = window.location,
): void {
  clearAdminAuthStorage();

  if (loginRedirectRequested || location.pathname === "/login") {
    return;
  }

  loginRedirectRequested = true;
  location.assign("/login");
}

const authClient = createAuthenticatedApiClient({
  storageKeyPrefix: "auth",
  storageKeys: {
    token: "auth_token",
    refreshToken: "auth_refresh_token",
    user: "auth_user",
  },
  tokenStorage: getAdminTokenStorageMode(),
  csrf: true,
  onAuthFailure: handleAdminAuthFailure,
  errorHandler: (error: unknown) => {
    const context = isAxiosError(error)
      ? {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        }
      : undefined;

    return KitchenErrorHandler.handleAPIError(error, context);
  },
});

setAuthTokenProvider(() => authClient.tokens.getToken());

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
    config?: AxiosRequestConfig,
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
