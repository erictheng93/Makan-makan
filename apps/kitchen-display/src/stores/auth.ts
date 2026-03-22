import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "@/types";
import { authApi } from "@/services/authApi";
import { isTokenExpired, getRefreshDelay } from "@makanmakan/utils";

export const useAuthStore = defineStore("auth", () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(false);
  const refreshTokenVal = ref<string | null>(
    localStorage.getItem("kitchen_refresh_token"),
  );

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const isChef = computed(() => user.value?.role === 2);
  const restaurantId = computed(() => user.value?.restaurantId);
  const hasPermission = computed(() => (permission: string) => {
    return user.value?.permissions.includes(permission) ?? false;
  });

  // Actions
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleProactiveRefresh = (accessToken: string) => {
    if (refreshTimer) clearTimeout(refreshTimer);
    const delay = getRefreshDelay(accessToken);
    if (!delay || delay <= 0) return;
    refreshTimer = setTimeout(async () => {
      await refreshToken();
    }, delay);
  };

  const clearRefreshTimer = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  };

  const login = async (credentials: { username: string; password: string }) => {
    loading.value = true;
    try {
      const response = await authApi.login(credentials);

      if (response.success && response.data) {
        const { user: userData, token: authToken } = response.data;

        // 檢查用戶角色是否為廚師
        if (userData.role !== 2) {
          throw new Error("此帳號沒有廚房系統存取權限");
        }

        user.value = userData;
        token.value = authToken;

        // 保存到 localStorage
        localStorage.setItem("kitchen_auth_token", authToken);
        localStorage.setItem("kitchen_user", JSON.stringify(userData));

        // Save refresh token
        if (response.data?.refreshToken) {
          refreshTokenVal.value = response.data.refreshToken;
          localStorage.setItem("kitchen_refresh_token", refreshTokenVal.value!);
        }
        scheduleProactiveRefresh(authToken);

        return { success: true };
      } else {
        throw new Error(response.message || "登入失敗");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      if (token.value) {
        await authApi.logout();
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // 清除本地狀態
      user.value = null;
      token.value = null;

      // 清除 localStorage
      localStorage.removeItem("kitchen_auth_token");
      localStorage.removeItem("kitchen_user");
      refreshTokenVal.value = null;
      localStorage.removeItem("kitchen_refresh_token");
      clearRefreshTimer();
    }
  };

  const refreshToken = async () => {
    if (!token.value) return false;

    try {
      const response = await authApi.refreshToken();
      if (response.success && response.data) {
        const { token: newToken, user: userData } = response.data;

        token.value = newToken;
        user.value = userData;

        localStorage.setItem("kitchen_auth_token", newToken);
        localStorage.setItem("kitchen_user", JSON.stringify(userData));

        if (response.data.refreshToken) {
          refreshTokenVal.value = response.data.refreshToken;
          localStorage.setItem("kitchen_refresh_token", refreshTokenVal.value!);
        }

        scheduleProactiveRefresh(newToken);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Token refresh error:", error);
      await logout();
      return false;
    }
  };

  const checkAuth = async () => {
    const savedToken = localStorage.getItem("kitchen_auth_token");
    const savedUser = localStorage.getItem("kitchen_user");

    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser);

        if (userData.role !== 2) {
          await logout();
          return false;
        }

        token.value = savedToken;
        user.value = userData;

        // Only refresh if token is expired or about to expire
        if (isTokenExpired(savedToken, 60)) {
          const refreshResult = await refreshToken();
          return refreshResult;
        }

        // Token still valid — schedule proactive refresh
        scheduleProactiveRefresh(savedToken);
        return true;
      } catch (error) {
        console.error("Auth check error:", error);
        await logout();
        return false;
      }
    }

    return false;
  };

  const updateLastActivity = () => {
    if (user.value) {
      user.value.lastLogin = new Date().toISOString();
      localStorage.setItem("kitchen_user", JSON.stringify(user.value));
    }
  };

  // 初始化時檢查認證狀態
  const initialize = async () => {
    loading.value = true;
    try {
      await checkAuth();
    } finally {
      loading.value = false;
    }
  };

  return {
    // State
    user,
    token,
    loading,

    // Getters
    isAuthenticated,
    isChef,
    restaurantId,
    hasPermission,

    // Actions
    login,
    logout,
    refreshToken,
    checkAuth,
    updateLastActivity,
    initialize,
  };
});
