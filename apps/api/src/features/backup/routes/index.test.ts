import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  user: {
    id: "user-1",
    role: 1,
    restaurantId: "550e8400-e29b-41d4-a716-446655440000",
  } as {
    id: string;
    role: number;
    restaurantId?: string | number | null;
  },
  controller: {
    createBackup: vi.fn(),
    listBackups: vi.fn(),
    getBackup: vi.fn(),
    downloadBackup: vi.fn(),
    restoreBackup: vi.fn(),
    deleteBackup: vi.fn(),
    getConfigurations: vi.fn(),
    saveConfiguration: vi.fn(),
    getSystemHealth: vi.fn(),
    getRestaurantMetrics: vi.fn(),
    getRestaurantAlerts: vi.fn(),
    acknowledgeAlert: vi.fn(),
    resolveAlert: vi.fn(),
  },
  backupServiceCtor: vi.fn(),
  backupStorageServiceCtor: vi.fn(),
  backupConfigServiceCtor: vi.fn(),
  backupValidationServiceCtor: vi.fn(),
  setRequestContext: vi.fn(),
}));

vi.mock("../controllers/BackupController", () => ({
  BackupController: vi.fn(function BackupController() {
    return mocks.controller;
  }),
}));

vi.mock("../services/BackupService", () => ({
  BackupService: vi.fn(function BackupService(...args: unknown[]) {
    mocks.backupServiceCtor(...args);
    return {
      setRequestContext: mocks.setRequestContext,
    };
  }),
}));

vi.mock("../services/BackupStorageService", () => ({
  BackupStorageService: vi.fn(function BackupStorageService(
    ...args: unknown[]
  ) {
    mocks.backupStorageServiceCtor(...args);
    return {};
  }),
}));

vi.mock("../services/BackupConfigService", () => ({
  BackupConfigService: vi.fn(function BackupConfigService(
    ...args: unknown[]
  ) {
    mocks.backupConfigServiceCtor(...args);
    return {};
  }),
}));

vi.mock("../services/BackupValidationService", () => ({
  BackupValidationService: vi.fn(function BackupValidationService(
    ...args: unknown[]
  ) {
    mocks.backupValidationServiceCtor(...args);
    return {};
  }),
}));

import { createBackupRoutes } from "./index";

function createApp() {
  const routes = createBackupRoutes();
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.set("user", mocks.user);
    await next();
  });
  app.route("/", routes);
  app.onError((err, c) => {
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

  return app;
}

function env() {
  return {
    DB: { binding: "db" },
    BACKUP_STORAGE: { put: vi.fn(async () => undefined) },
    BACKUP_KV: { put: vi.fn(async () => undefined) },
  };
}

function request(path: string, options: RequestInit = {}, bindings = env()) {
  const app = createApp();
  return {
    bindings,
    response: app.request(
      path,
      {
        ...options,
        headers: {
          ...(options.body === undefined
            ? {}
            : { "content-type": "application/json" }),
          ...(options.headers ?? {}),
        },
      },
      bindings as never,
    ),
  };
}

const restaurantId = "550e8400-e29b-41d4-a716-446655440000";
const backupId = "660e8400-e29b-41d4-a716-446655440000";

describe("backup routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T04:05:06.000Z"));
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "upload-uuid"),
    });
    mocks.user = { id: "user-1", role: 1, restaurantId };

    for (const [name, fn] of Object.entries(mocks.controller)) {
      fn.mockImplementation((c) =>
        c.json({ success: true, data: { handler: name } }),
      );
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("initializes services for each request and forwards backup operation routes", async () => {
    const createBody = {
      restaurant_id: restaurantId,
      name: "Nightly",
      backup_type: "full",
      force_immediate: true,
    };
    const result = request("/create", {
      method: "POST",
      body: JSON.stringify(createBody),
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "user-agent": "Vitest",
      },
    });

    let response = await result.response;
    expect(response.status).toBe(200);
    expect(mocks.controller.createBackup).toHaveBeenCalledOnce();
    expect(mocks.backupStorageServiceCtor).toHaveBeenCalledWith(
      result.bindings.BACKUP_STORAGE,
      result.bindings.BACKUP_KV,
    );
    expect(mocks.backupConfigServiceCtor).toHaveBeenCalledWith(
      result.bindings.DB,
    );
    expect(mocks.backupValidationServiceCtor).toHaveBeenCalledWith(
      result.bindings.DB,
    );
    expect(mocks.backupServiceCtor).toHaveBeenCalledWith(
      result.bindings.DB,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined, // encryptionKey — not configured in the test env
    );
    expect(mocks.setRequestContext).toHaveBeenCalledWith({
      ipAddress: "203.0.113.10",
      userAgent: "Vitest",
    });

    response = await request(
      `/list?restaurant_id=${restaurantId}&page=2&limit=5`,
    ).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.listBackups).toHaveBeenCalledOnce();

    response = await request(`/${backupId}`).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.getBackup).toHaveBeenCalledOnce();

    response = await request(`/${backupId}/download`).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.downloadBackup).toHaveBeenCalledOnce();

    response = await request(`/${backupId}`, { method: "DELETE" }).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.deleteBackup).toHaveBeenCalledOnce();
  });

  it("forwards restore, configuration, monitoring, and alert routes", async () => {
    const restoreBody = {
      restaurant_id: restaurantId,
      backup_id: backupId,
      restore_type: "selective",
      target_tables: ["orders"],
      overwrite_existing: false,
      safety_confirmation: {
        backup_integrity_verified: true,
        data_loss_risk_acknowledged: true,
        confirmation_phrase: "I understand the risks",
      },
    };

    let response = await request(`/${backupId}/restore`, {
      method: "POST",
      body: JSON.stringify(restoreBody),
    }).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.restoreBackup).toHaveBeenCalledOnce();

    response = await request(`/configurations/${restaurantId}`).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.getConfigurations).toHaveBeenCalledOnce();

    response = await request("/configurations", {
      method: "POST",
      body: JSON.stringify({
        restaurant_id: restaurantId,
        name: "Daily",
        retention_days: 30,
      }),
    }).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.saveConfiguration).toHaveBeenCalledOnce();

    response = await request("/system/health").response;
    expect(response.status).toBe(200);
    expect(mocks.controller.getSystemHealth).toHaveBeenCalledOnce();

    response = await request(
      `/restaurants/${restaurantId}/metrics?period=month`,
    ).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.getRestaurantMetrics).toHaveBeenCalledOnce();

    response = await request(`/alerts/${restaurantId}?unresolved_only=true`)
      .response;
    expect(response.status).toBe(200);
    expect(mocks.controller.getRestaurantAlerts).toHaveBeenCalledOnce();

    response = await request("/alerts/alert-1/acknowledge", {
      method: "PATCH",
    }).response;
    expect(response.status).toBe(200);
    expect(mocks.controller.acknowledgeAlert).toHaveBeenCalledOnce();

    response = await request("/alerts/alert-1/resolve", { method: "PATCH" })
      .response;
    expect(response.status).toBe(200);
    expect(mocks.controller.resolveAlert).toHaveBeenCalledOnce();
  });

  it("rejects invalid validated bodies and queries before controller dispatch", async () => {
    let response = await request("/create", {
      method: "POST",
      body: JSON.stringify({
        restaurant_id: "not-a-uuid",
        name: "",
      }),
    }).response;

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.controller.createBackup).not.toHaveBeenCalled();

    response = await request(`/list?restaurant_id=${restaurantId}&limit=101`)
      .response;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.controller.listBackups).not.toHaveBeenCalled();

    response = await request(`/${backupId}/restore`, {
      method: "POST",
      body: JSON.stringify({
        restaurant_id: restaurantId,
        backup_id: backupId,
        restore_type: "full",
        safety_confirmation: {
          backup_integrity_verified: true,
          data_loss_risk_acknowledged: true,
          confirmation_phrase: "wrong phrase",
        },
      }),
    }).response;
    expect(response.status).toBe(400);
    expect(mocks.controller.restoreBackup).not.toHaveBeenCalled();
  });

  it("persists offline backup uploads for global and scoped restaurant requests", async () => {
    let result = request("/upload", {
      method: "POST",
      body: JSON.stringify({
        backup_id: "offline-1",
        payload: { orders: 2 },
      }),
    });

    let response = await result.response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        backup_id: "offline-1",
        uploaded: true,
        restaurant_id: restaurantId,
        storage_key: `offline-uploads/${restaurantId}/offline-1.json`,
        uploaded_at: "2026-06-07T04:05:06.000Z",
      },
    });
    expect(result.bindings.BACKUP_STORAGE.put).toHaveBeenCalledWith(
      `offline-uploads/${restaurantId}/offline-1.json`,
      expect.stringContaining('"backupId":"offline-1"'),
      { httpMetadata: { contentType: "application/json" } },
    );
    expect(result.bindings.BACKUP_KV.put).toHaveBeenCalledWith(
      "backup:offline-upload:offline-1",
      expect.stringContaining(
        `"storageKey":"offline-uploads/${restaurantId}/offline-1.json"`,
      ),
      { expirationTtl: 60 * 60 * 24 * 90 },
    );

    mocks.user = { id: "user-2", role: 1 };
    response = await request("/upload", {
      method: "POST",
      body: JSON.stringify({
        backup_id: "offline-global",
      }),
    }).response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        restaurant_id: "global",
        storage_key: "offline-uploads/global/offline-global.json",
      },
    });

    mocks.user = { id: "user-1", role: 1, restaurantId };
    result = request("/upload", {
      method: "POST",
      body: JSON.stringify({
        restaurant_id: restaurantId,
        payload: { tables: 1 },
      }),
    });
    response = await result.response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        backup_id: "upload-uuid",
        restaurant_id: restaurantId,
        storage_key: `offline-uploads/${restaurantId}/upload-uuid.json`,
      },
    });
  });

  it("blocks offline uploads for another restaurant unless the user is admin", async () => {
    let response = await request("/upload", {
      method: "POST",
      body: JSON.stringify({
        restaurant_id: "other-restaurant",
        backup_id: "offline-2",
      }),
    }).response;

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "BACKUP_UPLOAD_FORBIDDEN" },
    });

    mocks.user = { id: "admin-1", role: 0 };
    response = await request("/upload", {
      method: "POST",
      body: JSON.stringify({
        restaurant_id: "other-restaurant",
        backup_id: "offline-3",
      }),
    }).response;

    expect(response.status).toBe(200);
  });
});
