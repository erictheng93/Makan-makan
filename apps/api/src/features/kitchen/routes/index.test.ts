import { beforeEach, describe, expect, it, vi } from "vitest";
import { verify } from "hono/jwt";
import routes from "./index";

const mocks = vi.hoisted(() => ({
  currentUser: { id: 22, role: 2, restaurantId: "restaurant-1" },
  validateChefAccess: vi.fn(),
  getKitchenOrders: vi.fn(),
  updateOrderItemStatus: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.currentUser);
    await next();
  }),
  sseAuthMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.currentUser);
    await next();
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("../services/KitchenService", () => ({
  KitchenService: vi.fn(function KitchenService() {
    return {
      validateChefAccess: mocks.validateChefAccess,
      getKitchenOrders: mocks.getKitchenOrders,
      updateOrderItemStatus: mocks.updateOrderItemStatus,
    };
  }),
}));

function createEnv() {
  const store = new Map<string, string>();
  return {
    JWT_SECRET: "test-jwt-secret-for-kitchen-routes-32",
    CACHE_KV: {
      get: vi.fn(async (key: string, type?: string) => {
        const value = store.get(key) ?? null;
        return type === "json" && value ? JSON.parse(value) : value;
      }),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    },
  };
}

function jsonRequest(path: string, method: string, body: unknown) {
  return new Request(`https://kitchen.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expectIsolatedRouteError(action: () => Promise<Response>) {
  const response = await action();
  expect(response.status).toBe(500);
  await expect(response.text()).resolves.toBe("Internal Server Error");
}

describe("kitchen routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    mocks.currentUser = {
      id: 22,
      role: 2,
      restaurantId: "restaurant-1",
    };
    mocks.validateChefAccess.mockReturnValue(true);
    mocks.getKitchenOrders.mockResolvedValue({
      pending: [{ id: 1, orderNumber: "A001" }],
      preparing: [],
      ready: [],
      stats: { pendingCount: 1 },
    });
    mocks.updateOrderItemStatus.mockResolvedValue({
      orderId: 44,
      itemId: 9,
      status: "ready",
      updatedAt: "2026-06-07T00:00:00.000Z",
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.warn).mockRestore();
    vi.mocked(console.log).mockRestore();
    vi.mocked(console.error).mockRestore();
    vi.useRealTimers();
  });

  it("gets empty notification settings and persists user scoped settings", async () => {
    const env = createEnv();
    const emptyResponse = await routes.fetch(
      new Request("https://kitchen.test/notification-settings"),
      env as never,
    );

    expect(emptyResponse.status).toBe(200);
    await expect(emptyResponse.json()).resolves.toEqual({
      success: true,
      data: {},
    });
    expect(env.CACHE_KV.get).toHaveBeenCalledWith(
      "kitchen:notification-settings:restaurant-1:22",
      "json",
    );

    const updateResponse = await routes.fetch(
      jsonRequest("/notification-settings", "PUT", {
        sound: true,
        volume: 80,
      }),
      env as never,
    );

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        settings: { sound: true, volume: 80 },
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "kitchen:notification-settings:restaurant-1:22",
      JSON.stringify({
        userId: 22,
        restaurantId: "restaurant-1",
        settings: { sound: true, volume: 80 },
        updatedAt: "2026-06-07T00:00:00.000Z",
      }),
    );

    const storedResponse = await routes.fetch(
      new Request("https://kitchen.test/notification-settings"),
      env as never,
    );
    await expect(storedResponse.json()).resolves.toEqual({
      success: true,
      data: { sound: true, volume: 80 },
    });
  });

  it("uses a global notification settings key when the user has no restaurant", async () => {
    mocks.currentUser = { id: 22, role: 0, restaurantId: undefined };
    const env = createEnv();

    const response = await routes.fetch(
      jsonRequest("/notification-settings", "PUT", { tickets: "muted" }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "kitchen:notification-settings:global:22",
      expect.stringContaining('"restaurantId":null'),
    );
  });

  it("lists kitchen orders after chef and restaurant access checks", async () => {
    const response = await routes.fetch(
      new Request("https://kitchen.test/restaurant-1/orders"),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        pending: [{ id: 1, orderNumber: "A001" }],
        stats: { pendingCount: 1 },
      },
      message: "Kitchen orders retrieved successfully",
    });
    expect(mocks.validateChefAccess).toHaveBeenCalledWith(
      22,
      2,
      "restaurant-1",
    );
    expect(mocks.getKitchenOrders).toHaveBeenCalledWith(
      "restaurant-1",
      22,
      100,
    );
  });

  it("passes an explicit kitchen order limit from the query string", async () => {
    const response = await routes.fetch(
      new Request("https://kitchen.test/restaurant-1/orders?limit=250"),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.getKitchenOrders).toHaveBeenCalledWith(
      "restaurant-1",
      22,
      250,
    );
  });

  it("issues short-lived scoped tokens for kitchen SSE connections", async () => {
    const env = createEnv();
    const response = await routes.fetch(
      new Request("https://kitchen.test/restaurant-1/events/token", {
        method: "POST",
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { sseToken: string; expiresIn: number };
    };

    expect(body.data.expiresIn).toBe(60);
    const payload = await verify(body.data.sseToken, env.JWT_SECRET, "HS256");
    expect(payload).toMatchObject({
      id: 22,
      role: 2,
      restaurantId: "restaurant-1",
      purpose: "kitchen_sse",
      aud: "kitchen_sse",
    });
    expect(payload.exp).toBe(payload.iat + 60);
    expect(mocks.validateChefAccess).toHaveBeenCalledWith(
      22,
      2,
      "restaurant-1",
    );
  });

  it("updates an order item through the canonical route", async () => {
    const response = await routes.fetch(
      jsonRequest("/restaurant-1/orders/44/items/9", "PUT", {
        status: "ready",
        notes: "plate now",
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        orderId: 44,
        itemId: 9,
        status: "ready",
      },
      message: "Order item status updated successfully",
    });
    expect(mocks.updateOrderItemStatus).toHaveBeenCalledWith(
      "restaurant-1",
      44,
      9,
      { status: "ready", notes: "plate now" },
      22,
    );
  });

  it("rejects invalid canonical item status bodies before service calls", async () => {
    await expectIsolatedRouteError(() =>
      routes.fetch(
        jsonRequest("/restaurant-1/orders/44/items/9", "PUT", {
          status: "anything",
        }),
        createEnv() as never,
      ),
    );

    expect(mocks.updateOrderItemStatus).not.toHaveBeenCalled();
  });

  it("maps legacy start and ready routes to status updates with notes", async () => {
    mocks.updateOrderItemStatus
      .mockResolvedValueOnce({
        orderId: 44,
        itemId: 9,
        status: "preparing",
        updatedAt: "2026-06-07T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        orderId: 44,
        itemId: 9,
        status: "ready",
        updatedAt: "2026-06-07T00:00:00.000Z",
      });

    const startResponse = await routes.fetch(
      jsonRequest("/44/items/9/start", "POST", { data: { notes: "fire" } }),
      createEnv() as never,
    );
    const readyResponse = await routes.fetch(
      jsonRequest("/44/items/9/ready", "POST", { notes: "window" }),
      createEnv() as never,
    );

    expect(startResponse.status).toBe(200);
    expect(readyResponse.status).toBe(200);
    expect(mocks.updateOrderItemStatus).toHaveBeenNthCalledWith(
      1,
      "restaurant-1",
      44,
      9,
      { status: "preparing", notes: "fire" },
      22,
    );
    expect(mocks.updateOrderItemStatus).toHaveBeenNthCalledWith(
      2,
      "restaurant-1",
      44,
      9,
      { status: "ready", notes: "window" },
      22,
    );
    expect(console.warn).toHaveBeenCalledWith(
      "[deprecated-route] kitchen legacy item status hit",
      expect.objectContaining({
        canonical:
          "PUT /api/v1/kitchen/:restaurantId/orders/:orderId/items/:itemId",
      }),
    );
  });

  it("rejects malformed legacy route parameters before service calls", async () => {
    await expectIsolatedRouteError(() =>
      routes.fetch(
        jsonRequest("/bad/items/9/start", "POST", {}),
        createEnv() as never,
      ),
    );

    expect(mocks.updateOrderItemStatus).not.toHaveBeenCalled();
  });

  it("rejects kitchen route access when chef role or restaurant checks fail", async () => {
    mocks.validateChefAccess.mockReturnValueOnce(false);
    await expectIsolatedRouteError(() =>
      routes.fetch(
        new Request("https://kitchen.test/restaurant-1/orders"),
        createEnv() as never,
      ),
    );

    mocks.currentUser = { id: 22, role: 2, restaurantId: "restaurant-2" };
    mocks.validateChefAccess.mockReturnValueOnce(true);
    await expectIsolatedRouteError(() =>
      routes.fetch(
        jsonRequest("/restaurant-1/orders/44/items/9", "PUT", {
          status: "ready",
        }),
        createEnv() as never,
      ),
    );
  });

  it("rejects legacy updates when restaurant context or chef access is missing", async () => {
    mocks.currentUser = { id: 22, role: 2, restaurantId: undefined };
    await expectIsolatedRouteError(() =>
      routes.fetch(
        jsonRequest("/44/items/9/start", "POST", {}),
        createEnv() as never,
      ),
    );

    mocks.currentUser = { id: 22, role: 4, restaurantId: "restaurant-1" };
    mocks.validateChefAccess.mockReturnValueOnce(false);
    await expectIsolatedRouteError(() =>
      routes.fetch(
        jsonRequest("/44/items/9/ready", "POST", {}),
        createEnv() as never,
      ),
    );
  });

  it("rejects SSE event access before opening a stream when checks fail", async () => {
    mocks.validateChefAccess.mockReturnValueOnce(false);
    await expectIsolatedRouteError(() =>
      routes.fetch(
        new Request("https://kitchen.test/restaurant-1/events"),
        createEnv() as never,
      ),
    );

    mocks.currentUser = { id: 22, role: 2, restaurantId: "restaurant-2" };
    mocks.validateChefAccess.mockReturnValueOnce(true);
    await expectIsolatedRouteError(() =>
      routes.fetch(
        new Request("https://kitchen.test/restaurant-1/events"),
        createEnv() as never,
      ),
    );
  });
});
