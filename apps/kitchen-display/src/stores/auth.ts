import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "@/types";
import { authApi } from "@/services/authApi";

export const useAuthStore = defineStore("auth", () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(false);

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const isChef = computed(() => user.value?.role === 2);
  const restaurantId = computed(() => user.value?.restaurantId);
  const hasPermission = computed(() => (permission: string) => {
    return user.value?.permissions.includes(permission) ?? false;
  });

  // Actions
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

        // 驗證用戶角色
        if (userData.role !== 2) {
          await logout();
          return false;
        }

        token.value = savedToken;
        user.value = userData;

        // 嘗試刷新 token 以驗證其有效性
        const refreshResult = await refreshToken();
        return refreshResult;
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
