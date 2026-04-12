import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import type { User } from "@/types";
import { UserRole } from "@/types";
import { api, authClient } from "@/services/api";
import { t } from "@/i18n";

// Hydrate user from localStorage for instant restore on refresh
const hydrateUser = (): User | null => {
  try {
    const saved = localStorage.getItem("auth_user");
    return saved ? JSON.parse(saved) : null;
  } catch {
    localStorage.removeItem("auth_user");
    return null;
  }
};

const persistUser = (u: User | null) => {
  if (u) {
    localStorage.setItem("auth_user", JSON.stringify(u));
  } else {
    localStorage.removeItem("auth_user");
  }
};

// Module-level deduplication: all callers share the same in-flight refresh
let sharedRefreshPromise: Promise<boolean> | null = null;

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(hydrateUser());
  const token = ref<string | null>(localStorage.getItem("auth_token"));
  const refreshTokenRef = ref<string | null>(
    localStorage.getItem("auth_refresh_token"),
  );

  const isLoading = ref(false);

  // Admin restaurant context (sessionStorage-backed for per-tab isolation)
  const selectedRestaurantId = ref<string | null>(
    sessionStorage.getItem("admin_selected_restaurant_id"),
  );
  const selectedRestaurantName = ref<string | null>(
    sessionStorage.getItem("admin_selected_restaurant_name"),
  );

  const isAuthenticated = computed(() => !!user.value && !!token.value);
  const userRole = computed(() => user.value?.role);
  const isAdminRole = computed(() => user.value?.role === UserRole.ADMIN);
  const hasRestaurantContext = computed(() => restaurantId.value !== null);

  // For admin: use selected restaurant; for others: use their bound restaurant
  const restaurantId = computed(() => {
    if (isAdminRole.value) {
      return selectedRestaurantId.value;
    }
    return user.value?.restaurantId ?? null;
  });

  const selectRestaurant = (id: string, name: string) => {
    selectedRestaurantId.value = id;
    selectedRestaurantName.value = name;
    sessionStorage.setItem("admin_selected_restaurant_id", id);
    sessionStorage.setItem("admin_selected_restaurant_name", name);
  };

  const clearRestaurant = () => {
    selectedRestaurantId.value = null;
    selectedRestaurantName.value = null;
    sessionStorage.removeItem("admin_selected_restaurant_id");
    sessionStorage.removeItem("admin_selected_restaurant_name");
  };

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
        return selectedRestaurantId.value
          ? "/dashboard"
          : "/dashboard/platform";
      case UserRole.OWNER:
        return "/dashboard/owner-overview";
      case UserRole.CHEF:
        // Chef should be redirected to Kitchen Display App (handled by LoginView)
        // Fallback to dashboard if somehow reached here
        return "/dashboard";
      case UserRole.SERVICE:
        return "/service";
      case UserRole.CASHIER:
        return "/dashboard/pos/checkout";
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
      PlatformOverview: [UserRole.ADMIN],
      Orders: [
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.SERVICE,
        UserRole.CASHIER,
      ],
      Menu: [UserRole.ADMIN, UserRole.OWNER],
      Tables: [UserRole.ADMIN, UserRole.OWNER],
      Users: [UserRole.ADMIN, UserRole.OWNER],
      EmployeeList: [UserRole.ADMIN, UserRole.OWNER],
      EmployeeAttendance: [UserRole.ADMIN, UserRole.OWNER],
      EmployeeProfile: [UserRole.ADMIN, UserRole.OWNER],
      EmployeeSchedule: [UserRole.ADMIN, UserRole.OWNER],
      EmployeeLeave: [UserRole.ADMIN, UserRole.OWNER],
      Scheduling: [UserRole.ADMIN, UserRole.OWNER],
      Analytics: [UserRole.ADMIN, UserRole.OWNER],
      Settings: [UserRole.ADMIN, UserRole.OWNER],
      Service: [UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE],
      ServiceDelivery: [UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE],
      POSCheckout: [UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER],
      POSManagement: [UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER],
      OwnerOverview: [UserRole.ADMIN, UserRole.OWNER],
      Feedback: [UserRole.ADMIN, UserRole.OWNER],
    };

    const requiredRoles = routePermissions[routeName];
    if (!requiredRoles) return true; // 如果沒有定義權限，允許訪問

    return hasPermission(requiredRoles);
  };

  const login = async (username: string, password: string) => {
    isLoading.value = true;
    try {
      const response = await api.post<{
        token: string;
        refreshToken?: string;
        user: User;
      }>("/auth/login", { username, password });

      if (response.data.success && response.data.data) {
        token.value = response.data.data.token;
        user.value = response.data.data.user;

        authClient.tokens.setTokens(
          token.value!,
          response.data.data.refreshToken,
        );
        authClient.tokens.setUser(user.value);
        api.setAuthToken(token.value!);

        if (response.data.data.refreshToken) {
          refreshTokenRef.value = response.data.data.refreshToken;
        }
        authClient.tokens.scheduleProactiveRefresh(token.value!);

        return { success: true };
      }

      return {
        success: false,
        error: response.data.error?.message || "Login failed",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || t("auth.loginFailed"),
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
      clearRestaurant();
      api.setAuthToken(null);
      refreshTokenRef.value = null;
      authClient.tokens.clearAll();
    }
  };

  const checkAuth = async () => {
    if (!token.value) return false;

    try {
      api.setAuthToken(token.value);
      const response = await api.get<User>("/auth/me");

      if (response.data.success && response.data.data) {
        user.value = response.data.data;
        persistUser(user.value);
        if (token.value)
          authClient.tokens.scheduleProactiveRefresh(token.value);
        return true;
      }
    } catch (error: any) {
      const status = error?.response?.status ?? error?.status;

      // Only logout on definitive auth failures (401/403).
      // Transient errors (429 rate-limit, 5xx, network) should NOT
      // wipe the session — the hydrated user from localStorage is
      // good enough until the next successful revalidation.
      // NOTE: Don't call refreshToken() here — the axios 401 interceptor
      // in api.ts already attempted a refresh + retry. If we still got
      // an error, the refresh failed. Just logout.
      if (status === 401 || status === 403) {
        await logout();
        return false;
      }

      console.warn("Auth revalidation failed (non-auth error):", status);
      // Keep the hydrated user — session is still valid locally
      return !!user.value;
    }

    // Server responded but user data was missing — token likely invalid
    await logout();
    return false;
  };

  const refreshToken = async (): Promise<boolean> => {
    // Deduplicate: if a refresh is already in flight, reuse its promise
    if (sharedRefreshPromise) return sharedRefreshPromise;

    sharedRefreshPromise = (async () => {
      const rt =
        refreshTokenRef.value || localStorage.getItem("auth_refresh_token");
      if (!rt) {
        await logout();
        return false;
      }

      try {
        // Use fetch directly to avoid the axios 401 interceptor loop
        const response = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Refresh-Token": rt,
          },
        });
        const data = await response.json();

        if (data.success && data.data) {
          token.value = data.data.token;
          authClient.tokens.setTokens(data.data.token, data.data.refreshToken);
          api.setAuthToken(token.value!);

          if (data.data.refreshToken) {
            refreshTokenRef.value = data.data.refreshToken;
          }

          if (data.data.user) {
            user.value = data.data.user;
            persistUser(user.value);
          }

          authClient.tokens.scheduleProactiveRefresh(token.value!);
          return true;
        }
      } catch {
        console.warn("Proactive refresh failed, falling back to reactive mode");
        return false;
      }

      console.warn(
        "Refresh returned non-success, falling back to reactive mode",
      );
      return false;
    })();

    try {
      return await sharedRefreshPromise;
    } finally {
      sharedRefreshPromise = null;
    }
  };

  return {
    user: readonly(user),
    token: readonly(token),
    isLoading: readonly(isLoading),
    isAuthenticated,
    userRole,
    restaurantId,
    isAdminRole,
    hasRestaurantContext,
    selectedRestaurantName: readonly(selectedRestaurantName),
    hasPermission,
    canAccessAdminFeatures,
    canManageOrders,
    canManageMenu,
    canAccessService,
    canAccessCashier,
    canAccessOwnerDashboard,
    canManageStaff,
    canViewAnalytics,
    canManageSettings,
    getDefaultRoute,
    canAccessRoute,
    selectRestaurant,
    clearRestaurant,
    login,
    logout,
    checkAuth,
    refreshToken,
  };
});
