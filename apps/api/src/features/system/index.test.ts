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
  routes.get("/probe", (c) => c.json({ success: true, feature: "system" }));
  return { default: routes };
});

describe("system feature module", () => {
  it("initializes metadata, health status, routes, and singleton exports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const systemFeature = await import("./index");
    const module = new systemFeature.SystemModule();

    expect(module.name).toBe("system");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith("system module initialized", {
      version: "1.0.0",
    });

    await expect(module.routes.request("/probe")).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      module.routes.request("/probe").then((res) => res.json()),
    ).resolves.toEqual({ success: true, feature: "system" });
    await expect(module.routes.request("/missing")).resolves.toMatchObject({
      status: 404,
    });
    expect(loggerFns.debug).toHaveBeenCalledWith("GET /missing - 0ms");

    expect(module.getHealthStatus()).toEqual({
      name: "system",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        errorReporting: true,
        systemHealthCheck: true,
        errorStatistics: true,
        cleanupOperations: true,
      },
    });

    const first = systemFeature.createSystemModule();
    const second = systemFeature.createSystemModule();
    expect(second).toBe(first);
    expect(systemFeature.default.routes).toBe(first.routes);
    expect(systemFeature.default.getHealthStatus()).toMatchObject({
      name: "system",
      status: "healthy",
    });

    vi.useRealTimers();
  });
});
