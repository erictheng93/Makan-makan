import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 8,
      username: "chef",
      role: 2,
      restaurantId: "rest-1",
    });
    await next();
  }),
  sseAuthMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 8,
      username: "chef",
      role: 2,
      restaurantId: "rest-1",
    });
    await next();
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../services/KitchenService", () => ({
  KitchenService: vi.fn(),
}));

import kitchenRoutes from "../routes";

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
        err.status as never,
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

  app.route("/kitchen", kitchenRoutes);
  return { app, kv };
}

describe("Kitchen Notification Settings Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores kitchen notification settings in KV", async () => {
    const { app, kv } = buildApp();
    const settings = {
      newOrders: true,
      timerAlerts: true,
      orderModifications: true,
      kitchenAlerts: true,
      shiftUpdates: false,
      sound: true,
      vibration: true,
      soundVolume: 80,
      priorityAlerts: true,
      autoAcknowledge: false,
      displayDuration: 5,
    };

    const response = await app.request(
      "/kitchen/notification-settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.settings).toEqual(settings);
    expect(kv.put).toHaveBeenCalledOnce();
    expect(kv.put.mock.calls[0][0]).toBe(
      "kitchen:notification-settings:rest-1:8",
    );
    expect(JSON.parse(kv.put.mock.calls[0][1])).toMatchObject({
      userId: 8,
      restaurantId: "rest-1",
      settings,
    });
  });

  it("returns stored kitchen notification settings", async () => {
    const settings = { newOrders: false, sound: false };
    const { app, kv } = buildApp({
      get: vi.fn().mockResolvedValue({ settings }),
      put: vi.fn().mockResolvedValue(undefined),
    });

    const response = await app.request(
      "/kitchen/notification-settings",
      {},
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, data: settings });
    expect(kv.get).toHaveBeenCalledWith(
      "kitchen:notification-settings:rest-1:8",
      "json",
    );
  });
});
