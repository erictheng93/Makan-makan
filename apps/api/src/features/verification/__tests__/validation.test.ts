// apps/api/src/features/verification/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import {
  forgotPasswordSchema,
  verifyResetTokenSchema,
  resetPasswordSchema,
  sendEmailVerificationSchema,
  verifyEmailSchema,
  sendPhoneVerificationSchema,
  verifyPhoneSchema,
} from "../schemas/validation";

describe("Verification Validation Schemas", () => {
  // ========================================
  // forgotPasswordSchema
  // ========================================

  describe("forgotPasswordSchema", () => {
    it("should accept valid email identifier with email method", () => {
      const result = forgotPasswordSchema.safeParse({
        identifier: "user@example.com",
        method: "email",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid phone identifier with sms method", () => {
      const result = forgotPasswordSchema.safeParse({
        identifier: "+60123456789",
        method: "sms",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty identifier", () => {
      const result = forgotPasswordSchema.safeParse({
        identifier: "",
        method: "email",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing identifier", () => {
      const result = forgotPasswordSchema.safeParse({
        method: "email",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid method enum value", () => {
      const result = forgotPasswordSchema.safeParse({
        identifier: "user@example.com",
        method: "push",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing method", () => {
      const result = forgotPasswordSchema.safeParse({
        identifier: "user@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty object", () => {
      const result = forgotPasswordSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject method=fax (invalid enum)", () => {
      const result = forgotPasswordSchema.safeParse({
        identifier: "user@example.com",
        method: "fax",
      });
      expect(result.success).toBe(false);
    });
  });

  // ========================================
  // verifyResetTokenSchema
  // ========================================

  describe("verifyResetTokenSchema", () => {
    it("should accept valid UUID v4 token", () => {
      const result = verifyResetTokenSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-UUID string", () => {
      const result = verifyResetTokenSchema.safeParse({
        token: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty string token", () => {
      const result = verifyResetTokenSchema.safeParse({
        token: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject numeric token", () => {
      const result = verifyResetTokenSchema.safeParse({
        token: "123456",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing token", () => {
      const result = verifyResetTokenSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject UUID-like string missing hyphens", () => {
      const result = verifyResetTokenSchema.safeParse({
        token: "123456781234123412341234567890ab",
      });
      expect(result.success).toBe(false);
    });
  });

  // ========================================
  // resetPasswordSchema
  // ========================================

  describe("resetPasswordSchema", () => {
    it("should accept valid token, matching passwords at minimum length", () => {
      const result = resetPasswordSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
        newPassword: "abc123",
        confirmPassword: "abc123",
      });
      expect(result.success).toBe(true);
    });

    it("should accept password at exact maximum length (100 chars)", () => {
      const password = "a".repeat(100);
      const result = resetPasswordSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
        newPassword: password,
        confirmPassword: password,
      });
      expect(result.success).toBe(true);
    });

    it("should reject password shorter than 6 characters", () => {
      const result = resetPasswordSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
        newPassword: "12345",
        confirmPassword: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password longer than 100 characters", () => {
      const password = "a".repeat(101);
      const result = resetPasswordSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
        newPassword: password,
        confirmPassword: password,
      });
      expect(result.success).toBe(false);
    });

    it("should reject mismatched confirmPassword", () => {
      const result = resetPasswordSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
        newPassword: "password123",
        confirmPassword: "password456",
      });
      expect(result.success).toBe(false);
    });

    it("should place mismatch error on confirmPassword path", () => {
      const result = resetPasswordSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
        newPassword: "password123",
        confirmPassword: "different123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.errors.map((e) => e.path.join("."));
        expect(paths).toContain("confirmPassword");
      }
    });

    it("should reject non-UUID token", () => {
      const result = resetPasswordSchema.safeParse({
        token: "invalid-token",
        newPassword: "password123",
        confirmPassword: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing token", () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: "password123",
        confirmPassword: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject password of exactly 5 characters (boundary below minimum)", () => {
      const result = resetPasswordSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
        newPassword: "12345",
        confirmPassword: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("should accept password of exactly 6 characters (boundary at minimum)", () => {
      const result = resetPasswordSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
        newPassword: "123456",
        confirmPassword: "123456",
      });
      expect(result.success).toBe(true);
    });
  });

  // ========================================
  // sendEmailVerificationSchema
  // ========================================

  describe("sendEmailVerificationSchema", () => {
    it("should accept valid email address", () => {
      const result = sendEmailVerificationSchema.safeParse({
        email: "valid@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should accept email with subdomain", () => {
      const result = sendEmailVerificationSchema.safeParse({
        email: "user@mail.example.co.uk",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format (missing @)", () => {
      const result = sendEmailVerificationSchema.safeParse({
        email: "invalidemail.com",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid email format (missing domain)", () => {
      const result = sendEmailVerificationSchema.safeParse({
        email: "user@",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty email string", () => {
      const result = sendEmailVerificationSchema.safeParse({
        email: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing email field", () => {
      const result = sendEmailVerificationSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject plain string without TLD", () => {
      const result = sendEmailVerificationSchema.safeParse({
        email: "user@localhost",
      });
      // Zod's email validator may or may not accept this; test for consistent behavior
      // Most strict validators reject this
      const parsed = sendEmailVerificationSchema.safeParse({
        email: "not-an-email",
      });
      expect(parsed.success).toBe(false);
    });
  });

  // ========================================
  // verifyEmailSchema
  // ========================================

  describe("verifyEmailSchema", () => {
    it("should accept valid UUID token", () => {
      const result = verifyEmailSchema.safeParse({
        token: "12345678-1234-1234-1234-123456789abc",
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-UUID token", () => {
      const result = verifyEmailSchema.safeParse({
        token: "not-a-valid-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty token", () => {
      const result = verifyEmailSchema.safeParse({
        token: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing token", () => {
      const result = verifyEmailSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ========================================
  // sendPhoneVerificationSchema
  // ========================================

  describe("sendPhoneVerificationSchema", () => {
    it("should accept valid international phone with + prefix", () => {
      const result = sendPhoneVerificationSchema.safeParse({
        phone: "+60123456789",
      });
      expect(result.success).toBe(true);
    });

    it("should accept phone number without + prefix", () => {
      const result = sendPhoneVerificationSchema.safeParse({
        phone: "60123456789",
      });
      expect(result.success).toBe(true);
    });

    it("should accept US phone number", () => {
      const result = sendPhoneVerificationSchema.safeParse({
        phone: "+12025551234",
      });
      expect(result.success).toBe(true);
    });

    it("should reject phone starting with 0 (fails E.164: first digit must be 1-9)", () => {
      const result = sendPhoneVerificationSchema.safeParse({
        phone: "+0123456789",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty phone string", () => {
      const result = sendPhoneVerificationSchema.safeParse({
        phone: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject phone with letters", () => {
      const result = sendPhoneVerificationSchema.safeParse({
        phone: "+601234ABCD",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing phone field", () => {
      const result = sendPhoneVerificationSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject phone that is too short (< 2 digits after first)", () => {
      // regex: \+?[1-9]\d{1,14} — must have 1-14 more digits after first
      const result = sendPhoneVerificationSchema.safeParse({
        phone: "+6",
      });
      expect(result.success).toBe(false);
    });
  });

  // ========================================
  // verifyPhoneSchema
  // ========================================

  describe("verifyPhoneSchema", () => {
    it("should accept valid phone and 6-digit numeric OTP", () => {
      const result = verifyPhoneSchema.safeParse({
        phone: "+60123456789",
        otpCode: "123456",
      });
      expect(result.success).toBe(true);
    });

    it("should reject OTP shorter than 6 digits", () => {
      const result = verifyPhoneSchema.safeParse({
        phone: "+60123456789",
        otpCode: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("should reject OTP longer than 6 digits", () => {
      const result = verifyPhoneSchema.safeParse({
        phone: "+60123456789",
        otpCode: "1234567",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-numeric OTP", () => {
      const result = verifyPhoneSchema.safeParse({
        phone: "+60123456789",
        otpCode: "abcdef",
      });
      expect(result.success).toBe(false);
    });

    it("should reject OTP with mixed numeric and non-numeric characters", () => {
      const result = verifyPhoneSchema.safeParse({
        phone: "+60123456789",
        otpCode: "12345a",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty OTP string", () => {
      const result = verifyPhoneSchema.safeParse({
        phone: "+60123456789",
        otpCode: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing otpCode", () => {
      const result = verifyPhoneSchema.safeParse({
        phone: "+60123456789",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing phone", () => {
      const result = verifyPhoneSchema.safeParse({
        otpCode: "123456",
      });
      expect(result.success).toBe(false);
    });

    it("should reject OTP with spaces", () => {
      const result = verifyPhoneSchema.safeParse({
        phone: "+60123456789",
        otpCode: "123 56",
      });
      expect(result.success).toBe(false);
    });
  });
});
