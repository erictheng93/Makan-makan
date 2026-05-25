/**
 * Authentication API Response Contracts
 *
 * Defines the STABLE response shapes for authentication endpoints.
 * Frontend depends on these shapes — any change here is a breaking change.
 */

import { z } from "zod";
import {
  successEnvelope,
  messageOnlyResponse,
  TimestampFields,
} from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

/** User entity returned in auth responses */
export const AuthUserSchema = z.object({
  id: z.union([z.number(), z.string()]),
  username: z.string(),
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional().nullable(),
  role: z.number().int().min(0).max(4),
  restaurantId: z.string().optional().nullable(),
  isActive: z.union([z.boolean(), z.number()]).optional(),
  ...TimestampFields,
});

/** Token pair returned on login/refresh */
export const TokenPairSchema = z.object({
  token: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.union([z.string(), z.number()]).optional(),
});

/** Session entity */
export const SessionSchema = z.object({
  id: z.union([z.number(), z.string()]),
  userId: z.union([z.number(), z.string()]),
  userAgent: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  ...TimestampFields,
});

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const LoginResponse = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.union([z.string(), z.number()]).optional(),
    user: AuthUserSchema,
  }),
});

export const RegisterResponse = z.object({
  success: z.literal(true),
  data: z
    .object({
      user: AuthUserSchema.optional(),
      tokens: TokenPairSchema.optional(),
      token: z.string().optional(),
    })
    .passthrough(),
});

export const RefreshTokenResponse = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.union([z.string(), z.number()]).optional(),
    user: AuthUserSchema.optional(),
  }),
});

export const MeResponse = successEnvelope(AuthUserSchema);

export const SessionsListResponse = successEnvelope(z.array(SessionSchema));

export const GuestTokenResponse = z.object({
  success: z.literal(true),
  token: z.string(),
  expiresIn: z.number().optional(),
});

export const LogoutResponse = messageOnlyResponse;
export const ChangePasswordResponse = messageOnlyResponse;
export const ForgotPasswordResponse = messageOnlyResponse;
export const ResetPasswordResponse = messageOnlyResponse;
export const VerifyEmailResponse = messageOnlyResponse;

// ---------------------------------------------------------------------------
// Sensitive fields that MUST NOT appear in any auth response
// ---------------------------------------------------------------------------

export const AUTH_SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "hashedPassword",
  "salt",
  "totpSecret",
  "recoveryKeys",
];
