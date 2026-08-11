/**
 * Management API Authentication Middleware
 *
 * Protects management endpoints with JWT Bearer token verification.
 * Only admin role is supported for the management API.
 */

import { verify } from "hono/jwt";
import type { Context, Next } from "hono";
import type { ManagementEnv } from "../types";
import { ApiError, unauthorized } from "@makanmasak/utils";

export interface ManagementUser {
  id: string;
  email: string;
  role: "admin";
}

export const MANAGEMENT_JWT_AUDIENCE = "management";
export const MANAGEMENT_JWT_ISSUER = "makanmakan-management";

type Env = {
  Bindings: ManagementEnv;
  Variables: { managementUser: ManagementUser };
};

export function hasPlatformAdminClaim(
  payload: Record<string, unknown>,
): boolean {
  return payload.role === "admin" || payload.role === 0;
}

export function managementJwtSecret(env: ManagementEnv): string {
  return env.MANAGEMENT_JWT_SECRET || env.JWT_SECRET;
}

/**
 * JWT authentication middleware for management API.
 * Validates Bearer token, checks expiry, and sets managementUser on context.
 */
export const managementAuthMiddleware = async (c: Context<Env>, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw unauthorized("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  if (!token) {
    throw unauthorized("Missing token");
  }

  try {
    const payload = await verify(token, managementJwtSecret(c.env), "HS256");

    // Validate required claims
    if (
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      !hasPlatformAdminClaim(payload) ||
      payload.aud !== MANAGEMENT_JWT_AUDIENCE ||
      payload.iss !== MANAGEMENT_JWT_ISSUER
    ) {
      throw unauthorized("Invalid token claims");
    }

    // Check expiration (hono/jwt checks exp automatically, but be explicit)
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw unauthorized("Token expired");
    }

    const user: ManagementUser = {
      id: payload.id,
      email: payload.email,
      role: "admin",
    };

    c.set("managementUser", user);
    await next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unauthorized("Invalid or expired token");
  }
};
