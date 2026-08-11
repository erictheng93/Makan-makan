import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  routes.get("/probe", (c) => c.json({ success: true, feature: "scheduling" }));
  return { default: routes };
});

vi.mock("@makanmasak/database", () => ({
  SchedulingService: vi.fn(),
}));

vi.mock("./schemas/validation", () => ({
  schedulingSchemas: {},
}));

describe("scheduling feature module", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("initializes metadata, health, diagnostics, routes, and cleanup exports", async () => {
    vi.spyOn(Date.prototype, "toISOString").mockReturnValue(
      "2026-06-08T08:30:00.000Z",
    );

    const schedulingFeature = await import("./index");
    const module = new schedulingFeature.SchedulingModule();
    module.routes.get("/slow", (c) => c.text("slow"));

    expect(module.name).toBe("scheduling");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith(
      "scheduling module initialized",
      { version: "1.0.0" },
    );

    await expect(module.routes.request("/probe")).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      module.routes.request("/probe").then((res) => res.json()),
    ).resolves.toEqual({ success: true, feature: "scheduling" });
    const missingDateNow = vi.spyOn(Date, "now").mockReturnValue(0);
    const missingResponse = await module.routes.request("/missing");
    missingDateNow.mockRestore();
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

    expect(module.getHealthStatus()).toMatchObject({
      name: "scheduling",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        shiftTemplateManagement: true,
        taiwanLaborLawCompliance: true,
        realTimeScheduleStats: false,
      },
      statistics: {
        totalEndpoints: 17,
        supportedConflictTypes: 7,
      },
    });
    expect(module.getStatistics()).toMatchObject({
      name: "scheduling",
      version: "1.0.0",
      routes: { total: 17 },
    });
    expect(module.getConfiguration()).toMatchObject({
      name: "scheduling",
      settings: {
        validation: { maxBulkCreateEmployees: 50 },
        taiwanLaborLaw: { maxDailyHours: 12 },
      },
    });
    await module.cleanup();
    expect(loggerFns.info).toHaveBeenCalledWith(
      "scheduling module cleaning up",
    );

    const first = schedulingFeature.createSchedulingModule();
    const second = schedulingFeature.createSchedulingModule();
    expect(second).toBe(first);
    expect(schedulingFeature.default.routes).toBe(first.routes);
    expect(schedulingFeature.default.getHealthStatus()).toMatchObject({
      name: "scheduling",
    });
    expect(schedulingFeature.default.getStatistics()).toMatchObject({
      name: "scheduling",
    });
    expect(schedulingFeature.default.getConfiguration()).toMatchObject({
      name: "scheduling",
    });
    await schedulingFeature.default.cleanup();
  });
});
