import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const loggerFns = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return loggerFns;
  }),
}));

vi.mock("./routes", () => {
  const routes = new Hono();
  routes.get("/probe", (c) => c.json({ success: true, feature: "analytics" }));

  return { default: routes };
});

describe("analytics feature module", () => {
  it("initializes module metadata, health status, and mounted routes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const { AnalyticsModule } = await import("./index");
    const module = new AnalyticsModule();

    expect(module.name).toBe("analytics");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith(
      "analytics module initialized",
      { version: "1.0.0" },
    );

    await expect(module.routes.request("/probe")).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      module.routes.request("/probe").then((res) => res.json()),
    ).resolves.toEqual({ success: true, feature: "analytics" });

    await expect(module.routes.request("/missing")).resolves.toMatchObject({
      status: 404,
    });
    expect(loggerFns.debug).toHaveBeenCalledWith("GET /missing - 0ms");

    expect(module.getHealthStatus()).toEqual({
      name: "analytics",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        dashboardAnalytics: true,
        revenueAnalytics: true,
        productAnalytics: true,
        customerAnalytics: true,
        performanceAnalytics: true,
        realtimeData: true,
        exportFunctionality: true,
        sseStreaming: true,
      },
    });

    vi.useRealTimers();
  });

  it("reuses the lazy singleton behind factory and default exports", async () => {
    vi.resetModules();

    const analyticsFeature = await import("./index");

    const first = analyticsFeature.createAnalyticsModule();
    const second = analyticsFeature.createAnalyticsModule();

    expect(second).toBe(first);
    expect(analyticsFeature.default.routes).toBe(first.routes);
    expect(analyticsFeature.default.getHealthStatus()).toMatchObject({
      name: "analytics",
      version: "1.0.0",
      status: "healthy",
    });
  });
});
