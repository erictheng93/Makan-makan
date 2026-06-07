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
  routes.get("/probe", (c) =>
    c.json({ success: true, feature: "ingredients" }),
  );
  return { default: routes };
});

describe("ingredients feature module", () => {
  it("initializes metadata, health status, routes, and singleton exports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:30:00.000Z"));

    const ingredientsFeature = await import("./index");
    const module = new ingredientsFeature.IngredientsModule();

    expect(module.name).toBe("ingredients");
    expect(module.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith(
      "ingredients module initialized",
      { version: "1.0.0" },
    );

    const probeResponse = await Promise.resolve(
      module.routes.request("/probe"),
    );
    expect(probeResponse.status).toBe(200);
    await expect(probeResponse.json()).resolves.toEqual({
      success: true,
      feature: "ingredients",
    });

    expect(module.getHealthStatus()).toEqual({
      name: "ingredients",
      version: "1.0.0",
      status: "healthy",
      timestamp: "2026-06-08T08:30:00.000Z",
      features: {
        ingredientCrud: true,
        recipeCrud: true,
        bulkImport: true,
        stockTracking: true,
      },
    });

    const first = ingredientsFeature.createIngredientsModule();
    const second = ingredientsFeature.createIngredientsModule();
    expect(second).toBe(first);
    expect(ingredientsFeature.default.routes).toBe(first.routes);
    expect(ingredientsFeature.default.getHealthStatus()).toMatchObject({
      name: "ingredients",
      status: "healthy",
    });

    vi.useRealTimers();
  });
});
