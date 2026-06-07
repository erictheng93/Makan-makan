import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const loggerFns = vi.hoisted(() => ({
  info: vi.fn(),
}));

vi.mock("../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return loggerFns;
  }),
}));

vi.mock("./routes", () => {
  const routes = new Hono();
  routes.get("/probe", (c) => c.json({ success: true, feature: "forecast" }));
  return { default: routes };
});

describe("forecast feature module", () => {
  it("initializes metadata, health status, routes, and singleton exports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const forecastFeature = await import("./index");
    const module = new forecastFeature.ForecastModule();

    expect(module.name).toBe("forecast");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith("forecast module initialized", {
      version: "1.0.0",
    });

    const probeResponse = await Promise.resolve(
      module.routes.request("/probe"),
    );
    expect(probeResponse.status).toBe(200);
    await expect(probeResponse.json()).resolves.toEqual({
      success: true,
      feature: "forecast",
    });

    expect(module.getHealthStatus()).toEqual({
      name: "forecast",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        statisticalForecast: true,
        aiEnhanced: true,
        ingredientForecast: true,
        prepAlerts: true,
        accuracyTracking: true,
      },
    });

    const first = forecastFeature.createForecastModule();
    const second = forecastFeature.createForecastModule();
    expect(second).toBe(first);
    expect(forecastFeature.default.routes).toBe(first.routes);
    expect(forecastFeature.default.getHealthStatus()).toMatchObject({
      name: "forecast",
      status: "healthy",
    });

    vi.useRealTimers();
  });
});
