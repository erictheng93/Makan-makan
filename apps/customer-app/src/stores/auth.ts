import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";

// 定義客戶用戶類型
export interface CustomerUser {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: number; // 5 for customer
}

export const useAuthStore = defineStore("auth", () => {
  // 狀態
  const user = ref<CustomerUser | null>(null);
  const token = ref<string | null>(localStorage.getItem("customer_auth_token"));
  const refreshToken = ref<string | null>(
    localStorage.getItem("customer_refresh_token"),
  );
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 計算屬性
  const isAuthenticated = computed(() => !!user.value && !!token.value);
  const userId = computed(() => user.value?.id);
  const userName = computed(() => user.value?.fullName || user.value?.username);

  // 登入
  const login = async (username: string, password: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        // 保存 token 和用戶信息
        token.value = data.data.tokens.accessToken;
        refreshToken.value = data.data.tokens.refreshToken;
        user.value = data.data.user;

        // 存儲到 localStorage
        localStorage.setItem("customer_auth_token", token.value!);
        if (refreshToken.value) {
          localStorage.setItem("customer_refresh_token", refreshToken.value);
        }

        return { success: true };
      }

      error.value = data.error || "登入失敗";
      return { success: false, error: error.value };
    } catch (err: any) {
      error.value = err.message || "網絡錯誤，請稍後再試";
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 註冊
  const register = async (data: {
    username: string;
    password: string;
    fullName: string;
    email?: string;
    phone?: string;
  }) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          role: 5, // Customer role
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // 註冊成功後自動登入
        token.value = result.data.tokens.accessToken;
        refreshToken.value = result.data.tokens.refreshToken;
        user.value = result.data.user;

        localStorage.setItem("customer_auth_token", token.value!);
        if (refreshToken.value) {
          localStorage.setItem("customer_refresh_token", refreshToken.value);
        }

        return { success: true };
      }

      error.value = result.error || "註冊失敗";
      return { success: false, error: error.value };
    } catch (err: any) {
      error.value = err.message || "網絡錯誤，請稍後再試";
      return { success: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  };

  // 登出
  const logout = async () => {
    try {
      if (token.value) {
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.value}`,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      // 清除本地狀態
      user.value = null;
      token.value = null;
      refreshToken.value = null;
      error.value = null;

      localStorage.removeItem("customer_auth_token");
      localStorage.removeItem("customer_refresh_token");
    }
  };

  // 檢查認證狀態
  const checkAuth = async () => {
    if (!token.value) return false;

    try {
      const response = await fetch("/api/v1/auth/me", {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      });

      const data = await response.json();

      if (data.success && data.data) {
        user.value = data.data;
        return true;
      }
    } catch (err) {
      console.warn("Auth check failed:", err);
    }

    await logout();
    return false;
  };

  // 刷新 token
  const refresh = async () => {
    if (!refreshToken.value) return false;

    try {
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: refreshToken.value }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        token.value = data.data.tokens.accessToken;
        refreshToken.value = data.data.tokens.refreshToken;

        localStorage.setItem("customer_auth_token", token.value!);
        if (refreshToken.value) {
          localStorage.setItem("customer_refresh_token", refreshToken.value);
        }

        return true;
      }
    } catch (err) {
      console.warn("Token refresh failed:", err);
    }

    await logout();
    return false;
  };

  // 獲取當前用戶資料
  const fetchUserProfile = async () => {
    if (!token.value) return null;

    try {
      const response = await fetch("/api/v1/customers/me", {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      });

      const data = await response.json();

      if (data.success && data.data) {
        user.value = data.data;
        return data.data;
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }

    return null;
  };

  // 清除錯誤
  const clearError = () => {
    error.value = null;
  };

  return {
    // 狀態
    user: readonly(user),
    token: readonly(token),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // 計算屬性
    isAuthenticated,
    userId,
    userName,

    // 方法
    login,
    register,
    logout,
    checkAuth,
    refresh,
    fetchUserProfile,
    clearError,
  };
});
