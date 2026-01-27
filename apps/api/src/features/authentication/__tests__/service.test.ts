/**
 * AuthService Extended Tests
 * 認證服務擴展測試 - 提高 services/AuthService.ts 覆蓋率
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Env } from "../../../shared/types";
import { AuthService } from "../services/AuthService";
import type { LoginData, RegisterData, SecurityEvent } from "../types";

// Mock dependencies
vi.mock("../../../core/database");
vi.mock("../../../core/cache");
vi.mock("../../../core/monitoring");
vi.mock("@makanmakan/database");

// Import mocked modules
import * as databaseModule from "../../../core/database";
import * as cacheModule from "../../../core/cache";
import * as monitoringModule from "../../../core/monitoring";
import * as dbModule from "@makanmakan/database";

// Mock implementations
const mockDbAuthService = {
  login: vi.fn(),
  register: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  validateToken: vi.fn(),
  changePassword: vi.fn(),
  getUserSessions: vi.fn(),
};

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockPerformance = {
  startTimer: vi.fn(() => "timer-123"),
  endTimer: vi.fn(() => 100),
  recordMetric: vi.fn(),
};

// Mock environment
const mockEnv: Env = {
  NODE_ENV: "test",
  JWT_SECRET: "test-secret-key-that-is-at-least-32-chars-long",
  API_VERSION: "1.0.0",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
  DB: {} as any,
  CACHE_KV: {} as any,
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: {} as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any,
};

describe("AuthService Extended Tests", () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks (use function for constructors in Vitest 4)
    vi.mocked(databaseModule.getDatabaseConnection).mockReturnValue({} as any);
    vi.mocked(cacheModule.KVCacheService).mockImplementation(function () {
      return mockCache as any;
    });
    vi.mocked(monitoringModule.ConsoleLogger).mockImplementation(function () {
      return mockLogger as any;
    });
    vi.mocked(monitoringModule.SimplePerformanceTracker).mockImplementation(
      function () {
        return mockPerformance as any;
      },
    );
    vi.mocked(dbModule.AuthService).mockImplementation(function () {
      return mockDbAuthService as any;
    });

    authService = new AuthService(mockEnv);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Login Edge Cases", () => {
    it("should handle login with device info", async () => {
      const loginData: LoginData = {
        username: "testuser",
        password: "testpass123",
        deviceInfo: {
          userAgent: "Mozilla/5.0",
          ipAddress: "192.168.1.1",
          platform: "desktop",
          deviceType: "PC",
          browser: "Chrome",
          version: "100.0",
        },
        location: {
          country: "US",
          city: "New York",
          coordinates: { lat: 40.7128, lng: -74.006 },
        },
      };

      const dbResult = {
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

      mockDbAuthService.login.mockResolvedValue(dbResult);
      mockCache.set.mockResolvedValue(undefined);

      const result = await authService.login(loginData);

      expect(result.success).toBe(true);
      expect(mockDbAuthService.login).toHaveBeenCalledWith(loginData);
      // Should log security event with device info
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^security-event:/),
        expect.objectContaining({
          type: "LOGIN",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        }),
        expect.any(Number),
      );
    });

    it("should handle login without device info", async () => {
      const loginData: LoginData = {
        username: "testuser",
        password: "testpass123",
      };

      const dbResult = {
        success: true,
        user: {
          id: 1,
          username: "testuser",
          fullName: "Test User",
          role: 2,
          restaurantId: null,
          isActive: true,
        },
        tokens: {
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };

      mockDbAuthService.login.mockResolvedValue(dbResult);
      mockCache.set.mockResolvedValue(undefined);

      const result = await authService.login(loginData);

      expect(result.success).toBe(true);
      expect(result.user?.restaurantId).toBeUndefined();
    });

    it("should track failed login attempts", async () => {
      const loginData: LoginData = {
        username: "testuser",
        password: "wrongpassword",
        deviceInfo: {
          ipAddress: "192.168.1.100",
        },
      };

      mockDbAuthService.login.mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });
      mockCache.get.mockResolvedValue(2); // Previous failed attempts
      mockCache.set.mockResolvedValue(undefined);

      const result = await authService.login(loginData);

      expect(result.success).toBe(false);
      // Should increment failed login counter
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining("failed-login:testuser"),
        3, // Incremented from 2
        expect.any(Number),
      );
    });

    it("should clear failed login attempts on successful login", async () => {
      const loginData: LoginData = {
        username: "testuser",
        password: "correctpassword",
      };

      const dbResult = {
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

      mockDbAuthService.login.mockResolvedValue(dbResult);
      mockCache.set.mockResolvedValue(undefined);
      mockCache.clear.mockResolvedValue(undefined);

      await authService.login(loginData);

      expect(mockCache.clear).toHaveBeenCalledWith("failed-login:testuser");
    });
  });

  describe("Register Edge Cases", () => {
    it("should register user with all optional fields", async () => {
      const registerData: RegisterData = {
        username: "newuser",
        fullName: "New User",
        email: "new@example.com",
        phone: "+1234567890",
        password: "NewPass123!",
        role: 3,
        restaurantId: "test-restaurant-1",
      };

      const dbResult = {
        success: true,
        user: {
          id: 2,
          username: "newuser",
          fullName: "New User",
          email: "new@example.com",
          role: 3,
          restaurantId: "test-restaurant-1",
          isActive: true,
        },
      };

      mockDbAuthService.register.mockResolvedValue(dbResult);
      mockCache.delete.mockResolvedValue(undefined);

      const result = await authService.register(registerData, 1);

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe("new@example.com");
      expect(result.user?.phone).toBe("+1234567890");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "User registration successful",
        expect.objectContaining({
          createdBy: 1,
        }),
      );
    });

    it("should register user without createdBy", async () => {
      const registerData: RegisterData = {
        username: "selfregister",
        fullName: "Self Register",
        email: "self@example.com",
        password: "SelfPass123!",
        role: 5, // Customer
      };

      const dbResult = {
        success: true,
        user: {
          id: 3,
          username: "selfregister",
          fullName: "Self Register",
          role: 5,
          restaurantId: null,
          isActive: true,
        },
      };

      mockDbAuthService.register.mockResolvedValue(dbResult);
      mockCache.delete.mockResolvedValue(undefined);

      const result = await authService.register(registerData);

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "User registration successful",
        expect.objectContaining({
          createdBy: undefined,
        }),
      );
    });

    it("should handle registration with tokens (auto-login)", async () => {
      const registerData: RegisterData = {
        username: "autologin",
        fullName: "Auto Login User",
        email: "auto@example.com",
        password: "AutoPass123!",
        role: 5,
      };

      const dbResult = {
        success: true,
        user: {
          id: 4,
          username: "autologin",
          fullName: "Auto Login User",
          role: 5,
          restaurantId: null,
          isActive: true,
        },
        tokens: {
          accessToken: "auto-access-token",
          refreshToken: "auto-refresh-token",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };

      mockDbAuthService.register.mockResolvedValue(dbResult);
      mockCache.delete.mockResolvedValue(undefined);

      const result = await authService.register(registerData);

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens?.accessToken).toBe("auto-access-token");
    });

    it("should handle registration error", async () => {
      const registerData: RegisterData = {
        username: "erroruser",
        fullName: "Error User",
        email: "error@example.com",
        password: "ErrorPass123!",
        role: 5,
      };

      mockDbAuthService.register.mockRejectedValue(new Error("Database error"));

      await expect(authService.register(registerData)).rejects.toThrow(
        "Database error",
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Registration failed",
        expect.any(Error),
        { username: "erroruser" },
      );
      expect(mockPerformance.recordMetric).toHaveBeenCalledWith(
        "auth.register.error",
        1,
      );
    });
  });

  describe("Token Refresh Edge Cases", () => {
    it("should handle refresh token with null restaurantId", async () => {
      const dbResult = {
        success: true,
        user: {
          id: 1,
          username: "testuser",
          fullName: "Test User",
          role: 5,
          restaurantId: null,
          isActive: true,
        },
        tokens: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
          expiresAt: new Date(Date.now() + 86400000),
        },
      };

      mockDbAuthService.refreshToken.mockResolvedValue(dbResult);
      mockCache.set.mockResolvedValue(undefined);

      const result = await authService.refreshToken("valid-refresh-token");

      expect(result.success).toBe(true);
      expect(result.user?.restaurantId).toBeUndefined();
    });

    it("should handle refresh token error", async () => {
      mockDbAuthService.refreshToken.mockRejectedValue(
        new Error("Token service unavailable"),
      );

      await expect(authService.refreshToken("some-token")).rejects.toThrow(
        "Token service unavailable",
      );
      expect(mockPerformance.recordMetric).toHaveBeenCalledWith(
        "auth.refreshToken.error",
        1,
      );
    });
  });

  describe("Logout Edge Cases", () => {
    it("should logout with all sessions flag", async () => {
      mockDbAuthService.logout.mockResolvedValue(true);
      mockCache.clear.mockResolvedValue(undefined);

      const result = await authService.logout(1, "token", true);

      expect(result).toBe(true);
      expect(mockCache.clear).toHaveBeenCalledWith("user-session:1");
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^security-event:/),
        expect.objectContaining({
          type: "LOGOUT",
          metadata: { allSessions: true },
        }),
        expect.any(Number),
      );
    });

    it("should logout single session", async () => {
      mockDbAuthService.logout.mockResolvedValue(true);
      mockCache.delete.mockResolvedValue(undefined);

      const result = await authService.logout(1, "specific-token", false);

      expect(result).toBe(true);
      expect(mockCache.delete).toHaveBeenCalledWith("token:specific-token");
    });

    it("should handle logout error gracefully", async () => {
      mockDbAuthService.logout.mockRejectedValue(
        new Error("Logout service error"),
      );

      const result = await authService.logout(1, "token");

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Logout failed",
        expect.any(Error),
        { userId: 1 },
      );
    });
  });

  describe("Token Validation Edge Cases", () => {
    it("should handle validation error gracefully", async () => {
      mockCache.get.mockResolvedValue(null);
      mockDbAuthService.validateToken.mockRejectedValue(
        new Error("Validation service error"),
      );

      const result = await authService.validateToken("error-token");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token validation failed");
      expect(mockPerformance.recordMetric).toHaveBeenCalledWith(
        "auth.validateToken.error",
        1,
      );
    });

    it("should not cache invalid token validation", async () => {
      mockCache.get.mockResolvedValue(null);
      mockDbAuthService.validateToken.mockResolvedValue({
        valid: false,
        error: "Token expired",
      });

      const result = await authService.validateToken("expired-token");

      expect(result.valid).toBe(false);
      // Should not call cache.set for invalid tokens
      expect(mockCache.set).not.toHaveBeenCalledWith(
        expect.stringContaining("token-validation:"),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("User Profile Methods", () => {
    it("should get user profile from cache", async () => {
      const cachedProfile = {
        id: 1,
        username: "cacheduser",
        fullName: "Cached User",
        role: 2,
        isActive: true,
        sessions: [],
      };

      mockCache.get.mockResolvedValue(cachedProfile);

      const result = await authService.getUserProfile(1);

      expect(result).toEqual(cachedProfile);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "User profile retrieved from cache",
        { userId: 1 },
      );
    });

    it("should handle getUserProfile error", async () => {
      mockCache.get.mockRejectedValue(new Error("Cache error"));

      const result = await authService.getUserProfile(1);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to get user profile",
        expect.any(Error),
        { userId: 1 },
      );
    });

    it("should update user profile and clear cache", async () => {
      mockCache.delete.mockResolvedValue(undefined);

      const result = await authService.updateUserProfile(1, {
        fullName: "Updated Name",
      });

      expect(result).toBeNull(); // Not fully implemented
      expect(mockCache.delete).toHaveBeenCalledWith("user-profile:1");
      expect(mockCache.delete).toHaveBeenCalledWith("user:1");
    });
  });

  describe("Password Change Edge Cases", () => {
    it("should handle password change error", async () => {
      mockDbAuthService.changePassword.mockRejectedValue(
        new Error("Password service error"),
      );

      const result = await authService.changePassword(1, "old", "new");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to change password");
      expect(mockPerformance.recordMetric).toHaveBeenCalledWith(
        "auth.changePassword.error",
        1,
      );
    });
  });

  describe("Session Management", () => {
    it("should transform session data correctly", async () => {
      const mockSessions = [
        {
          id: "session-1",
          deviceInfo: { platform: "desktop", browser: "Chrome" },
          location: { country: "US" },
          lastAccessedAt: "2024-01-01T00:00:00Z",
          expiresAt: "2024-01-02T00:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "session-2",
          deviceInfo: { platform: "mobile" },
          location: null,
          lastAccessedAt: null,
          expiresAt: "2024-01-02T00:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      mockDbAuthService.getUserSessions.mockResolvedValue(mockSessions);

      const result = await authService.getUserSessions(1);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("session-1");
      expect(result[0].isCurrent).toBe(false);
      expect(result[1].lastAccessedAt).toBeUndefined();
    });

    it("should terminate session (placeholder)", async () => {
      const result = await authService.terminateSession(1, "session-1");

      expect(result).toBe(false); // Not fully implemented
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "terminateSession not fully implemented",
        { userId: 1, sessionId: "session-1" },
      );
    });

    it("should terminate all sessions", async () => {
      mockDbAuthService.logout.mockResolvedValue(true);
      mockCache.clear.mockResolvedValue(undefined);

      const result = await authService.terminateAllSessions(1);

      expect(result).toBe(true);
      expect(mockPerformance.recordMetric).toHaveBeenCalledWith(
        "auth.terminateAllSessions.success",
        1,
      );
    });

    it("should handle terminateAllSessions error", async () => {
      // When logout returns false (due to internal error handling), terminateAllSessions returns false
      mockDbAuthService.logout.mockRejectedValue(new Error("Session error"));

      const result = await authService.terminateAllSessions(1);

      expect(result).toBe(false);
      // The logout method catches the error and returns false, so terminateAllSessions
      // records success metric (since it completed without throwing)
      expect(mockPerformance.recordMetric).toHaveBeenCalledWith(
        "auth.terminateAllSessions.success",
        1,
      );
    });
  });

  describe("Two-Factor Authentication (Placeholders)", () => {
    it("should throw for setupTwoFactor", async () => {
      await expect(authService.setupTwoFactor(1, "password")).rejects.toThrow(
        "Two-factor authentication not yet implemented",
      );
    });

    it("should return error for verifyTwoFactor", async () => {
      const result = await authService.verifyTwoFactor(1, "123456");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not yet implemented");
    });

    it("should return error for disableTwoFactor", async () => {
      const result = await authService.disableTwoFactor(1, "password");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not yet implemented");
    });

    it("should throw for generateBackupCodes", async () => {
      await expect(authService.generateBackupCodes(1)).rejects.toThrow(
        "Two-factor authentication not yet implemented",
      );
    });
  });

  describe("Password Reset (Placeholders)", () => {
    it("should return error for requestPasswordReset", async () => {
      const result = await authService.requestPasswordReset("test@example.com");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not yet implemented");
    });

    it("should return error for resetPassword", async () => {
      const result = await authService.resetPassword("token", "newpassword");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not yet implemented");
    });
  });

  describe("Email Verification (Placeholders)", () => {
    it("should return error for requestEmailVerification", async () => {
      const result = await authService.requestEmailVerification(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not yet implemented");
    });

    it("should return error for verifyEmail", async () => {
      const result = await authService.verifyEmail("token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not yet implemented");
    });
  });

  describe("Security and Monitoring", () => {
    it("should log security event successfully", async () => {
      mockCache.set.mockResolvedValue(undefined);

      await authService.logSecurityEvent({
        type: "LOGIN",
        userId: 1,
        username: "testuser",
        ipAddress: "192.168.1.1",
        severity: "LOW",
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^security-event:/),
        expect.objectContaining({
          type: "LOGIN",
          userId: 1,
          timestamp: expect.any(Date),
        }),
        expect.any(Number),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Security event logged",
        expect.objectContaining({
          type: "LOGIN",
          userId: 1,
          severity: "LOW",
        }),
      );
    });

    it("should handle security event logging error", async () => {
      mockCache.set.mockRejectedValue(new Error("Cache error"));

      await authService.logSecurityEvent({
        type: "LOGIN_FAILED",
        username: "testuser",
        severity: "MEDIUM",
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to log security event",
        expect.any(Error),
        expect.objectContaining({ event: expect.any(Object) }),
      );
    });

    it("should return empty array for getSecurityEvents", async () => {
      const result = await authService.getSecurityEvents(1, 50);

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "getSecurityEvents not fully implemented",
        { userId: 1, limit: 50 },
      );
    });

    it("should return default account security", async () => {
      const result = await authService.checkAccountSecurity(1);

      expect(result).toEqual({
        failedLoginAttempts: 0,
        passwordStrength: "MEDIUM",
        suspiciousActivity: false,
      });
    });

    it("should return default auth statistics", async () => {
      const result = await authService.getAuthStatistics("30d");

      expect(result).toEqual({
        totalUsers: 0,
        activeUsers: 0,
        dailyLogins: 0,
        uniqueDevices: 0,
        topCountries: [],
        platformDistribution: {},
        twoFactorAdoptionRate: 0,
        recentSecurityEvents: [],
      });
    });
  });

  describe("Private Helper Methods (via public methods)", () => {
    it("should handle cache session error gracefully", async () => {
      const loginData: LoginData = {
        username: "testuser",
        password: "testpass123",
      };

      const dbResult = {
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

      mockDbAuthService.login.mockResolvedValue(dbResult);
      // First call for session caching fails
      mockCache.set.mockRejectedValueOnce(new Error("Cache error"));
      // Subsequent calls succeed
      mockCache.set.mockResolvedValue(undefined);

      const result = await authService.login(loginData);

      // Should still succeed despite cache error
      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to cache user session",
        expect.any(Error),
        { userId: 1 },
      );
    });

    it("should handle clear failed login attempts error", async () => {
      const loginData: LoginData = {
        username: "testuser",
        password: "testpass123",
      };

      const dbResult = {
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

      mockDbAuthService.login.mockResolvedValue(dbResult);
      mockCache.set.mockResolvedValue(undefined);
      mockCache.clear.mockRejectedValue(new Error("Clear error"));

      const result = await authService.login(loginData);

      // Should still succeed despite clear error
      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to clear failed login attempts",
        expect.any(Error),
      );
    });
  });
});
