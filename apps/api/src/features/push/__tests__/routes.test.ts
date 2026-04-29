import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 7,
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    });
    await next();
  }),
}));

import pushRoutes from "../routes";

function createMockKV() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

function buildApp(kv = createMockKV()) {
  const app = new Hono<any>();

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as any,
      );
    }
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: err.message },
      },
      500,
    );
  });

  app.route("/push", pushRoutes);
  return { app, kv };
}

const validBody = {
  subscription: {
    endpoint: "https://push.example.test/subscription/abc",
    keys: {
      p256dh: "p256dh-key",
      auth: "auth-key",
    },
  },
  user_type: "admin",
  role: "owner",
  restaurant_id: "rest-1",
  device_info: {
    platform: "MacIntel",
    language: "zh-TW",
  },
};

describe("Push Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores an authenticated push subscription in KV", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/push/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.subscribed).toBe(true);
    expect(json.data.restaurantId).toBe("rest-1");
    expect(kv.put).toHaveBeenCalledOnce();

    const [key, value, options] = kv.put.mock.calls[0];
    expect(key).toMatch(/^push:subscription:rest-1:7:/);
    expect(options).toEqual({ expirationTtl: 31536000 });
    expect(JSON.parse(value)).toMatchObject({
      userId: 7,
      username: "owner",
      userRole: 1,
      userType: "admin",
      requestedRole: "owner",
      restaurantId: "rest-1",
      subscription: validBody.subscription,
      deviceInfo: validBody.device_info,
    });
  });

  it("rejects invalid subscription payloads", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/push/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: {
            endpoint: "not-a-url",
            keys: { p256dh: "", auth: "auth-key" },
          },
        }),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(kv.put).not.toHaveBeenCalled();
  });
});
