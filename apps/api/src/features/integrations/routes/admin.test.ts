import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";

const mocks = vi.hoisted(() => ({
  currentUser: {
    value: {
      id: "user-42",
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    } as AuthUser,
  },
  integrationService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getIntegration: vi.fn(),
    getIntegrations: vi.fn(),
    updateConfig: vi.fn(),
  },
  integrationServiceCtor: vi.fn(),
  menuSyncService: {
    syncMenu: vi.fn(),
  },
  menuSyncServiceCtor: vi.fn(),
  orderService: {
    getPlatformOrders: vi.fn(),
  },
  orderServiceCtor: vi.fn(),
  adapterSupported: vi.fn(),
  db: {
    from: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    orderBy: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
  },
  drizzle: vi.fn(),
}));

vi.mock("../../../shared/middleware", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.currentUser.value);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../services/PlatformIntegrationService", () => ({
  PlatformIntegrationService: vi.fn(function PlatformIntegrationService(
    ...args: unknown[]
  ) {
    mocks.integrationServiceCtor(...args);
    return mocks.integrationService;
  }),
}));

vi.mock("../services/PlatformMenuSyncService", () => ({
  PlatformMenuSyncService: vi.fn(function PlatformMenuSyncService(
    ...args: unknown[]
  ) {
    mocks.menuSyncServiceCtor(...args);
    return mocks.menuSyncService;
  }),
}));

vi.mock("../services/PlatformOrderService", () => ({
  PlatformOrderService: vi.fn(function PlatformOrderService(
    ...args: unknown[]
  ) {
    mocks.orderServiceCtor(...args);
    return mocks.orderService;
  }),
}));

vi.mock("../adapters/PlatformAdapter", () => ({
  isPlatformAdapterSupported: mocks.adapterSupported,
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: mocks.drizzle,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => ({ op: "and", conditions })),
  desc: vi.fn((column: unknown) => ({ op: "desc", column })),
  eq: vi.fn((column: unknown, value: unknown) => ({ op: "eq", column, value })),
}));

vi.mock("@makanmasak/database", () => ({
  platformWebhookLogs: {
    createdAt: "created_at",
    platform: "platform",
    restaurantId: "restaurant_id",
  },
}));

import routes from "./admin";
import { ApiError } from "../../../shared/utils/api-error";

// The routes throw ApiError and leave rendering to the app-wide handler that
// app-factory installs; mounted bare there is none, so Hono's default answers
// 500 for every guard.
routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409 | 500 | 501,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function request(path: string, init: RequestInit = {}) {
  return routes.request(path, init, {
    DB: { binding: "db" },
    CACHE_KV: { binding: "cache" },
  } as never);
}

async function json(response: Response) {
  return (await response.json()) as {
    data?: unknown;
    error?: string;
    success?: boolean;
    message?: string;
  };
}

describe("integrations admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.value = {
      id: "user-42",
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    };
    mocks.adapterSupported.mockImplementation(
      (platform: string) => platform === "uber_eats",
    );
    mocks.integrationService.getIntegrations.mockResolvedValue([
      { platform: "uber_eats", enabled: true },
    ]);
    mocks.integrationService.getIntegration.mockResolvedValue({
      platform: "uber_eats",
      enabled: true,
    });
    mocks.integrationService.connect.mockResolvedValue({
      platform: "uber_eats",
      connected: true,
    });
    mocks.integrationService.updateConfig.mockResolvedValue({
      platform: "uber_eats",
      enabled: false,
    });
    mocks.integrationService.disconnect.mockResolvedValue(undefined);
    mocks.menuSyncService.syncMenu.mockResolvedValue(undefined);
    mocks.orderService.getPlatformOrders.mockResolvedValue({
      items: [{ id: "order-1" }],
    });

    mocks.db.select.mockReturnValue(mocks.db);
    mocks.db.from.mockReturnValue(mocks.db);
    mocks.db.where.mockReturnValue(mocks.db);
    mocks.db.orderBy.mockReturnValue(mocks.db);
    mocks.db.limit.mockReturnValue(mocks.db);
    mocks.db.offset.mockResolvedValue([{ id: "log-1", platform: "uber_eats" }]);
    mocks.drizzle.mockReturnValue(mocks.db);
  });

  it("lists integrations and returns a single integration", async () => {
    let response = await request("/restaurant-1");
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.integrationServiceCtor).toHaveBeenCalledWith({
      DB: { binding: "db" },
      CACHE_KV: { binding: "cache" },
    });
    expect(mocks.integrationService.getIntegrations).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(body.data).toEqual([{ platform: "uber_eats", enabled: true }]);

    response = await request("/restaurant-1/uber_eats");
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.integrationService.getIntegration).toHaveBeenCalledWith(
      "restaurant-1",
      "uber_eats",
    );
    expect(body.data).toEqual({ platform: "uber_eats", enabled: true });
  });

  it("rejects owner access to another restaurant's integrations", async () => {
    const response = await withSilencedRouteError(() =>
      request("/restaurant-2"),
    );

    // Was 500: this file had no app-wide error handler, so the 403 the route
    // throws surfaced as Hono's default. The status the caller really gets is
    // the one asserted here.
    expect(response.status).toBe(403);
    expect(mocks.integrationService.getIntegrations).not.toHaveBeenCalled();
  });

  it("allows admins to access any restaurant's integrations", async () => {
    mocks.currentUser.value = {
      id: "user-1",
      username: "admin",
      role: 0,
      restaurantId: "platform",
    };

    const response = await request("/restaurant-2");

    expect(response.status).toBe(200);
    expect(mocks.integrationService.getIntegrations).toHaveBeenCalledWith(
      "restaurant-2",
    );
  });

  it("returns 404 for missing integration details", async () => {
    mocks.integrationService.getIntegration.mockResolvedValueOnce(null);

    const response = await request("/restaurant-1/uber_eats");
    const body = await json(response);

    expect(response.status).toBe(404);
    expect(body.error).toEqual({
      code: "INTEGRATION_NOT_FOUND",
      message: "Integration not found",
    });
  });

  it("connects, updates, and disconnects supported integrations", async () => {
    let response = await request("/restaurant-1/uber_eats/connect", {
      method: "POST",
      body: JSON.stringify({ credentials: { token: "secret" } }),
    });
    let body = await json(response);

    expect(response.status).toBe(201);
    expect(mocks.adapterSupported).toHaveBeenCalledWith("uber_eats");
    expect(mocks.integrationService.connect).toHaveBeenCalledWith(
      "restaurant-1",
      "uber_eats",
      { credentials: { token: "secret" } },
    );
    expect(body.data).toEqual({ platform: "uber_eats", connected: true });

    response = await request("/restaurant-1/uber_eats", {
      method: "PUT",
      body: JSON.stringify({ enabled: false }),
    });
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.integrationService.updateConfig).toHaveBeenCalledWith(
      "restaurant-1",
      "uber_eats",
      { enabled: false },
    );
    expect(body.data).toEqual({ platform: "uber_eats", enabled: false });

    response = await request("/restaurant-1/uber_eats", {
      method: "DELETE",
    });
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.integrationService.disconnect).toHaveBeenCalledWith(
      "restaurant-1",
      "uber_eats",
    );
    expect(body).toEqual({ success: true });
  });

  it("rejects owner mutation of another restaurant's integration", async () => {
    const updateResponse = await withSilencedRouteError(() =>
      request("/restaurant-2/uber_eats", {
        method: "PUT",
        body: JSON.stringify({ enabled: false }),
      }),
    );
    const deleteResponse = await withSilencedRouteError(() =>
      request("/restaurant-2/uber_eats", {
        method: "DELETE",
      }),
    );

    expect(updateResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(mocks.integrationService.updateConfig).not.toHaveBeenCalled();
    expect(mocks.integrationService.disconnect).not.toHaveBeenCalled();
  });

  it("rejects unsupported connect, update, and menu sync platforms", async () => {
    for (const [path, init] of [
      [
        "/restaurant-1/foodpanda/connect",
        { method: "POST", body: JSON.stringify({}) },
      ],
      [
        "/restaurant-1/foodpanda",
        { method: "PUT", body: JSON.stringify({ enabled: true }) },
      ],
      ["/restaurant-1/foodpanda/menu-sync", { method: "POST" }],
    ] as const) {
      const response = await request(path, init);
      const body = await json(response);
      expect(response.status).toBe(501);
      expect(body.error).toEqual({
        code: "INTEGRATION_NOT_AVAILABLE",
        message: "foodpanda integration is not available yet",
      });
    }
    expect(mocks.integrationService.connect).not.toHaveBeenCalled();
    expect(mocks.integrationService.updateConfig).not.toHaveBeenCalled();
    expect(mocks.menuSyncService.syncMenu).not.toHaveBeenCalled();
  });

  it("triggers menu sync and lists platform orders", async () => {
    let response = await request("/restaurant-1/uber_eats/menu-sync", {
      method: "POST",
    });
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.menuSyncServiceCtor).toHaveBeenCalled();
    expect(mocks.menuSyncService.syncMenu).toHaveBeenCalledWith(
      "restaurant-1",
      "uber_eats",
    );
    expect(body).toEqual({
      success: true,
      message: "Menu sync completed",
    });

    response = await request(
      "/restaurant-1/uber_eats/orders?status=accepted&limit=25&page=3",
    );
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.orderService.getPlatformOrders).toHaveBeenCalledWith(
      "restaurant-1",
      {
        platform: "uber_eats",
        platformStatus: "accepted",
        limit: 25,
        page: 3,
      },
    );
    expect(body.data).toEqual({ items: [{ id: "order-1" }] });
  });

  it("rejects owner menu sync and order listing for another restaurant", async () => {
    const syncResponse = await withSilencedRouteError(() =>
      request("/restaurant-2/uber_eats/menu-sync", {
        method: "POST",
      }),
    );
    const ordersResponse = await withSilencedRouteError(() =>
      request("/restaurant-2/uber_eats/orders"),
    );

    expect(syncResponse.status).toBe(403);
    expect(ordersResponse.status).toBe(403);
    expect(mocks.menuSyncService.syncMenu).not.toHaveBeenCalled();
    expect(mocks.orderService.getPlatformOrders).not.toHaveBeenCalled();
  });

  it("lists webhook logs with default and explicit filters", async () => {
    let response = await request("/restaurant-1/webhook-logs");
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.drizzle).toHaveBeenCalledWith({ binding: "db" });
    expect(mocks.db.limit).toHaveBeenCalledWith(50);
    expect(mocks.db.offset).toHaveBeenCalledWith(0);
    expect(body.data).toEqual([{ id: "log-1", platform: "uber_eats" }]);

    response = await request(
      "/restaurant-1/webhook-logs?platform=uber_eats&limit=10&offset=20",
    );
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.db.limit).toHaveBeenLastCalledWith(10);
    expect(mocks.db.offset).toHaveBeenLastCalledWith(20);
    expect(body.data).toEqual([{ id: "log-1", platform: "uber_eats" }]);
  });
});

async function withSilencedRouteError<T>(
  action: () => T | Promise<T>,
): Promise<Awaited<T>> {
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  try {
    return await action();
  } finally {
    consoleError.mockRestore();
  }
}
