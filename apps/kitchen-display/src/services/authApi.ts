import axios from "axios";
import type { ApiResponse, User } from "@/types";

// 創建 axios 實例
const api = axios.create({
  baseURL: "/api/v1",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 請求攔截器 - 添加認證 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("kitchen_auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 響應攔截器 - 處理錯誤和 token 過期
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        // 嘗試刷新 token
        const refreshResponse = await authApi.refreshToken();
        if (refreshResponse.success) {
          const newToken = refreshResponse.data?.token;
          localStorage.setItem("kitchen_auth_token", newToken || "");

          // 重新發送原請求
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch (refreshError) {
        // 刷新失敗，清除認證信息並跳轉到登入頁
        localStorage.removeItem("kitchen_auth_token");
        localStorage.removeItem("kitchen_user");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

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
        data: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Login API error:", error);

      const message =
        error.response?.data?.message || error.message || "登入失敗";
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
    } catch (error: any) {
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
      const response = await api.post("/auth/refresh");

      return {
        success: true,
        data: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Refresh token API error:", error);

      const message =
        error.response?.data?.message || error.message || "Token 刷新失敗";
      return {
        success: false,
        error: message,
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
    } catch (error: any) {
      console.error("Validate token API error:", error);

      const message =
        error.response?.data?.message || error.message || "Token 驗證失敗";
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
    } catch (error: any) {
      console.error("Get current user API error:", error);

      const message =
        error.response?.data?.message || error.message || "獲取用戶資訊失敗";
      return {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      };
    }
  },

  // 檢查廚師權限
  async checkKitchenAccess(
    restaurantId: number,
  ): Promise<ApiResponse<boolean>> {
    try {
      const response = await api.get(`/auth/kitchen-access/${restaurantId}`);

      return {
        success: true,
        data: response.data.hasAccess,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Check kitchen access API error:", error);

      const message =
        error.response?.data?.message || error.message || "權限檢查失敗";
      return {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      };
    }
  },
};

export default api;
