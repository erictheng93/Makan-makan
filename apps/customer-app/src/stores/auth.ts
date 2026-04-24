import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import { i18n } from "@/i18n";
import { getRefreshDelay } from "@makanmakan/utils";

// Helper to avoid vue-i18n's deep type instantiation on t()
const t = (key: string): string => (i18n as any).global.t(key);

// 定義客戶用戶類型
export interface CustomerUser {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: number; // 5 for customer
}

// Hydrate user from localStorage for instant restore on page refresh.
// Without this, refreshing any authenticated view kicks the user back to
// /login because the router guard checks `isAuthenticated` (which depends
// on `!!user`) before `checkAuth()` has a chance to fetch the user.
const hydrateUser = (): CustomerUser | null => {
  try {
    const saved = localStorage.getItem("customer_user");
    return saved ? (JSON.parse(saved) as CustomerUser) : null;
  } catch {
    localStorage.removeItem("customer_user");
    return null;
  }
};

const persistUser = (u: CustomerUser | null): void => {
  if (u) {
    localStorage.setItem("customer_user", JSON.stringify(u));
  } else {
    localStorage.removeItem("customer_user");
  }
};

export const useAuthStore = defineStore("auth", () => {
  // 狀態
  const user = ref<CustomerUser | null>(hydrateUser());
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

  // 清除錯誤
  const clearError = () => {
    error.value = null;
  };

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleProactiveRefresh = (accessToken: string) => {
    if (refreshTimer) clearTimeout(refreshTimer);
    const delay = getRefreshDelay(accessToken);
    if (!delay || delay <= 0) return;
    refreshTimer = setTimeout(async () => {
      await refresh();
    }, delay);
  };

  const clearRefreshTimer = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  };

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
        token.value = data.data.token;
        refreshToken.value = data.data.refreshToken;
        user.value = data.data.user;

        // 存儲到 localStorage
        localStorage.setItem("customer_auth_token", token.value!);
        if (refreshToken.value) {
          localStorage.setItem("customer_refresh_token", refreshToken.value);
        }
        persistUser(user.value);

        if (token.value) scheduleProactiveRefresh(token.value);

        return { success: true };
      }

      error.value = data.error?.message || t("auth.loginFailed");
      return { success: false, error: error.value };
    } catch (err: any) {
      error.value = err.message || t("messages.networkError");
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
        persistUser(user.value);

        if (token.value) scheduleProactiveRefresh(token.value);

        return { success: true };
      }

      error.value = result.error || t("auth.registerFailed");
      return { success: false, error: error.value };
    } catch (err: any) {
      error.value = err.message || t("messages.networkError");
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
      persistUser(null);
      clearRefreshTimer();
    }
  };

  // 刷新 token
  const refresh = async () => {
    if (!refreshToken.value) return false;

    try {
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: {
          "X-Refresh-Token": refreshToken.value,
        },
      });

      const data = await response.json();

      if (data.success && data.data) {
        token.value = data.data.token;
        refreshToken.value = data.data.refreshToken;

        localStorage.setItem("customer_auth_token", token.value!);
        if (refreshToken.value) {
          localStorage.setItem("customer_refresh_token", refreshToken.value);
        }

        if (token.value) scheduleProactiveRefresh(token.value);
        return true;
      }
    } catch (err) {
      console.warn("Token refresh failed:", err);
    }

    // Degrade to reactive mode — don't logout on refresh failure
    return false;
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
        persistUser(user.value);
        if (token.value) scheduleProactiveRefresh(token.value);
        return true;
      }
    } catch (err) {
      console.warn("Auth check failed:", err);
    }

    // Attempt refresh before giving up
    if (refreshToken.value) {
      const refreshed = await refresh();
      if (refreshed) return true;
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
