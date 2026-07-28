import { Context, Next } from "hono";
import type { Env } from "../types/env";
import { badRequest } from "../shared/utils/api-error";

// Custom AnalyticsEngine interface since it's not exported by @cloudflare/workers-types
interface AnalyticsEngine {
  writeDataPoint(data: {
    blobs?: Array<string | ArrayBuffer>;
    doubles?: Array<number>;
    indexes?: Array<string>;
  }): void;
}

/**
 * Advanced Workers Analytics Integration
 * Provides comprehensive business intelligence and performance monitoring
 * at the edge with zero-latency impact on requests
 */

export interface AnalyticsDataPoint {
  event: string;
  restaurant_id?: number | string;
  user_id?: number | string;
  dimensions: Record<string, string>;
  metrics: Record<string, number>;
  timestamp?: number;
}

export interface AnalyticsQuery {
  metrics: string[];
  event?: string;
  restaurant_id?: string;
  group_by?: string[];
  order_by?: string;
  limit?: number;
}

export class AdvancedAnalyticsService {
  // Whitelist of allowed Analytics Engine metric expressions
  private static readonly ALLOWED_METRICS = new Set([
    "count",
    "sum(double1)",
    "avg(double1)",
    "sum(double2)",
    "avg(double2)",
    "quantileWeighted(0.5)(double1)",
    "min(double1)",
    "max(double1)",
    "min(double2)",
    "max(double2)",
    "timestamp",
  ]);

  // Whitelist of allowed Analytics Engine group-by columns
  private static readonly ALLOWED_GROUP_BY = new Set([
    "blob1",
    "blob2",
    "blob3",
    "blob4",
    "blob5",
    "blob6",
    "blob7",
    "blob8",
    "blob9",
    "blob10",
    "double1",
    "double2",
    "_sample_interval",
  ]);

  constructor(
    private analyticsEngine: AnalyticsEngine | undefined,
    private context: ExecutionContext,
    private env: Env,
  ) {}

  /**
   * Record high-performance analytics events with zero request latency impact
   */
  async recordEvent(dataPoint: AnalyticsDataPoint): Promise<void> {
    try {
      if (!this.analyticsEngine) {
        return;
      }

      // Use waitUntil to ensure zero impact on request performance
      this.context.waitUntil(
        Promise.resolve(
          this.analyticsEngine.writeDataPoint({
            // String dimensions (blobs) - up to 20
            blobs: [
              dataPoint.event,
              dataPoint.restaurant_id?.toString() || "0",
              dataPoint.user_id?.toString() || "0",
              dataPoint.dimensions.country || "unknown",
              dataPoint.dimensions.city || "unknown",
              dataPoint.dimensions.device_type || "unknown",
              dataPoint.dimensions.browser || "unknown",
              dataPoint.dimensions.endpoint || "unknown",
              dataPoint.dimensions.method || "GET",
              dataPoint.dimensions.status_code || "200",
              dataPoint.dimensions.user_role || "guest",
              dataPoint.dimensions.order_type || "unknown",
              dataPoint.dimensions.payment_method || "unknown",
              dataPoint.dimensions.campaign_source || "direct",
              dataPoint.dimensions.ab_test_variant || "control",
            ],

            // Numeric metrics (doubles) - up to 20
            doubles: [
              dataPoint.timestamp || Date.now(),
              dataPoint.metrics.response_time || 0,
              dataPoint.metrics.cpu_time || 0,
              dataPoint.metrics.memory_used || 0,
              dataPoint.metrics.cache_hit_rate || 0,
              dataPoint.metrics.error_rate || 0,
              dataPoint.metrics.conversion_rate || 0,
              dataPoint.metrics.order_value || 0,
              dataPoint.metrics.customer_wait_time || 0,
              dataPoint.metrics.kitchen_prep_time || 0,
              dataPoint.metrics.delivery_time || 0,
              dataPoint.metrics.user_session_duration || 0,
              dataPoint.metrics.page_load_time || 0,
              dataPoint.metrics.api_calls_count || 0,
              dataPoint.metrics.database_query_time || 0,
              dataPoint.metrics.threat_score || 0,
              dataPoint.metrics.customer_rating || 0,
              dataPoint.metrics.items_in_cart || 0,
              dataPoint.metrics.discount_amount || 0,
              dataPoint.metrics.tip_amount || 0,
            ],

            // Analytics Engine accepts exactly ONE index — it is the sampling
            // key, not a list of queryable dimensions. This used to pass 20,
            // so writeDataPoint threw `Maximum of 1 indexes supported` on every
            // request and the dataset never received a single data point.
            //
            // Nothing is lost by dropping the rest: those values are either
            // already carried in the blobs/doubles above, or derivable at query
            // time (timestamp is a built-in column, and hour/day/week come from
            // toHour()/toDayOfWeek()/toYYYYMM() in SQL).
            //
            // restaurant_id is the right key — it is the dimension we group by
            // most, so sampling stays representative per tenant instead of
            // letting one busy restaurant crowd out the rest.
            indexes: [dataPoint.restaurant_id?.toString() || "0"],
          }),
        ),
      );
    } catch (error) {
      console.error("Analytics recording failed:", error);
      // Don't throw - analytics failures should never impact user experience
    }
  }

  /**
   * Record performance metrics with automatic alerting
   */
  async recordPerformanceMetrics(
    endpoint: string,
    metrics: {
      response_time: number;
      cpu_time: number;
      memory_used: number;
      cache_hit_rate: number;
      error_rate: number;
      concurrent_requests: number;
    },
  ): Promise<void> {
    await this.recordEvent({
      event: "performance_metrics",
      dimensions: {
        endpoint,
        performance_category: this.categorizePerformance(metrics.response_time),
        alerting_level: this.determineAlertingLevel(metrics),
      },
      metrics,
    });

    // Automatic alerting for performance issues
    if (this.shouldAlert(metrics)) {
      this.context.waitUntil(this.triggerPerformanceAlert(endpoint, metrics));
    }
  }

  /**
   * Record security events and threat intelligence
   */
  async recordSecurityEvent(
    event: string,
    details: {
      ip_address: string;
      user_agent: string;
      country: string;
      threat_score: number;
      action_taken: string;
      endpoint: string;
      blocked: boolean;
    },
  ): Promise<void> {
    await this.recordEvent({
      event: "security_event",
      dimensions: {
        security_event: event,
        country: details.country,
        action_taken: details.action_taken,
        endpoint: details.endpoint,
        blocked: details.blocked.toString(),
        threat_level: this.categorizeThreatLevel(details.threat_score),
      },
      metrics: {
        threat_score: details.threat_score,
        blocked_request: details.blocked ? 1 : 0,
      },
    });

    // Automatic threat response
    if (details.threat_score > 80) {
      this.context.waitUntil(this.triggerSecurityAlert(event, details));
    }
  }

  /**
   * Query analytics data for real-time insights
   */
  async queryAnalytics(query: {
    event?: string;
    restaurant_id?: string;
    time_range: "1h" | "24h" | "7d" | "30d";
    metrics: string[];
    group_by?: string[];
    filters?: Record<string, unknown>;
  }): Promise<unknown[]> {
    try {
      // This would typically use the Analytics Engine SQL API
      // For now, we'll structure the query parameters
      const timeRange = this.getTimeRangeMillis(query.time_range);
      const startTime = Date.now() - timeRange;

      // Build SQL query for Analytics Engine
      const sql = this.buildAnalyticsQuery(query, startTime);

      // Execute query (would need Analytics Engine SQL API)
      console.log("Analytics Query:", sql);

      return []; // Placeholder - would return actual results
    } catch (error) {
      console.error("Analytics query failed:", error);
      return [];
    }
  }

  // Private helper methods
  private categorizePerformance(responseTime: number): string {
    if (responseTime < 100) return "excellent";
    if (responseTime < 300) return "good";
    if (responseTime < 1000) return "acceptable";
    return "poor";
  }

  private categorizeThreatLevel(threatScore: number): string {
    if (threatScore < 20) return "low";
    if (threatScore < 50) return "medium";
    if (threatScore < 80) return "high";
    return "critical";
  }

  private determineAlertingLevel(metrics: {
    error_rate: number;
    response_time: number;
  }): string {
    if (metrics.error_rate > 0.05 || metrics.response_time > 5000)
      return "critical";
    if (metrics.error_rate > 0.02 || metrics.response_time > 2000)
      return "warning";
    return "normal";
  }

  private shouldAlert(metrics: {
    error_rate: number;
    response_time: number;
    cpu_time: number;
    memory_used: number;
  }): boolean {
    return (
      metrics.error_rate > 0.05 ||
      metrics.response_time > 5000 ||
      metrics.cpu_time > 800 ||
      metrics.memory_used > 100
    );
  }

  private async triggerPerformanceAlert(
    endpoint: string,
    metrics: {
      response_time: number;
      error_rate: number;
      cpu_time: number;
      memory_used: number;
    },
  ): Promise<void> {
    try {
      // Send to alerting system (Slack, PagerDuty, etc.)
      if (this.env.SLACK_WEBHOOK_URL) {
        await fetch(this.env.SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 Performance Alert: ${endpoint}`,
            attachments: [
              {
                color: "danger",
                fields: [
                  {
                    title: "Response Time",
                    value: `${metrics.response_time}ms`,
                    short: true,
                  },
                  {
                    title: "Error Rate",
                    value: `${(metrics.error_rate * 100).toFixed(2)}%`,
                    short: true,
                  },
                  {
                    title: "CPU Time",
                    value: `${metrics.cpu_time}ms`,
                    short: true,
                  },
                  {
                    title: "Memory",
                    value: `${metrics.memory_used}MB`,
                    short: true,
                  },
                ],
              },
            ],
          }),
        });
      }
    } catch (error) {
      console.error("Failed to send performance alert:", error);
    }
  }

  private async triggerSecurityAlert(
    event: string,
    details: {
      ip_address: string;
      country: string;
      threat_score: number;
      action_taken: string;
    },
  ): Promise<void> {
    try {
      if (this.env.SLACK_WEBHOOK_URL) {
        await fetch(this.env.SLACK_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🔒 Security Alert: ${event}`,
            attachments: [
              {
                color: "warning",
                fields: [
                  {
                    title: "IP Address",
                    value: details.ip_address,
                    short: true,
                  },
                  { title: "Country", value: details.country, short: true },
                  {
                    title: "Threat Score",
                    value: details.threat_score.toString(),
                    short: true,
                  },
                  { title: "Action", value: details.action_taken, short: true },
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

  private getTimeRangeMillis(range: string): number {
    switch (range) {
      case "1h":
        return 60 * 60 * 1000;
      case "24h":
        return 24 * 60 * 60 * 1000;
      case "7d":
        return 7 * 24 * 60 * 60 * 1000;
      case "30d":
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  private buildAnalyticsQuery(
    query: AnalyticsQuery,
    startTime: number,
  ): string {
    // Validate metrics against whitelist
    const safeMetrics = query.metrics.filter((m) =>
      AdvancedAnalyticsService.ALLOWED_METRICS.has(m),
    );
    if (safeMetrics.length === 0) {
      throw badRequest(
        "No valid metrics provided. Allowed: " +
          [...AdvancedAnalyticsService.ALLOWED_METRICS].join(", "),
        "INVALID_METRICS",
      );
    }

    // Validate identifier pattern for event and restaurant_id
    const identifierPattern = /^[a-zA-Z0-9_-]+$/;

    let sql = `SELECT ${safeMetrics.join(", ")} FROM analytics WHERE timestamp >= ${startTime}`;

    if (query.event) {
      if (!identifierPattern.test(query.event)) {
        throw badRequest(
          "Invalid event name. Only alphanumeric, underscore, and hyphen characters are allowed.",
          "INVALID_EVENT",
        );
      }
      sql += ` AND blob1 = '${query.event}'`;
    }

    if (query.restaurant_id) {
      if (!identifierPattern.test(query.restaurant_id)) {
        throw badRequest(
          "Invalid restaurant_id. Only alphanumeric, underscore, and hyphen characters are allowed.",
          "INVALID_RESTAURANT_ID",
        );
      }
      sql += ` AND blob2 = '${query.restaurant_id}'`;
    }

    if (query.group_by?.length) {
      const safeGroupBy = query.group_by.filter((g) =>
        AdvancedAnalyticsService.ALLOWED_GROUP_BY.has(g),
      );
      if (safeGroupBy.length > 0) {
        sql += ` GROUP BY ${safeGroupBy.join(", ")}`;
      }
    }

    sql += ` ORDER BY timestamp DESC LIMIT 1000`;

    return sql;
  }
}

/**
 * Advanced Analytics Middleware
 */
export function advancedAnalyticsMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const startTime = Date.now();
    const requestId = c.get("requestId") || crypto.randomUUID();

    // Create a minimal execution context if not available.
    const executionCtx = c.executionCtx || {
      waitUntil: (p: Promise<unknown>) => p,
    };
    const analyticsEngine = c.env.ANALYTICS_ENGINE ?? c.env.ANALYTICS;
    const analytics = new AdvancedAnalyticsService(
      analyticsEngine,
      executionCtx as ExecutionContext,
      c.env,
    );

    // Store analytics service in context
    (
      c as unknown as Context<{
        Bindings: Env;
        Variables: { analytics: AdvancedAnalyticsService };
      }>
    ).set("analytics", analytics);

    // Extract request metadata
    const metadata = {
      endpoint: c.req.path,
      method: c.req.method,
      user_agent: c.req.header("User-Agent") || "unknown",
      country: c.req.header("CF-IPCountry") || "unknown",
      city: c.req.header("CF-IPCity") || "unknown",
      device_type: "unknown", // detectDeviceType(c.req.header('User-Agent') || ''),
      browser: "unknown", // detectBrowser(c.req.header('User-Agent') || ''),
      ip_address: c.req.header("CF-Connecting-IP") || "unknown",
      threat_score: parseInt(c.req.header("CF-Threat-Score") || "0"),
    };

    await next();

    // Calculate response metrics
    const responseTime = Date.now() - startTime;
    const statusCode = c.res.status;
    const user = c.get("user");
    const restaurantId =
      user?.restaurantId || parseInt(c.req.param("restaurantId") || "0");

    // Record comprehensive analytics
    analytics.recordEvent({
      event: "api_request",
      restaurant_id: restaurantId,
      user_id: user?.id,
      dimensions: {
        status_code: statusCode.toString(),
        user_role: user?.role?.toString() || "guest",
        request_id: requestId,
        endpoint: metadata.endpoint,
        method: metadata.method,
        user_agent: metadata.user_agent,
        country: metadata.country,
        city: metadata.city,
        device_type: metadata.device_type,
        browser: metadata.browser,
        ip_address: metadata.ip_address,
        threat_score: metadata.threat_score.toString(),
      },
      metrics: {
        response_time: responseTime,
        status_code: statusCode,
        threat_score: metadata.threat_score,
        request_size: parseInt(c.req.header("Content-Length") || "0"),
        user_session_duration: 0, // Would be calculated from session data
      },
    });

    // Record performance metrics if slow
    if (responseTime > 1000 || statusCode >= 500) {
      analytics.recordPerformanceMetrics(metadata.endpoint, {
        response_time: responseTime,
        cpu_time: 0, // Would be measured
        memory_used: 0, // Would be measured
        cache_hit_rate: c.res.headers.get("X-Cache") === "HIT" ? 1 : 0,
        error_rate: statusCode >= 400 ? 1 : 0,
        concurrent_requests: 0, // Would be tracked
      });
    }

    // Record security events for suspicious activity
    if (
      metadata.threat_score > 50 ||
      statusCode === 401 ||
      statusCode === 403
    ) {
      analytics.recordSecurityEvent("suspicious_request", {
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        country: metadata.country,
        threat_score: metadata.threat_score,
        action_taken: statusCode >= 400 ? "blocked" : "allowed",
        endpoint: metadata.endpoint,
        blocked: statusCode >= 400,
      });
    }
  };

  // Helper functions for device/browser detection
  function _detectDeviceType(userAgent: string): string {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return "mobile";
    if (/Tablet/.test(userAgent)) return "tablet";
    return "desktop";
  }

  function _detectBrowser(userAgent: string): string {
    if (/Chrome/.test(userAgent)) return "chrome";
    if (/Firefox/.test(userAgent)) return "firefox";
    if (/Safari/.test(userAgent)) return "safari";
    if (/Edge/.test(userAgent)) return "edge";
    return "other";
  }
}

declare module "hono" {
  interface ContextVariableMap {
    analytics: AdvancedAnalyticsService;
  }
}
