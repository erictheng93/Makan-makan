import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import type { User } from "@/types";
import { UserRole } from "@/types";
import { api } from "@/services/api";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem("auth_token"));
  const isLoading = ref(false);

  const isAuthenticated = computed(() => !!user.value && !!token.value);
  const userRole = computed(() => user.value?.role);
  const restaurantId = computed(() => user.value?.restaurantId);

  const hasPermission = (requiredRole: UserRole | UserRole[]) => {
    if (!user.value) return false;

    const userRoleValue = user.value.role;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    return roles.includes(userRoleValue);
  };

  const canAccessAdminFeatures = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER]),
  );

  const canManageOrders = computed(() =>
    hasPermission([
      UserRole.ADMIN,
      UserRole.OWNER,
      UserRole.SERVICE,
      UserRole.CASHIER,
    ]),
  );

  const canManageMenu = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER]),
  );

  const canViewKitchen = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF]),
  );

  const canAccessService = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE]),
  );

  const canAccessCashier = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER]),
  );

  const canAccessOwnerDashboard = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER]),
  );

  const canManageStaff = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER]),
  );

  const canViewAnalytics = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER]),
  );

  const canManageSettings = computed(() =>
    hasPermission([UserRole.ADMIN, UserRole.OWNER]),
  );

  // 根據用戶角色返回預設路由
  const getDefaultRoute = () => {
    if (!user.value) return "/login";

    switch (user.value.role) {
      case UserRole.ADMIN:
        return "/dashboard";
      case UserRole.OWNER:
        return "/owner";
      case UserRole.CHEF:
        return "/kitchen";
      case UserRole.SERVICE:
        return "/service";
      case UserRole.CASHIER:
        return "/cashier";
      default:
        return "/dashboard";
    }
  };

  // 檢查用戶是否可以訪問特定路由
  const canAccessRoute = (routeName: string) => {
    if (!user.value) return false;

    const routePermissions: Record<string, UserRole[]> = {
      Dashboard: [
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.CHEF,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ],
      DashboardHome: [
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.CHEF,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ],
      Orders: [
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ],
      Menu: [UserRole.ADMIN, UserRole.OWNER],
      Tables: [UserRole.ADMIN, UserRole.OWNER],
      Users: [UserRole.ADMIN, UserRole.OWNER],
      Analytics: [UserRole.ADMIN, UserRole.OWNER],
      Settings: [UserRole.ADMIN, UserRole.OWNER],
      Kitchen: [UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF],
      KitchenDisplay: [UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF],
      Service: [UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE],
      ServiceDelivery: [UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE],
      Cashier: [UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER],
      CashierPOS: [UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER],
      Owner: [UserRole.ADMIN, UserRole.OWNER],
      OwnerDashboard: [UserRole.ADMIN, UserRole.OWNER],
    };

    const requiredRoles = routePermissions[routeName];
    if (!requiredRoles) return true; // 如果沒有定義權限，允許訪問

    return hasPermission(requiredRoles);
  };

  const login = async (username: string, password: string) => {
    isLoading.value = true;
    try {
      const response = await api.post<{ token: string; user: User }>(
        "/auth/login",
        { username, password },
      );

      if (response.data.success && response.data.data) {
        token.value = response.data.data.token;
        user.value = response.data.data.user;

        localStorage.setItem("auth_token", token.value!);
        api.setAuthToken(token.value!);

        return { success: true };
      }

      return {
        success: false,
        error: response.data.error?.message || "Login failed",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || "登入失敗",
      };
    } finally {
      isLoading.value = false;
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.warn("Logout request failed:", error);
    } finally {
      user.value = null;
      token.value = null;
      localStorage.removeItem("auth_token");
      api.setAuthToken(null);
    }
  };

  const checkAuth = async () => {
    if (!token.value) return false;

    try {
      api.setAuthToken(token.value);
      const response = await api.get<User>("/auth/me");

      if (response.data.success && response.data.data) {
        user.value = response.data.data;
        return true;
      }
    } catch (error) {
      console.warn("Auth check failed:", error);
    }

    await logout();
    return false;
  };

  const refreshToken = async () => {
    try {
      const response = await api.post<{ token: string }>("/auth/refresh");

      if (response.data.success && response.data.data) {
        token.value = response.data.data.token;
        localStorage.setItem("auth_token", token.value!);
        api.setAuthToken(token.value!);
        return true;
      }
    } catch (error) {
      await logout();
      return false;
    }
  };

  return {
    user: readonly(user),
    token: readonly(token),
    isLoading: readonly(isLoading),
    isAuthenticated,
    userRole,
    restaurantId,
    hasPermission,
    canAccessAdminFeatures,
    canManageOrders,
    canManageMenu,
    canViewKitchen,
    canAccessService,
    canAccessCashier,
    canAccessOwnerDashboard,
    canManageStaff,
    canViewAnalytics,
    canManageSettings,
    getDefaultRoute,
    canAccessRoute,
    login,
    logout,
    checkAuth,
    refreshToken,
  };
});
