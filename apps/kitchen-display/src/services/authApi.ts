import { createAuthenticatedApiClient } from "@makanmasak/auth-client";
import type { ApiResponse, User } from "@/types";
import {
  getApiErrorMessage,
  getApiErrorStatus,
  isRecord,
} from "@/utils/unknown";
import { getApiErrorCode } from "@makanmasak/shared/utils/unknown";

export function getKitchenApiBaseUrl(env = import.meta.env): string {
  const baseUrl = env.VITE_API_BASE_URL;

  if (!baseUrl && env.PROD) {
    throw new Error(
      "[Config Error] VITE_API_BASE_URL is required for kitchen-display production builds",
    );
  }

  return baseUrl || "/api/v1";
}

const LOGIN_PATH = "/login";

/** axios sets `code` (ERR_NETWORK, ECONNABORTED) when there is no response. */
function getTransportErrorCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === "string"
    ? error.code
    : undefined;
}

interface AuthFailureLocation {
  pathname: string;
  assign(url: string): void;
}

export function createKitchenAuthFailureHandler() {
  let loginRedirectRequested = false;

  return function handleKitchenAuthFailure(
    location: AuthFailureLocation = window.location,
  ): void {
    // A failed login also returns 401, but navigating from this page destroys
    // the login form before it can render the server-provided error message.
    if (loginRedirectRequested || location.pathname === LOGIN_PATH) {
      return;
    }

    loginRedirectRequested = true;
    location.assign(LOGIN_PATH);
  };
}

export const handleKitchenAuthFailure = createKitchenAuthFailureHandler();

// Create the shared API client with kitchen-specific config
export const apiClient = createAuthenticatedApiClient({
  baseURL: getKitchenApiBaseUrl(),
  storageKeyPrefix: "kitchen",
  csrf: true,
  onAuthFailure: handleKitchenAuthFailure,
});

// Re-export the axios instance for kitchenApi.ts (default import)
const api = apiClient.instance;
export default api;

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

export const authApi = {
  // 登入
  async login(
    credentials: LoginCredentials,
  ): Promise<ApiResponse<LoginResponse>> {
    try {
      const response = await api.post("/auth/login", {
        ...credentials,
        system: "kitchen", // 標識這是廚房系統登入
      });

      return {
        success: true,
        data: response.data.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      console.error("Login API error:", error);

      // Both, and for different readers: `code`/`status` are what the login
      // form translates from, `error` is the server's own sentence for the
      // console. Falling back to axios's own `code` matters -- without it a
      // request that never left the browser looks like an empty envelope, and
      // the form would tell someone their password is wrong when the network
      // is down.
      return {
        success: false,
        error: getApiErrorMessage(error, "Login request failed"),
        code: getApiErrorCode(error) ?? getTransportErrorCode(error),
        status: getApiErrorStatus(error),
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 登出
  async logout(): Promise<ApiResponse> {
    try {
      await api.post("/auth/logout");

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      // 即使登出 API 失敗，也視為成功（本地清除認證信息）
      console.error("Logout API error:", error);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 刷新 token
  async refreshToken(): Promise<ApiResponse<LoginResponse>> {
    try {
      const response = await api.post(
        "/auth/refresh",
        {},
        {
          withCredentials: true,
        },
      );

      const data = response.data?.data;
      if (data?.token) {
        apiClient.tokens.setTokens(data.token);
      }

      return {
        success: true,
        data: response.data.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      console.error("Refresh token API error:", error);
      return {
        success: false,
        error: getApiErrorMessage(error, "Token 刷新失敗"),
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 驗證 token
  async validateToken(): Promise<ApiResponse<User>> {
    try {
      const response = await api.get("/auth/validate");

      return {
        success: true,
        data: response.data.user,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      console.error("Validate token API error:", error);

      const message = getApiErrorMessage(error, "Token 驗證失敗");
      return {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 獲取用戶資訊
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      const response = await api.get("/auth/me");

      return {
        success: true,
        data: response.data.user,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      console.error("Get current user API error:", error);

      const message = getApiErrorMessage(error, "獲取用戶資訊失敗");
      return {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      };
    }
  },
};
