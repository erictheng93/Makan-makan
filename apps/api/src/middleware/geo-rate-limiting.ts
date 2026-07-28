import { Context, Next } from "hono";
import type { Env } from "../types/env";

// Custom AnalyticsEngine interface since it's not exported by @cloudflare/workers-types
interface AnalyticsEngine {
  writeDataPoint(data: {
    blobs?: Array<string | ArrayBuffer>;
    doubles?: Array<number>;
    indexes?: Array<string>;
  }): void;
}

/**
 * Advanced Geographic Rate Limiting with Threat Intelligence
 * Features:
 * - Dynamic rate limits based on CF-Threat-Score, geography, and ASN
 * - Sliding window rate limiting with burst protection
 * - Automatic threat response and escalation
 * - Real-time analytics and alerting
 * - Cost-optimized using Cloudflare's edge data
 */

interface BlockData {
  reason: string;
  blockedAt: number;
  blockedUntil: number;
  escalationLevel: number;
  threatScore: number;
  country: string;
  asn: string;
}

interface RateLimitConfig {
  requests: number;
  windowSeconds: number;
  burstMultiplier: number;
  blockDuration: number;
}

interface NativeRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  reason?: string;
}

interface GeoRiskProfile {
  country: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  multiplier: number;
  requiresChallenge: boolean;
  additionalChecks: string[];
}

interface ThreatIntelligence {
  ip: string;
  asn: string;
  country: string;
  city: string;
  threatScore: number;
  riskFactors: string[];
  actionRecommendation: "allow" | "challenge" | "block";
  confidence: number;
}

const SENSITIVE_KV_RATE_LIMIT_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/customers/otp",
  "/api/v1/customer/otp",
  "/api/v1/realtime/auth/guest-token",
];

function shouldUseKvRateLimiter(path: string): boolean {
  return SENSITIVE_KV_RATE_LIMIT_PATHS.some((sensitivePath) =>
    path.includes(sensitivePath),
  );
}

// High-risk countries requiring stricter limits
const HIGH_RISK_COUNTRIES = new Set([
  "CN",
  "RU",
  "KP",
  "IR",
  "SY",
  "AF",
  "MM",
  "BY",
  "CU",
  "VE",
]);

// Known bot/hosting ASNs
const BOT_ASNS = new Set([
  "13335",
  "15169",
  "16509",
  "14061",
  "32934",
  "62240",
  "44273",
  "49505",
]);

// Critical infrastructure ASNs (more lenient)
const TRUSTED_ASNS = new Set([
  "15169", // Google
  "32934", // Facebook
  "16509", // Amazon
  "8075", // Microsoft
]);

export class GeoIntelligentRateLimiter {
  constructor(
    private rateLimitKV: KVNamespace,
    private analyticsEngine: AnalyticsEngine | undefined,
    private context: Pick<ExecutionContext, "waitUntil">,
    private env: Env,
  ) {}

  /**
   * Calculate dynamic rate limit based on multiple risk factors
   */
  calculateDynamicRateLimit(
    request: Request,
    endpoint: string,
    userRole?: number,
  ): RateLimitConfig {
    const threatIntel = this.extractThreatIntelligence(request);
    const geoRisk = this.assessGeographicRisk(threatIntel);
    const endpointRisk = this.assessEndpointRisk(endpoint);

    // Base rate limits by endpoint type
    let baseConfig: RateLimitConfig;

    if (endpoint.includes("/auth/")) {
      baseConfig = {
        requests: 5,
        windowSeconds: 60,
        burstMultiplier: 1.2,
        blockDuration: 300,
      };
    } else if (endpoint.includes("/admin/") || endpoint.includes("/system/")) {
      baseConfig = {
        requests: 20,
        windowSeconds: 60,
        burstMultiplier: 1.5,
        blockDuration: 600,
      };
    } else if (
      endpoint.includes("/api/v1/orders") &&
      request.method === "POST"
    ) {
      baseConfig = {
        requests: 10,
        windowSeconds: 60,
        burstMultiplier: 2.0,
        blockDuration: 120,
      };
    } else if (endpoint.includes("/api/v1/menu")) {
      baseConfig = {
        requests: 100,
        windowSeconds: 60,
        burstMultiplier: 3.0,
        blockDuration: 60,
      };
    } else {
      baseConfig = {
        requests: 60,
        windowSeconds: 60,
        burstMultiplier: 2.0,
        blockDuration: 120,
      };
    }

    // Apply risk-based multipliers
    let riskMultiplier = 1.0;

    // Geographic risk adjustment
    riskMultiplier *= geoRisk.multiplier;

    // Threat score adjustment (most critical factor)
    if (threatIntel.threatScore > 80) {
      riskMultiplier *= 0.1; // 90% reduction for critical threats
    } else if (threatIntel.threatScore > 60) {
      riskMultiplier *= 0.2; // 80% reduction for high threats
    } else if (threatIntel.threatScore > 40) {
      riskMultiplier *= 0.5; // 50% reduction for medium threats
    } else if (threatIntel.threatScore > 20) {
      riskMultiplier *= 0.8; // 20% reduction for low threats
    }

    // ASN-based adjustments
    if (BOT_ASNS.has(threatIntel.asn)) {
      riskMultiplier *= 0.3; // Strict limits for known bots
    } else if (TRUSTED_ASNS.has(threatIntel.asn)) {
      riskMultiplier *= 1.5; // More lenient for trusted providers
    }

    // User role adjustments (if authenticated)
    if (userRole !== undefined) {
      switch (userRole) {
        case 0: // Admin
          riskMultiplier *= 2.0;
          break;
        case 1: // Owner
          riskMultiplier *= 1.8;
          break;
        case 2: // Chef
        case 3: // Service
        case 4: // Cashier
          riskMultiplier *= 1.3;
          break;
      }
    }

    // Endpoint-specific risk adjustments
    riskMultiplier *= endpointRisk.multiplier;

    // Calculate final rate limit (minimum 1 request)
    const finalRequests = Math.max(
      1,
      Math.floor(baseConfig.requests * riskMultiplier),
    );

    return {
      requests: finalRequests,
      windowSeconds: baseConfig.windowSeconds,
      burstMultiplier: baseConfig.burstMultiplier,
      blockDuration: this.calculateBlockDuration(
        threatIntel,
        baseConfig.blockDuration,
      ),
    };
  }

  /**
   * Apply rate limiting with sliding window and burst protection
   */
  async applyRateLimit(
    request: Request,
    rateLimit: RateLimitConfig,
    identifier: string,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
    reason?: string;
  }> {
    const now = Date.now();
    const windowStart = now - rateLimit.windowSeconds * 1000;

    // Sliding window over two fixed buckets.
    //
    // This used to keep one KV key per second and read every key in the window
    // (generateWindowKeys), so a 60s window cost 60 KV reads on EVERY request —
    // and since most of those seconds never saw traffic, nearly all of them were
    // misses, which is KV's slowest path. On /api/v1/auth/login that alone was
    // multiple seconds of latency.
    //
    // Instead keep one counter per window and interpolate against the previous
    // window, weighted by how far into the current window we are. Same smoothing
    // the per-second keys bought us, at 2 reads + 1 write regardless of window
    // size.
    const windowMs = rateLimit.windowSeconds * 1000;
    const windowIndex = Math.floor(now / windowMs);
    const elapsedFraction = (now % windowMs) / windowMs;
    const currentKey = `rl:${identifier}:${windowIndex}`;
    const previousKey = `rl:${identifier}:${windowIndex - 1}`;

    try {
      const [currentCount, previousCount] = await Promise.all([
        this.rateLimitKV.get(currentKey).then((val) => parseInt(val || "0")),
        this.rateLimitKV.get(previousKey).then((val) => parseInt(val || "0")),
      ]);

      // The previous window only counts for the portion still inside the
      // trailing window edge.
      const totalRequests = Math.round(
        previousCount * (1 - elapsedFraction) + currentCount,
      );
      const burstLimit = Math.ceil(
        rateLimit.requests * rateLimit.burstMultiplier,
      );

      // Check if over limit
      if (totalRequests >= burstLimit) {
        // Record rate limit violation
        this.recordRateLimitViolation(
          request,
          identifier,
          totalRequests,
          burstLimit,
        );

        return {
          allowed: false,
          remaining: 0,
          resetTime: windowStart + rateLimit.windowSeconds * 1000,
          retryAfter: rateLimit.blockDuration,
          reason: "Rate limit exceeded",
        };
      }

      // Increment the current window. We already read currentCount above, so
      // there is no need to re-read it here (the old code did a second blocking
      // get inside the put's argument list).
      //
      // TTL spans two windows so the previous-window interpolation above still
      // has a value to read from.
      await this.rateLimitKV.put(currentKey, (currentCount + 1).toString(), {
        expirationTtl: rateLimit.windowSeconds * 2 + 10,
      });

      const remaining = Math.max(0, rateLimit.requests - (totalRequests + 1));

      return {
        allowed: true,
        remaining,
        resetTime: windowStart + rateLimit.windowSeconds * 1000,
      };
    } catch (error) {
      console.error("Rate limiting error:", error);
      // Fail open for availability
      return {
        allowed: true,
        remaining: rateLimit.requests,
        resetTime: windowStart + rateLimit.windowSeconds * 1000,
      };
    }
  }

  /**
   * Check if IP/identifier is currently blocked
   */
  async isBlocked(identifier: string): Promise<{
    blocked: boolean;
    blockedUntil?: number;
    reason?: string;
    escalationLevel?: number;
  }> {
    try {
      const blockKey = `block:${identifier}`;
      const blockData = await this.rateLimitKV.get(blockKey, { type: "json" });

      if (!blockData) {
        return { blocked: false };
      }

      const now = Date.now();
      const blockInfo = blockData as {
        blockedUntil?: number;
        reason?: string;
        escalationLevel?: number;
      };

      if (blockInfo.blockedUntil && now < blockInfo.blockedUntil) {
        return {
          blocked: true,
          blockedUntil: blockInfo.blockedUntil,
          reason: blockInfo.reason || "Security violation",
          escalationLevel: blockInfo.escalationLevel || 1,
        };
      }

      // Block expired, clean up
      await this.rateLimitKV.delete(blockKey);
      return { blocked: false };
    } catch (error) {
      console.error("Block check error:", error);
      return { blocked: false };
    }
  }

  /**
   * Block an identifier with escalating penalties
   */
  async blockIdentifier(
    identifier: string,
    reason: string,
    durationSeconds: number,
    threatIntel: ThreatIntelligence,
  ): Promise<void> {
    try {
      // Get existing escalation level
      const escalationKey = `escalation:${identifier}`;
      const currentLevel = parseInt(
        (await this.rateLimitKV.get(escalationKey)) || "0",
      );
      const newLevel = currentLevel + 1;

      // Escalating block durations
      const escalatedDuration =
        durationSeconds * Math.pow(2, Math.min(newLevel - 1, 5)); // Max 32x
      const blockedUntil = Date.now() + escalatedDuration * 1000;

      const blockData = {
        reason,
        blockedAt: Date.now(),
        blockedUntil,
        escalationLevel: newLevel,
        threatScore: threatIntel.threatScore,
        country: threatIntel.country,
        asn: threatIntel.asn,
      };

      // Store block information
      await Promise.all([
        this.rateLimitKV.put(`block:${identifier}`, JSON.stringify(blockData), {
          expirationTtl: escalatedDuration + 60,
        }),
        this.rateLimitKV.put(escalationKey, newLevel.toString(), {
          expirationTtl: 24 * 60 * 60, // Reset escalation after 24 hours
        }),
      ]);

      // Record security event
      this.recordSecurityBlock(identifier, blockData, threatIntel);

      // Trigger alerts for high-level escalations
      if (newLevel >= 3) {
        this.context.waitUntil(
          this.triggerSecurityAlert(identifier, blockData, threatIntel),
        );
      }
    } catch (error) {
      console.error("Block identifier error:", error);
    }
  }

  /**
   * Extract comprehensive threat intelligence from request
   */
  private extractThreatIntelligence(request: Request): ThreatIntelligence {
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const country = request.headers.get("CF-IPCountry") || "unknown";
    const city = request.headers.get("CF-IPCity") || "unknown";
    const asn = request.headers.get("CF-ASN") || "unknown";
    const threatScore = parseInt(request.headers.get("CF-Threat-Score") || "0");
    const userAgent = request.headers.get("User-Agent") || "";

    const riskFactors: string[] = [];
    let actionRecommendation: "allow" | "challenge" | "block" = "allow";
    let confidence = 0.7;

    // Analyze risk factors
    if (HIGH_RISK_COUNTRIES.has(country)) {
      riskFactors.push("high_risk_country");
      confidence += 0.1;
    }

    if (BOT_ASNS.has(asn)) {
      riskFactors.push("bot_asn");
      confidence += 0.1;
    }

    if (threatScore > 50) {
      riskFactors.push("high_threat_score");
      confidence += 0.2;
    }

    if (this.detectSuspiciousUserAgent(userAgent)) {
      riskFactors.push("suspicious_user_agent");
      confidence += 0.1;
    }

    // Determine action recommendation
    if (
      threatScore > 80 ||
      (threatScore > 60 && HIGH_RISK_COUNTRIES.has(country))
    ) {
      actionRecommendation = "block";
    } else if (threatScore > 40 || HIGH_RISK_COUNTRIES.has(country)) {
      actionRecommendation = "challenge";
    }

    return {
      ip,
      asn,
      country,
      city,
      threatScore,
      riskFactors,
      actionRecommendation,
      confidence: Math.min(confidence, 1.0),
    };
  }

  /**
   * Assess geographic risk profile
   */
  private assessGeographicRisk(
    threatIntel: ThreatIntelligence,
  ): GeoRiskProfile {
    const { country, threatScore } = threatIntel;

    if (HIGH_RISK_COUNTRIES.has(country) || threatScore > 70) {
      return {
        country,
        riskLevel: "critical",
        multiplier: 0.1,
        requiresChallenge: true,
        additionalChecks: [
          "captcha",
          "device_fingerprint",
          "behavioral_analysis",
        ],
      };
    } else if (threatScore > 50) {
      return {
        country,
        riskLevel: "high",
        multiplier: 0.3,
        requiresChallenge: true,
        additionalChecks: ["captcha", "device_fingerprint"],
      };
    } else if (threatScore > 25) {
      return {
        country,
        riskLevel: "medium",
        multiplier: 0.6,
        requiresChallenge: false,
        additionalChecks: ["device_fingerprint"],
      };
    }

    return {
      country,
      riskLevel: "low",
      multiplier: 1.0,
      requiresChallenge: false,
      additionalChecks: [],
    };
  }

  /**
   * Assess endpoint-specific risk
   */
  private assessEndpointRisk(endpoint: string): {
    multiplier: number;
    additionalChecks: string[];
  } {
    if (
      endpoint.includes("/auth/login") ||
      endpoint.includes("/auth/register")
    ) {
      return {
        multiplier: 0.5,
        additionalChecks: ["captcha", "device_fingerprint"],
      };
    } else if (endpoint.includes("/admin/") || endpoint.includes("/system/")) {
      return { multiplier: 0.3, additionalChecks: ["mfa", "ip_whitelist"] };
    } else if (endpoint.includes("/orders") && endpoint.includes("POST")) {
      return { multiplier: 0.7, additionalChecks: ["fraud_detection"] };
    }

    return { multiplier: 1.0, additionalChecks: [] };
  }

  /**
   * Calculate block duration based on threat level
   */
  private calculateBlockDuration(
    threatIntel: ThreatIntelligence,
    baseDuration: number,
  ): number {
    let multiplier = 1.0;

    if (threatIntel.threatScore > 90) multiplier = 10.0;
    else if (threatIntel.threatScore > 80) multiplier = 5.0;
    else if (threatIntel.threatScore > 70) multiplier = 3.0;
    else if (threatIntel.threatScore > 60) multiplier = 2.0;

    if (HIGH_RISK_COUNTRIES.has(threatIntel.country)) {
      multiplier *= 2.0;
    }

    return Math.floor(baseDuration * multiplier);
  }

  /**
   * Detect suspicious user agent patterns
   */
  private detectSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /python/i,
      /curl/i,
      /wget/i,
      /bot(?!.*googlebot|bingbot|baiduspider)/i,
      /scanner/i,
      /crawler/i,
      /spider(?!.*googlebot)/i,
      /scraper/i,
      /^$/,
      /.{0,10}$/, // Too short
      /.{500,}$/, // Too long
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Record rate limit violation for analytics
   */
  private recordRateLimitViolation(
    request: Request,
    identifier: string,
    currentRequests: number,
    limit: number,
  ): void {
    if (this.analyticsEngine) {
      try {
        this.analyticsEngine.writeDataPoint({
          blobs: [
            "rate_limit_violation",
            identifier,
            request.headers.get("CF-IPCountry") || "unknown",
            request.headers.get("CF-ASN") || "unknown",
            new URL(request.url).pathname,
          ],
          doubles: [
            Date.now(),
            currentRequests,
            limit,
            parseInt(request.headers.get("CF-Threat-Score") || "0"),
          ],
          // One index only — Analytics Engine rejects more, and both values
          // are already in the doubles above.
          indexes: [currentRequests.toString()],
        });
      } catch (error) {
        console.error("Analytics error:", error);
      }
    }
  }

  /**
   * Record security block event
   */
  private recordSecurityBlock(
    identifier: string,
    blockData: BlockData,
    threatIntel: ThreatIntelligence,
  ): void {
    if (this.analyticsEngine) {
      try {
        this.analyticsEngine.writeDataPoint({
          blobs: [
            "security_block",
            identifier,
            blockData.reason,
            threatIntel.country,
            threatIntel.asn,
          ],
          doubles: [
            Date.now(),
            blockData.escalationLevel,
            threatIntel.threatScore,
            blockData.blockedUntil - blockData.blockedAt,
          ],
          // One index only — Analytics Engine rejects more, and both values
          // are already in the doubles above.
          indexes: [blockData.escalationLevel.toString()],
        });
      } catch (error) {
        console.error("Analytics error:", error);
      }
    }
  }

  /**
   * Trigger security alert for high-severity blocks
   */
  private async triggerSecurityAlert(
    identifier: string,
    blockData: BlockData,
    threatIntel: ThreatIntelligence,
  ): Promise<void> {
    try {
      if (this.env.SLACK_WEBHOOK_URL) {
        await fetch(this.env.SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 Security Alert: High-level escalation block`,
            attachments: [
              {
                color: "danger",
                fields: [
                  { title: "IP/Identifier", value: identifier, short: true },
                  { title: "Country", value: threatIntel.country, short: true },
                  {
                    title: "Threat Score",
                    value: threatIntel.threatScore.toString(),
                    short: true,
                  },
                  {
                    title: "Escalation Level",
                    value: blockData.escalationLevel.toString(),
                    short: true,
                  },
                  { title: "Reason", value: blockData.reason, short: false },
                  {
                    title: "Risk Factors",
                    value: threatIntel.riskFactors.join(", "),
                    short: false,
                  },
                ],
              },
            ],
          }),
        });
      }
    } catch (error) {
      console.error("Failed to send security alert:", error);
    }
  }
}

/**
 * Geo-Intelligent Rate Limiting Middleware
 */
export function geoIntelligentRateLimitMiddleware(
  options: {
    skipPaths?: string[];
    customLimits?: Record<string, Partial<RateLimitConfig>>;
  } = {},
) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const path = c.req.path;

    // Skip rate limiting entirely in local development and CI integration
    // runs. The integration test suite makes hundreds of requests in <1min
    // from the same loopback IP, which trips the geo-rate-limiter and
    // blocks the whole IP for minutes. Both NODE_ENV=development (local
    // dev via `pnpm dev`) and NODE_ENV=test (the value CI sets in the
    // generated `.dev.vars` for nightly-integration.yml) need to bypass.
    // Production is unaffected because NODE_ENV is set explicitly.
    const nodeEnv = c.env.NODE_ENV as string;
    if (nodeEnv === "development" || nodeEnv === "test") {
      await next();
      return;
    }

    // Skip rate limiting for certain paths
    if (options.skipPaths?.some((skipPath) => path.includes(skipPath))) {
      await next();
      return;
    }

    const rateLimiter = new GeoIntelligentRateLimiter(
      c.env.RATE_LIMIT_KV,
      c.env.ANALYTICS_ENGINE,
      c.executionCtx,
      c.env,
    );

    // Create identifier (prefer user ID, fallback to IP)
    const user = c.get("user");
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const identifier = user?.id ? `user:${user.id}` : `ip:${ip}`;

    const nativeLimiter = c.env.GLOBAL_RATE_LIMITER;
    const useKvRateLimiter = !nativeLimiter || shouldUseKvRateLimiter(path);

    if (useKvRateLimiter) {
      // Check if blocked. This remains KV-backed only for sensitive/fallback
      // paths so normal traffic does not pay a KV read before native limiting.
      const blockStatus = await rateLimiter.isBlocked(identifier);
      if (blockStatus.blocked) {
        return c.json(
          {
            success: false,
            error: "Access temporarily blocked",
            reason: blockStatus.reason,
            blocked_until: blockStatus.blockedUntil,
            escalation_level: blockStatus.escalationLevel,
          },
          429,
        );
      }
    }

    // Calculate dynamic rate limit
    const rateLimit = rateLimiter.calculateDynamicRateLimit(
      c.req.raw,
      path,
      user?.role,
    );

    // Apply custom limits if configured
    const customLimit = options.customLimits?.[path];
    if (customLimit) {
      Object.assign(rateLimit, customLimit);
    }

    let result: NativeRateLimitResult;

    // Check rate limit
    if (!useKvRateLimiter) {
      try {
        const outcome = await nativeLimiter.limit({
          key: `${identifier}:${path}`,
        });
        const resetTime = Date.now() + rateLimit.windowSeconds * 1000;
        result = {
          allowed: outcome.success,
          remaining: outcome.success ? rateLimit.requests - 1 : 0,
          resetTime,
          retryAfter: rateLimit.blockDuration,
          reason: outcome.success
            ? undefined
            : "Rate limit exceeded by edge limiter",
        };
      } catch (error) {
        console.error("Native rate limiting error:", error);
        result = {
          allowed: true,
          remaining: rateLimit.requests,
          resetTime: Date.now() + rateLimit.windowSeconds * 1000,
        };
      }
    } else {
      result = await rateLimiter.applyRateLimit(
        c.req.raw,
        rateLimit,
        identifier,
      );
    }

    if (!result.allowed) {
      // Extract threat intelligence for blocking decision
      const threatIntel = (
        rateLimiter as unknown as {
          extractThreatIntelligence: (req: Request) => ThreatIntelligence;
        }
      ).extractThreatIntelligence(c.req.raw);

      // Block high-threat sources
      if (
        threatIntel.threatScore > 70 ||
        threatIntel.actionRecommendation === "block"
      ) {
        await rateLimiter.blockIdentifier(
          identifier,
          "Automated security block: High threat score",
          rateLimit.blockDuration,
          threatIntel,
        );
      }

      // Set rate limit headers
      c.res.headers.set("X-RateLimit-Limit", rateLimit.requests.toString());
      c.res.headers.set("X-RateLimit-Remaining", "0");
      c.res.headers.set("X-RateLimit-Reset", result.resetTime.toString());
      c.res.headers.set("Retry-After", (result.retryAfter || 60).toString());

      return c.json(
        {
          success: false,
          error: "Rate limit exceeded",
          reason: result.reason,
          retry_after: result.retryAfter || 60,
          threat_score: threatIntel.threatScore,
          recommended_action: threatIntel.actionRecommendation,
        },
        429,
      );
    }

    // Set rate limit headers for successful requests
    c.res.headers.set("X-RateLimit-Limit", rateLimit.requests.toString());
    c.res.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    c.res.headers.set("X-RateLimit-Reset", result.resetTime.toString());

    await next();
  };
}

declare module "hono" {
  interface ContextVariableMap {
    rateLimiter: GeoIntelligentRateLimiter;
  }
}
