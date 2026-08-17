import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./auth";
import { authApi } from "@/services/authApi";

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

const credentials = { username: "chef1", password: "wrong" };

describe("kitchen auth store — failed login messages", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  /**
   * The whole point of reading the server's text: a lockout notice tells the
   * chef to stop retrying, while "登入失敗" invites them to keep guessing.
   */
  it("surfaces the message the server sent rather than the generic fallback", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      success: false,
      error: "帳號已鎖定，請聯絡管理員",
      timestamp: "2026-08-17T00:00:00.000Z",
    });

    await expect(useAuthStore().login(credentials)).rejects.toThrow(
      "帳號已鎖定，請聯絡管理員",
    );
  });

  it("still reads a message-shaped response, for routes that populate it", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      success: false,
      message: "舊路由的訊息",
      timestamp: "2026-08-17T00:00:00.000Z",
    });

    await expect(useAuthStore().login(credentials)).rejects.toThrow(
      "舊路由的訊息",
    );
  });

  it("falls back only when the response carries no text at all", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      success: false,
      timestamp: "2026-08-17T00:00:00.000Z",
    });

    await expect(useAuthStore().login(credentials)).rejects.toThrow("登入失敗");
  });
});
