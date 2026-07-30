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
  routes.get("/probe", (c) => c.json({ success: true, feature: "menu" }));
  return { default: routes };
});

describe("menu feature module", () => {
  it("initializes metadata, health, diagnostics, routes, and cleanup exports", async () => {
    // Import before installing fake timers. This pulls in @makanmakan/database
    // and @makanmakan/shared-types, so on a cold transform cache — any change
    // to those packages — it can take well over the default 10s timeout, and
    // under fake timers that stall is unrecoverable. The clock only needs to be
    // frozen for the assertions below, not for module loading.
    const menuFeature = await import("./index");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const module = new menuFeature.MenuModule();
    module.routes.get("/slow", (c) => c.text("slow"));
    module.routes.get("/restaurant-1/featured", (c) => c.json({ ok: true }));
    module.routes.get("/restaurant-1/popular", (c) => c.json({ ok: true }));
    module.routes.get("/restaurant-1", (c) => c.json({ ok: true }));

    expect(module.name).toBe("menu");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith("menu module initialized", {
      version: "1.0.0",
    });

    await expect(module.routes.request("/probe")).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      module.routes.request("/probe").then((res) => res.json()),
    ).resolves.toEqual({ success: true, feature: "menu" });
    const missingResponse = await module.routes.request("/missing");
    expect(missingResponse.status).toBe(404);
    expect(loggerFns.debug).toHaveBeenCalledWith("GET /missing - starting");
    expect(loggerFns.debug).toHaveBeenCalledWith("GET /missing - completed", {
      duration: 0,
      status: 404,
    });

    const dateNow = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1001);
    const slowResponse = await module.routes.request("/slow");
    expect(slowResponse.status).toBe(200);
    expect(loggerFns.warn).toHaveBeenCalledWith("Slow request detected", {
      method: "GET",
      path: "/slow",
      duration: 1001,
      status: 200,
    });
    dateNow.mockRestore();

    const featuredResponse = await module.routes.request(
      "/restaurant-1/featured",
    );
    expect(featuredResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=300",
    );
    const popularResponse = await module.routes.request(
      "/restaurant-1/popular",
    );
    expect(popularResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=600",
    );
    const publicMenuResponse = await module.routes.request("/restaurant-1");
    expect(publicMenuResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=1800",
    );

    expect(module.getHealthStatus()).toMatchObject({
      name: "menu",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        menuManagement: true,
        analytics: true,
        performanceMonitoring: true,
      },
      supportedFeatures: {
        menuItems: { creation: true, seoOptimization: true },
        caching: { menuCaching: true, searchCaching: false },
      },
      dependencies: {
        monitoring: "ConsoleLogger",
      },
    });
    expect(module.getStatistics()).toMatchObject({
      name: "menu",
      version: "1.0.0",
      routes: { total: 15 },
    });
    expect(module.getConfiguration()).toMatchObject({
      name: "menu",
      settings: {
        caching: { menuTtl: 1800, popularTtl: 600 },
        limits: { maxBulkOperations: 100 },
      },
    });
    await module.cleanup();
    expect(loggerFns.info).toHaveBeenCalledWith("menu module cleaning up");

    const first = menuFeature.createMenuModule();
    const second = menuFeature.createMenuModule();
    expect(second).toBe(first);
    expect(menuFeature.default.routes).toBe(first.routes);
    expect(menuFeature.default.getHealthStatus()).toMatchObject({
      name: "menu",
    });
    expect(menuFeature.default.getStatistics()).toMatchObject({
      name: "menu",
    });
    expect(menuFeature.default.getConfiguration()).toMatchObject({
      name: "menu",
    });
    await menuFeature.default.cleanup();

    vi.useRealTimers();
  });
});
