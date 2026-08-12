import { createAuthenticatedApiClient } from "@makanmasak/auth-client";
import type { ApiResponse, User } from "@/types";
import { getApiErrorMessage } from "@/utils/unknown";

export function getKitchenApiBaseUrl(env = import.meta.env): string {
  const baseUrl = env.VITE_API_BASE_URL;

  if (!baseUrl && env.PROD) {
    throw new Error(
      "[Config Error] VITE_API_BASE_URL is required for kitchen-display production builds",
    );
  }

  return baseUrl || "/api/v1";
}

// Create the shared API client with kitchen-specific config
export const apiClient = createAuthenticatedApiClient({
  baseURL: getKitchenApiBaseUrl(),
  storageKeyPrefix: "kitchen",
  csrf: true,
  onAuthFailure: () => {
    window.location.href = "/login";
  },
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

      const message = getApiErrorMessage(error, "登入失敗");
      return {
        success: false,
        error: message,
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
