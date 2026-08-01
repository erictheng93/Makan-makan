import { describe, expect, it } from "vitest";
import {
  alertRuleSchema,
  monitoringConfigSchema,
  overviewQuerySchema,
  paginationSchema,
  performanceReportQuerySchema,
  updateAlertRuleSchema,
} from "./validation";

describe("monitoring validation schemas", () => {
  it("decodes escaped alert operators and conditions", () => {
    const parsed = alertRuleSchema.parse({
      name: "High latency",
      condition: "p95 &gt; 500 &amp;&amp; enabled &#x3D; true",
      metric: "request_latency_ms",
      operator: "&gt;=",
      threshold: 500,
      duration: 60,
      config: {
        type: "webhook",
        severity: "critical",
        enabled: true,
        webhookUrl: "https://alerts.example.test/hook",
      },
    });

    expect(parsed.operator).toBe(">=");
    expect(parsed.condition).toBe("p95 > 500 && enabled = true");
  });

  it("validates partial alert updates", () => {
    expect(updateAlertRuleSchema.parse({ operator: "&lt;" })).toEqual({
      operator: "<",
    });
    expect(() => updateAlertRuleSchema.parse({ operator: "!=" })).toThrow();
  });

  it("applies pagination and performance report defaults", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(performanceReportQuerySchema.parse({ days: "14" })).toEqual({
      days: 14,
    });

    // Pin the bound itself, not Zod's message wording, so the shared
    // boundedLimitQuery helper stays free to phrase the error however it likes.
    expect(paginationSchema.parse({ limit: "100" })).toEqual({
      page: 1,
      limit: 100,
    });
    expect(() => paginationSchema.parse({ limit: "101" })).toThrow();
  });

  it("accepts an absent or explicit overview include, and nothing else", () => {
    // Absent stays absent so existing callers keep the payload they had.
    expect(overviewQuerySchema.parse({})).toEqual({});
    expect(overviewQuerySchema.parse({ include: "metrics" })).toEqual({
      include: "metrics",
    });

    expect(() =>
      overviewQuerySchema.parse({ include: "everything" }),
    ).toThrow();
  });

  it("applies monitoring config defaults and validates webhook URLs", () => {
    expect(monitoringConfigSchema.parse({})).toMatchObject({
      enableMetrics: true,
      enableAlerts: true,
      enablePerformanceTracking: true,
      metricsRetentionDays: 30,
      alertThrottleDuration: 300,
      enableDebugLogging: false,
    });

    expect(() =>
      monitoringConfigSchema.parse({ defaultSlackWebhook: "not-a-url" }),
    ).toThrow();
  });
});
