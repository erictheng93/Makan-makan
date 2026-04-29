import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 9,
      username: "customer",
      role: 5,
      restaurantId: null,
    });
    await next();
  }),
  requireRole: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../services/UsersService", () => ({
  UsersService: vi.fn(),
}));

import usersRoutes from "../routes";

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

  app.route("/users", usersRoutes);
  return { app, kv };
}

describe("User Notification Settings Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores customer notification settings in KV", async () => {
    const { app, kv } = buildApp();
    const settings = {
      orderUpdates: true,
      promotions: false,
      tableAlerts: true,
      messages: true,
      sound: true,
      vibration: false,
    };

    const response = await app.request(
      "/users/notification-settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.settings).toEqual(settings);
    expect(kv.put).toHaveBeenCalledOnce();
    expect(kv.put.mock.calls[0][0]).toBe("customer:notification-settings:9");
    expect(JSON.parse(kv.put.mock.calls[0][1])).toMatchObject({
      userId: 9,
      settings,
    });
  });

  it("returns stored customer notification settings", async () => {
    const settings = { orderUpdates: false, sound: false };
    const { app, kv } = buildApp({
      get: vi.fn().mockResolvedValue({ settings }),
      put: vi.fn().mockResolvedValue(undefined),
    });

    const response = await app.request(
      "/users/notification-settings",
      {},
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, data: settings });
    expect(kv.get).toHaveBeenCalledWith(
      "customer:notification-settings:9",
      "json",
    );
  });
});
