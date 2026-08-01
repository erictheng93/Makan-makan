// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "./auth";
import { UserRole, type User } from "@/types";
import { api, authClient, managementAuthClient } from "@/services/api";
import { getAuthToken } from "@/utils/authTokenProvider";

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
}));

vi.mock("@/services/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    setAuthToken: vi.fn(),
  },
  authClient: {
    instance: {
      post: vi.fn(),
    },
    tokens: {
      getToken: vi.fn(),
      setTokens: vi.fn(),
      setUser: vi.fn(),
      clearAll: vi.fn(),
      scheduleProactiveRefresh: vi.fn(),
    },
  },
  managementAuthClient: {
    setAuthToken: vi.fn(),
    tokens: {
      clearAll: vi.fn(),
    },
  },
}));

vi.mock("@/utils/authTokenProvider", () => ({
  getAuthToken: vi.fn(() => null),
}));

const moduleAccess = vi.hoisted(() => ({
  fetch: vi.fn(async () => {}),
  reset: vi.fn(),
}));

vi.mock("@makanmakan/shared/stores/moduleAccess", () => ({
  useModuleAccessStore: () => moduleAccess,
}));

const user = (overrides: Partial<User> = {}): User => ({
  id: 1,
  username: "owner",
  email: "owner@example.com",
  role: UserRole.OWNER,
  restaurantId: "restaurant-1",
  createdAt: "2026-06-07T00:00:00.000Z",
  updatedAt: "2026-06-07T00:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setActivePinia(createPinia());
  vi.mocked(getAuthToken).mockReset();
  vi.mocked(getAuthToken).mockReturnValue(null);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAuthStore", () => {
  it("hydrates user, memory token, and admin restaurant context", () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify(user({ role: UserRole.ADMIN, restaurantId: null })),
    );
    vi.mocked(getAuthToken).mockReturnValue("stored-token");
    sessionStorage.setItem("admin_selected_restaurant_id", "restaurant-42");
    sessionStorage.setItem("admin_selected_restaurant_name", "Demo Restaurant");

    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(true);
    expect(store.isAdminRole).toBe(true);
    expect(store.restaurantId).toBe("restaurant-42");
    expect(store.hasRestaurantContext).toBe(true);
    expect(store.selectedRestaurantName).toBe("Demo Restaurant");
    expect(store.getDefaultRoute()).toBe("/dashboard");
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("logs in, persists auth data through auth-client, and exposes owner permissions", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          token: "access-token",
          refreshToken: "refresh-token",
          user: user(),
        },
      },
    });
    const store = useAuthStore();

    await expect(store.login("owner", "secret")).resolves.toEqual({
      success: true,
    });

    expect(store.user).toEqual(user());
    expect(store.token).toBe("access-token");
    expect(store.isAuthenticated).toBe(true);
    expect(store.restaurantId).toBe("restaurant-1");
    expect(store.canManageOrders).toBe(true);
    expect(store.canManageMenu).toBe(true);
    expect(store.canAccessRoute("PlatformOverview")).toBe(false);
    expect(store.getDefaultRoute()).toBe("/dashboard/owner-overview");
    expect(authClient.tokens.setTokens).toHaveBeenCalledWith("access-token");
    expect(authClient.tokens.setUser).toHaveBeenCalledWith(user());
    expect(api.setAuthToken).toHaveBeenCalledWith("access-token");
  });

  it("loads module access on login, since bootstrap already ran", async () => {
    // Bootstrap only fetches when the app starts authenticated. Without this
    // the whole session kept an empty `effectiveModules` and every
    // module-gated feature stayed hidden until a manual reload.
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          token: "access-token",
          refreshToken: "refresh-token",
          user: user(),
        },
      },
    });

    await useAuthStore().login("owner", "secret");

    expect(moduleAccess.fetch).toHaveBeenCalledOnce();
    expect(moduleAccess.fetch).toHaveBeenCalledWith({ force: true });
  });

  it("does not load module access when login fails", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { success: false, error: { message: "bad credentials" } },
    });

    await expect(useAuthStore().login("owner", "wrong")).resolves.toEqual({
      success: false,
      error: "bad credentials",
    });

    expect(moduleAccess.fetch).not.toHaveBeenCalled();
  });

  it("clears module access on logout so the next user starts empty", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });

    await useAuthStore().logout();

    expect(moduleAccess.reset).toHaveBeenCalledOnce();
  });

  it("restricts platform market checkout routes to admins", () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify(user({ role: UserRole.ADMIN, restaurantId: null })),
    );
    const adminStore = useAuthStore();

    expect(adminStore.canAccessRoute("PlatformMarketCheckouts")).toBe(true);

    setActivePinia(createPinia());
    localStorage.setItem("auth_user", JSON.stringify(user()));
    const ownerStore = useAuthStore();

    expect(ownerStore.canAccessRoute("PlatformMarketCheckouts")).toBe(false);
  });

  it("selects and clears admin restaurant context per browser tab", () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify(user({ role: UserRole.ADMIN, restaurantId: null })),
    );
    const store = useAuthStore();

    expect(store.getDefaultRoute()).toBe("/dashboard/platform");

    store.selectRestaurant("restaurant-99", "Noodle Shop");
    expect(store.restaurantId).toBe("restaurant-99");
    expect(sessionStorage.getItem("admin_selected_restaurant_id")).toBe(
      "restaurant-99",
    );
    expect(store.getDefaultRoute()).toBe("/dashboard");

    store.clearRestaurant();
    expect(store.restaurantId).toBeNull();
    expect(sessionStorage.getItem("admin_selected_restaurant_id")).toBeNull();
  });

  it("keeps hydrated sessions on transient auth revalidation failures", async () => {
    localStorage.setItem("auth_user", JSON.stringify(user()));
    vi.mocked(getAuthToken).mockReturnValue("stored-token");
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } });
    const store = useAuthStore();

    await expect(store.checkAuth()).resolves.toBe(true);

    expect(store.user).toEqual(user());
    expect(store.isAuthenticated).toBe(true);
    expect(authClient.tokens.clearAll).not.toHaveBeenCalled();
  });

  it("keeps the session when revalidation is blocked by a subscription 403", async () => {
    localStorage.setItem("auth_user", JSON.stringify(user()));
    vi.mocked(getAuthToken).mockReturnValue("stored-token");
    // api.ts wraps non-401 rejections into ErrorDetails, keeping the axios
    // error under originalError.
    vi.mocked(api.get).mockRejectedValue({
      type: "subscription",
      code: 403,
      originalError: {
        response: {
          status: 403,
          data: {
            success: false,
            error: {
              code: "SUBSCRIPTION_NOT_FOUND",
              message: "Subscription not found. Please contact support.",
            },
          },
        },
      },
    });
    const store = useAuthStore();

    await expect(store.checkAuth()).resolves.toBe(true);

    expect(store.user).toEqual(user());
    expect(store.isAuthenticated).toBe(true);
    expect(authClient.tokens.clearAll).not.toHaveBeenCalled();
    expect(managementAuthClient.tokens.clearAll).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("logs out and clears restaurant context on definitive auth failure", async () => {
    localStorage.setItem("auth_user", JSON.stringify(user()));
    vi.mocked(getAuthToken).mockReturnValue("stored-token");
    sessionStorage.setItem("admin_selected_restaurant_id", "restaurant-42");
    vi.mocked(api.get).mockRejectedValue({ response: { status: 401 } });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    const store = useAuthStore();

    await expect(store.checkAuth()).resolves.toBe(false);

    expect(store.user).toBeNull();
    expect(store.token).toBeNull();
    expect(store.restaurantId).toBeNull();
    expect(api.setAuthToken).toHaveBeenLastCalledWith(null);
    expect(authClient.tokens.clearAll).toHaveBeenCalled();
    expect(managementAuthClient.tokens.clearAll).toHaveBeenCalled();
    expect(managementAuthClient.setAuthToken).toHaveBeenCalledWith(null);
  });

  it("refreshes tokens with cookie credentials and updates user when returned", async () => {
    localStorage.setItem("auth_user", JSON.stringify(user()));
    vi.mocked(getAuthToken).mockReturnValue("old-token");
    vi.mocked(authClient.instance.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          token: "new-token",
          refreshToken: "new-refresh",
          user: user({ username: "updated-owner" }),
        },
      },
    });
    const store = useAuthStore();

    await expect(store.refreshToken()).resolves.toBe(true);

    expect(authClient.instance.post).toHaveBeenCalledWith(
      "/auth/refresh",
      {},
      {
        withCredentials: true,
        _retry: true,
      },
    );
    expect(store.token).toBe("new-token");
    expect(store.user?.username).toBe("updated-owner");
    expect(authClient.tokens.setTokens).toHaveBeenCalledWith("new-token");
    expect(api.setAuthToken).toHaveBeenCalledWith("new-token");
  });

  // #66: production holds the access token in memory, so a reload leaves the
  // user hydrated but the token gone. isAuthenticated needs both, so without
  // this the router guard redirected to /login and the 7-day refresh cookie
  // was never spent.
  describe("restoreSession", () => {
    it("spends the refresh cookie when a reload left a user but no token", async () => {
      localStorage.setItem("auth_user", JSON.stringify(user()));
      vi.mocked(getAuthToken).mockReturnValue(null);
      vi.mocked(authClient.instance.post).mockResolvedValue({
        data: { success: true, data: { token: "restored-token" } },
      });
      const store = useAuthStore();

      await expect(store.restoreSession()).resolves.toBe(true);

      expect(authClient.instance.post).toHaveBeenCalledWith(
        "/auth/refresh",
        {},
        expect.objectContaining({ withCredentials: true }),
      );
      expect(store.token).toBe("restored-token");
      expect(store.isAuthenticated).toBe(true);
    });

    it("does not call the API for a visitor with no stored session", async () => {
      const store = useAuthStore();

      await expect(store.restoreSession()).resolves.toBe(false);

      expect(authClient.instance.post).not.toHaveBeenCalled();
    });

    it("does not refresh when the token is still in memory", async () => {
      localStorage.setItem("auth_user", JSON.stringify(user()));
      vi.mocked(getAuthToken).mockReturnValue("live-token");
      const store = useAuthStore();

      await expect(store.restoreSession()).resolves.toBe(true);

      expect(authClient.instance.post).not.toHaveBeenCalled();
    });
  });
});
