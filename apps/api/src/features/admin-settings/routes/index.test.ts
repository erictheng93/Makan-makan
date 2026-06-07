import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  user: {
    id: 42,
    username: "owner",
    role: 1,
    restaurantId: "restaurant-1",
  },
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.user);
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

function createCacheKv(stored: unknown = null) {
  return {
    get: vi.fn(async () => stored),
    put: vi.fn(async () => undefined),
  };
}

function request(
  path: string,
  init: RequestInit = {},
  cacheKv = createCacheKv(),
) {
  return routes.request(path, init, { CACHE_KV: cacheKv } as never);
}

function postJson(path: string, body: unknown, cacheKv = createCacheKv()) {
  return request(
    path,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
    cacheKv,
  );
}

function putJson(path: string, body: unknown, cacheKv = createCacheKv()) {
  return request(
    path,
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
    cacheKv,
  );
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: unknown;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

const notificationSettings = {
  newOrders: false,
  systemAlerts: true,
  backupStatus: true,
  performanceAlerts: false,
  userActivity: true,
  inventoryAlerts: false,
  revenueUpdates: true,
  sound: false,
  vibration: true,
  quietHours: {
    enabled: true,
    start: "21:30",
    end: "07:15",
  },
};

describe("admin settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.user = {
      id: 42,
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    };
  });

  it("returns stored notification settings for the authenticated user scope", async () => {
    const cacheKv = createCacheKv({
      userId: 42,
      restaurantId: "restaurant-1",
      settings: notificationSettings,
      updatedAt: "2026-06-01T00:00:00.000Z",
    });

    const response = await request("/notification-settings", {}, cacheKv);
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(cacheKv.get).toHaveBeenCalledWith(
      "admin:notification-settings:restaurant-1:42",
      "json",
    );
    expect(body).toEqual({ success: true, data: notificationSettings });
  });

  it("falls back to default notification settings when none are stored", async () => {
    const response = await request("/notification-settings");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        newOrders: true,
        systemAlerts: true,
        backupStatus: true,
        performanceAlerts: true,
        userActivity: false,
        inventoryAlerts: true,
        revenueUpdates: true,
        sound: true,
        vibration: true,
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "08:00",
        },
      },
    });
  });

  it("stores validated notification settings with an update timestamp", async () => {
    vi.setSystemTime(new Date("2026-06-07T12:34:56.000Z"));
    const cacheKv = createCacheKv();

    const response = await putJson(
      "/notification-settings",
      notificationSettings,
      cacheKv,
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(cacheKv.put).toHaveBeenCalledWith(
      "admin:notification-settings:restaurant-1:42",
      JSON.stringify({
        userId: 42,
        restaurantId: "restaurant-1",
        settings: notificationSettings,
        updatedAt: "2026-06-07T12:34:56.000Z",
      }),
    );
    expect(body).toEqual({
      success: true,
      data: {
        settings: notificationSettings,
        updatedAt: "2026-06-07T12:34:56.000Z",
      },
    });
  });

  it("rejects invalid notification quiet-hour times", async () => {
    const cacheKv = createCacheKv();

    const response = await putJson(
      "/notification-settings",
      {
        ...notificationSettings,
        quietHours: {
          ...notificationSettings.quietHours,
          start: "24:00",
        },
      },
      cacheKv,
    );
    const body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(cacheKv.put).not.toHaveBeenCalled();
  });

  it("syncs settings to user and latest keys with a supplied sync id", async () => {
    vi.setSystemTime(new Date("2026-06-07T13:00:00.000Z"));
    const cacheKv = createCacheKv();
    const payload = {
      sync_id: "terminal #1",
      restaurant_id: "restaurant-1",
      layout: "compact",
    };

    const response = await postJson("/settings/sync", payload, cacheKv);
    const body = await json(response);

    expect(response.status).toBe(200);
    const record = JSON.stringify({
      userId: 42,
      restaurantId: "restaurant-1",
      settings: payload,
      syncedAt: "2026-06-07T13:00:00.000Z",
    });
    expect(cacheKv.put).toHaveBeenNthCalledWith(
      1,
      "admin:settings-sync:restaurant-1:42:terminal%20%231",
      record,
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(cacheKv.put).toHaveBeenNthCalledWith(
      2,
      "admin:settings-sync:restaurant-1:42:latest",
      record,
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(body).toEqual({
      success: true,
      data: {
        syncId: "terminal%20%231",
        synced: true,
        restaurantId: "restaurant-1",
        syncedAt: "2026-06-07T13:00:00.000Z",
      },
    });
  });

  it("uses global scope for admins without a restaurant", async () => {
    vi.setSystemTime(new Date("2026-06-07T14:00:00.000Z"));
    mocks.user = {
      id: 1,
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };
    const cacheKv = createCacheKv();

    const response = await postJson("/settings/sync", {}, cacheKv);
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(cacheKv.put).toHaveBeenCalledWith(
      "admin:settings-sync:global:1:1780840800000",
      expect.any(String),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(body).toMatchObject({
      success: true,
      data: {
        syncId: "1780840800000",
        restaurantId: null,
      },
    });
  });

  it("prevents owners from syncing another restaurant scope", async () => {
    const cacheKv = createCacheKv();

    const response = await postJson(
      "/settings/sync",
      {
        restaurant_id: "restaurant-2",
      },
      cacheKv,
    );
    const body = await json(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      error: {
        code: "SETTINGS_SYNC_FORBIDDEN",
        message: "Cannot sync settings for another restaurant",
      },
    });
    expect(cacheKv.put).not.toHaveBeenCalled();
  });
});
