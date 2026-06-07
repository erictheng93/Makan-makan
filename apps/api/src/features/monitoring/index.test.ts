import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const loggerFns = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return loggerFns;
  }),
}));

vi.mock("./routes", () => {
  const routes = new Hono();
  routes.get("/probe", (c) => c.json({ success: true, feature: "monitoring" }));
  return { default: routes };
});

describe("monitoring feature module", () => {
  it("initializes metadata, health status, routes, and singleton exports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const monitoringFeature = await import("./index");
    const module = new monitoringFeature.MonitoringModule();

    expect(module.name).toBe("monitoring");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith(
      "monitoring module initialized",
      { version: "1.0.0" },
    );

    await expect(module.routes.request("/probe")).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      module.routes.request("/probe").then((res) => res.json()),
    ).resolves.toEqual({ success: true, feature: "monitoring" });
    await expect(module.routes.request("/missing")).resolves.toMatchObject({
      status: 404,
    });
    expect(loggerFns.debug).toHaveBeenCalledWith("GET /missing - 0ms");

    expect(module.getHealthStatus()).toEqual({
      name: "monitoring",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: [
        "system_metrics",
        "health_monitoring",
        "alert_management",
        "performance_tracking",
        "error_reporting",
        "cache_monitoring",
      ],
    });

    const first = monitoringFeature.createMonitoringModule();
    const second = monitoringFeature.createMonitoringModule();
    expect(second).toBe(first);
    expect(monitoringFeature.default.routes).toBe(first.routes);
    expect(monitoringFeature.default.getHealthStatus()).toMatchObject({
      name: "monitoring",
      status: "healthy",
    });

    vi.useRealTimers();
  });
});
