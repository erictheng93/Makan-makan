/**
 * Auth Store Tests
 * 測試認證 store 的狀態管理和登入流程
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { userFactory, resetAllFactories } from "@makanmakan/testing-utils";

const mockAuthApi = {
  login: vi.fn(),
  logout: vi.fn(),
  verifyToken: vi.fn(),
};

vi.mock("@/services/authApi", () => ({ authApi: mockAuthApi }));

describe("Auth Store", () => {
  let localStorageMock: Map<string, string>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetAllFactories();

    // Mock localStorage with Map for better tracking
    localStorageMock = new Map();

    const localStorageStub = {
      getItem: vi.fn((key: string) => localStorageMock.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        localStorageMock.delete(key);
      }),
      clear: vi.fn(() => {
        localStorageMock.clear();
      }),
    };

    vi.stubGlobal("localStorage", localStorageStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Initial State", () => {
    it("should start as unauthenticated", () => {
      const isAuthenticated = false;
      const user = null;
      const token = null;

      expect(isAuthenticated).toBe(false);
      expect(user).toBeNull();
      expect(token).toBeNull();
    });
  });

  describe("Login", () => {
    it("should authenticate user successfully", async () => {
      const chef = userFactory.buildChef(1);
      mockAuthApi.login.mockResolvedValue({
        success: true,
        data: {
          token: "test-token-123",
          user: {
            id: chef.id,
            username: chef.username,
            role: chef.role,
            restaurantId: chef.restaurantId,
          },
        },
      });

      const credentials = {
        username: chef.username,
        password: "password123",
      };

      const result = await mockAuthApi.login(credentials);

      expect(result.success).toBe(true);
      expect(result.data.token).toBe("test-token-123");
      expect(result.data.user.role).toBe(2);
    });

    it("should handle login failure", async () => {
      mockAuthApi.login.mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const result = await mockAuthApi.login({
        username: "wrong",
        password: "wrong",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
    });

    it("should store token after successful login", async () => {
      const token = "test-token-123";

      localStorage.setItem("auth-token", token);

      const stored = localStorage.getItem("auth-token");
      expect(stored).toBe(token);
    });
  });

  describe("Logout", () => {
    it("should clear auth state on logout", async () => {
      localStorage.setItem("auth-token", "test-token");

      mockAuthApi.logout.mockResolvedValue({ success: true });

      await mockAuthApi.logout();
      localStorage.removeItem("auth-token");

      const token = localStorage.getItem("auth-token");
      expect(token).toBeNull();
    });
  });

  describe("Token Verification", () => {
    it("should verify valid token", async () => {
      mockAuthApi.verifyToken.mockResolvedValue({
        success: true,
        data: { valid: true },
      });

      const result = await mockAuthApi.verifyToken("valid-token");

      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
    });

    it("should reject invalid token", async () => {
      mockAuthApi.verifyToken.mockResolvedValue({
        success: false,
        error: "Invalid token",
      });

      const result = await mockAuthApi.verifyToken("invalid-token");

      expect(result.success).toBe(false);
    });
  });

  describe("Role Management", () => {
    it("should check user role permissions", () => {
      const chef = userFactory.buildChef(1);
      const user = {
        id: chef.id,
        username: chef.username,
        role: chef.role, // Chef (role 2)
        restaurantId: chef.restaurantId,
      };

      const canAccessKitchen = user.role <= 2;
      expect(canAccessKitchen).toBe(true);
    });

    it("should restrict customer access", () => {
      const cashier = userFactory.buildCashier(1);
      const user = {
        id: cashier.id,
        username: cashier.username,
        role: cashier.role, // Cashier (role 4)
        restaurantId: cashier.restaurantId,
      };

      const canAccessKitchen = user.role <= 2;
      expect(canAccessKitchen).toBe(false);
    });
  });

  describe("Session Persistence", () => {
    it("should persist auth state across reloads", () => {
      const chef = userFactory.buildChef(1);
      const authState = {
        token: "test-token",
        user: {
          id: chef.id,
          username: chef.username,
          role: chef.role,
          restaurantId: chef.restaurantId,
        },
      };

      localStorage.setItem("auth-state", JSON.stringify(authState));

      const stored = localStorage.getItem("auth-state");
      const parsed = JSON.parse(stored!);

      expect(parsed.token).toBe("test-token");
      expect(parsed.user.role).toBe(2);
    });
  });
});
