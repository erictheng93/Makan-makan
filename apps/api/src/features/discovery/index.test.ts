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
  routes.get("/probe", (c) => c.json({ success: true, feature: "discovery" }));
  return { default: routes };
});

describe("discovery feature module", () => {
  it("initializes metadata, health status, routes, and singleton exports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const discoveryFeature = await import("./index");
    const module = new discoveryFeature.DiscoveryModule();

    expect(module.name).toBe("discovery");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith(
      "discovery module initialized",
      { version: "1.0.0" },
    );

    const probeResponse = await Promise.resolve(
      module.routes.request("/probe"),
    );
    expect(probeResponse.status).toBe(200);
    await expect(probeResponse.json()).resolves.toEqual({
      success: true,
      feature: "discovery",
    });

    expect(module.getHealthStatus()).toEqual({
      name: "discovery",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        dishSearch: true,
        restaurantBrowse: true,
        popularItems: true,
        reindex: true,
      },
    });

    const first = discoveryFeature.createDiscoveryModule();
    const second = discoveryFeature.createDiscoveryModule();
    expect(second).toBe(first);
    expect(discoveryFeature.default.routes).toBe(first.routes);
    expect(discoveryFeature.default.getHealthStatus()).toMatchObject({
      name: "discovery",
      status: "healthy",
    });

    vi.useRealTimers();
  });
});
