// apps/api/src/features/forecast/__tests__/ForecastModule.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: class MockConsoleLogger {
    info = vi.fn();
    error = vi.fn();
    warn = vi.fn();
  },
}));

vi.mock("../routes", async () => {
  const { Hono } = await import("hono");
  return { default: new Hono() };
});

describe("ForecastModule", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should return correct health status structure", async () => {
    const { createForecastModule } = await import("../index");
    const mod = createForecastModule();
    const health = mod.getHealthStatus();

    expect(health).toEqual({
      name: "forecast",
      version: "1.0.0",
      status: "healthy",
      timestamp: expect.any(String),
      features: {
        statisticalForecast: true,
        aiEnhanced: true,
        ingredientForecast: true,
        prepAlerts: true,
        accuracyTracking: true,
      },
    });
  });

  it("should have correct name and version", async () => {
    const { createForecastModule } = await import("../index");
    const mod = createForecastModule();

    expect(mod.name).toBe("forecast");
    expect(mod.version).toBe("1.0.0");
  });

  it("should expose routes as a Hono instance", async () => {
    const { createForecastModule } = await import("../index");
    const mod = createForecastModule();

    expect(mod.routes).toBeDefined();
    expect(typeof mod.routes.fetch).toBe("function");
  });

  it("should return singleton instance via createForecastModule", async () => {
    const mod = await import("../index");
    const instance1 = mod.createForecastModule();
    const instance2 = mod.createForecastModule();

    expect(instance1).toBe(instance2);
  });

  it("default export should proxy routes and healthStatus", async () => {
    const mod = await import("../index");
    const defaultExport = mod.default;

    expect(defaultExport.routes).toBeDefined();
    expect(typeof defaultExport.getHealthStatus).toBe("function");
    const health = defaultExport.getHealthStatus();
    expect(health.name).toBe("forecast");
  });
});
