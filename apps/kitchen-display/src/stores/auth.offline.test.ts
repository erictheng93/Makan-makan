import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./auth";
import { authApi, apiClient } from "@/services/authApi";
import { offlineService } from "@/services/offlineService";
import type { User } from "@/types";

vi.mock("@/services/authApi", () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  },
  apiClient: {
    tokens: {
      setTokens: vi.fn(),
      setUser: vi.fn(),
      scheduleProactiveRefresh: vi.fn(),
      clearAll: vi.fn(),
      getToken: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

vi.mock("@/services/offlineService", () => ({
  offlineService: {
    setActiveRestaurant: vi.fn(),
    clearOfflineData: vi.fn(),
  },
}));

vi.mock("@makanmasak/utils", () => ({
  isTokenExpired: vi.fn(() => false),
}));

const buildChef = (overrides: Partial<User> = {}): User => ({
  id: 7,
  username: "chef-a",
  name: "Chef A",
  role: 2,
  restaurantId: 11,
  permissions: ["kitchen.view"],
  ...overrides,
});

describe("auth store offline cache tenancy", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("binds the offline cache to the restaurant of the logging-in chef", async () => {
    const store = useAuthStore();
    vi.mocked(authApi.login).mockResolvedValue({
      success: true,
      data: {
        user: buildChef({ restaurantId: 22 }),
        token: "token-b",
        expiresIn: 3600,
      },
      timestamp: "2026-06-08T01:00:00.000Z",
    });

    await store.login({ username: "chef-b", password: "pw" });

    expect(offlineService.setActiveRestaurant).toHaveBeenCalledOnce();
    expect(offlineService.setActiveRestaurant).toHaveBeenCalledWith(22);
    expect(apiClient.tokens.setUser).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: 22 }),
    );
  });

  it("purges the offline cache on logout so the next chef starts clean", async () => {
    const store = useAuthStore();
    vi.mocked(authApi.login).mockResolvedValue({
      success: true,
      data: { user: buildChef(), token: "token-a", expiresIn: 3600 },
      timestamp: "2026-06-08T01:00:00.000Z",
    });
    vi.mocked(authApi.logout).mockResolvedValue({
      success: true,
      timestamp: "2026-06-08T01:00:00.000Z",
    });

    await store.login({ username: "chef-a", password: "pw" });
    await store.logout();

    expect(authApi.logout).toHaveBeenCalledOnce();
    expect(offlineService.clearOfflineData).toHaveBeenCalledOnce();
    expect(apiClient.tokens.clearAll).toHaveBeenCalledOnce();
    expect(store.isAuthenticated).toBe(false);
  });

  it("purges the offline cache even when the logout request fails", async () => {
    const store = useAuthStore();
    vi.mocked(authApi.login).mockResolvedValue({
      success: true,
      data: { user: buildChef(), token: "token-a", expiresIn: 3600 },
      timestamp: "2026-06-08T01:00:00.000Z",
    });
    vi.mocked(authApi.logout).mockRejectedValue(new Error("offline"));

    await store.login({ username: "chef-a", password: "pw" });
    await store.logout();

    expect(offlineService.clearOfflineData).toHaveBeenCalledOnce();
  });

  it("rebinds the offline cache to the restored session restaurant", async () => {
    const store = useAuthStore();
    vi.mocked(apiClient.tokens.getToken).mockReturnValue("token-c");
    vi.mocked(apiClient.tokens.getUser).mockReturnValue(
      buildChef({ restaurantId: 33 }),
    );

    const restored = await store.checkAuth();

    expect(restored).toBe(true);
    expect(offlineService.setActiveRestaurant).toHaveBeenCalledWith(33);
    expect(offlineService.clearOfflineData).not.toHaveBeenCalled();
  });
});
