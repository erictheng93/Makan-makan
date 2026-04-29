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

import adminSettingsRoutes from "../routes";

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

  app.route("/admin", adminSettingsRoutes);
  return { app, kv };
}

const settings = {
  newOrders: true,
  systemAlerts: true,
  backupStatus: true,
  performanceAlerts: false,
  userActivity: false,
  inventoryAlerts: true,
  revenueUpdates: true,
  sound: true,
  vibration: false,
  quietHours: {
    enabled: true,
    start: "21:30",
    end: "08:00",
  },
};

describe("Admin Settings Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores notification settings by restaurant and user", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/admin/notification-settings",
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

    const [key, value] = kv.put.mock.calls[0];
    expect(key).toBe("admin:notification-settings:rest-1:7");
    expect(JSON.parse(value)).toMatchObject({
      userId: 7,
      restaurantId: "rest-1",
      settings,
    });
  });

  it("returns stored notification settings", async () => {
    const kv = createMockKV();
    kv.get.mockResolvedValue({
      userId: 7,
      restaurantId: "rest-1",
      settings,
      updatedAt: "2026-04-29T00:00:00.000Z",
    });
    const { app } = buildApp(kv);

    const response = await app.request(
      "/admin/notification-settings",
      {},
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true, data: settings });
    expect(kv.get).toHaveBeenCalledWith(
      "admin:notification-settings:rest-1:7",
      "json",
    );
  });

  it("returns defaults when no settings are stored", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/admin/notification-settings",
      {},
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      newOrders: true,
      systemAlerts: true,
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "08:00",
      },
    });
  });

  it("rejects invalid quiet hour values", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/admin/notification-settings",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          quietHours: { enabled: true, start: "25:00", end: "08:00" },
        }),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("stores background-synced admin settings snapshots", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/admin/settings/sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sync_id: "sync-1",
          restaurant_id: "rest-1",
          settings: { locale: "zh-TW", receiptFooter: "Thank you" },
        }),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      data: {
        syncId: "sync-1",
        synced: true,
        restaurantId: "rest-1",
      },
    });
    expect(kv.put).toHaveBeenCalledWith(
      "admin:settings-sync:rest-1:7:sync-1",
      expect.stringContaining('"restaurantId":"rest-1"'),
      { expirationTtl: 2592000 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "admin:settings-sync:rest-1:7:latest",
      expect.stringContaining('"restaurantId":"rest-1"'),
      { expirationTtl: 2592000 },
    );
  });

  it("rejects owner settings syncs for another restaurant", async () => {
    const { app, kv } = buildApp();

    const response = await app.request(
      "/admin/settings/sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sync_id: "sync-2",
          restaurant_id: "rest-2",
          settings: { locale: "zh-TW" },
        }),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as any;

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("SETTINGS_SYNC_FORBIDDEN");
    expect(kv.put).not.toHaveBeenCalled();
  });
});
