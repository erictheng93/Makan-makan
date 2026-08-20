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
  routes.get("/probe", (c) =>
    c.json({ success: true, feature: "restaurants" }),
  );
  return { default: routes };
});

describe("restaurants feature module", () => {
  it("initializes metadata, health status, routes, and singleton exports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const restaurantsFeature = await import("./index");
    const module = new restaurantsFeature.RestaurantsModule();

    expect(module.name).toBe("restaurants");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith(
      "restaurants module initialized",
      { version: "1.0.0" },
    );

    await expect(module.routes.request("/probe")).resolves.toMatchObject({
      status: 200,
    });
    const probeResponse = await module.routes.request("/probe");
    await expect(probeResponse.json()).resolves.toEqual({
      success: true,
      feature: "restaurants",
    });
    await expect(module.routes.request("/missing")).resolves.toMatchObject({
      status: 404,
    });
    expect(loggerFns.debug).toHaveBeenCalledWith("GET /missing - 0ms");

    expect(module.getHealthStatus()).toEqual({
      name: "restaurants",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        restaurantListing: true,
        restaurantManagement: true,
        searchAndFiltering: true,
        statisticsTracking: true,
        nearbySearch: true,
        popularRestaurants: true,
        cacheOptimization: true,
        roleBasedAccess: true,
      },
    });

    const first = restaurantsFeature.createRestaurantsModule();
    const second = restaurantsFeature.createRestaurantsModule();
    expect(second).toBe(first);
    expect(restaurantsFeature.default.routes).toBe(first.routes);
    expect(restaurantsFeature.default.getHealthStatus()).toMatchObject({
      name: "restaurants",
      status: "healthy",
    });

    vi.useRealTimers();
  });
});
