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
  routes.get("/probe", (c) => c.json({ success: true, feature: "leaves" }));
  return { default: routes };
});

describe("leaves feature module", () => {
  it("initializes metadata, health, diagnostics, routes, and cleanup exports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const leavesFeature = await import("./index");
    const module = new leavesFeature.LeavesModule();
    module.routes.get("/slow", (c) => c.text("slow"));

    expect(module.name).toBe("leaves");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith("leaves module initialized", {
      version: "1.0.0",
    });

    await expect(module.routes.request("/probe")).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      module.routes.request("/probe").then((res) => res.json()),
    ).resolves.toEqual({ success: true, feature: "leaves" });
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

    expect(module.getHealthStatus()).toMatchObject({
      name: "leaves",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        leaveTypeManagement: true,
        taiwanLaborLawCompliance: true,
        workingDayValidation: true,
      },
      statistics: {
        preConfiguredLeaveTypes: 10,
        taiwanPublicHolidays2025: 19,
      },
    });
    expect(module.getStatistics()).toMatchObject({
      name: "leaves",
      version: "1.0.0",
      routes: { total: 16 },
    });
    expect(module.getConfiguration()).toMatchObject({
      name: "leaves",
      settings: {
        validation: { maxLeaveDaysPerRequest: 365 },
        taiwanLaborLaw: { annualLeaveMaxDays: 30 },
      },
    });
    await module.cleanup();
    expect(loggerFns.info).toHaveBeenCalledWith("leaves module cleaning up");

    const first = leavesFeature.createLeavesModule();
    const second = leavesFeature.createLeavesModule();
    expect(second).toBe(first);
    expect(leavesFeature.default.routes).toBe(first.routes);
    expect(leavesFeature.default.getHealthStatus()).toMatchObject({
      name: "leaves",
    });
    expect(leavesFeature.default.getStatistics()).toMatchObject({
      name: "leaves",
    });
    expect(leavesFeature.default.getConfiguration()).toMatchObject({
      name: "leaves",
    });
    await leavesFeature.default.cleanup();

    vi.useRealTimers();
  });
});
