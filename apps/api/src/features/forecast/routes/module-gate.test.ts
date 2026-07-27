/**
 * Subscription-gate wiring for forecast routes.
 *
 * This feature spans two modules, so it is gated per route rather than by the
 * blanket `apiV1.use("/forecast/*", moduleGate("analytics"))` it used to carry
 * in app-factory. Demand forecasting, accuracy and alerts are reporting
 * (`analytics`, pro); ingredient forecasting and the procurement list read
 * ingredient records and belong with `/ingredients/*` (`inventory`,
 * enterprise).
 *
 * The old blanket gate let a pro shop start an ingredient forecast it could
 * never finish — the procurement list calls `/ingredients`, which 403'd. These
 * tests exercise the REAL moduleGate so a missing or mis-keyed gate fails here.
 * The tier x module matrix itself is covered in middleware/moduleGate.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => ({
  value: { id: 1, role: 1, restaurantId: "rest-1" } as {
    id: number;
    role: number;
    restaurantId: string | undefined;
  },
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", currentUser.value);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

const generateForecast = vi.hoisted(() => vi.fn());
const getForecast = vi.hoisted(() => vi.fn());
const getAlerts = vi.hoisted(() => vi.fn());
const getAccuracy = vi.hoisted(() => vi.fn());
const generateIngredientForecast = vi.hoisted(() => vi.fn());
const getIngredientForecast = vi.hoisted(() => vi.fn());

vi.mock("../services/ForecastService", () => ({
  ForecastService: vi.fn(function ForecastService() {
    return { generateForecast, getForecast, getAlerts, getAccuracy };
  }),
}));

vi.mock("../services/IngredientForecastService", () => ({
  IngredientForecastService: vi.fn(function IngredientForecastService() {
    return { generateIngredientForecast, getIngredientForecast };
  }),
}));

import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

interface CachedSubscription {
  isActive: boolean;
  planTier: "trial" | "basic" | "pro" | "enterprise";
  moduleOverrides: Record<string, boolean>;
  trialEndsAt: number | null;
}

/** KV stand-in pre-seeded so the gate resolves from cache and never touches DB. */
class FakeKv {
  constructor(private readonly sub: CachedSubscription) {}
  async get<T>(): Promise<T | null> {
    return this.sub as unknown as T;
  }
  async put(): Promise<void> {}
  async delete(): Promise<void> {}
}

function envFor(planTier: CachedSubscription["planTier"]) {
  return {
    DB: {},
    CACHE_KV: new FakeKv({
      isActive: true,
      planTier,
      moduleOverrides: {},
      trialEndsAt: null,
    }),
    ENCRYPTION_KEY: "k".repeat(32),
  } as never;
}

const RESTAURANT = "019fa136-cfe3-709f-a2ab-f8a3ebcd31a1";

function get(path: string, planTier: CachedSubscription["planTier"]) {
  return routes.fetch(
    new Request(
      `https://api.test/${RESTAURANT}${path}?startDate=2026-07-27&endDate=2026-07-27`,
    ),
    envFor(planTier),
  );
}

function generate(type: string, planTier: CachedSubscription["planTier"]) {
  return routes.fetch(
    new Request(`https://api.test/${RESTAURANT}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        startDate: "2026-07-27",
        endDate: "2026-07-27",
      }),
    }),
    envFor(planTier),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.value = { id: 1, role: 1, restaurantId: RESTAURANT };
  getForecast.mockResolvedValue([]);
  getAlerts.mockResolvedValue([]);
  getAccuracy.mockResolvedValue([]);
  generateForecast.mockResolvedValue([]);
  generateIngredientForecast.mockResolvedValue([]);
  getIngredientForecast.mockResolvedValue([]);
});

describe("forecast route module gating", () => {
  it("lets a pro shop read demand forecast, accuracy and alerts", async () => {
    for (const path of ["", "/accuracy", "/alerts"]) {
      const response = await get(path, "pro");
      expect(response.status).toBe(200);
    }
  });

  it("denies a basic shop the demand forecast — it is analytics, not core", async () => {
    const response = await get("", "basic");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MODULE_NOT_ENABLED" },
    });
  });

  it("denies a pro shop the ingredient forecast — that is inventory", async () => {
    const response = await get("/ingredient-forecast", "pro");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MODULE_NOT_ENABLED" },
    });
    expect(getIngredientForecast).not.toHaveBeenCalled();
  });

  it("lets an enterprise shop read the ingredient forecast", async () => {
    const response = await get("/ingredient-forecast", "enterprise");

    expect(response.status).toBe(200);
    expect(getIngredientForecast).toHaveBeenCalledOnce();
  });

  it("routes generate to analytics or inventory based on the requested type", async () => {
    // Demand generation is analytics — a pro shop may run it.
    expect((await generate("item_level", "pro")).status).toBe(200);
    expect(generateForecast).toHaveBeenCalledOnce();

    vi.clearAllMocks();

    // Ingredient generation through the SAME endpoint is inventory — denied.
    const denied = await generate("ingredient_level", "pro");
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toMatchObject({
      error: { code: "MODULE_NOT_ENABLED" },
    });
    expect(generateIngredientForecast).not.toHaveBeenCalled();
  });

  it("lets an enterprise shop generate an ingredient forecast", async () => {
    const response = await generate("ingredient_level", "enterprise");

    expect(response.status).toBe(200);
    expect(generateIngredientForecast).toHaveBeenCalledOnce();
  });
});
