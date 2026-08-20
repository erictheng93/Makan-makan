import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, Next } from "hono";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";

const serviceFns = vi.hoisted(() => ({
  forecastConstructorArgs: [] as unknown[][],
  ingredientConstructorArgs: [] as unknown[][],
  generateForecast: vi.fn(),
  getAccuracy: vi.fn(),
  getAlerts: vi.fn(),
  getForecast: vi.fn(),
  generateIngredientForecast: vi.fn(),
  getIngredientForecast: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: Context, next: Next) => {
    c.set("user", {
      id: "user-7",
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    } satisfies AuthUser);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

// This file exercises handler/service wiring with a bare env that has no
// subscription bindings, so the gate is stubbed out here. Which module each
// route is gated on — analytics for demand, inventory for ingredient — is
// covered against the real middleware in module-gate.test.ts.
vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../services/ForecastService", () => ({
  ForecastService: class {
    constructor(...args: unknown[]) {
      serviceFns.forecastConstructorArgs.push(args);
    }

    generateForecast = serviceFns.generateForecast;
    getAccuracy = serviceFns.getAccuracy;
    getAlerts = serviceFns.getAlerts;
    getForecast = serviceFns.getForecast;
  },
}));

vi.mock("../services/IngredientForecastService", () => ({
  IngredientForecastService: class {
    constructor(...args: unknown[]) {
      serviceFns.ingredientConstructorArgs.push(args);
    }

    generateIngredientForecast = serviceFns.generateIngredientForecast;
    getIngredientForecast = serviceFns.getIngredientForecast;
  },
}));

import routes from "./index";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as 400,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function env() {
  return {
    CACHE_KV: { get: vi.fn(), put: vi.fn() },
    DB: { binding: "db" },
    ENCRYPTION_KEY: "forecast-key",
  };
}

function request(path: string, method = "GET", body?: unknown) {
  return routes.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    env() as never,
  );
}

describe("forecast routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceFns.forecastConstructorArgs.length = 0;
    serviceFns.ingredientConstructorArgs.length = 0;

    serviceFns.generateForecast.mockResolvedValue([
      { date: "2026-06-10", type: "item_level", items: [] },
    ]);
    serviceFns.generateIngredientForecast.mockResolvedValue([
      { date: "2026-06-10", ingredientId: 1 },
    ]);
    serviceFns.getForecast.mockResolvedValue([
      { date: "2026-06-10", type: "item_level", items: [] },
    ]);
    serviceFns.getAccuracy.mockResolvedValue({ mape: 12.5 });
    serviceFns.getIngredientForecast.mockResolvedValue([
      { date: "2026-06-10", ingredientId: 1 },
    ]);
    serviceFns.getAlerts.mockResolvedValue([{ severity: "warning" }]);
  });

  it("generates item-level forecasts with validated defaults", async () => {
    const response = await request("/restaurant-1/generate", "POST", {
      startDate: "2026-06-10",
      endDate: "2026-06-11",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        forecasts: [{ date: "2026-06-10", type: "item_level", items: [] }],
      },
    });
    expect(serviceFns.generateForecast).toHaveBeenCalledWith("restaurant-1", {
      startDate: "2026-06-10",
      endDate: "2026-06-11",
      type: "item_level",
      useAI: false,
    });
    expect(serviceFns.generateIngredientForecast).not.toHaveBeenCalled();
  });

  it("delegates ingredient-level forecast generation to the ingredient service", async () => {
    const response = await request("/restaurant-1/generate", "POST", {
      startDate: "2026-06-10",
      endDate: "2026-06-10",
      type: "ingredient_level",
      useAI: true,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { forecasts: [{ ingredientId: 1 }] },
    });
    expect(serviceFns.generateForecast).not.toHaveBeenCalled();
    expect(serviceFns.generateIngredientForecast).toHaveBeenCalledWith(
      "restaurant-1",
      {
        startDate: "2026-06-10",
        endDate: "2026-06-10",
        type: "ingredient_level",
        useAI: true,
      },
    );
    expect(serviceFns.ingredientConstructorArgs[0]?.[3]).toBe("forecast-key");
  });

  it("maps forecast, accuracy, ingredient, and alert reads to services", async () => {
    let response = await request(
      "/restaurant-1?date=2026-06-10&type=item_level",
    );
    expect(response.status).toBe(200);
    expect(serviceFns.getForecast).toHaveBeenCalledWith(
      "restaurant-1",
      "2026-06-10",
      "2026-06-10",
      "item_level",
    );

    response = await request(
      "/restaurant-1/accuracy?startDate=2026-06-01&endDate=2026-06-10",
    );
    expect(response.status).toBe(200);
    expect(serviceFns.getAccuracy).toHaveBeenCalledWith(
      "restaurant-1",
      "2026-06-01",
      "2026-06-10",
    );

    response = await request(
      "/restaurant-1/ingredient-forecast?startDate=2026-06-01&endDate=2026-06-10",
    );
    expect(response.status).toBe(200);
    expect(serviceFns.getIngredientForecast).toHaveBeenCalledWith(
      "restaurant-1",
      "2026-06-01",
      "2026-06-10",
    );

    response = await request("/restaurant-1/alerts");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { alerts: [{ severity: "warning" }] },
    });
    expect(serviceFns.getAlerts).toHaveBeenCalledWith("restaurant-1");
  });

  it("rejects invalid forecast bodies and missing query date ranges", async () => {
    let response = await request("/restaurant-1/generate", "POST", {
      startDate: "2026-06-11",
      endDate: "2026-06-10",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(serviceFns.generateForecast).not.toHaveBeenCalled();

    response = await request("/restaurant-1");
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(serviceFns.getForecast).not.toHaveBeenCalled();
  });
});
