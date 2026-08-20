import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";

const auth = vi.hoisted(() => ({
  user: {
    id: "user-42",
    username: "owner",
    role: 1,
    restaurantId: "restaurant-1" as string | number | null | undefined,
  } as AuthUser,
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", auth.user);
    await next();
  }),
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
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function createEnv() {
  return {
    CACHE_KV: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
}

type TestEnv = ReturnType<typeof createEnv>;

function request(path: string, env: TestEnv, init: RequestInit = {}) {
  return routes.request(path, init, env as never);
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

const subscription = {
  endpoint: "https://push.example.test/subscriptions/device-1",
  keys: {
    p256dh: "p256dh-key",
    auth: "auth-key",
  },
};

function subscribePayload(overrides: Record<string, unknown> = {}) {
  return {
    subscription,
    user_type: "kitchen",
    role: 2,
    device_info: { platform: "web", model: "tablet" },
    ...overrides,
  };
}

async function subscriptionId(endpoint = subscription.endpoint) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

describe("push subscription routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = {
      id: "user-42",
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    };
  });

  it("stores a scoped subscription for the authenticated user", async () => {
    const env = createEnv();
    env.CACHE_KV.get.mockResolvedValue(null);

    const response = await request("/subscribe", env, {
      method: "POST",
      body: JSON.stringify(subscribePayload()),
    });
    const body = await json(response);
    const expectedId = await subscriptionId();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        subscriptionId: expectedId,
        subscribed: true,
        restaurantId: "restaurant-1",
      },
    });
    expect(env.CACHE_KV.get).toHaveBeenCalledWith(
      `push:subscription:restaurant-1:user-42:${expectedId}`,
      "json",
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      `push:subscription:restaurant-1:user-42:${expectedId}`,
      expect.any(String),
      { expirationTtl: 31536000 },
    );

    const stored = JSON.parse(env.CACHE_KV.put.mock.calls[0][1]) as Record<
      string,
      unknown
    >;
    expect(stored).toMatchObject({
      id: expectedId,
      userId: "user-42",
      username: "owner",
      userRole: 1,
      requestedRole: 2,
      userType: "kitchen",
      restaurantId: "restaurant-1",
      subscription,
      deviceInfo: { platform: "web", model: "tablet" },
    });
    expect(Date.parse(String(stored.createdAt))).not.toBeNaN();
    expect(stored.updatedAt).toEqual(stored.createdAt);
  });

  it("preserves createdAt when refreshing an existing subscription", async () => {
    const env = createEnv();
    const createdAt = "2026-01-02T03:04:05.000Z";
    env.CACHE_KV.get.mockResolvedValue({ createdAt });

    const response = await request("/subscribe", env, {
      method: "POST",
      body: JSON.stringify(subscribePayload({ user_type: undefined })),
    });
    const stored = JSON.parse(env.CACHE_KV.put.mock.calls[0][1]) as Record<
      string,
      unknown
    >;

    expect(response.status).toBe(200);
    expect(stored.createdAt).toBe(createdAt);
    expect(stored.updatedAt).not.toBe(createdAt);
    expect(stored.userType).toBe("admin");
  });

  it("allows admins to store global and encoded restaurant subscriptions", async () => {
    const env = createEnv();
    env.CACHE_KV.get.mockResolvedValue(null);
    auth.user = {
      id: "user-1",
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };

    let response = await request("/subscribe", env, {
      method: "POST",
      body: JSON.stringify(subscribePayload({ restaurant_id: undefined })),
    });
    let body = await json(response);
    const expectedId = await subscriptionId();

    expect(response.status).toBe(200);
    expect(body.data?.restaurantId).toBeNull();
    expect(env.CACHE_KV.put).toHaveBeenLastCalledWith(
      `push:subscription:global:user-1:${expectedId}`,
      expect.any(String),
      expect.any(Object),
    );

    response = await request("/subscribe", env, {
      method: "POST",
      body: JSON.stringify(
        subscribePayload({ restaurant_id: "night market/store 7" }),
      ),
    });
    body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data?.restaurantId).toBe("night market/store 7");
    expect(env.CACHE_KV.put).toHaveBeenLastCalledWith(
      `push:subscription:night%20market%2Fstore%207:user-1:${expectedId}`,
      expect.any(String),
      expect.any(Object),
    );
  });

  it("rejects invalid subscription payloads and cross-restaurant writes", async () => {
    const env = createEnv();

    let response = await request("/subscribe", env, {
      method: "POST",
      body: JSON.stringify(
        subscribePayload({ subscription: { endpoint: "" } }),
      ),
    });
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
    });
    expect(env.CACHE_KV.put).not.toHaveBeenCalled();

    response = await request("/subscribe", env, {
      method: "POST",
      body: JSON.stringify(subscribePayload({ restaurant_id: "restaurant-2" })),
    });
    body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error).toEqual({
      code: "PUSH_SUBSCRIPTION_FORBIDDEN",
      message: "Cannot manage push subscriptions for another restaurant",
    });
    expect(env.CACHE_KV.put).not.toHaveBeenCalled();
  });

  it("deletes a subscription by explicit id or endpoint hash", async () => {
    const env = createEnv();
    const explicitId = "subscription-abc";

    let response = await request("/unsubscribe", env, {
      method: "POST",
      body: JSON.stringify({ subscriptionId: explicitId }),
    });
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        unsubscribed: true,
        subscriptionId: explicitId,
        restaurantId: "restaurant-1",
      },
    });
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith(
      `push:subscription:restaurant-1:user-42:${explicitId}`,
    );

    response = await request("/unsubscribe", env, {
      method: "POST",
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    body = await json(response);
    const expectedId = await subscriptionId();

    expect(response.status).toBe(200);
    expect(body.data?.subscriptionId).toBe(expectedId);
    expect(env.CACHE_KV.delete).toHaveBeenLastCalledWith(
      `push:subscription:restaurant-1:user-42:${expectedId}`,
    );
  });

  it("supports unsubscribe no-ops and validates unsubscribe scope", async () => {
    const env = createEnv();

    let response = await request("/unsubscribe", env, {
      method: "POST",
      body: JSON.stringify({}),
    });
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        unsubscribed: false,
        subscriptionId: null,
        restaurantId: "restaurant-1",
      },
    });
    expect(env.CACHE_KV.delete).not.toHaveBeenCalled();

    response = await request("/unsubscribe", env, {
      method: "POST",
      body: JSON.stringify({ endpoint: "not-a-url" }),
    });
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");

    response = await request("/unsubscribe", env, {
      method: "POST",
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        restaurant_id: "restaurant-2",
      }),
    });
    body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("PUSH_SUBSCRIPTION_FORBIDDEN");
    expect(env.CACHE_KV.delete).not.toHaveBeenCalled();
  });
});
