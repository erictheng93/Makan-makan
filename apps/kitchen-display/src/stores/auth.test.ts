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
   * The server's text still rides on the thrown error, but its audience moved:
   * the login form now translates from `code` and `status`, and this string is
   * what lands in the console. Keeping it is what makes a lockout diagnosable
   * from a log rather than only from the screen.
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

    // English on purpose: nothing renders this. The form reads `code`.
    await expect(useAuthStore().login(credentials)).rejects.toThrow(
      "Login failed",
    );
  });

  /**
   * A rejected login is a 401 whichever way it failed, so the status alone
   * cannot tell a wrong password from a locked account. Dropping the code here
   * would leave the form with nothing to tell them apart -- which is the same
   * information loss #197 fixed, in a different place.
   */
  it("carries the code and status through to whoever renders the failure", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      success: false,
      error: "Account locked after repeated failures",
      code: "ACCOUNT_LOCKED",
      status: 401,
      timestamp: "2026-08-17T00:00:00.000Z",
    });

    await expect(useAuthStore().login(credentials)).rejects.toMatchObject({
      code: "ACCOUNT_LOCKED",
      status: 401,
    });
  });
});
