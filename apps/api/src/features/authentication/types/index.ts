/**
 * Authentication Types
 * TypeScript type definitions for the authentication feature
 */

import type { BaseEntity } from "../../../shared/types";

// Import shared types that exist
import type { UserRole } from "@makanmasak/shared-types";

// Device and Location Information
export interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  platform?: "mobile" | "desktop" | "tablet";
  deviceType?: string;
  browser?: string;
  version?: string;
}

export interface LocationInfo {
  country?: string;
  city?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Authentication Request Types
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  restaurantId?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ForgotPasswordRequest {
  email?: string;
  username?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

// Enhanced Login Data (with tracking info)
export interface LoginData {
  username: string;
  password: string;
  deviceInfo?: DeviceInfo;
  location?: LocationInfo;
}

export interface RegisterData {
  username: string;
  email?: string;
  phone?: string;
  fullName: string;
  password: string;
  role: UserRole;
  restaurantId?: string;
}

// User and Session Types (feature-specific user type)
export interface AuthUser extends BaseEntity {
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  restaurantId?: string | null;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  emailVerifiedAt?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
}

export interface SessionEntity extends BaseEntity {
  sessionId: string;
  userId: number;
  token: string;
  refreshToken?: string;
  deviceInfo?: DeviceInfo;
  location?: LocationInfo;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  lastAccessedAt?: Date;
  isActive: boolean;
}

// JWT Token Types
export interface JWTPayload {
  id: number;
  username: string;
  role: UserRole;
  restaurantId?: string;
  iat?: number;
  exp?: number;
  nbf?: number;
}

export interface RefreshTokenPayload {
  userId: number;
  type: "refresh";
  iat?: number;
  exp?: number;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  expiresIn: number;
}

// Authentication Response Types
export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  tokens?: Tokens;
  error?: string;
  requiresTwoFactor?: boolean;
  twoFactorChallenge?: string;
}

export interface TokenValidation {
  valid: boolean;
  user?: AuthUser;
  error?: string;
  remainingTime?: number;
}

export interface UserProfile {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  restaurantId?: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  twoFactorEnabled: boolean;
  sessions: SessionSummary[];
}

export interface SessionSummary {
  id: string;
  deviceInfo?: DeviceInfo;
  location?: LocationInfo;
  lastAccessedAt?: Date;
  expiresAt: Date;
  isCurrent: boolean;
  createdAt: Date;
}

// Two-Factor Authentication Types
export interface TwoFactorSetupRequest {
  password: string;
}

export interface TwoFactorVerifyRequest {
  token: string;
  backupCode?: string;
}

export interface TwoFactorBackupCodes {
  codes: string[];
  generatedAt: Date;
}

// Password Reset Types
export interface PasswordResetToken extends BaseEntity {
  userId: number;
  token: string;
  expiresAt: Date;
  isUsed: boolean;
  ipAddress?: string;
}

export interface EmailVerificationToken extends BaseEntity {
  userId: number;
  token: string;
  email: string;
  expiresAt: Date;
  isUsed: boolean;
}

// Security and Audit Types
export interface SecurityEvent {
  type:
    | "LOGIN"
    | "LOGIN_FAILED"
    | "LOGOUT"
    | "PASSWORD_CHANGED"
    | "TWO_FACTOR_ENABLED"
    | "TWO_FACTOR_DISABLED"
    | "ACCOUNT_LOCKED"
    | "PASSWORD_RESET_REQUESTED"
    | "PASSWORD_RESET_COMPLETED"
    | "EMAIL_VERIFIED";
  userId?: number;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: LocationInfo;
  metadata?: Record<string, unknown>;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timestamp: Date;
}

export interface AccountSecurity {
  failedLoginAttempts: number;
  lastFailedLoginAt?: Date;
  lockoutUntil?: Date;
  passwordStrength: "WEAK" | "MEDIUM" | "STRONG" | "VERY_STRONG";
  lastPasswordChangeAt?: Date;
  suspiciousActivity: boolean;
}

// Permission and Role Types
export interface Permission {
  id: number;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
  canCreateUsers: boolean;
  canManageRestaurant: boolean;
  canAccessAllRestaurants: boolean;
}

// Statistics and Analytics
export interface AuthStatistics {
  totalUsers: number;
  activeUsers: number;
  dailyLogins: number;
  uniqueDevices: number;
  topCountries: Array<{
    country: string;
    count: number;
  }>;
  platformDistribution: Record<string, number>;
  twoFactorAdoptionRate: number;
  recentSecurityEvents: SecurityEvent[];
}

// Service Interfaces
export interface IAuthService {
  // Core authentication methods
  login(data: LoginData): Promise<AuthResult>;
  register(data: RegisterData, createdBy?: number): Promise<AuthResult>;
  refreshToken(refreshToken: string): Promise<AuthResult>;
  logout(
    userId: number,
    token?: string,
    allSessions?: boolean,
  ): Promise<boolean>;
  validateToken(token: string): Promise<TokenValidation>;

  // User management
  getUserProfile(userId: number): Promise<UserProfile | null>;
  updateUserProfile(
    userId: number,
    data: Partial<AuthUser>,
  ): Promise<AuthUser | null>;
  changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }>;

  // Session management
  getUserSessions(userId: number): Promise<SessionSummary[]>;
  terminateSession(userId: number, sessionId: string): Promise<boolean>;
  terminateAllSessions(userId: number): Promise<boolean>;

  // Two-factor authentication
  setupTwoFactor(
    userId: number,
    password: string,
  ): Promise<{ secret: string; qrCode: string; backupCodes: string[] }>;
  verifyTwoFactor(
    userId: number,
    token: string,
    backupCode?: string,
  ): Promise<{ success: boolean; error?: string }>;
  disableTwoFactor(
    userId: number,
    password: string,
    token?: string,
  ): Promise<{ success: boolean; error?: string }>;
  generateBackupCodes(userId: number): Promise<TwoFactorBackupCodes>;

  // Password reset
  requestPasswordReset(
    identifier: string,
  ): Promise<{ success: boolean; error?: string }>;
  resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }>;

  // Email verification
  requestEmailVerification(
    userId: number,
  ): Promise<{ success: boolean; error?: string }>;
  verifyEmail(token: string): Promise<{ success: boolean; error?: string }>;

  // Security and monitoring
  logSecurityEvent(event: Omit<SecurityEvent, "timestamp">): Promise<void>;
  getSecurityEvents(userId?: number, limit?: number): Promise<SecurityEvent[]>;
  checkAccountSecurity(userId: number): Promise<AccountSecurity>;

  // Statistics
  getAuthStatistics(timeRange?: string): Promise<AuthStatistics>;
}

// Event Types for Real-time Updates
export type AuthEvent =
  | {
      type: "USER_LOGGED_IN";
      payload: { userId: number; deviceInfo?: DeviceInfo };
    }
  | { type: "USER_LOGGED_OUT"; payload: { userId: number } }
  | { type: "USER_REGISTERED"; payload: AuthUser }
  | { type: "PASSWORD_CHANGED"; payload: { userId: number } }
  | { type: "TWO_FACTOR_ENABLED"; payload: { userId: number } }
  | { type: "TWO_FACTOR_DISABLED"; payload: { userId: number } }
  | { type: "SECURITY_ALERT"; payload: SecurityEvent }
  | { type: "ACCOUNT_LOCKED"; payload: { userId: number; reason: string } }
  | { type: "EMAIL_VERIFIED"; payload: { userId: number; email: string } };

// Configuration Types
export interface AuthConfig {
  jwt: {
    secret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    algorithm: "HS256" | "HS384" | "HS512";
  };
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    preventReuse: number;
  };
  security: {
    maxFailedAttempts: number;
    lockoutDuration: number;
    sessionTimeout: number;
    requireTwoFactor: boolean;
    allowedOrigins: string[];
  };
  email: {
    verificationRequired: boolean;
    verificationExpiry: number;
    resetTokenExpiry: number;
  };
}

// Error Types
export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_EXISTS: "USER_EXISTS",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  PASSWORD_TOO_WEAK: "PASSWORD_TOO_WEAK",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  TWO_FACTOR_REQUIRED: "TWO_FACTOR_REQUIRED",
  TWO_FACTOR_INVALID: "TWO_FACTOR_INVALID",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
