import { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";
import type { Env } from "../types/env";

/**
 * CSRF Protection Middleware
 *
 * Protects against Cross-Site Request Forgery attacks by validating
 * CSRF tokens on state-changing requests (POST, PUT, DELETE, PATCH)
 */

const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

/**
 * Build CSRF cookie options string.
 * Omits `Secure` flag in development (HTTP on localhost).
 */
function buildCookieOptions(
  token: string,
  env: Record<string, unknown>,
): string {
  const isDev =
    (env.NODE_ENV as string) === "development" ||
    ((env.API_BASE_URL as string) || "").includes("localhost");
  const parts = [
    `${CSRF_COOKIE_NAME}=${token}`,
    ...(isDev ? [] : ["Secure"]),
    "SameSite=Lax",
    `Max-Age=${CSRF_TOKEN_EXPIRY / 1000}`,
    "Path=/",
  ];
  return parts.join("; ");
}

interface CSRFOptions {
  /**
   * HTTP methods to protect with CSRF validation
   * @default ['POST', 'PUT', 'DELETE', 'PATCH']
   */
  protectedMethods?: string[];

  /**
   * Paths to exclude from CSRF protection (e.g., public APIs)
   */
  excludePaths?: string[];

  /**
   * Enable double-submit cookie pattern
   * @default true
   */
  useDoubleSubmit?: boolean;
}

const defaultOptions: Required<CSRFOptions> = {
  protectedMethods: ["POST", "PUT", "DELETE", "PATCH"],
  excludePaths: [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/health",
  ],
  useDoubleSubmit: true,
};

/**
 * Generate a cryptographically secure random token
 */
function generateCSRFToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Validate request origin matches expected host
 */
function validateOrigin(c: Context<{ Bindings: Env }>): boolean {
  const origin = c.req.header("Origin");
  const referer = c.req.header("Referer");
  const host = c.req.header("Host");

  // Allow configured CORS origins (covers Vite dev proxy and deployment)
  const corsOrigin = (c.env as unknown as Record<string, string>).CORS_ORIGIN;
  const allowedOrigins = corsOrigin
    ? corsOrigin.split(",").map((o) => o.trim())
    : [];

  // If Origin header exists, validate it
  if (origin) {
    try {
      const originUrl = new URL(origin);
      // Allow same-origin requests
      if (originUrl.host === host) {
        return true;
      }
      // Allow configured CORS origins
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // If no Origin but has Referer, validate it
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) {
        return true;
      }
      if (
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(refererUrl.origin)
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // No Origin or Referer - reject for extra safety
  return false;
}

/**
 * CSRF Protection Middleware
 */
export function csrfProtection(options: CSRFOptions = {}) {
  const opts = { ...defaultOptions, ...options };

  return createMiddleware<{ Bindings: Env }>(
    async (c: Context<{ Bindings: Env }>, next: Next) => {
      const method = c.req.method.toUpperCase();
      const path = c.req.path;

      // Skip CSRF check for excluded paths (supports * wildcard for path segments)
      if (
        opts.excludePaths.some((excludePath) => {
          // Support simple wildcard pattern matching
          if (excludePath.includes("*")) {
            const pattern = excludePath.replace(/\*/g, "[^/]+");
            const regex = new RegExp(`^${pattern}(/.*)?$`);
            return regex.test(path);
          }
          return path.startsWith(excludePath);
        })
      ) {
        return next();
      }

      // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
      if (!opts.protectedMethods.includes(method)) {
        return next();
      }

      // === DEFENSE LAYER 1: Origin/Referer Validation ===
      if (!validateOrigin(c)) {
        return c.json(
          {
            success: false,
            error: "Invalid request origin",
            message: "Request origin does not match expected host",
          },
          403,
        );
      }

      // === DEFENSE LAYER 2: CSRF Token Validation ===
      // Get CSRF token from header
      const tokenFromHeader = c.req.header(CSRF_HEADER_NAME);

      if (!tokenFromHeader) {
        return c.json(
          {
            success: false,
            error: "CSRF token missing",
            message: "CSRF token is required for this request",
          },
          403,
        );
      }

      // Validate token format (must be 64 hex characters)
      if (!/^[a-f0-9]{64}$/.test(tokenFromHeader)) {
        return c.json(
          {
            success: false,
            error: "CSRF token invalid format",
            message: "CSRF token must be a valid hexadecimal string",
          },
          403,
        );
      }

      if (opts.useDoubleSubmit) {
        // Double-submit cookie pattern: validate token from cookie matches header
        const tokenFromCookie = c.req
          .header("Cookie")
          ?.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`))?.[1];

        if (!tokenFromCookie || tokenFromCookie !== tokenFromHeader) {
          return c.json(
            {
              success: false,
              error: "CSRF token invalid",
              message: "CSRF token validation failed",
            },
            403,
          );
        }
      } else {
        // Server-side validation: check token from KV store
        if (c.env.CACHE_KV) {
          const storedToken = await c.env.CACHE_KV.get(
            `csrf:${tokenFromHeader}`,
          );

          if (!storedToken) {
            return c.json(
              {
                success: false,
                error: "CSRF token expired or invalid",
                message: "CSRF token validation failed",
              },
              403,
            );
          }
        }
      }

      await next();
    },
  );
}

/**
 * Generate and set CSRF token
 * This endpoint should be called to get a CSRF token before making protected requests
 */
export async function generateCSRFTokenHandler(c: Context<{ Bindings: Env }>) {
  const token = generateCSRFToken();

  // Store token in KV for server-side validation (optional)
  if (c.env.CACHE_KV) {
    await c.env.CACHE_KV.put(
      `csrf:${token}`,
      JSON.stringify({ created: Date.now() }),
      { expirationTtl: CSRF_TOKEN_EXPIRY / 1000 },
    );
  }

  // Set cookie for double-submit pattern
  const cookieOptions = buildCookieOptions(
    token,
    c.env as unknown as Record<string, unknown>,
  );

  return c.json(
    {
      success: true,
      data: {
        csrfToken: token,
        expiresIn: CSRF_TOKEN_EXPIRY,
      },
    },
    {
      headers: {
        "Set-Cookie": cookieOptions,
      },
    },
  );
}

/**
 * Middleware to automatically generate CSRF token for authenticated users
 * Adds token to response headers for SPA consumption
 */
export function attachCSRFToken() {
  return createMiddleware<{ Bindings: Env }>(
    async (c: Context<{ Bindings: Env }>, next: Next) => {
      await next();

      // Only attach token to successful authentication responses
      if (c.res.status === 200 && c.req.path.includes("/auth/")) {
        const token = generateCSRFToken();

        // Store in KV
        if (c.env.CACHE_KV) {
          await c.env.CACHE_KV.put(
            `csrf:${token}`,
            JSON.stringify({ created: Date.now() }),
            { expirationTtl: CSRF_TOKEN_EXPIRY / 1000 },
          );
        }

        // Add to response headers
        c.res.headers.set("X-CSRF-Token", token);

        // Set cookie (NOT HttpOnly for double-submit pattern)
        const cookieOptions = buildCookieOptions(
          token,
          c.env as unknown as Record<string, unknown>,
        );
        c.res.headers.append("Set-Cookie", cookieOptions);
      }
    },
  );
}
