/**
 * Authentication Validation Schemas Tests
 * 認證模組驗證模式測試
 *
 * 測試覆蓋範圍：
 * - 登入驗證 (loginSchema)
 * - 註冊驗證 (registerSchema, customerRegisterSchema)
 * - 密碼管理 (changePassword, forgotPassword, resetPassword)
 * - 雙因素認證 (twoFactorSetup, twoFactorVerify)
 * - 個人資料更新 (updateProfile)
 * - 會話管理 (terminateSession, terminateAllSessions)
 * - 查詢參數驗證 (authStatsQuery, securityEventsQuery)
 * - 安全事件驗證 (securityEvent)
 * - 批量操作驗證 (bulkUserAction)
 */

import { describe, it, expect } from "vitest";
import { authSchemas } from "../schemas/validation";

describe("Authentication Validation Schemas", () => {
  // ==========================================
  // Login Schema Tests (10 tests)
  // ==========================================
  describe("loginSchema", () => {
    const validLogin = {
      username: "testuser",
      password: "Password123!",
    };

    it("should validate valid login data", () => {
      const result = authSchemas.login.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it("should accept login with rememberMe option", () => {
      const result = authSchemas.login.safeParse({
        ...validLogin,
        rememberMe: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject username shorter than 3 characters", () => {
      const result = authSchemas.login.safeParse({
        ...validLogin,
        username: "ab",
      });
      expect(result.success).toBe(false);
    });

    it("should reject username longer than 50 characters", () => {
      const result = authSchemas.login.safeParse({
        ...validLogin,
        username: "a".repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it("should reject username with invalid characters", () => {
      const result = authSchemas.login.safeParse({
        ...validLogin,
        username: "test@user!",
      });
      expect(result.success).toBe(false);
    });

    it("should accept username with hyphens and underscores", () => {
      const result = authSchemas.login.safeParse({
        ...validLogin,
        username: "test-user_123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty password", () => {
      const result = authSchemas.login.safeParse({
        ...validLogin,
        password: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password longer than 100 characters", () => {
      const result = authSchemas.login.safeParse({
        ...validLogin,
        password: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing username", () => {
      const result = authSchemas.login.safeParse({
        password: "Password123!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing password", () => {
      const result = authSchemas.login.safeParse({
        username: "testuser",
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Register Schema Tests (15 tests)
  // ==========================================
  describe("registerSchema", () => {
    const validRegister = {
      username: "newuser",
      fullName: "John Doe",
      email: "john@example.com",
      password: "Password123!",
      confirmPassword: "Password123!",
      role: 1,
    };

    it("should validate valid registration data", () => {
      const result = authSchemas.register.safeParse(validRegister);
      expect(result.success).toBe(true);
    });

    it("should accept registration with phone instead of email", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        email: undefined,
        phone: "+1234567890",
      });
      expect(result.success).toBe(true);
    });

    it("should accept registration with both email and phone", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        phone: "+1234567890",
      });
      expect(result.success).toBe(true);
    });

    it("should reject registration without email or phone", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        email: undefined,
      });
      expect(result.success).toBe(false);
    });

    it("should reject mismatched passwords", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        confirmPassword: "DifferentPassword123!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password without uppercase", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        password: "password123!",
        confirmPassword: "password123!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password without lowercase", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        password: "PASSWORD123!",
        confirmPassword: "PASSWORD123!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password without number", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        password: "Password!!!",
        confirmPassword: "Password!!!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password without special character", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        password: "Password123",
        confirmPassword: "Password123",
      });
      expect(result.success).toBe(false);
    });

    it("should accept all valid roles (0-5)", () => {
      const roles = [0, 1, 2, 3, 4, 5];
      roles.forEach((role) => {
        const result = authSchemas.register.safeParse({
          ...validRegister,
          role,
        });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid role", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        role: 6,
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty full name", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        fullName: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject full name exceeding max length", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        fullName: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional restaurantId", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        restaurantId: 1,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format", () => {
      const result = authSchemas.register.safeParse({
        ...validRegister,
        email: "invalid-email",
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Customer Register Schema Tests (8 tests)
  // ==========================================
  describe("customerRegisterSchema", () => {
    const validCustomerRegister = {
      username: "customer1",
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "Simple123",
    };

    it("should validate valid customer registration", () => {
      const result = authSchemas.customerRegister.safeParse(
        validCustomerRegister,
      );
      expect(result.success).toBe(true);
    });

    it("should accept customer registration with phone", () => {
      const result = authSchemas.customerRegister.safeParse({
        ...validCustomerRegister,
        email: undefined,
        phone: "+1234567890",
      });
      expect(result.success).toBe(true);
    });

    it("should accept only role 5 (customer)", () => {
      const result = authSchemas.customerRegister.safeParse({
        ...validCustomerRegister,
        role: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should reject password shorter than minimum length", () => {
      const result = authSchemas.customerRegister.safeParse({
        ...validCustomerRegister,
        password: "12345", // Less than 6 characters
      });
      expect(result.success).toBe(false);
    });

    it("should reject username with special characters", () => {
      const result = authSchemas.customerRegister.safeParse({
        ...validCustomerRegister,
        username: "cust@mer!",
      });
      expect(result.success).toBe(false);
    });

    it("should accept simple password (no strength check for customer)", () => {
      const result = authSchemas.customerRegister.safeParse({
        ...validCustomerRegister,
        password: "simple123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty fullName", () => {
      const result = authSchemas.customerRegister.safeParse({
        ...validCustomerRegister,
        fullName: "",
      });
      expect(result.success).toBe(false);
    });

    it("should trim whitespace from fullName", () => {
      const result = authSchemas.customerRegister.safeParse({
        ...validCustomerRegister,
        fullName: "  Jane Doe  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe("Jane Doe");
      }
    });
  });

  // ==========================================
  // Refresh Token Schema Tests (4 tests)
  // ==========================================
  describe("refreshTokenSchema", () => {
    it("should validate valid refresh token", () => {
      const result = authSchemas.refreshToken.safeParse({
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty refresh token", () => {
      const result = authSchemas.refreshToken.safeParse({
        refreshToken: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject refresh token exceeding max length", () => {
      const result = authSchemas.refreshToken.safeParse({
        refreshToken: "a".repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing refresh token", () => {
      const result = authSchemas.refreshToken.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Change Password Schema Tests (8 tests)
  // ==========================================
  describe("changePasswordSchema", () => {
    const validChangePassword = {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmPassword: "NewPassword456!",
    };

    it("should validate valid password change", () => {
      const result = authSchemas.changePassword.safeParse(validChangePassword);
      expect(result.success).toBe(true);
    });

    it("should reject when passwords do not match", () => {
      const result = authSchemas.changePassword.safeParse({
        ...validChangePassword,
        confirmPassword: "DifferentPassword!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject when new password equals current password", () => {
      const result = authSchemas.changePassword.safeParse({
        currentPassword: "SamePassword123!",
        newPassword: "SamePassword123!",
        confirmPassword: "SamePassword123!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty current password", () => {
      const result = authSchemas.changePassword.safeParse({
        ...validChangePassword,
        currentPassword: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject weak new password", () => {
      const result = authSchemas.changePassword.safeParse({
        ...validChangePassword,
        newPassword: "weak",
        confirmPassword: "weak",
      });
      expect(result.success).toBe(false);
    });

    it("should reject new password without special character", () => {
      const result = authSchemas.changePassword.safeParse({
        ...validChangePassword,
        newPassword: "NewPassword456",
        confirmPassword: "NewPassword456",
      });
      expect(result.success).toBe(false);
    });

    it("should reject current password exceeding max length", () => {
      const result = authSchemas.changePassword.safeParse({
        ...validChangePassword,
        currentPassword: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty confirm password", () => {
      const result = authSchemas.changePassword.safeParse({
        ...validChangePassword,
        confirmPassword: "",
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Forgot Password Schema Tests (5 tests)
  // ==========================================
  describe("forgotPasswordSchema", () => {
    it("should validate with email", () => {
      const result = authSchemas.forgotPassword.safeParse({
        email: "user@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should validate with username", () => {
      const result = authSchemas.forgotPassword.safeParse({
        username: "testuser",
      });
      expect(result.success).toBe(true);
    });

    it("should validate with both email and username", () => {
      const result = authSchemas.forgotPassword.safeParse({
        email: "user@example.com",
        username: "testuser",
      });
      expect(result.success).toBe(true);
    });

    it("should reject when neither email nor username provided", () => {
      const result = authSchemas.forgotPassword.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject invalid email format", () => {
      const result = authSchemas.forgotPassword.safeParse({
        email: "invalid-email",
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Reset Password Schema Tests (6 tests)
  // ==========================================
  describe("resetPasswordSchema", () => {
    const validResetPassword = {
      token: "reset-token-abc123",
      newPassword: "NewSecure123!",
      confirmPassword: "NewSecure123!",
    };

    it("should validate valid reset password request", () => {
      const result = authSchemas.resetPassword.safeParse(validResetPassword);
      expect(result.success).toBe(true);
    });

    it("should reject empty token", () => {
      const result = authSchemas.resetPassword.safeParse({
        ...validResetPassword,
        token: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject token exceeding max length", () => {
      const result = authSchemas.resetPassword.safeParse({
        ...validResetPassword,
        token: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should reject mismatched passwords", () => {
      const result = authSchemas.resetPassword.safeParse({
        ...validResetPassword,
        confirmPassword: "DifferentPassword!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject weak password", () => {
      const result = authSchemas.resetPassword.safeParse({
        ...validResetPassword,
        newPassword: "weak",
        confirmPassword: "weak",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing confirm password", () => {
      const result = authSchemas.resetPassword.safeParse({
        token: "reset-token",
        newPassword: "NewSecure123!",
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Verify Email Schema Tests (4 tests)
  // ==========================================
  describe("verifyEmailSchema", () => {
    it("should validate valid verification token", () => {
      const result = authSchemas.verifyEmail.safeParse({
        token: "verification-token-xyz",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty token", () => {
      const result = authSchemas.verifyEmail.safeParse({
        token: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject token exceeding max length", () => {
      const result = authSchemas.verifyEmail.safeParse({
        token: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing token", () => {
      const result = authSchemas.verifyEmail.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Two-Factor Authentication Schema Tests (10 tests)
  // ==========================================
  describe("twoFactorSetupSchema", () => {
    it("should validate valid 2FA setup request", () => {
      const result = authSchemas.twoFactorSetup.safeParse({
        password: "UserPassword123!",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty password", () => {
      const result = authSchemas.twoFactorSetup.safeParse({
        password: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password exceeding max length", () => {
      const result = authSchemas.twoFactorSetup.safeParse({
        password: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("twoFactorVerifySchema", () => {
    it("should validate with 6-digit token", () => {
      const result = authSchemas.twoFactorVerify.safeParse({
        token: "123456",
      });
      expect(result.success).toBe(true);
    });

    it("should validate with 8-character backup code", () => {
      const result = authSchemas.twoFactorVerify.safeParse({
        backupCode: "ABCD1234",
      });
      expect(result.success).toBe(true);
    });

    it("should reject token that is not 6 digits", () => {
      const result = authSchemas.twoFactorVerify.safeParse({
        token: "12345", // Only 5 digits
      });
      expect(result.success).toBe(false);
    });

    it("should reject backup code that is not 8 characters", () => {
      const result = authSchemas.twoFactorVerify.safeParse({
        backupCode: "ABC123", // Only 6 characters
      });
      expect(result.success).toBe(false);
    });

    it("should reject lowercase backup code", () => {
      const result = authSchemas.twoFactorVerify.safeParse({
        backupCode: "abcd1234",
      });
      expect(result.success).toBe(false);
    });

    it("should reject when neither token nor backup code provided", () => {
      const result = authSchemas.twoFactorVerify.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should accept both token and backup code", () => {
      const result = authSchemas.twoFactorVerify.safeParse({
        token: "123456",
        backupCode: "ABCD1234",
      });
      expect(result.success).toBe(true);
    });
  });

  // ==========================================
  // Update Profile Schema Tests (6 tests)
  // ==========================================
  describe("updateProfileSchema", () => {
    it("should validate with fullName update", () => {
      const result = authSchemas.updateProfile.safeParse({
        fullName: "Updated Name",
      });
      expect(result.success).toBe(true);
    });

    it("should validate with email update", () => {
      const result = authSchemas.updateProfile.safeParse({
        email: "new@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should validate with phone update", () => {
      const result = authSchemas.updateProfile.safeParse({
        phone: "+1987654321",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty object (no fields to update)", () => {
      const result = authSchemas.updateProfile.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject invalid email format", () => {
      const result = authSchemas.updateProfile.safeParse({
        email: "invalid-email",
      });
      expect(result.success).toBe(false);
    });

    it("should reject fullName exceeding max length", () => {
      const result = authSchemas.updateProfile.safeParse({
        fullName: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Session Management Schema Tests (6 tests)
  // ==========================================
  describe("terminateSessionSchema", () => {
    it("should validate valid session termination", () => {
      const result = authSchemas.terminateSession.safeParse({
        sessionId: "session-abc-123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty session ID", () => {
      const result = authSchemas.terminateSession.safeParse({
        sessionId: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject session ID exceeding max length", () => {
      const result = authSchemas.terminateSession.safeParse({
        sessionId: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("terminateAllSessionsSchema", () => {
    it("should validate without except parameter", () => {
      const result = authSchemas.terminateAllSessions.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should validate with except parameter", () => {
      const result = authSchemas.terminateAllSessions.safeParse({
        except: "current-session-id",
      });
      expect(result.success).toBe(true);
    });

    it("should reject except exceeding max length", () => {
      const result = authSchemas.terminateAllSessions.safeParse({
        except: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Query Parameter Schema Tests (12 tests)
  // ==========================================
  describe("authStatsQuerySchema", () => {
    it("should validate empty query with defaults", () => {
      const result = authSchemas.authStatsQuery.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeRange).toBe("30d");
      }
    });

    it("should validate all time range values", () => {
      const timeRanges = ["24h", "7d", "30d", "90d", "1y"] as const;
      timeRanges.forEach((timeRange) => {
        const result = authSchemas.authStatsQuery.safeParse({ timeRange });
        expect(result.success).toBe(true);
      });
    });

    it("should transform restaurantId string to number", () => {
      const result = authSchemas.authStatsQuery.safeParse({
        restaurantId: "123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.restaurantId).toBe(123);
      }
    });

    it("should reject invalid restaurantId", () => {
      const result = authSchemas.authStatsQuery.safeParse({
        restaurantId: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("securityEventsQuerySchema", () => {
    it("should validate empty query", () => {
      const result = authSchemas.securityEventsQuery.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should transform page and limit to numbers", () => {
      const result = authSchemas.securityEventsQuery.safeParse({
        page: "2",
        limit: "50",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
      }
    });

    it("should reject limit exceeding 100", () => {
      const result = authSchemas.securityEventsQuery.safeParse({
        limit: "101",
      });
      expect(result.success).toBe(false);
    });

    it("should validate all severity levels", () => {
      const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
      severities.forEach((severity) => {
        const result = authSchemas.securityEventsQuery.safeParse({ severity });
        expect(result.success).toBe(true);
      });
    });

    it("should validate all event types", () => {
      const types = [
        "LOGIN",
        "LOGIN_FAILED",
        "LOGOUT",
        "PASSWORD_CHANGED",
        "TWO_FACTOR_ENABLED",
        "TWO_FACTOR_DISABLED",
        "ACCOUNT_LOCKED",
        "PASSWORD_RESET_REQUESTED",
        "PASSWORD_RESET_COMPLETED",
        "EMAIL_VERIFIED",
      ] as const;
      types.forEach((type) => {
        const result = authSchemas.securityEventsQuery.safeParse({ type });
        expect(result.success).toBe(true);
      });
    });

    it("should validate date range", () => {
      const result = authSchemas.securityEventsQuery.safeParse({
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-12-31T23:59:59Z",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid date format", () => {
      const result = authSchemas.securityEventsQuery.safeParse({
        startDate: "invalid-date",
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative page number", () => {
      const result = authSchemas.securityEventsQuery.safeParse({
        page: "-1",
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Parameter Schema Tests (6 tests)
  // ==========================================
  describe("userIdParamSchema", () => {
    it("should transform id string to number", () => {
      const result = authSchemas.userIdParam.safeParse({ id: "42" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });

    it("should reject non-numeric id", () => {
      const result = authSchemas.userIdParam.safeParse({ id: "abc" });
      expect(result.success).toBe(false);
    });

    it("should reject zero id", () => {
      const result = authSchemas.userIdParam.safeParse({ id: "0" });
      expect(result.success).toBe(false);
    });

    it("should reject negative id", () => {
      const result = authSchemas.userIdParam.safeParse({ id: "-1" });
      expect(result.success).toBe(false);
    });
  });

  describe("sessionIdParamSchema", () => {
    it("should validate valid session ID", () => {
      const result = authSchemas.sessionIdParam.safeParse({
        sessionId: "sess-123-abc",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty session ID", () => {
      const result = authSchemas.sessionIdParam.safeParse({
        sessionId: "",
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Header Schema Tests (6 tests)
  // ==========================================
  describe("authHeaderSchema", () => {
    it("should validate valid Bearer token", () => {
      const result = authSchemas.authHeader.safeParse({
        authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.test",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty authorization header", () => {
      const result = authSchemas.authHeader.safeParse({
        authorization: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject authorization without Bearer prefix", () => {
      const result = authSchemas.authHeader.safeParse({
        authorization: "eyJhbGciOiJIUzI1NiJ9.test",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("refreshTokenHeaderSchema", () => {
    it("should validate valid refresh token header", () => {
      const result = authSchemas.refreshTokenHeader.safeParse({
        "x-refresh-token": "refresh-token-abc123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty refresh token header", () => {
      const result = authSchemas.refreshTokenHeader.safeParse({
        "x-refresh-token": "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject refresh token header exceeding max length", () => {
      const result = authSchemas.refreshTokenHeader.safeParse({
        "x-refresh-token": "a".repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Security Event Schema Tests (8 tests)
  // ==========================================
  describe("securityEventSchema", () => {
    const validSecurityEvent = {
      type: "LOGIN" as const,
      severity: "LOW" as const,
    };

    it("should validate valid security event", () => {
      const result = authSchemas.securityEvent.safeParse(validSecurityEvent);
      expect(result.success).toBe(true);
    });

    it("should validate all event types", () => {
      const types = [
        "LOGIN",
        "LOGIN_FAILED",
        "LOGOUT",
        "PASSWORD_CHANGED",
        "TWO_FACTOR_ENABLED",
        "TWO_FACTOR_DISABLED",
        "ACCOUNT_LOCKED",
        "PASSWORD_RESET_REQUESTED",
        "PASSWORD_RESET_COMPLETED",
        "EMAIL_VERIFIED",
      ] as const;
      types.forEach((type) => {
        const result = authSchemas.securityEvent.safeParse({
          ...validSecurityEvent,
          type,
        });
        expect(result.success).toBe(true);
      });
    });

    it("should validate all severity levels", () => {
      const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
      severities.forEach((severity) => {
        const result = authSchemas.securityEvent.safeParse({
          ...validSecurityEvent,
          severity,
        });
        expect(result.success).toBe(true);
      });
    });

    it("should accept optional fields", () => {
      const result = authSchemas.securityEvent.safeParse({
        ...validSecurityEvent,
        userId: 123,
        username: "testuser",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        metadata: { action: "successful" },
      });
      expect(result.success).toBe(true);
    });

    it("should validate IP address format", () => {
      const result = authSchemas.securityEvent.safeParse({
        ...validSecurityEvent,
        ipAddress: "192.168.1.1",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid IP address", () => {
      const result = authSchemas.securityEvent.safeParse({
        ...validSecurityEvent,
        ipAddress: "not-an-ip",
      });
      expect(result.success).toBe(false);
    });

    it("should reject userAgent exceeding max length", () => {
      const result = authSchemas.securityEvent.safeParse({
        ...validSecurityEvent,
        userAgent: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should accept location info", () => {
      const result = authSchemas.securityEvent.safeParse({
        ...validSecurityEvent,
        location: {
          country: "Taiwan",
          city: "Taipei",
          coordinates: { lat: 25.033, lng: 121.5654 },
        },
      });
      expect(result.success).toBe(true);
    });
  });

  // ==========================================
  // Bulk User Action Schema Tests (6 tests)
  // ==========================================
  describe("bulkUserActionSchema", () => {
    const validBulkAction = {
      userIds: [1, 2, 3],
      action: "activate" as const,
      reason: "Batch activation for new employees",
    };

    it("should validate valid bulk action", () => {
      const result = authSchemas.bulkUserAction.safeParse(validBulkAction);
      expect(result.success).toBe(true);
    });

    it("should validate all action types", () => {
      const actions = ["activate", "deactivate", "lock", "unlock"] as const;
      actions.forEach((action) => {
        const result = authSchemas.bulkUserAction.safeParse({
          ...validBulkAction,
          action,
        });
        expect(result.success).toBe(true);
      });
    });

    it("should reject empty userIds array", () => {
      const result = authSchemas.bulkUserAction.safeParse({
        ...validBulkAction,
        userIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject userIds exceeding 100", () => {
      const result = authSchemas.bulkUserAction.safeParse({
        ...validBulkAction,
        userIds: Array(101)
          .fill(1)
          .map((_, i) => i + 1),
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty reason", () => {
      const result = authSchemas.bulkUserAction.safeParse({
        ...validBulkAction,
        reason: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject reason exceeding max length", () => {
      const result = authSchemas.bulkUserAction.safeParse({
        ...validBulkAction,
        reason: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Rate Limit Schema Tests (4 tests)
  // ==========================================
  describe("rateLimitSchema", () => {
    const validRateLimit = {
      ip: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      endpoint: "/api/v1/auth/login",
      method: "POST",
    };

    it("should validate valid rate limit data", () => {
      const result = authSchemas.rateLimit.safeParse(validRateLimit);
      expect(result.success).toBe(true);
    });

    it("should reject invalid IP address", () => {
      const result = authSchemas.rateLimit.safeParse({
        ...validRateLimit,
        ip: "invalid-ip",
      });
      expect(result.success).toBe(false);
    });

    it("should reject userAgent exceeding max length", () => {
      const result = authSchemas.rateLimit.safeParse({
        ...validRateLimit,
        userAgent: "a".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should reject method exceeding max length", () => {
      const result = authSchemas.rateLimit.safeParse({
        ...validRateLimit,
        method: "a".repeat(11),
      });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Component Schema Tests (10 tests)
  // ==========================================
  describe("Component Schemas", () => {
    describe("usernameSchema", () => {
      it("should accept valid username", () => {
        const result = authSchemas.username.safeParse("valid_user-123");
        expect(result.success).toBe(true);
      });

      it("should reject username with spaces", () => {
        const result = authSchemas.username.safeParse("invalid user");
        expect(result.success).toBe(false);
      });
    });

    describe("emailSchema", () => {
      it("should accept valid email", () => {
        const result = authSchemas.email.safeParse("test@example.com");
        expect(result.success).toBe(true);
      });

      it("should reject email exceeding max length", () => {
        const result = authSchemas.email.safeParse(
          "a".repeat(250) + "@test.com",
        );
        expect(result.success).toBe(false);
      });
    });

    describe("phoneSchema", () => {
      it("should accept valid phone numbers", () => {
        const phones = ["+1234567890", "(02) 1234-5678", "+886-912-345-678"];
        phones.forEach((phone) => {
          const result = authSchemas.phone.safeParse(phone);
          expect(result.success).toBe(true);
        });
      });

      it("should reject invalid phone format", () => {
        const result = authSchemas.phone.safeParse("invalid-phone!");
        expect(result.success).toBe(false);
      });

      it("should reject phone shorter than 8 characters", () => {
        const result = authSchemas.phone.safeParse("1234567");
        expect(result.success).toBe(false);
      });
    });

    describe("roleSchema", () => {
      it("should accept all valid roles", () => {
        const roles = [0, 1, 2, 3, 4, 5];
        roles.forEach((role) => {
          const result = authSchemas.role.safeParse(role);
          expect(result.success).toBe(true);
        });
      });

      it("should reject role outside range", () => {
        expect(authSchemas.role.safeParse(-1).success).toBe(false);
        expect(authSchemas.role.safeParse(6).success).toBe(false);
      });

      it("should reject non-integer role", () => {
        const result = authSchemas.role.safeParse(1.5);
        expect(result.success).toBe(false);
      });
    });
  });

  // ==========================================
  // Device Info Schema Tests (4 tests)
  // ==========================================
  describe("deviceInfoSchema", () => {
    it("should accept empty device info", () => {
      const result = authSchemas.deviceInfo.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept full device info", () => {
      const result = authSchemas.deviceInfo.safeParse({
        userAgent: "Mozilla/5.0",
        ipAddress: "192.168.1.1",
        platform: "desktop",
        deviceType: "PC",
        browser: "Chrome",
        version: "120.0.0",
      });
      expect(result.success).toBe(true);
    });

    it("should validate all platform types", () => {
      const platforms = ["mobile", "desktop", "tablet"] as const;
      platforms.forEach((platform) => {
        const result = authSchemas.deviceInfo.safeParse({ platform });
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid platform", () => {
      const result = authSchemas.deviceInfo.safeParse({ platform: "invalid" });
      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // Location Info Schema Tests (4 tests)
  // ==========================================
  describe("locationInfoSchema", () => {
    it("should accept empty location info", () => {
      const result = authSchemas.locationInfo.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept full location info", () => {
      const result = authSchemas.locationInfo.safeParse({
        country: "Taiwan",
        city: "Taipei",
        coordinates: { lat: 25.033, lng: 121.5654 },
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid latitude", () => {
      const result = authSchemas.locationInfo.safeParse({
        coordinates: { lat: 100, lng: 0 }, // lat > 90
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid longitude", () => {
      const result = authSchemas.locationInfo.safeParse({
        coordinates: { lat: 0, lng: 200 }, // lng > 180
      });
      expect(result.success).toBe(false);
    });
  });
});

// ==========================================
// Export Type Tests
// ==========================================
describe("Type Exports", () => {
  it("should have authSchemas with all expected schemas", () => {
    expect(authSchemas.login).toBeDefined();
    expect(authSchemas.register).toBeDefined();
    expect(authSchemas.customerRegister).toBeDefined();
    expect(authSchemas.refreshToken).toBeDefined();
    expect(authSchemas.changePassword).toBeDefined();
    expect(authSchemas.forgotPassword).toBeDefined();
    expect(authSchemas.resetPassword).toBeDefined();
    expect(authSchemas.verifyEmail).toBeDefined();
    expect(authSchemas.twoFactorSetup).toBeDefined();
    expect(authSchemas.twoFactorVerify).toBeDefined();
    expect(authSchemas.updateProfile).toBeDefined();
    expect(authSchemas.terminateSession).toBeDefined();
    expect(authSchemas.terminateAllSessions).toBeDefined();
    expect(authSchemas.authStatsQuery).toBeDefined();
    expect(authSchemas.securityEventsQuery).toBeDefined();
    expect(authSchemas.userIdParam).toBeDefined();
    expect(authSchemas.sessionIdParam).toBeDefined();
    expect(authSchemas.authHeader).toBeDefined();
    expect(authSchemas.refreshTokenHeader).toBeDefined();
    expect(authSchemas.securityEvent).toBeDefined();
    expect(authSchemas.rateLimit).toBeDefined();
    expect(authSchemas.bulkUserAction).toBeDefined();
  });

  it("should have component schemas", () => {
    expect(authSchemas.deviceInfo).toBeDefined();
    expect(authSchemas.locationInfo).toBeDefined();
    expect(authSchemas.password).toBeDefined();
    expect(authSchemas.username).toBeDefined();
    expect(authSchemas.email).toBeDefined();
    expect(authSchemas.phone).toBeDefined();
    expect(authSchemas.role).toBeDefined();
  });
});
