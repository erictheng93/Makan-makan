/**
 * Subscription-gate wiring for kitchen GET/PUT /notification-settings.
 *
 * Regression coverage for the bug where these two routes had no
 * moduleGate("kitchen_display"), unlike the other 6 routes in this router
 * (events/token, legacy /start /ready, SSE /events, /orders, item status
 * update). That let a basic-tier owner read/write kitchen alert settings for
 * a display feature their plan doesn't include.
 *
 * Unlike index.test.ts, this file does NOT mock "../../../middleware/moduleGate"
 * — it exercises the real middleware so a missing/misplaced moduleGate call
 * fails these tests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, Next } from "hono";
import type { AuthUser } from "../../../middleware/auth";

const currentUser = vi.hoisted(() => {
  const value: AuthUser = {
    id: "user-22",
    username: "chef",
    role: 2,
    restaurantId: "rest-basic",
  };
  return { value };
});

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: Context, next: Next) => {
    c.set("user", currentUser.value);
    await next();
  }),
  sseAuthMiddleware: vi.fn(async (c: Context, next: Next) => {
    c.set("user", currentUser.value);
    await next();
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

/** Minimal KV stand-in: serves subscription reads, no-ops on writes (both
 * used by moduleGate and by the notification-settings handlers themselves). */
class FakeKv {
  constructor(private readonly data: Record<string, CachedSubscription>) {}
  async get<T>(key: string, type?: string): Promise<T | null> {
    if (key.startsWith("subscription:")) {
      const restaurantId = key.replace(/^subscription:/, "");
      return (this.data[restaurantId] as unknown as T) ?? null;
    }
    return null;
  }
  async put(): Promise<void> {}
  async delete(): Promise<void> {}
}

function subscription(
  planTier: CachedSubscription["planTier"],
  overrides: Record<string, boolean> = {},
): CachedSubscription {
  return {
    isActive: true,
    planTier,
    moduleOverrides: overrides,
    trialEndsAt: null,
  };
}

function envWithSubscription(
  restaurantId: string,
  planTier: CachedSubscription["planTier"],
) {
  return {
    DB: { binding: "db" },
    CACHE_KV: new FakeKv({ [restaurantId]: subscription(planTier) }),
  } as unknown as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.value = {
    id: "user-22",
    username: "chef",
    role: 2,
    restaurantId: "rest-basic",
  };
});

describe("kitchen notification-settings routes are gated on kitchen_display", () => {
  it("GET denies a basic-tier chef with 403 MODULE_NOT_ENABLED", async () => {
    const res = await routes.fetch(
      new Request("https://kitchen.test/notification-settings"),
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

  it("PUT denies a basic-tier chef with 403 MODULE_NOT_ENABLED", async () => {
    const res = await routes.fetch(
      new Request("https://kitchen.test/notification-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sound: true }),
      }),
      envWithSubscription("rest-basic", "basic") as never,
    );
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("MODULE_NOT_ENABLED");
  });

  it("allows a pro-tier chef through to GET and PUT", async () => {
    currentUser.value = {
      id: "user-22",
      username: "chef",
      role: 2,
      restaurantId: "rest-pro",
    };
    let res = await routes.fetch(
      new Request("https://kitchen.test/notification-settings"),
      envWithSubscription("rest-pro", "pro") as never,
    );
    expect(res.status).toBe(200);

    res = await routes.fetch(
      new Request("https://kitchen.test/notification-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sound: true }),
      }),
      envWithSubscription("rest-pro", "pro") as never,
    );
    expect(res.status).toBe(200);
  });
});
