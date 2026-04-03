import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "@/stores/auth";

// Mock i18n
vi.mock("@/i18n", () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

// Mock getRefreshDelay
vi.mock("@makanmakan/utils", () => ({
  getRefreshDelay: vi.fn(() => 300000), // 5 minutes
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      null,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ──────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────

  describe("initial state", () => {
    it("should start unauthenticated", () => {
      const store = useAuthStore();
      expect(store.isAuthenticated).toBe(false);
      expect(store.user).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it("should read token from localStorage on creation", () => {
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((key: string) => {
        if (key === "customer_auth_token") return "existing-token";
        if (key === "customer_refresh_token") return "existing-refresh";
        return null;
      });

      setActivePinia(createPinia());
      const store = useAuthStore();
      expect(store.token).toBe("existing-token");
    });
  });

  // ──────────────────────────────────────────────
  // login
  // ──────────────────────────────────────────────

  describe("login", () => {
    it("should set user and token on successful login", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              token: "new-token",
              refreshToken: "new-refresh",
              user: {
                id: 1,
                username: "testuser",
                fullName: "Test User",
                role: 5,
              },
            },
          }),
      });

      const store = useAuthStore();
      const result = await store.login("testuser", "password123");

      expect(result.success).toBe(true);
      expect(store.user).toEqual(
        expect.objectContaining({ username: "testuser" }),
      );
      expect(store.token).toBe("new-token");
      expect(store.isAuthenticated).toBe(true);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "customer_auth_token",
        "new-token",
      );
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "customer_refresh_token",
        "new-refresh",
      );
    });

    it("should verify fetch was called with correct params", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              token: "t",
              refreshToken: "r",
              user: { id: 1, username: "u", fullName: "U", role: 5 },
            },
          }),
      });

      const store = useAuthStore();
      await store.login("myuser", "mypass");

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "myuser", password: "mypass" }),
      });
    });

    it("should set error on failed login", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            error: "Invalid credentials",
          }),
      });

      const store = useAuthStore();
      const result = await store.login("bad", "creds");

      expect(result.success).toBe(false);
      expect(store.error).toBe("Invalid credentials");
      expect(store.isAuthenticated).toBe(false);
    });

    it("should handle network error during login", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const store = useAuthStore();
      const result = await store.login("user", "pass");

      expect(result.success).toBe(false);
      expect(store.error).toBe("Network error");
    });

    it("should set isLoading during login", async () => {
      let resolvePromise: (value: unknown) => void;
      const pending = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(pending);

      const store = useAuthStore();
      const loginPromise = store.login("user", "pass");

      expect(store.isLoading).toBe(true);

      resolvePromise!({
        json: () =>
          Promise.resolve({ success: false, error: "fail" }),
      });
      await loginPromise;

      expect(store.isLoading).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // register
  // ──────────────────────────────────────────────

  describe("register", () => {
    it("should register and auto-login on success", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              tokens: {
                accessToken: "reg-token",
                refreshToken: "reg-refresh",
              },
              user: {
                id: 2,
                username: "newuser",
                fullName: "New User",
                role: 5,
              },
            },
          }),
      });

      const store = useAuthStore();
      const result = await store.register({
        username: "newuser",
        password: "pass123",
        fullName: "New User",
      });

      expect(result.success).toBe(true);
      expect(store.token).toBe("reg-token");
      expect(store.isAuthenticated).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/auth/register",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"role":5'),
        }),
      );
    });

    it("should set error on failed registration", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            error: "Username taken",
          }),
      });

      const store = useAuthStore();
      const result = await store.register({
        username: "taken",
        password: "pass",
        fullName: "User",
      });

      expect(result.success).toBe(false);
      expect(store.error).toBe("Username taken");
    });
  });

  // ──────────────────────────────────────────────
  // logout
  // ──────────────────────────────────────────────

  describe("logout", () => {
    it("should clear all auth state and localStorage", async () => {
      // Set up authenticated state first
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              token: "t",
              refreshToken: "r",
              user: { id: 1, username: "u", fullName: "U", role: 5 },
            },
          }),
      });
      const store = useAuthStore();
      await store.login("u", "p");

      // Now logout
      mockFetch.mockResolvedValueOnce({}); // logout endpoint
      await store.logout();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        "customer_auth_token",
      );
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        "customer_refresh_token",
      );
    });

    it("should still clear state even if logout request fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                token: "t",
                refreshToken: "r",
                user: { id: 1, username: "u", fullName: "U", role: 5 },
              },
            }),
        })
        .mockRejectedValueOnce(new Error("Network fail"));

      const store = useAuthStore();
      await store.login("u", "p");
      await store.logout();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // refresh
  // ──────────────────────────────────────────────

  describe("refresh", () => {
    it("should update tokens on successful refresh", async () => {
      // First login
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              token: "old-token",
              refreshToken: "old-refresh",
              user: { id: 1, username: "u", fullName: "U", role: 5 },
            },
          }),
      });
      const store = useAuthStore();
      await store.login("u", "p");

      // Then refresh
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              token: "new-token",
              refreshToken: "new-refresh",
            },
          }),
      });
      const result = await store.refresh();

      expect(result).toBe(true);
      expect(store.token).toBe("new-token");
      expect(mockFetch).toHaveBeenLastCalledWith("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "X-Refresh-Token": "old-refresh" },
      });
    });

    it("should return false when no refresh token exists", async () => {
      const store = useAuthStore();
      const result = await store.refresh();
      expect(result).toBe(false);
    });

    it("should return false on refresh failure without logging out", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              token: "t",
              refreshToken: "r",
              user: { id: 1, username: "u", fullName: "U", role: 5 },
            },
          }),
      });
      const store = useAuthStore();
      await store.login("u", "p");

      mockFetch.mockRejectedValueOnce(new Error("fail"));
      const result = await store.refresh();

      expect(result).toBe(false);
      // Should NOT have logged out (degraded to reactive mode)
      expect(store.token).toBe("t");
    });
  });

  // ──────────────────────────────────────────────
  // checkAuth
  // ──────────────────────────────────────────────

  describe("checkAuth", () => {
    it("should return false if no token exists", async () => {
      const store = useAuthStore();
      const result = await store.checkAuth();
      expect(result).toBe(false);
    });

    it("should set user on successful auth check", async () => {
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation((key: string) => {
        if (key === "customer_auth_token") return "valid-token";
        return null;
      });
      setActivePinia(createPinia());

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 1, username: "u", fullName: "U", role: 5 },
          }),
      });

      const store = useAuthStore();
      const result = await store.checkAuth();

      expect(result).toBe(true);
      expect(store.user).toEqual(
        expect.objectContaining({ username: "u" }),
      );
    });
  });

  // ──────────────────────────────────────────────
  // clearError
  // ──────────────────────────────────────────────

  describe("clearError", () => {
    it("should clear the error state", async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ success: false, error: "Some error" }),
      });

      const store = useAuthStore();
      await store.login("u", "p");
      expect(store.error).toBe("Some error");

      store.clearError();
      expect(store.error).toBeNull();
    });
  });
});
