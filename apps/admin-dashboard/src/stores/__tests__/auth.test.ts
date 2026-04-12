/**
 * Auth Store Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { UserRole } from "@/types";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    setAuthToken: vi.fn(),
  },
  authClient: {
    tokens: {
      setTokens: vi.fn((token: string, rt?: string) => {
        localStorage.setItem("auth_token", token);
        if (rt) localStorage.setItem("auth_refresh_token", rt);
      }),
      setUser: vi.fn((u: unknown) => {
        if (u) localStorage.setItem("auth_user", JSON.stringify(u));
        else localStorage.removeItem("auth_user");
      }),
      clearAll: vi.fn(() => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_refresh_token");
        localStorage.removeItem("auth_user");
      }),
      scheduleProactiveRefresh: vi.fn(),
      clearRefreshTimer: vi.fn(),
      getToken: vi.fn(() => localStorage.getItem("auth_token")),
      getUser: vi.fn(() => {
        const raw = localStorage.getItem("auth_user");
        return raw ? JSON.parse(raw) : null;
      }),
    },
    setAuthToken: vi.fn(),
  },
}));

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
}));

vi.mock("@makanmakan/utils", () => ({
  getRefreshDelay: vi.fn(() => null),
}));

import { api } from "@/services/api";
import { useAuthStore } from "../auth";

describe("Auth Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(global.fetch).mockReset();
  });

  describe("Initial State", () => {
    it("should start unauthenticated with no stored tokens", () => {
      const store = useAuthStore();
      expect(store.isAuthenticated).toBe(false);
      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
    });

    it("should hydrate user from localStorage", () => {
      const savedUser = {
        id: 1,
        username: "admin",
        role: UserRole.ADMIN,
        restaurantId: null,
      };
      localStorage.setItem("auth_user", JSON.stringify(savedUser));
      localStorage.setItem("auth_token", "saved-token");

      // Need a new Pinia after setting storage
      setActivePinia(createPinia());
      const store = useAuthStore();

      expect(store.user).toEqual(savedUser);
      expect(store.token).toBe("saved-token");
      expect(store.isAuthenticated).toBe(true);
    });
  });

  describe("login", () => {
    it("should set user and token on successful login", async () => {
      const mockUser = {
        id: 1,
        username: "admin",
        role: UserRole.ADMIN,
        restaurantId: null,
      };
      vi.mocked(api.post).mockResolvedValue({
        data: {
          success: true,
          data: {
            token: "new-token",
            refreshToken: "refresh-token",
            user: mockUser,
          },
        },
      });

      const store = useAuthStore();
      const result = await store.login("admin", "password");

      expect(result.success).toBe(true);
      expect(store.isAuthenticated).toBe(true);
      expect(store.user).toEqual(mockUser);
      expect(store.token).toBe("new-token");
      expect(api.post).toHaveBeenCalledWith("/auth/login", {
        username: "admin",
        password: "password",
      });
      expect(api.setAuthToken).toHaveBeenCalledWith("new-token");
      expect(localStorage.getItem("auth_token")).toBe("new-token");
      expect(localStorage.getItem("auth_refresh_token")).toBe("refresh-token");
    });

    it("should return error on failed login", async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: {
          success: false,
          error: { message: "Invalid credentials" },
        },
      });

      const store = useAuthStore();
      const result = await store.login("bad", "bad");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
      expect(store.isAuthenticated).toBe(false);
    });

    it("should handle network error", async () => {
      vi.mocked(api.post).mockRejectedValue({
        response: { data: { error: { message: "Server down" } } },
      });

      const store = useAuthStore();
      const result = await store.login("admin", "password");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Server down");
    });

    it("should set isLoading during login", async () => {
      let resolveLogin: (v: any) => void;
      vi.mocked(api.post).mockReturnValue(
        new Promise((r) => {
          resolveLogin = r;
        }),
      );

      const store = useAuthStore();
      const promise = store.login("admin", "pass");

      expect(store.isLoading).toBe(true);

      resolveLogin!({
        data: { success: false, error: { message: "fail" } },
      });
      await promise;

      expect(store.isLoading).toBe(false);
    });
  });

  describe("logout", () => {
    it("should clear all auth state and storage", async () => {
      // Set up authenticated state
      localStorage.setItem("auth_token", "token");
      localStorage.setItem("auth_refresh_token", "rt");
      localStorage.setItem("auth_user", '{"id":1}');
      sessionStorage.setItem("admin_selected_restaurant_id", "r1");

      vi.mocked(api.post).mockResolvedValue({ data: {} });

      setActivePinia(createPinia());
      const store = useAuthStore();
      await store.logout();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("auth_refresh_token")).toBeNull();
      expect(sessionStorage.getItem("admin_selected_restaurant_id")).toBeNull();
      expect(api.setAuthToken).toHaveBeenCalledWith(null);
    });

    it("should still clear state if logout API fails", async () => {
      localStorage.setItem("auth_token", "token");
      vi.mocked(api.post).mockRejectedValue(new Error("Network error"));

      setActivePinia(createPinia());
      const store = useAuthStore();
      await store.logout();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
    });
  });

  describe("checkAuth", () => {
    it("should return false if no token", async () => {
      const store = useAuthStore();
      const result = await store.checkAuth();
      expect(result).toBe(false);
    });

    it("should validate token and update user", async () => {
      localStorage.setItem("auth_token", "valid-token");
      setActivePinia(createPinia());

      const mockUser = {
        id: 1,
        username: "admin",
        role: UserRole.ADMIN,
      };
      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockUser },
      });

      const store = useAuthStore();
      const result = await store.checkAuth();

      expect(result).toBe(true);
      expect(api.setAuthToken).toHaveBeenCalledWith("valid-token");
      expect(api.get).toHaveBeenCalledWith("/auth/me");
    });

    it("should logout on 401 error", async () => {
      localStorage.setItem("auth_token", "expired-token");
      setActivePinia(createPinia());

      vi.mocked(api.get).mockRejectedValue({
        response: { status: 401 },
      });
      vi.mocked(api.post).mockResolvedValue({ data: {} }); // logout call

      const store = useAuthStore();
      const result = await store.checkAuth();

      expect(result).toBe(false);
    });

    it("should keep hydrated user on transient error (5xx)", async () => {
      const savedUser = { id: 1, username: "admin", role: UserRole.ADMIN };
      localStorage.setItem("auth_token", "valid-token");
      localStorage.setItem("auth_user", JSON.stringify(savedUser));
      setActivePinia(createPinia());

      vi.mocked(api.get).mockRejectedValue({
        response: { status: 500 },
      });

      const store = useAuthStore();
      const result = await store.checkAuth();

      // Should keep the hydrated user, not logout
      expect(result).toBe(true);
      expect(store.user).toEqual(savedUser);
    });
  });

  describe("hasPermission", () => {
    it("should return false when no user", () => {
      const store = useAuthStore();
      expect(store.hasPermission(UserRole.ADMIN)).toBe(false);
    });

    it("should check single role", async () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 1, role: UserRole.OWNER }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.hasPermission(UserRole.OWNER)).toBe(true);
      expect(store.hasPermission(UserRole.ADMIN)).toBe(false);
    });

    it("should check array of roles", async () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 1, role: UserRole.CASHIER }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.hasPermission([UserRole.CASHIER, UserRole.SERVICE])).toBe(
        true,
      );
      expect(store.hasPermission([UserRole.ADMIN, UserRole.OWNER])).toBe(false);
    });
  });

  describe("computed permissions", () => {
    it("should compute canAccessAdminFeatures for ADMIN", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 1, role: UserRole.ADMIN }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.canAccessAdminFeatures).toBe(true);
      expect(store.canManageOrders).toBe(true);
      expect(store.canManageMenu).toBe(true);
    });

    it("should restrict CHEF permissions", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 2, role: UserRole.CHEF }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.canAccessAdminFeatures).toBe(false);
      expect(store.canManageMenu).toBe(false);
      expect(store.canManageOrders).toBe(false);
    });
  });

  describe("selectRestaurant / clearRestaurant", () => {
    it("should persist restaurant selection in sessionStorage", () => {
      const store = useAuthStore();
      store.selectRestaurant("r1", "Test Restaurant");

      expect(store.selectedRestaurantName).toBe("Test Restaurant");
      expect(sessionStorage.getItem("admin_selected_restaurant_id")).toBe("r1");
      expect(sessionStorage.getItem("admin_selected_restaurant_name")).toBe(
        "Test Restaurant",
      );
    });

    it("should clear restaurant selection", () => {
      const store = useAuthStore();
      store.selectRestaurant("r1", "Test");
      store.clearRestaurant();

      expect(store.selectedRestaurantName).toBeNull();
      expect(sessionStorage.getItem("admin_selected_restaurant_id")).toBeNull();
    });
  });

  describe("restaurantId computed", () => {
    it("should use selectedRestaurantId for admin users", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 1, role: UserRole.ADMIN, restaurantId: null }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.restaurantId).toBeNull();

      store.selectRestaurant("r1", "Test");
      expect(store.restaurantId).toBe("r1");
    });

    it("should use user restaurantId for non-admin users", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 2, role: UserRole.OWNER, restaurantId: "r2" }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.restaurantId).toBe("r2");
    });
  });

  describe("getDefaultRoute", () => {
    it("should return /login when no user", () => {
      const store = useAuthStore();
      expect(store.getDefaultRoute()).toBe("/login");
    });

    it("should return platform for admin without restaurant", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 1, role: UserRole.ADMIN }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.getDefaultRoute()).toBe("/dashboard/platform");
    });

    it("should return owner overview for owners", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 2, role: UserRole.OWNER }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.getDefaultRoute()).toBe("/dashboard/owner-overview");
    });

    it("should return POS checkout for cashier", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 3, role: UserRole.CASHIER }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.getDefaultRoute()).toBe("/dashboard/pos/checkout");
    });
  });

  describe("refreshToken", () => {
    it("should call refresh endpoint and update tokens", async () => {
      localStorage.setItem("auth_token", "old-token");
      localStorage.setItem("auth_refresh_token", "rt-1");
      setActivePinia(createPinia());

      vi.mocked(global.fetch).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              token: "new-token",
              refreshToken: "new-rt",
              user: { id: 1, username: "admin" },
            },
          }),
      } as Response);

      const store = useAuthStore();
      const result = await store.refreshToken();

      expect(result).toBe(true);
      expect(store.token).toBe("new-token");
      expect(localStorage.getItem("auth_token")).toBe("new-token");
      expect(localStorage.getItem("auth_refresh_token")).toBe("new-rt");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/refresh",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Refresh-Token": "rt-1",
          }),
        }),
      );
    });

    it("should logout if no refresh token available", async () => {
      vi.mocked(api.post).mockResolvedValue({ data: {} }); // logout call
      setActivePinia(createPinia());

      const store = useAuthStore();
      const result = await store.refreshToken();

      expect(result).toBe(false);
    });
  });

  describe("canAccessRoute", () => {
    it("should allow admin to access all routes", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 1, role: UserRole.ADMIN }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.canAccessRoute("PlatformOverview")).toBe(true);
      expect(store.canAccessRoute("Orders")).toBe(true);
      expect(store.canAccessRoute("Analytics")).toBe(true);
    });

    it("should restrict cashier access", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 3, role: UserRole.CASHIER }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.canAccessRoute("POSCheckout")).toBe(true);
      expect(store.canAccessRoute("PlatformOverview")).toBe(false);
      expect(store.canAccessRoute("Menu")).toBe(false);
    });

    it("should allow access to undefined routes", () => {
      localStorage.setItem("auth_token", "t");
      localStorage.setItem(
        "auth_user",
        JSON.stringify({ id: 1, role: UserRole.CASHIER }),
      );
      setActivePinia(createPinia());

      const store = useAuthStore();
      expect(store.canAccessRoute("UnknownRoute")).toBe(true);
    });
  });
});
