/**
 * Subscription-gate wiring for ai-analytics GET /models/:provider.
 *
 * Regression coverage for the bug where this route had no
 * moduleGate("ai_analytics"), unlike the other 9 routes in this router
 * (/config, /generate, /products/*, /usage/*). ai_analytics is an
 * enterprise-only module (not included in basic or pro); this route let any
 * authenticated user probe available AI models regardless of plan.
 *
 * Unlike index.test.ts, this file does NOT mock "../../../middleware/moduleGate"
 * — it exercises the real middleware so a missing moduleGate call fails
 * these tests. authMiddleware for /ai-analytics/* is applied at the
 * app-factory blanket level (not per-route in this file), so this test
 * injects "user" directly the same way that blanket gate would.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../types/env";

const currentUser = vi.hoisted(() => ({
  value: { id: 1, role: 1, restaurantId: "rest-basic" } as {
    id: number;
    role: number;
    restaurantId: string | number | undefined;
  },
}));

vi.mock("../../../middleware/quotaGate", () => ({
  quotaGate: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

function buildApp() {
  // Mirror the app-factory mount: a blanket authMiddleware in front of the
  // ai-analytics sub-app, injecting the current test user.
  const app = new Hono<{ Bindings: Env }>();
  app.use("/ai-analytics/*", async (c, next) => {
    c.set("user", currentUser.value as never);
    await next();
  });
  app.route("/ai-analytics", routes);
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 401 | 403 | 404 | 409,
      );
    }
    return c.json({ success: false, error: { message: String(err) } }, 500);
  });
  return app;
}

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
  currentUser.value = { id: 1, role: 1, restaurantId: "rest-basic" };
});

describe("ai-analytics GET /models/:provider is gated on ai_analytics", () => {
  it("denies a basic-tier owner with 403 MODULE_NOT_ENABLED", async () => {
    const res = await buildApp().fetch(
      new Request("https://test/ai-analytics/models/openai"),
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
  });

  it("denies a pro-tier owner too (ai_analytics is enterprise-only)", async () => {
    const res = await buildApp().fetch(
      new Request("https://test/ai-analytics/models/openai"),
      envWithSubscription("rest-basic", "pro") as never,
    );

    expect(res.status).toBe(403);
  });

  it("allows an enterprise-tier owner through", async () => {
    const res = await buildApp().fetch(
      new Request("https://test/ai-analytics/models/openai"),
      envWithSubscription("rest-basic", "enterprise") as never,
    );
    const json = (await res.json()) as {
      success: boolean;
      provider: string;
      models: string[];
    };

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, provider: "openai" });
  });
});
