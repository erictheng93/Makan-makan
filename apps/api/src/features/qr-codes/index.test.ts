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
  routes.get("/probe", (c) => c.json({ success: true, feature: "qr-codes" }));
  return { default: routes };
});

describe("qr-codes feature module", () => {
  it("initializes metadata, health status, routes, and singleton exports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const qrCodesFeature = await import("./index");
    const module = new qrCodesFeature.QrCodesModule();

    expect(module.name).toBe("qr-codes");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith("qr-codes module initialized", {
      version: "1.0.0",
    });

    const probeResponse = await module.routes.request("/probe");
    expect(probeResponse.status).toBe(200);
    await expect(probeResponse.json()).resolves.toEqual({
      success: true,
      feature: "qr-codes",
    });
    await expect(module.routes.request("/missing")).resolves.toMatchObject({
      status: 404,
    });
    expect(loggerFns.debug).toHaveBeenCalledWith("GET /missing - 0ms");

    expect(module.getHealthStatus()).toEqual({
      name: "qr-codes",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        qrGeneration: true,
        bulkGeneration: true,
        templateManagement: true,
        downloadSupport: true,
        statisticsTracking: true,
      },
    });

    const first = qrCodesFeature.createQrCodesModule();
    const second = qrCodesFeature.createQrCodesModule();
    expect(second).toBe(first);
    expect(qrCodesFeature.default.routes).toBe(first.routes);
    expect(qrCodesFeature.default.getHealthStatus()).toMatchObject({
      name: "qr-codes",
      status: "healthy",
    });

    vi.useRealTimers();
  });
});
