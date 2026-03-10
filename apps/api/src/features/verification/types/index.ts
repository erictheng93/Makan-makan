/**
 * Verification Feature Types
 * Type definitions for password reset, email and phone verification
 */

export type VerificationMethod = "email" | "sms";

export interface ForgotPasswordInput {
  identifier: string;
  method: VerificationMethod;
}

export interface VerifyResetTokenInput {
  token: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SendEmailVerificationInput {
  email: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface SendPhoneVerificationInput {
  phone: string;
}

export interface VerifyPhoneInput {
  phone: string;
  otpCode: string;
}

export interface ClientInfo {
  ipAddress: string;
  userAgent: string;
}

export interface VerificationResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface TokenVerificationResult {
  valid: boolean;
  email?: string;
  error?: string;
}
