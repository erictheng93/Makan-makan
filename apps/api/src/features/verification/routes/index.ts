/**
 * Verification Routes
 * Handles password reset, email verification, and phone verification
 * With rate limiting to prevent abuse
 */

import { Hono } from "hono";
import { VerificationService } from "@makanmakan/database";
import {
  rateLimitMiddleware,
  RateLimitPresets,
} from "../../../middleware/rateLimiter";
import { AlertService } from "../../../services/AlertService";
import type { Env } from "../../../types/env";
import {
  forgotPasswordSchema,
  verifyResetTokenSchema,
  resetPasswordSchema,
  sendEmailVerificationSchema,
  verifyEmailSchema,
  sendPhoneVerificationSchema,
  verifyPhoneSchema,
} from "../schemas/validation";

const routes = new Hono<{ Bindings: Env }>();

// ========================================
// Helper Functions
// ========================================

function getClientInfo(c: any) {
  return {
    ipAddress:
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-real-ip") ||
      "unknown",
    userAgent: c.req.header("user-agent") || "unknown",
  };
}

// ========================================
// Password Reset Routes
// ========================================

/**
 * POST /forgot-password
 * Request password reset link/OTP
 * Rate limit: 5 requests per hour per IP
 */
routes.post(
  "/forgot-password",
  rateLimitMiddleware(RateLimitPresets.passwordReset),
  async (c) => {
    const body = await c.req.json();
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400,
      );
    }

    const { identifier, method } = validation.data;
    const { ipAddress, userAgent } = getClientInfo(c);

    try {
      const service = new VerificationService(c.env.DB, c.env);
      const result = await service.requestPasswordReset({
        identifier,
        method,
        ipAddress,
        userAgent,
      });

      // Send alert for failed attempts (user not found)
      if (!result.success && result.error?.includes("找不到用戶")) {
        const alertService = new AlertService(c.env);
        await alertService.passwordResetAttempt(identifier, ipAddress, false);
      }

      return c.json(result, result.success ? 200 : 500);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: "處理請求時發生錯誤",
        },
        500,
      );
    }
  },
);

/**
 * GET /reset-password/verify?token=xxx
 * Verify reset token validity
 */
routes.get("/reset-password/verify", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.json(
      {
        valid: false,
        error: "缺少 Token 參數",
      },
      400,
    );
  }

  const validation = verifyResetTokenSchema.safeParse({ token });

  if (!validation.success) {
    return c.json(
      {
        valid: false,
        error: validation.error.errors[0].message,
      },
      400,
    );
  }

  const { ipAddress } = getClientInfo(c);

  try {
    const service = new VerificationService(c.env.DB, c.env);
    const result = await service.verifyResetToken({
      token,
      ipAddress,
    });

    return c.json(result, result.valid ? 200 : 400);
  } catch (error) {
    return c.json(
      {
        valid: false,
        error: "驗證 Token 時發生錯誤",
      },
      500,
    );
  }
});

/**
 * POST /reset-password
 * Reset password using token
 */
routes.post("/reset-password", async (c) => {
  const body = await c.req.json();
  const validation = resetPasswordSchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      {
        success: false,
        error: validation.error.errors[0].message,
      },
      400,
    );
  }

  const { token, newPassword } = validation.data;
  const { ipAddress, userAgent } = getClientInfo(c);

  try {
    const service = new VerificationService(c.env.DB, c.env);
    const result = await service.resetPassword({
      token,
      newPassword,
      ipAddress,
      userAgent,
    });

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "重設密碼時發生錯誤",
      },
      500,
    );
  }
});

// ========================================
// Email Verification Routes
// ========================================

/**
 * POST /verify-email/send
 * Send email verification link
 */
routes.post(
  "/verify-email/send",
  rateLimitMiddleware(RateLimitPresets.emailVerification),
  async (c) => {
    // Get user from auth middleware (assumed to be set)
    const user = c.get("user");

    if (!user) {
      return c.json(
        {
          success: false,
          error: "請先登入",
        },
        401,
      );
    }

    const body = await c.req.json();
    const validation = sendEmailVerificationSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400,
      );
    }

    const { email } = validation.data;
    const { ipAddress } = getClientInfo(c);

    try {
      const service = new VerificationService(c.env.DB, c.env);
      const result = await service.sendEmailVerification({
        userId: user.id,
        email,
        ipAddress,
      });

      return c.json(result, result.success ? 200 : 500);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: "發送驗證郵件時發生錯誤",
        },
        500,
      );
    }
  },
);

/**
 * GET /verify-email?token=xxx
 * Verify email using token
 */
routes.get("/verify-email", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.json(
      {
        success: false,
        error: "缺少 Token 參數",
      },
      400,
    );
  }

  const validation = verifyEmailSchema.safeParse({ token });

  if (!validation.success) {
    return c.json(
      {
        success: false,
        error: validation.error.errors[0].message,
      },
      400,
    );
  }

  const { ipAddress } = getClientInfo(c);

  try {
    const service = new VerificationService(c.env.DB, c.env);
    const result = await service.verifyEmail({
      token,
      ipAddress,
    });

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Email 驗證時發生錯誤",
      },
      500,
    );
  }
});

// ========================================
// Phone Verification Routes
// ========================================

/**
 * POST /verify-phone/send
 * Send phone verification OTP
 */
routes.post(
  "/verify-phone/send",
  rateLimitMiddleware(RateLimitPresets.smsOTP),
  async (c) => {
    // Get user from auth middleware
    const user = c.get("user");

    if (!user) {
      return c.json(
        {
          success: false,
          error: "請先登入",
        },
        401,
      );
    }

    const body = await c.req.json();
    const validation = sendPhoneVerificationSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          success: false,
          error: validation.error.errors[0].message,
        },
        400,
      );
    }

    const { phone } = validation.data;
    const { ipAddress } = getClientInfo(c);

    try {
      const service = new VerificationService(c.env.DB, c.env);
      const result = await service.sendPhoneVerification({
        userId: user.id,
        phone,
        ipAddress,
      });

      return c.json(result, result.success ? 200 : 500);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: "發送驗證碼時發生錯誤",
        },
        500,
      );
    }
  },
);

/**
 * POST /verify-phone
 * Verify phone using OTP
 */
routes.post("/verify-phone", async (c) => {
  // Get user from auth middleware
  const user = c.get("user");

  if (!user) {
    return c.json(
      {
        success: false,
        error: "請先登入",
      },
      401,
    );
  }

  const body = await c.req.json();
  const validation = verifyPhoneSchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      {
        success: false,
        error: validation.error.errors[0].message,
      },
      400,
    );
  }

  const { phone, otpCode } = validation.data;
  const { ipAddress } = getClientInfo(c);

  try {
    const service = new VerificationService(c.env.DB, c.env);
    const result = await service.verifyPhone({
      userId: user.id,
      phone,
      otpCode,
      ipAddress,
    });

    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "手機驗證時發生錯誤",
      },
      500,
    );
  }
});

export default routes;
