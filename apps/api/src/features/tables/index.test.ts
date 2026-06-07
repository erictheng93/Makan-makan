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
  routes.get("/probe", (c) => c.json({ success: true, feature: "tables" }));
  return { default: routes };
});

describe("tables feature module", () => {
  it("initializes metadata, health status, routes, and singleton exports", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const tablesFeature = await import("./index");
    const module = new tablesFeature.TablesModule();

    expect(module.name).toBe("tables");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith("tables module initialized", {
      version: "1.0.0",
    });

    await expect(module.routes.request("/probe")).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      module.routes.request("/probe").then((res) => res.json()),
    ).resolves.toEqual({ success: true, feature: "tables" });
    expect(loggerFns.debug).toHaveBeenCalledWith("GET /probe - 0ms");

    expect(module.getHealthStatus()).toEqual({
      name: "tables",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        tableManagement: true,
        qrCodeGeneration: true,
        tableOccupancy: true,
        bulkOperations: true,
        tableStatistics: true,
        cleaningManagement: true,
      },
    });
    expect(module.getFeatureInfo()).toMatchObject({
      name: "tables",
      version: "1.0.0",
      routes: { base: "/tables" },
      permissions: {
        view: ["ADMIN", "OWNER", "CHEF", "SERVICE", "CASHIER"],
      },
    });

    const first = tablesFeature.createTablesModule();
    const second = tablesFeature.createTablesModule();
    expect(second).toBe(first);
    expect(tablesFeature.default.routes).toBeDefined();
    expect(tablesFeature.default.getHealthStatus()).toMatchObject({
      name: "tables",
      status: "healthy",
    });
    expect(tablesFeature.default.getFeatureInfo()).toMatchObject({
      name: "tables",
    });

    consoleLog.mockRestore();
    vi.useRealTimers();
  });
});
