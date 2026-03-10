/**
 * Guest Token Authentication Middleware
 * Validates KV-stored guest tokens for unauthenticated order access.
 * Token format: "gt_" + 32-byte random hex, stored in CACHE_KV with 4hr TTL.
 */

import { Context, Next } from "hono";
import type { Env } from "../types/env";

export interface GuestTokenData {
  orderId: string;
  restaurantId: string;
  guestName: string;
  phoneLastDigits: string;
  createdAt: number;
}

declare module "hono" {
  interface ContextVariableMap {
    guestOrder: GuestTokenData;
  }
}

export const guestTokenAuth = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer gt_")) {
    return c.json(
      { success: false, error: "Missing or invalid guest token" },
      401,
    );
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const kvKey = `guest_token:${token}`;
    const tokenData = (await c.env.CACHE_KV.get(
      kvKey,
      "json",
    )) as GuestTokenData | null;

    if (!tokenData) {
      return c.json(
        { success: false, error: "Guest token expired or invalid" },
        401,
      );
    }

    // Verify orderId matches the route param
    const routeOrderId = c.req.param("id");
    if (routeOrderId && tokenData.orderId !== routeOrderId) {
      return c.json(
        { success: false, error: "Token does not match this order" },
        403,
      );
    }

    c.set("guestOrder", tokenData);
    await next();
  } catch (error) {
    console.error("Guest token auth error:", error);
    return c.json({ success: false, error: "Authentication failed" }, 401);
  }
};

/**
 * Generate a cryptographically random guest token.
 */
export function generateGuestToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `gt_${hex}`;
}
