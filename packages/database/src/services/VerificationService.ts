/**
 * Verification Service
 * Handles password reset, email verification, and phone verification
 */

import { eq, and, lt, isNull, sql } from "drizzle-orm";
import { BaseService, type CloudflareEnv } from "./base";
import type { D1Database } from "@cloudflare/workers-types";
import {
  passwordResetTokens,
  emailVerificationTokens,
  phoneVerificationTokens,
  passwordChangeLogs,
  users,
  type NewPasswordResetToken,
  type NewEmailVerificationToken,
  type NewPhoneVerificationToken,
  type NewPasswordChangeLog,
} from "../schema";
import { NotificationService } from "./NotificationService";

// ============================================
// Types
// ============================================

export interface PasswordResetRequestParams {
  identifier: string; // email or phone
  method: "email" | "sms";
  ipAddress?: string;
  userAgent?: string;
}

export interface VerifyResetTokenParams {
  token: string;
  ipAddress?: string;
}

export interface ResetPasswordParams {
  token: string;
  newPassword: string;
  ipAddress: string;
  userAgent?: string;
}

export interface SendEmailVerificationParams {
  userId: string;
  email: string;
  ipAddress?: string;
}

export interface VerifyEmailParams {
  token: string;
  ipAddress?: string;
}

export interface SendPhoneVerificationParams {
  userId: string;
  phone: string;
  ipAddress?: string;
}

export interface VerifyPhoneParams {
  userId: string;
  phone: string;
  otpCode: string;
  ipAddress?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate 6-digit OTP
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash password using bcrypt (via SubtleCrypto for edge compatibility)
 */
async function hashPassword(password: string): Promise<string> {
  // Note: In production, use @cloudflare/workers-bcrypt or similar
  // For now, we'll use a placeholder that should be replaced
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 10);
}

const LOCAL_APP_BASE_URL = "http://localhost:5173";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function firstConfiguredOrigin(value?: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .find((origin) => origin && origin !== "*");
}

function stripApiPath(url: string): string {
  return normalizeBaseUrl(url).replace(/\/api(?:\/v\d+)?$/i, "");
}

function isProductionEnv(env: CloudflareEnv): boolean {
  const envName = String(
    env.NODE_ENV || env["ENVIRONMENT"] || "",
  ).toLowerCase();
  return envName === "production";
}

export function resolveVerificationAppBaseUrl(env: CloudflareEnv): string {
  const appOrigin =
    firstConfiguredOrigin(env.CLIENT_BASE_URL) ||
    firstConfiguredOrigin(env.CORS_ORIGIN);

  if (appOrigin) {
    return normalizeBaseUrl(appOrigin);
  }

  if (isProductionEnv(env)) {
    throw new Error(
      "CLIENT_BASE_URL or CORS_ORIGIN must be configured for production verification links",
    );
  }

  if (env.API_BASE_URL) {
    return stripApiPath(env.API_BASE_URL);
  }

  return LOCAL_APP_BASE_URL;
}

// ============================================
// Verification Service
// ============================================

export class VerificationService extends BaseService {
  private notificationService: NotificationService;

  constructor(d1: D1Database, env: CloudflareEnv) {
    super(d1, env);
    this.notificationService = new NotificationService(d1, env);
  }

  // ========================================
  // Password Reset Methods
  // ========================================

  /**
   * Request password reset - send reset link/OTP
   */
  async requestPasswordReset(params: PasswordResetRequestParams): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    const { identifier, method, ipAddress, userAgent } = params;

    try {
      // Find user by email or phone
      const user = await this.db
        .select()
        .from(users)
        .where(
          method === "email"
            ? eq(users.email, identifier)
            : eq(users.phone, identifier),
        )
        .get();

      // Security: Don't reveal if user exists
      if (!user) {
        return {
          success: true,
          message: "如果該帳號存在，重設連結已發送",
        };
      }

      // Generate token
      const token = generateUUID();
      const otpCode = method === "sms" ? generateOTP() : null;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reset token
      const resetToken: NewPasswordResetToken = {
        userId: user.id,
        token,
        tokenType: method,
        otpCode,
        expiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      };

      await this.db.insert(passwordResetTokens).values(resetToken).run();

      // Send notification
      const appBaseUrl = resolveVerificationAppBaseUrl(this.env);
      const resetLink = `${appBaseUrl}/reset-password?token=${token}`;

      if (method === "email" && user.email) {
        await this.notificationService.sendNotification({
          recipientId: user.id,
          recipientEmail: user.email,
          category: "password_reset_request",
          type: "email",
          data: {
            userName: user.fullName || user.username,
            resetLink,
            ipAddress: ipAddress || "Unknown",
            requestTime: new Date().toLocaleString("zh-TW", {
              timeZone: "Asia/Taipei",
            }),
          },
        });
      } else if (method === "sms" && user.phone && otpCode) {
        await this.notificationService.sendNotification({
          recipientId: user.id,
          recipientPhone: user.phone,
          category: "phone_verification",
          type: "sms",
          data: {
            otpCode,
          },
        });
      }

      return {
        success: true,
        message:
          method === "email"
            ? "重設連結已發送至您的 Email"
            : "驗證碼已發送至您的手機",
      };
    } catch (error) {
      console.error("Request password reset error:", error);
      return {
        success: false,
        message: "發送重設連結失敗",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verify reset token validity
   */
  async verifyResetToken(params: VerifyResetTokenParams): Promise<{
    valid: boolean;
    userId?: string;
    email?: string;
    error?: string;
  }> {
    const { token } = params;

    try {
      const resetToken = await this.db
        .select({
          id: passwordResetTokens.id,
          userId: passwordResetTokens.userId,
          expiresAt: passwordResetTokens.expiresAt,
          usedAt: passwordResetTokens.usedAt,
          userEmail: users.email,
          userFullName: users.fullName,
        })
        .from(passwordResetTokens)
        .leftJoin(users, eq(passwordResetTokens.userId, users.id))
        .where(eq(passwordResetTokens.token, token))
        .get();

      if (!resetToken) {
        return { valid: false, error: "Token 不存在或無效" };
      }

      // Check if already used
      if (resetToken.usedAt) {
        return { valid: false, error: "Token 已被使用" };
      }

      // Check if expired
      const now = new Date();
      if (resetToken.expiresAt && resetToken.expiresAt < now) {
        return { valid: false, error: "Token 已過期" };
      }

      // Mask email for privacy
      const maskedEmail = resetToken.userEmail
        ? resetToken.userEmail.replace(/(.{1,3})(.*)(@.*)/, "$1***$3")
        : undefined;

      return {
        valid: true,
        userId: resetToken.userId,
        email: maskedEmail,
      };
    } catch (error) {
      console.error("Verify reset token error:", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(params: ResetPasswordParams): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    const { token, newPassword, ipAddress, userAgent } = params;

    try {
      // Verify token first
      const verification = await this.verifyResetToken({ token });
      if (!verification.valid || !verification.userId) {
        return {
          success: false,
          message: "無效的重設連結",
          error: verification.error,
        };
      }

      // Validate password strength (basic check)
      if (newPassword.length < 6) {
        return {
          success: false,
          message: "密碼至少需要 6 個字符",
        };
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Transaction: update password, mark token used, log change (all-or-nothing)
      await this.db.transaction(async (tx) => {
        // Update user password
        await tx
          .update(users)
          .set({
            passwordHash,
            passwordChangedAt: new Date(),
            tokenVersion: sql`${users.tokenVersion} + 1`,
          })
          .where(eq(users.id, verification.userId!))
          .run();

        // Mark token as used
        await tx
          .update(passwordResetTokens)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokens.token, token))
          .run();

        // Log password change
        const logEntry: NewPasswordChangeLog = {
          userId: verification.userId!,
          changeMethod: token.includes("-") ? "reset_email" : "reset_sms",
          ipAddress,
          userAgent: userAgent || null,
          success: true,
        };
        await tx.insert(passwordChangeLogs).values(logEntry).run();
      });

      // Get user details for notification
      const user = await this.db
        .select()
        .from(users)
        .where(eq(users.id, verification.userId))
        .get();

      if (user?.email) {
        // Send success notification
        await this.notificationService.sendNotification({
          recipientId: user.id,
          recipientEmail: user.email,
          category: "password_reset_success",
          type: "email",
          data: {
            userName: user.fullName || user.username,
            changeTime: new Date().toLocaleString("zh-TW", {
              timeZone: "Asia/Taipei",
            }),
            changeMethod: "Email 重設連結",
            ipAddress,
          },
        });
      }

      return {
        success: true,
        message: "密碼已成功重設，請重新登入",
      };
    } catch (error) {
      console.error("Reset password error:", error);
      return {
        success: false,
        message: "重設密碼失敗",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ========================================
  // Email Verification Methods
  // ========================================

  /**
   * Send email verification link
   */
  async sendEmailVerification(params: SendEmailVerificationParams): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    const { userId, email, ipAddress } = params;

    try {
      // Check if already verified
      const user = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();

      if (!user) {
        return { success: false, message: "用戶不存在" };
      }

      if (user.emailVerifiedAt) {
        return { success: true, message: "Email 已驗證" };
      }

      // Generate verification token
      const token = generateUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const verificationToken: NewEmailVerificationToken = {
        userId,
        token,
        email,
        expiresAt,
        ipAddress: ipAddress || null,
      };

      await this.db
        .insert(emailVerificationTokens)
        .values(verificationToken)
        .run();

      // Send verification email
      const appBaseUrl = resolveVerificationAppBaseUrl(this.env);
      const verificationLink = `${appBaseUrl}/verify-email?token=${token}`;

      await this.notificationService.sendNotification({
        recipientId: userId,
        recipientEmail: email,
        category: "email_verification",
        type: "email",
        data: {
          userName: user.fullName || user.username,
          verificationLink,
        },
      });

      return {
        success: true,
        message: "驗證郵件已發送",
      };
    } catch (error) {
      console.error("Send email verification error:", error);
      return {
        success: false,
        message: "發送驗證郵件失敗",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verify email using token
   */
  async verifyEmail(params: VerifyEmailParams): Promise<{
    success: boolean;
    message: string;
    userId?: string;
    error?: string;
  }> {
    const { token, ipAddress } = params;

    try {
      const verificationToken = await this.db
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.token, token))
        .get();

      if (!verificationToken) {
        return { success: false, message: "Token 不存在或無效" };
      }

      // Check if already verified
      if (verificationToken.verifiedAt) {
        return {
          success: true,
          message: "Email 已驗證",
          userId: verificationToken.userId,
        };
      }

      // Check if expired
      const now = new Date();
      if (verificationToken.expiresAt < now) {
        return { success: false, message: "Token 已過期" };
      }

      // Transaction: mark token verified and update user (all-or-nothing)
      await this.db.transaction(async (tx) => {
        // Mark as verified
        await tx
          .update(emailVerificationTokens)
          .set({
            verifiedAt: now,
            ipAddress: ipAddress || verificationToken.ipAddress,
          })
          .where(eq(emailVerificationTokens.id, verificationToken.id))
          .run();

        // Update user
        await tx
          .update(users)
          .set({
            isVerified: true,
            emailVerifiedAt: now,
          })
          .where(eq(users.id, verificationToken.userId))
          .run();
      });

      // Get user details
      const user = await this.db
        .select()
        .from(users)
        .where(eq(users.id, verificationToken.userId))
        .get();

      if (user?.email) {
        // Send success notification
        const appBaseUrl = resolveVerificationAppBaseUrl(this.env);
        await this.notificationService.sendNotification({
          recipientId: user.id,
          recipientEmail: user.email,
          category: "email_verification_success",
          type: "email",
          data: {
            userName: user.fullName || user.username,
            appLink: appBaseUrl,
          },
        });
      }

      return {
        success: true,
        message: "Email 驗證成功！",
        userId: verificationToken.userId,
      };
    } catch (error) {
      console.error("Verify email error:", error);
      return {
        success: false,
        message: "Email 驗證失敗",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ========================================
  // Phone Verification Methods
  // ========================================

  /**
   * Send phone verification OTP
   */
  async sendPhoneVerification(params: SendPhoneVerificationParams): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    const { userId, phone, ipAddress } = params;

    try {
      // Generate OTP
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const verificationToken: NewPhoneVerificationToken = {
        userId,
        phone,
        otpCode,
        expiresAt,
        ipAddress: ipAddress || null,
      };

      await this.db
        .insert(phoneVerificationTokens)
        .values(verificationToken)
        .run();

      // Send SMS
      await this.notificationService.sendNotification({
        recipientId: userId,
        recipientPhone: phone,
        category: "phone_verification",
        type: "sms",
        data: {
          otpCode,
        },
      });

      return {
        success: true,
        message: "驗證碼已發送",
      };
    } catch (error) {
      console.error("Send phone verification error:", error);
      return {
        success: false,
        message: "發送驗證碼失敗",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verify phone using OTP
   */
  async verifyPhone(params: VerifyPhoneParams): Promise<{
    success: boolean;
    message: string;
    attemptsLeft?: number;
    error?: string;
  }> {
    const { userId, phone, otpCode, ipAddress } = params;

    try {
      // Get latest OTP for this user and phone
      const verificationToken = await this.db
        .select()
        .from(phoneVerificationTokens)
        .where(
          and(
            eq(phoneVerificationTokens.userId, userId),
            eq(phoneVerificationTokens.phone, phone),
            isNull(phoneVerificationTokens.verifiedAt),
          ),
        )
        .orderBy(phoneVerificationTokens.createdAt)
        .get();

      if (!verificationToken) {
        return { success: false, message: "驗證碼不存在或已過期" };
      }

      // Check if expired
      const now = new Date();
      if (verificationToken.expiresAt < now) {
        return { success: false, message: "驗證碼已過期，請重新發送" };
      }

      // Check attempts
      if (verificationToken.attemptCount >= 3) {
        return {
          success: false,
          message: "驗證碼已失效，請重新發送",
          attemptsLeft: 0,
        };
      }

      // Verify OTP
      if (verificationToken.otpCode !== otpCode) {
        // Increment attempt count
        await this.db
          .update(phoneVerificationTokens)
          .set({ attemptCount: verificationToken.attemptCount + 1 })
          .where(eq(phoneVerificationTokens.id, verificationToken.id))
          .run();

        return {
          success: false,
          message: "驗證碼錯誤",
          attemptsLeft: 2 - verificationToken.attemptCount,
        };
      }

      // Transaction: mark token verified and update user (all-or-nothing)
      await this.db.transaction(async (tx) => {
        // Mark as verified
        await tx
          .update(phoneVerificationTokens)
          .set({
            verifiedAt: now,
            ipAddress: ipAddress || verificationToken.ipAddress,
          })
          .where(eq(phoneVerificationTokens.id, verificationToken.id))
          .run();

        // Update user
        await tx
          .update(users)
          .set({
            phoneVerifiedAt: now,
          })
          .where(eq(users.id, userId))
          .run();
      });

      // Send success notification
      await this.notificationService.sendNotification({
        recipientId: userId,
        recipientPhone: phone,
        category: "phone_verification_success",
        type: "sms",
        data: {
          phone,
        },
      });

      return {
        success: true,
        message: "手機驗證成功！",
      };
    } catch (error) {
      console.error("Verify phone error:", error);
      return {
        success: false,
        message: "手機驗證失敗",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ========================================
  // Cleanup Methods
  // ========================================

  /**
   * Clean up expired tokens (should be called by cron job)
   */
  async cleanupExpiredTokens(): Promise<{
    deletedPasswordResetTokens: number;
    deletedEmailVerificationTokens: number;
    deletedPhoneVerificationTokens: number;
  }> {
    const now = new Date();

    try {
      // Transaction: delete all expired tokens (all-or-nothing cleanup)
      let passwordResetChanges = 0;
      let emailVerificationChanges = 0;
      let phoneVerificationChanges = 0;

      await this.db.transaction(async (tx) => {
        // Delete expired password reset tokens
        const passwordResetResult = await tx
          .delete(passwordResetTokens)
          .where(lt(passwordResetTokens.expiresAt, now))
          .run();

        // Delete expired email verification tokens
        const emailVerificationResult = await tx
          .delete(emailVerificationTokens)
          .where(lt(emailVerificationTokens.expiresAt, now))
          .run();

        // Delete expired phone verification tokens
        const phoneVerificationResult = await tx
          .delete(phoneVerificationTokens)
          .where(lt(phoneVerificationTokens.expiresAt, now))
          .run();

        passwordResetChanges = passwordResetResult.meta.changes;
        emailVerificationChanges = emailVerificationResult.meta.changes;
        phoneVerificationChanges = phoneVerificationResult.meta.changes;
      });

      return {
        deletedPasswordResetTokens: passwordResetChanges,
        deletedEmailVerificationTokens: emailVerificationChanges,
        deletedPhoneVerificationTokens: phoneVerificationChanges,
      };
    } catch (error) {
      console.error("Cleanup expired tokens error:", error);
      return {
        deletedPasswordResetTokens: 0,
        deletedEmailVerificationTokens: 0,
        deletedPhoneVerificationTokens: 0,
      };
    }
  }
}
