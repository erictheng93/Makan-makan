import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
  authMiddleware: vi.fn(async (_c, next) => {
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

vi.mock("@makanmakan/database", () => ({
  platformWebhookLogs: {
    createdAt: "created_at",
    platform: "platform",
    restaurantId: "restaurant_id",
  },
}));

import routes from "./admin";

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

  it("returns 404 for missing integration details", async () => {
    mocks.integrationService.getIntegration.mockResolvedValueOnce(null);

    const response = await request("/restaurant-1/uber_eats");
    const body = await json(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe("Integration not found");
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
      expect(body.error).toBe("foodpanda integration is not available yet");
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
