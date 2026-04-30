/**
 * Verification Routes Integration Tests
 * Tests for password reset, email verification, and phone verification endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import verificationFeature from "../features/verification";
import { mockEnv } from "./setup";

// Type definitions for API responses
interface VerificationResponse {
  success?: boolean;
  message?: string;
  error?: string;
  valid?: boolean;
  userId?: number;
  email?: string;
}

// Use the feature routes
const verificationRouter = verificationFeature.routes;

// Mock @makanmakan/database to provide VerificationService
vi.mock("@makanmakan/database", () => {
  return {
    VerificationService: vi.fn(function () {
      return {
        requestPasswordReset: vi.fn(),
        verifyResetToken: vi.fn(),
        resetPassword: vi.fn(),
        sendEmailVerification: vi.fn(),
        verifyEmail: vi.fn(),
        sendPhoneVerification: vi.fn(),
        verifyPhone: vi.fn(),
      };
    }),
  };
});

// Mock auth middleware so the per-route customerAuthMiddleware lets the
// test's own user-injection middleware run. Without this the real JWT
// validator rejects "Bearer test-token" as "Invalid token format".
vi.mock("../middleware/auth", () => ({
  customerAuthMiddleware: vi.fn(async (_c: any, next: any) => {
    await next();
  }),
  authMiddleware: vi.fn(async (_c: any, next: any) => {
    await next();
  }),
}));

// Mock AlertService
vi.mock("../services/AlertService", () => {
  return {
    AlertService: vi.fn(function () {
      return {
        passwordResetAttempt: vi.fn().mockResolvedValue(undefined),
        sendAlert: vi.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

// Import after mocking
import { VerificationService } from "@makanmakan/database";
import { AlertService } from "../services/AlertService";

describe("Verification Routes", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;
  let mockVerificationService: any;
  let mockAlertService: any;

  beforeEach(() => {
    // Clear mocks FIRST, before setting up new ones
    vi.clearAllMocks();

    app = new Hono<{ Bindings: typeof mockEnv }>();

    // Add middleware to inject mockEnv and mock user into context
    app.use("*", async (c, next) => {
      if (!c.env) {
        (c as unknown as ApiTestContextWithEnv).env =
          {} as unknown as ApiTestEnv;
      }
      Object.assign(c.env, mockEnv);

      // If Authorization header is present, set mock user
      // This simulates what auth middleware would do
      const authHeader = c.req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        c.set("user", {
          id: 1,
          username: "testuser",
          role: 0,
          restaurantId: "test-restaurant-1",
        });
      }

      await next();
    });

    app.route("/auth", verificationRouter);

    // Get the mock VerificationService instance
    mockVerificationService = {
      requestPasswordReset: vi.fn(),
      verifyResetToken: vi.fn(),
      resetPassword: vi.fn(),
      sendEmailVerification: vi.fn(),
      verifyEmail: vi.fn(),
      sendPhoneVerification: vi.fn(),
      verifyPhone: vi.fn(),
    };

    // Get the mock AlertService instance
    mockAlertService = {
      passwordResetAttempt: vi.fn().mockResolvedValue(undefined),
      sendAlert: vi.fn().mockResolvedValue(undefined),
    };

    // Mock the constructors to return our mock instances (use function for constructor)
    vi.mocked(VerificationService).mockImplementation(function () {
      return mockVerificationService;
    });
    vi.mocked(AlertService).mockImplementation(function () {
      return mockAlertService;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================
  // Password Reset Tests
  // ========================================

  describe("POST /auth/forgot-password", () => {
    it("should successfully request password reset via email", async () => {
      mockVerificationService.requestPasswordReset.mockResolvedValue({
        success: true,
        message: "重設連結已發送至您的 Email",
      });

      const res = await app.request("/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: "test@example.com",
          method: "email",
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(true);
      expect(data.message).toContain("重設連結已發送");
      expect(mockVerificationService.requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: "test@example.com",
          method: "email",
        }),
      );
    });

    it("should validate required fields", async () => {
      const res = await app.request("/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Missing identifier and method
        }),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(false);
    });

    it("should handle user not found error", async () => {
      mockVerificationService.requestPasswordReset.mockResolvedValue({
        success: false,
        error: "找不到用戶",
      });

      const res = await app.request("/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier: "nonexistent@example.com",
          method: "email",
        }),
      });

      // Route returns 500 for failed requests (result.success = false)
      // This is intentional for security - don't reveal if user exists
      expect(res.status).toBe(500);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(false);
      expect(data.error).toContain("找不到用戶");
    });
  });

  describe("GET /auth/reset-password/verify", () => {
    it("should verify valid reset token", async () => {
      mockVerificationService.verifyResetToken.mockResolvedValue({
        valid: true,
        userId: 1,
        email: "te***@example.com",
      });

      const res = await app.request(
        "/auth/reset-password/verify?token=12345678-1234-1234-1234-123456789abc",
        {
          method: "GET",
        },
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as VerificationResponse;
      expect(data.valid).toBe(true);
      expect(data.userId).toBe(1);
    });

    it("should reject invalid token", async () => {
      mockVerificationService.verifyResetToken.mockResolvedValue({
        valid: false,
        error: "Token 無效或已過期",
      });

      // Use the same valid UUID format as the success test
      // The mock service will return { valid: false }
      const res = await app.request(
        "/auth/reset-password/verify?token=12345678-1234-1234-1234-123456789abc",
        {
          method: "GET",
        },
      );

      // Route returns 400 when result.valid is false
      expect(res.status).toBe(400);
      const data = (await res.json()) as VerificationResponse;
      expect(data.valid).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should require token parameter", async () => {
      const res = await app.request("/auth/reset-password/verify", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as VerificationResponse;
      // Route returns { valid: false, error: '...' } for missing token
      expect(data.valid).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe("POST /auth/reset-password", () => {
    it("should successfully reset password", async () => {
      mockVerificationService.resetPassword.mockResolvedValue({
        success: true,
        message: "密碼已成功重設",
      });

      const res = await app.request("/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "12345678-1234-1234-1234-123456789abc",
          newPassword: "NewPass@123",
          confirmPassword: "NewPass@123",
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(true);
      expect(data.message).toContain("密碼已成功重設");
    });

    it("should validate password match", async () => {
      const res = await app.request("/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "12345678-1234-1234-1234-123456789abc",
          newPassword: "NewPass@123",
          confirmPassword: "DifferentPass@123",
        }),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(false);
      expect(data.error).toContain("密碼不一致");
    });

    it("should validate password length", async () => {
      const res = await app.request("/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "12345678-1234-1234-1234-123456789abc",
          newPassword: "123",
          confirmPassword: "123",
        }),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(false);
    });
  });

  // ========================================
  // Email Verification Tests
  // ========================================

  describe("POST /auth/verify-email/send", () => {
    it("should send email verification", async () => {
      mockVerificationService.sendEmailVerification.mockResolvedValue({
        success: true,
        message: "驗證郵件已發送",
      });

      const res = await app.request("/auth/verify-email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          userId: 1,
          email: "test@example.com",
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(true);
    });
  });

  describe("GET /auth/verify-email", () => {
    it("should verify email with valid token", async () => {
      mockVerificationService.verifyEmail.mockResolvedValue({
        success: true,
        message: "Email 驗證成功",
      });

      const res = await app.request(
        "/auth/verify-email?token=12345678-1234-1234-1234-123456789abc",
        {
          method: "GET",
        },
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(true);
    });
  });

  // ========================================
  // Phone Verification Tests
  // ========================================

  describe("POST /auth/verify-phone/send", () => {
    it("should send phone verification OTP", async () => {
      mockVerificationService.sendPhoneVerification.mockResolvedValue({
        success: true,
        message: "驗證碼已發送",
      });

      const res = await app.request("/auth/verify-phone/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          userId: 1,
          phone: "+60123456789",
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(true);
    });
  });

  describe("POST /auth/verify-phone", () => {
    it("should verify phone with correct OTP", async () => {
      mockVerificationService.verifyPhone.mockResolvedValue({
        success: true,
        message: "手機驗證成功",
      });

      const res = await app.request("/auth/verify-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          userId: 1,
          phone: "+60123456789",
          otpCode: "123456",
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(true);
    });

    it("should reject incorrect OTP", async () => {
      mockVerificationService.verifyPhone.mockResolvedValue({
        success: false,
        error: "驗證碼錯誤",
      });

      const res = await app.request("/auth/verify-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          userId: 1,
          phone: "+60123456789",
          otpCode: "000000",
        }),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as VerificationResponse;
      expect(data.success).toBe(false);
    });
  });
});
