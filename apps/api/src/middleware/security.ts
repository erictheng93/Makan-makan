import { Context, Next } from "hono";
import type { Env } from "../types/env";

/**
 * Enhanced Security Headers Middleware
 * Adds comprehensive security headers for defense in depth
 */
export const securityHeadersMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  await next();

  // Only add security headers to successful responses
  if (c.res.status < 400) {
    // Prevent MIME-type sniffing attacks
    c.res.headers.set("X-Content-Type-Options", "nosniff");

    // Prevent clickjacking attacks
    c.res.headers.set("X-Frame-Options", "DENY");

    // Enable XSS protection in browsers
    c.res.headers.set("X-XSS-Protection", "1; mode=block");

    // Control referrer information
    c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Restrict permissions for browser features
    c.res.headers.set(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=(), payment=(), usb=(), autoplay=(), encrypted-media=(), picture-in-picture=()",
    );

    // Prevent DNS prefetching to avoid information leakage
    c.res.headers.set("X-DNS-Prefetch-Control", "off");

    // Prevent IE from opening downloads in the site's context
    c.res.headers.set("X-Download-Options", "noopen");

    // Prevent cross-domain policy files
    c.res.headers.set("X-Permitted-Cross-Domain-Policies", "none");

    // HSTS for HTTPS enforcement (production only)
    if (c.env.NODE_ENV === "production") {
      c.res.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }

    // Enhanced Content Security Policy
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https: wss: https://*.makanmakan.app https://api.cloudflare.com",
      "media-src 'self' data: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "block-all-mixed-content",
      "upgrade-insecure-requests",
    ].join("; ");

    c.res.headers.set("Content-Security-Policy", cspDirectives);

    // Add security-focused cache control
    if (c.req.path.includes("/auth/") || c.req.path.includes("/users/")) {
      c.res.headers.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      c.res.headers.set("Pragma", "no-cache");
      c.res.headers.set("Expires", "0");
    }
  }
};

/**
 * Request ID Middleware for Security Audit Trails
 */
export const requestIdMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  // Generate unique request ID for tracking
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.res.headers.set("X-Request-ID", requestId);

  // Add timestamp for audit purposes
  c.set("requestTimestamp", new Date().toISOString());

  await next();
};

export const inputSanitizationMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  await next();
};

/**
 * Security Monitoring Middleware
 * Logs suspicious activities for security analysis
 */
export const securityMonitoringMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  const startTime = Date.now();
  const requestId = c.get("requestId") || crypto.randomUUID();
  const userAgent = c.req.header("user-agent") || "unknown";
  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    "unknown";
  const method = c.req.method;
  const path = c.req.path;

  // Security event detection
  const securityEvents: string[] = [];

  // Detect suspicious patterns
  if (path.includes("../") || path.includes("..\\")) {
    securityEvents.push("PATH_TRAVERSAL_ATTEMPT");
  }

  if (userAgent.length > 512) {
    securityEvents.push("SUSPICIOUS_USER_AGENT_LENGTH");
  }

  // Check for common attack patterns in path
  const attackPatterns = [
    /\.\./,
    /\/etc\/passwd/,
    /\/proc\//,
    /\.php$/,
    /\.asp$/,
    /admin\.php/,
    /wp-admin/,
    /phpmyadmin/,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
  ];

  attackPatterns.forEach((pattern) => {
    if (pattern.test(path) || pattern.test(decodeURIComponent(path))) {
      securityEvents.push("SUSPICIOUS_PATH_PATTERN");
    }
  });

  await next();

  const endTime = Date.now();
  const duration = endTime - startTime;
  const statusCode = c.res.status;

  // Log security events
  if (securityEvents.length > 0 || statusCode === 401 || statusCode === 403) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      ip,
      userAgent,
      method,
      path,
      statusCode,
      duration,
      securityEvents,
      level: securityEvents.length > 0 ? "WARNING" : "INFO",
    };

    console.warn("[SECURITY]", JSON.stringify(logEntry));

    // In production, you might want to send this to a security monitoring service
    if (c.env.NODE_ENV === "production" && securityEvents.length > 0) {
      // Example: Send to monitoring service
      // await sendToSecurityMonitoring(logEntry)
    }
  }
};

/**
 * Enhanced Rate Limiting with Security Context
 */
export const securityAwareRateLimitMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";
  const path = c.req.path;

  // Skip rate limiting for localhost (performance testing)
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "unknown" ||
    ip === "localhost"
  ) {
    return next();
  }

  // Create composite key for more sophisticated rate limiting
  const securityKey = `security_${ip}_${path.split("/")[1]}`;

  if (c.env.CACHE_KV) {
    const current = await c.env.CACHE_KV.get(securityKey);
    const count = current ? parseInt(current) : 0;

    // Stricter limits for sensitive endpoints
    const isSensitiveEndpoint =
      path.includes("/auth/") || path.includes("/admin/");
    const limit = isSensitiveEndpoint ? 10 : 100;
    const window = 60 * 1000; // 1 minute

    if (count >= limit) {
      // Log potential attack
      console.warn("[SECURITY] Rate limit exceeded", {
        ip,
        userAgent,
        path,
        count,
        timestamp: new Date().toISOString(),
      });

      return c.json(
        {
          success: false,
          error: "Rate limit exceeded",
          retryAfter: 60,
        },
        429,
      );
    }

    // Increment counter
    await c.env.CACHE_KV.put(securityKey, (count + 1).toString(), {
      expirationTtl: Math.ceil(window / 1000),
    });
  }

  await next();
};

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    requestTimestamp: string;
  }
}
