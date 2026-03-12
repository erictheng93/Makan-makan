/**
 * Authentication Routes Tests
 * 認證路由測試 - 使用工廠模式注入 mock 依賴
 *
 * This test file uses the factory pattern to inject mock dependencies,
 * solving the Vitest mock hoisting issue where middleware is bound at
 * module load time before mocks are applied.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { Env } from "../../../shared/types";
import { mockEnv, mockUser, mockAdminUser } from "../../../__tests__/setup";

// Import the factory function instead of the pre-built routes
import {
  createAuthRoutes,
  type AuthMiddleware,
  type RequireRoleFactory,
  type BlacklistTokenFn,
  type AuthServiceFactory,
} from "../routes/index";

// Mock the error sanitizer module
vi.mock("../../../utils/errorSanitizer", () => ({
  ErrorSanitizer: {
    logAndSanitize: vi.fn(),
  },
  createSafeErrorResponse: vi.fn(() => ({
    success: false,
    error: "Internal server error",
  })),
}));

// Mock core modules
vi.mock("../../../core/database", () => ({
  getDatabaseConnection: vi.fn(() => ({})),
}));

vi.mock("../../../core/cache", () => ({
  KVCacheService: vi.fn(function () {
    return {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
    };
  }),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }),
  SimplePerformanceTracker: vi.fn(function () {
    return {
      startTimer: vi.fn(() => "timer"),
      endTimer: vi.fn(() => 100),
      recordMetric: vi.fn(),
    };
  }),
}));

/**
 * Create mock service with all required methods
 */
function createMockAuthService() {
  return {
    login: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    validateToken: vi.fn(),
    changePassword: vi.fn(),
    getUserSessions: vi.fn(),
    terminateSession: vi.fn(),
    terminateAllSessions: vi.fn(),
    getUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    verifyEmail: vi.fn(),
    getAuthStatistics: vi.fn(),
    getSecurityEvents: vi.fn(),
  };
}

describe("Authentication Routes", () => {
  let app: Hono<{ Bindings: Env }>;
  let mockAuthService: ReturnType<typeof createMockAuthService>;
  let mockAuthMiddleware: AuthMiddleware;
  let mockRequireRole: RequireRoleFactory;
  let mockBlacklistToken: BlacklistTokenFn;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mocks for each test
    mockAuthService = createMockAuthService();

    // Set up default mock implementations with safe defaults
    mockAuthService.login.mockResolvedValue({
      success: false,
      error: "Not configured",
    });
    mockAuthService.register.mockResolvedValue({
      success: false,
      error: "Not configured",
    });
    mockAuthService.refreshToken.mockResolvedValue({
      success: false,
      error: "Not configured",
    });
    mockAuthService.logout.mockResolvedValue(false);
    mockAuthService.validateToken.mockResolvedValue({
      valid: false,
      error: "Not configured",
    });
    mockAuthService.changePassword.mockResolvedValue({
      success: false,
      error: "Not configured",
    });
    mockAuthService.getUserSessions.mockResolvedValue([]);
    mockAuthService.terminateSession.mockResolvedValue(false);
    mockAuthService.terminateAllSessions.mockResolvedValue(false);
    mockAuthService.getUserProfile.mockResolvedValue(null);
    mockAuthService.updateUserProfile.mockResolvedValue(null);
    mockAuthService.requestPasswordReset.mockResolvedValue({
      success: false,
      error: "Not configured",
    });
    mockAuthService.resetPassword.mockResolvedValue({
      success: false,
      error: "Not configured",
    });
    mockAuthService.verifyEmail.mockResolvedValue({
      success: false,
      error: "Not configured",
    });
    mockAuthService.getAuthStatistics.mockResolvedValue({});
    mockAuthService.getSecurityEvents.mockResolvedValue([]);

    // Create mock middleware that sets user in context
    mockAuthMiddleware = vi.fn(
      async (c: Context<{ Bindings: Env }>, next: Next) => {
        c.set("user", mockUser);
        await next();
      },
    ) as unknown as AuthMiddleware;

    // Create mock requireRole factory
    mockRequireRole = vi.fn((roles: number[]) => {
      return async (c: Context<{ Bindings: Env }>, next: Next) => {
        const user = c.get("user");
        if (roles.includes(user?.role)) {
          await next();
        } else {
          return c.json({ success: false, error: "Forbidden" }, 403);
        }
      };
    }) as unknown as RequireRoleFactory;

    // Create mock blacklistToken
    mockBlacklistToken = vi.fn().mockResolvedValue(undefined);

    // Create service factory that returns our mock
    const mockAuthServiceFactory: AuthServiceFactory = () => mockAuthService;

    // Create routes with injected dependencies
    const authRoutes = createAuthRoutes({
      authMiddleware: mockAuthMiddleware,
      requireRole: mockRequireRole,
      blacklistToken: mockBlacklistToken,
      AuthService: mockAuthServiceFactory,
    });

    // Create app and mount routes
    app = new Hono<{ Bindings: Env }>();

    // Inject env into context
    app.use("*", async (c, next) => {
      // @ts-ignore
      c.env = mockEnv;
      await next();
    });

    app.route("/auth", authRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const loginResult = {
        success: true,
        user: {
          id: 1,
          username: "testuser",
          fullName: "Test User",
          role: 2,
          restaurantId: "test-restaurant-1",
          isActive: true,
        },
        tokens: {
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "testpass123",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.token).toBe("test-access-token");
      expect(result.data.user.username).toBe("testuser");
    });

    it("should return 401 for invalid credentials", async () => {
      mockAuthService.login.mockResolvedValue({
        success: false,
        error: "Invalid username or password",
      });

      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "wrongpassword",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid username or password");
    });

    it("should reject invalid username format", async () => {
      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "ab", // Too short
          password: "testpass123",
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);
    });

    it("should reject missing password", async () => {
      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/register (Customer Registration)", () => {
    it("should register a new customer successfully", async () => {
      const registerResult = {
        success: true,
        user: {
          id: 2,
          username: "newcustomer",
          fullName: "New Customer",
          role: 5,
          isActive: true,
        },
        tokens: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };

      mockAuthService.register.mockResolvedValue(registerResult);

      const req = new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "newcustomer",
          fullName: "New Customer",
          email: "customer@example.com",
          password: "CustomerPass123!",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.user.username).toBe("newcustomer");
    });

    it("should return 409 for existing username", async () => {
      mockAuthService.register.mockResolvedValue({
        success: false,
        error: "Username already exists",
      });

      const req = new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "existinguser",
          fullName: "Existing User",
          email: "existing@example.com",
          password: "TestPass123!",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(409);
      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });
  });

  describe("POST /auth/register-staff", () => {
    beforeEach(() => {
      // Mock admin user for staff registration
      mockAuthMiddleware = vi.fn(
        async (c: Context<{ Bindings: Env }>, next: Next) => {
          c.set("user", mockAdminUser);
          await next();
        },
      ) as unknown as AuthMiddleware;

      // Recreate routes with admin user
      const authRoutes = createAuthRoutes({
        authMiddleware: mockAuthMiddleware,
        requireRole: mockRequireRole,
        blacklistToken: mockBlacklistToken,
        AuthService: () => mockAuthService,
      });

      app = new Hono<{ Bindings: Env }>();
      app.use("*", async (c, next) => {
        // @ts-ignore
        c.env = mockEnv;
        await next();
      });
      app.route("/auth", authRoutes);
    });

    it("should register staff successfully by admin", async () => {
      const registerResult = {
        success: true,
        user: {
          id: 3,
          username: "newstaff",
          fullName: "New Staff",
          role: 2,
          restaurantId: "test-restaurant-1",
          isActive: true,
        },
      };

      mockAuthService.register.mockResolvedValue(registerResult);

      const req = new Request("http://localhost/auth/register-staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          username: "newstaff",
          fullName: "New Staff",
          email: "staff@example.com",
          password: "StaffPass123!",
          confirmPassword: "StaffPass123!",
          role: 2,
          restaurantId: "S-20241225-001",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(201);
      expect(result.success).toBe(true);
    });

    it("should reject staff registration by non-admin", async () => {
      // Mock regular user (Chef role = 2)
      mockAuthMiddleware = vi.fn(
        async (c: Context<{ Bindings: Env }>, next: Next) => {
          c.set("user", { ...mockUser, role: 2 });
          await next();
        },
      ) as unknown as AuthMiddleware;

      // Recreate routes with regular user
      const authRoutes = createAuthRoutes({
        authMiddleware: mockAuthMiddleware,
        requireRole: mockRequireRole,
        blacklistToken: mockBlacklistToken,
        AuthService: () => mockAuthService,
      });

      app = new Hono<{ Bindings: Env }>();
      app.use("*", async (c, next) => {
        // @ts-ignore
        c.env = mockEnv;
        await next();
      });
      app.route("/auth", authRoutes);

      const req = new Request("http://localhost/auth/register-staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer user-token",
        },
        body: JSON.stringify({
          username: "newstaff",
          fullName: "New Staff",
          email: "staff@example.com",
          password: "StaffPass123!",
          confirmPassword: "StaffPass123!",
          role: 2,
          restaurantId: "S-20241225-001",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(result.success).toBe(false);
    });
  });

  describe("POST /auth/refresh", () => {
    it("should refresh token successfully", async () => {
      const refreshResult = {
        success: true,
        user: {
          id: 1,
          username: "testuser",
          fullName: "Test User",
          role: 2,
        },
        tokens: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };

      mockAuthService.refreshToken.mockResolvedValue(refreshResult);

      const req = new Request("http://localhost/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-refresh-token": "valid-refresh-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.token).toBe("new-access-token");
    });

    it("should return 401 for invalid refresh token", async () => {
      mockAuthService.refreshToken.mockResolvedValue({
        success: false,
        error: "Invalid refresh token",
      });

      const req = new Request("http://localhost/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-refresh-token": "invalid-refresh-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(401);
      expect(result.success).toBe(false);
    });

    it("should return 400 for missing refresh token", async () => {
      const req = new Request("http://localhost/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const res = await app.request(req);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/logout", () => {
    it("should logout successfully", async () => {
      mockAuthService.logout.mockResolvedValue(true);

      const req = new Request("http://localhost/auth/logout", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe("Logout successful");
    });

    it("should return 500 for logout failure", async () => {
      mockAuthService.logout.mockResolvedValue(false);

      const req = new Request("http://localhost/auth/logout", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(500);
      expect(result.success).toBe(false);
    });
  });

  describe("GET /auth/me", () => {
    it("should return current user info", async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: true,
        user: {
          id: 1,
          username: "testuser",
          fullName: "Test User",
          role: 2,
          restaurantId: "test-restaurant-1",
          isActive: true,
        },
      });

      const req = new Request("http://localhost/auth/me", {
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.username).toBe("testuser");
    });

    it("should return 401 for invalid token", async () => {
      mockAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: "Token expired",
      });

      const req = new Request("http://localhost/auth/me", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(401);
      expect(result.success).toBe(false);
    });
  });

  describe("GET /auth/profile/:id", () => {
    it("should return user profile for own profile", async () => {
      mockAuthService.getUserProfile.mockResolvedValue({
        id: 1,
        username: "testuser",
        fullName: "Test User",
        role: 2,
        isActive: true,
      });

      const req = new Request("http://localhost/auth/profile/1", {
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it("should return 403 for accessing other user profile", async () => {
      const req = new Request("http://localhost/auth/profile/999", {
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(403);
      expect(result.success).toBe(false);
    });

    it("should return 404 for non-existent user", async () => {
      // Create routes with admin user who can access any profile
      mockAuthMiddleware = vi.fn(
        async (c: Context<{ Bindings: Env }>, next: Next) => {
          c.set("user", mockAdminUser);
          await next();
        },
      ) as unknown as AuthMiddleware;

      const authRoutes = createAuthRoutes({
        authMiddleware: mockAuthMiddleware,
        requireRole: mockRequireRole,
        blacklistToken: mockBlacklistToken,
        AuthService: () => mockAuthService,
      });

      app = new Hono<{ Bindings: Env }>();
      app.use("*", async (c, next) => {
        // @ts-ignore
        c.env = mockEnv;
        await next();
      });
      app.route("/auth", authRoutes);

      mockAuthService.getUserProfile.mockResolvedValue(null);

      const req = new Request("http://localhost/auth/profile/999", {
        headers: {
          Authorization: "Bearer admin-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(404);
      expect(result.success).toBe(false);
    });
  });

  describe("PUT /auth/profile/:id", () => {
    it("should update user profile successfully", async () => {
      mockAuthService.updateUserProfile.mockResolvedValue({
        id: 1,
        username: "testuser",
        fullName: "Updated Name",
        role: 2,
        isActive: true,
      });

      const req = new Request("http://localhost/auth/profile/1", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          fullName: "Updated Name",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it("should return 400 for failed update", async () => {
      mockAuthService.updateUserProfile.mockResolvedValue(null);

      const req = new Request("http://localhost/auth/profile/1", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          fullName: "Updated Name",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(400);
      expect(result.success).toBe(false);
    });
  });

  describe("POST /auth/change-password", () => {
    it("should change password successfully", async () => {
      mockAuthService.changePassword.mockResolvedValue({ success: true });

      const req = new Request("http://localhost/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          currentPassword: "OldPass123!",
          newPassword: "NewPass123!",
          confirmPassword: "NewPass123!",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it("should return 400 for incorrect current password", async () => {
      mockAuthService.changePassword.mockResolvedValue({
        success: false,
        error: "Current password is incorrect",
      });

      const req = new Request("http://localhost/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          currentPassword: "WrongPass123!",
          newPassword: "NewPass123!",
          confirmPassword: "NewPass123!",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(400);
      expect(result.success).toBe(false);
    });
  });

  describe("GET /auth/sessions", () => {
    it("should return user sessions", async () => {
      mockAuthService.getUserSessions.mockResolvedValue([
        {
          id: "session-1",
          deviceInfo: { platform: "desktop" },
          lastAccessedAt: new Date(),
          expiresAt: new Date(),
          isCurrent: true,
        },
      ]);

      const req = new Request("http://localhost/auth/sessions", {
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("DELETE /auth/sessions/:sessionId", () => {
    it("should terminate session successfully", async () => {
      mockAuthService.terminateSession.mockResolvedValue(true);

      const req = new Request("http://localhost/auth/sessions/session-1", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it("should return 400 for failed termination", async () => {
      mockAuthService.terminateSession.mockResolvedValue(false);

      const req = new Request("http://localhost/auth/sessions/session-1", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(400);
      expect(result.success).toBe(false);
    });
  });

  describe("DELETE /auth/sessions", () => {
    it("should terminate all sessions successfully", async () => {
      mockAuthService.terminateAllSessions.mockResolvedValue(true);

      const req = new Request("http://localhost/auth/sessions", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("should request password reset successfully", async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({ success: true });

      const req = new Request("http://localhost/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it("should return 400 for failed request", async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({
        success: false,
        error: "User not found",
      });

      const req = new Request("http://localhost/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(400);
      expect(result.success).toBe(false);
    });
  });

  describe("POST /auth/reset-password", () => {
    it("should reset password successfully", async () => {
      mockAuthService.resetPassword.mockResolvedValue({ success: true });

      const req = new Request("http://localhost/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "valid-reset-token",
          newPassword: "NewPass123!",
          confirmPassword: "NewPass123!",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe("POST /auth/verify-email", () => {
    it("should verify email successfully", async () => {
      mockAuthService.verifyEmail.mockResolvedValue({ success: true });

      const req = new Request("http://localhost/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "valid-verification-token",
        }),
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe("GET /auth/stats (Admin only)", () => {
    beforeEach(() => {
      // Create routes with admin user
      mockAuthMiddleware = vi.fn(
        async (c: Context<{ Bindings: Env }>, next: Next) => {
          c.set("user", mockAdminUser);
          await next();
        },
      ) as unknown as AuthMiddleware;

      const authRoutes = createAuthRoutes({
        authMiddleware: mockAuthMiddleware,
        requireRole: mockRequireRole,
        blacklistToken: mockBlacklistToken,
        AuthService: () => mockAuthService,
      });

      app = new Hono<{ Bindings: Env }>();
      app.use("*", async (c, next) => {
        // @ts-ignore
        c.env = mockEnv;
        await next();
      });
      app.route("/auth", authRoutes);
    });

    it("should return auth statistics for admin", async () => {
      mockAuthService.getAuthStatistics.mockResolvedValue({
        totalUsers: 100,
        activeUsers: 80,
        dailyLogins: 50,
        uniqueDevices: 30,
      });

      const req = new Request("http://localhost/auth/stats?timeRange=30d", {
        headers: {
          Authorization: "Bearer admin-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.totalUsers).toBe(100);
    });
  });

  describe("GET /auth/security-events (Admin only)", () => {
    beforeEach(() => {
      // Create routes with admin user
      mockAuthMiddleware = vi.fn(
        async (c: Context<{ Bindings: Env }>, next: Next) => {
          c.set("user", mockAdminUser);
          await next();
        },
      ) as unknown as AuthMiddleware;

      const authRoutes = createAuthRoutes({
        authMiddleware: mockAuthMiddleware,
        requireRole: mockRequireRole,
        blacklistToken: mockBlacklistToken,
        AuthService: () => mockAuthService,
      });

      app = new Hono<{ Bindings: Env }>();
      app.use("*", async (c, next) => {
        // @ts-ignore
        c.env = mockEnv;
        await next();
      });
      app.route("/auth", authRoutes);
    });

    it("should return security events for admin", async () => {
      mockAuthService.getSecurityEvents.mockResolvedValue([
        {
          type: "LOGIN",
          userId: 1,
          timestamp: new Date(),
          severity: "LOW",
        },
      ]);

      const req = new Request("http://localhost/auth/security-events", {
        headers: {
          Authorization: "Bearer admin-token",
        },
      });

      const res = await app.request(req);
      const result = (await res.json()) as any;

      expect(res.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      mockAuthService.login.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const req = new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "testpass123",
        }),
      });

      const res = await app.request(req);
      expect(res.status).toBe(500);
    });
  });
});
