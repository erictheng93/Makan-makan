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

export interface GuestSessionData {
  restaurantId: string;
  phoneLastDigits: string;
  createdAt: number;
  orderId?: string; // Set after order is created
}

declare module "hono" {
  interface ContextVariableMap {
    guestOrder: GuestTokenData;
    guestSession: GuestSessionData;
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
 * Guest session auth middleware for pre-order sessions.
 * Unlike guestTokenAuth, this does NOT require orderId.
 * Used for guest order creation flow.
 */
export const guestSessionAuth = async (
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
    )) as GuestSessionData | null;

    if (!tokenData) {
      return c.json(
        { success: false, error: "Guest token expired or invalid" },
        401,
      );
    }

    c.set("guestSession", tokenData);
    await next();
  } catch (error) {
    console.error("Guest session auth error:", error);
    return c.json({ success: false, error: "Authentication failed" }, 401);
  }
};

/**
 * Extract a well-formed guest token from an Authorization header.
 * Returns null when the header is absent or is not a `gt_` bearer token, so
 * callers can tell "this device has no guest identity yet" apart from "this
 * device presented a token". Does not prove the token exists in KV.
 */
export function getGuestBearerToken(
  authorization: string | undefined,
): string | null {
  const bearerPrefix = "Bearer ";
  if (!authorization?.startsWith(bearerPrefix)) return null;

  const token = authorization.slice(bearerPrefix.length).trim();
  return /^gt_[0-9a-f]{64}$/i.test(token) ? token : null;
}

/**
 * Build the per-device active-order lock key for a restaurant.
 * The lock must be scoped to something the customer's own device holds — a
 * guest token — never to the client IP: a restaurant's shared WiFi (or a
 * carrier's CGNAT) puts every customer behind one address, which would make
 * one guest's open order block the whole venue.
 */
export function guestActiveOrderKey(
  restaurantId: string,
  guestToken: string,
): string {
  return `guest_active:${restaurantId}:token:${guestToken}`;
}

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
