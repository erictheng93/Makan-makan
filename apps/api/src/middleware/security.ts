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

/**
 * Input Sanitization Middleware for XSS Prevention
 */
export const inputSanitizationMiddleware = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
  // Only sanitize for content-type: application/json
  const contentType = c.req.header("content-type");
  if (contentType?.includes("application/json")) {
    try {
      const body = await c.req.json();
      if (body && typeof body === "object") {
        const sanitizedBody = sanitizeObject(body);
        // Replace the request with sanitized data
        c.req.json = async () => sanitizedBody;
      }
    } catch {
      // If JSON parsing fails, let the validation middleware handle it
      // Don't throw here to avoid breaking the middleware chain
    }
  }

  await next();
};

/**
 * Recursively sanitize object properties to prevent XSS
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  return obj;
}

/**
 * Sanitize string input to prevent XSS attacks
 * Enhanced implementation with comprehensive HTML entity encoding
 */
function sanitizeString(str: string): string {
  // Apply dangerous pattern removal in a loop to handle nested/recursive bypass attempts
  // e.g., "<scr<script>ipt>" becomes "<script>" after one pass, so we repeat until stable
  let sanitized = str;
  let previous: string;

  // Use regex patterns that match obfuscated variants (handles character insertion attacks)
  // e.g., "<scr<script>ipt>" won't bypass these because they match character-by-character
  const dangerousTagPatterns = [
    /<s\s*c\s*r\s*i\s*p\s*t/gi,
    /<i\s*f\s*r\s*a\s*m\s*e/gi,
    /<o\s*b\s*j\s*e\s*c\s*t/gi,
    /<e\s*m\s*b\s*e\s*d/gi,
    /<a\s*p\s*p\s*l\s*e\s*t/gi,
  ];

  do {
    previous = sanitized;
    sanitized = sanitized
      // Remove script tags and content (case-insensitive, handles broken tags)
      .replace(/<script[^>]*>[\s\S]*?<\/script[^>]*>/gi, "")
      // Remove dangerous protocol handlers (javascript:, vbscript:, data:text/html, etc.)
      .replace(
        /(javascript|vbscript|data:text\/html|data:text\/javascript|data:application\/javascript):/gi,
        "",
      )
      // Remove on* event handlers (onclick, onerror, onload, etc.)
      .replace(/\bon\w+\s*=/gi, "")
      // Remove style attributes that could contain expressions
      .replace(/\s*style\s*=\s*["'][^"']*expression\([^"']*\)["']/gi, "")
      // Remove import statements
      .replace(/@import\s+/gi, "")
      // Remove iframe, object, embed, applet tags and content
      .replace(
        /<(iframe|object|embed|applet)[^>]*>[\s\S]*?<\/(iframe|object|embed|applet)>/gi,
        "",
      );

    // Remove obfuscated dangerous tags (e.g., <s c r i p t, <i f r a m e)
    for (const pattern of dangerousTagPatterns) {
      sanitized = sanitized.replace(pattern, "");
    }
  } while (sanitized !== previous);

  // Then, HTML entity encode ALL special characters for defense in depth
  // This ensures even if something slips through regex, it's encoded
  return sanitized.replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00FF]/g,
    (char) => {
      // Comprehensive entity map including extended ASCII
      const code = char.charCodeAt(0);

      // Standard HTML entities (most common XSS vectors)
      const standardEntities: { [key: string]: string } = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;",
      };

      // Return standard entity if available, otherwise use numeric entity
      return standardEntities[char] || `&#${code};`;
    },
  );
}

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
