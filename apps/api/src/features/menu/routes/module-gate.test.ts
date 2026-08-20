/**
 * Subscription-gate wiring for menu GET /:restaurantId/popularity.
 *
 * Regression coverage for the bug where this route was gated on
 * "menu_management" (basic tier — included in every plan) even though it
 * returns order-derived sales data (mostOrdered, mostViewed, highestRated),
 * not catalogue metadata. It should require "analytics" (pro tier+), same as
 * its sibling GET /:restaurantId/analytics does NOT need to (that route only
 * returns item counts/price ranges, which is defensibly menu_management).
 *
 * Unlike index.test.ts, this file does NOT mock "../../../middleware/moduleGate"
 * — it exercises the real middleware so a missing/misplaced moduleGate call
 * fails these tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";

const currentUser = vi.hoisted(() => {
  const value: AuthUser = {
    id: "user-1",
    username: "owner",
    role: 1,
    restaurantId: "rest-basic",
  };
  return { value };
});

vi.mock("../../../shared/middleware", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../shared/middleware")>();
  return {
    ...actual,
    authMiddleware: vi.fn(async (c: any, next: any) => {
      c.set("user", currentUser.value);
      await next();
    }),
  };
});

const serviceFns = vi.hoisted(() => ({
  getPopularityMetrics: vi.fn(),
  getMenuAnalytics: vi.fn(),
}));

vi.mock("../services/MenuService", () => ({
  MenuService: class {
    getPopularityMetrics = serviceFns.getPopularityMetrics;
    getMenuAnalytics = serviceFns.getMenuAnalytics;
  },
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

class FakeKv {
  constructor(private readonly data: Record<string, CachedSubscription>) {}
  async get<T>(key: string): Promise<T | null> {
    const restaurantId = key.replace(/^subscription:/, "");
    return (this.data[restaurantId] as unknown as T) ?? null;
  }
  async put(): Promise<void> {}
  async delete(): Promise<void> {}
}

function subscription(
  planTier: CachedSubscription["planTier"],
): CachedSubscription {
  return { isActive: true, planTier, moduleOverrides: {}, trialEndsAt: null };
}

function envWithSubscription(
  restaurantId: string,
  planTier: CachedSubscription["planTier"],
) {
  return {
    DB: {},
    CACHE_KV: new FakeKv({ [restaurantId]: subscription(planTier) }),
  } as unknown as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.value = {
    id: "user-1",
    username: "owner",
    role: 1,
    restaurantId: "rest-basic",
  };
});

describe("menu GET /:restaurantId/popularity is gated on analytics", () => {
  it("denies a basic-tier owner with 403 MODULE_NOT_ENABLED", async () => {
    const res = await routes.fetch(
      new Request("https://test/rest-basic/popularity"),
      envWithSubscription("rest-basic", "basic") as never,
    );
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(403);
    expect(json).toMatchObject({
      success: false,
      error: { code: "MODULE_NOT_ENABLED" },
    });
    expect(serviceFns.getPopularityMetrics).not.toHaveBeenCalled();
  });

  it("allows a pro-tier owner through", async () => {
    serviceFns.getPopularityMetrics.mockResolvedValue({
      mostOrdered: [],
      mostViewed: [],
      highestRated: [],
      recentlyAdded: [],
    });

    const res = await routes.fetch(
      new Request("https://test/rest-basic/popularity"),
      envWithSubscription("rest-basic", "pro") as never,
    );

    expect(res.status).toBe(200);
    expect(serviceFns.getPopularityMetrics).toHaveBeenCalledWith("rest-basic");
  });
});
