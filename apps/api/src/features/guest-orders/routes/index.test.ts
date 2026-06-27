import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";

const databaseMocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  selectQueue: [] as Array<{ get?: unknown }>,
}));
const createOrder = vi.hoisted(() => vi.fn());
const getOrder = vi.hoisted(() => vi.fn());
const updateOrder = vi.hoisted(() => vi.fn());
const addItemsToOrder = vi.hoisted(() => vi.fn());
const cancelOrder = vi.hoisted(() => vi.fn());
const enforceQuota = vi.hoisted(() => vi.fn());
const meterEmit = vi.hoisted(() => vi.fn());

vi.mock("@makanmakan/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@makanmakan/database")>()),
  createDatabase: databaseMocks.createDatabase,
}));

vi.mock("../../../middleware/quotaGate", () => ({
  enforceQuota,
}));

vi.mock("../../../shared/utils/meter", () => ({
  meterEmit,
}));

vi.mock("../../../middleware/guestAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../middleware/guestAuth")>()),
  generateGuestToken: () => "gt_test_token",
  guestTokenAuth: async (
    c: {
      req: {
        param: (name: string) => string;
        header: (name: string) => string | undefined;
      };
      set: (key: "guestOrder", value: unknown) => void;
    },
    next: () => Promise<void>,
  ) => {
    c.set("guestOrder", {
      orderId: c.req.param("id"),
      restaurantId: "restaurant-1",
      guestName: "Guest",
      phoneLastDigits: "678",
      createdAt: 1780308000000,
    });
    await next();
  },
}));

vi.mock("../../orders/services/OrdersService", () => ({
  OrdersService: function OrdersService() {
    return {
      createOrder,
      getOrder,
      updateOrder,
      addItemsToOrder,
      cancelOrder,
    };
  },
}));

function createMockDb() {
  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      get: vi.fn(async () => databaseMocks.selectQueue.shift()?.get),
    };
    return chain;
  };

  return { select: vi.fn(() => createSelectChain()) };
}

function createEnv() {
  const kv = new Map<string, string>();
  return {
    DB: {},
    CACHE_KV: {
      get: vi.fn(async (key: string) => kv.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        kv.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        kv.delete(key);
      }),
    },
  };
}

function validGuestOrderBody(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: "restaurant-1",
    guestName: "Guest",
    phoneLastDigits: "678",
    orderType: "shop",
    items: [{ menuItemId: 101, quantity: 2 }],
    ...overrides,
  };
}

async function withSilencedRouteError<T>(action: () => Promise<T>): Promise<T> {
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  try {
    return await action();
  } finally {
    consoleError.mockRestore();
  }
}

describe("guest order routes", () => {
  beforeEach(() => {
    databaseMocks.selectQueue.length = 0;
    databaseMocks.createDatabase.mockReset();
    databaseMocks.createDatabase.mockReturnValue(createMockDb());
    createOrder.mockReset();
    getOrder.mockReset();
    updateOrder.mockReset();
    addItemsToOrder.mockReset();
    cancelOrder.mockReset();
    enforceQuota.mockReset();
    meterEmit.mockReset();
  });

  it("creates guest shop orders and stores guest access keys", async () => {
    databaseMocks.selectQueue.push({
      get: {
        id: "restaurant-1",
        isActive: true,
        isAvailable: true,
        settings: { allowGuestOrders: true },
      },
    });
    createOrder.mockResolvedValue({
      id: 501,
      orderNumber: "G001",
      status: "pending",
      totalAmount: 240,
    });
    const env = createEnv();

    const response = await routes.fetch(
      new Request("https://test/", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.10" },
        body: JSON.stringify(validGuestOrderBody({ notes: "no peanuts" })),
      }),
      env as never,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        guestToken: "gt_test_token",
        order: { id: 501, orderNumber: "G001" },
      },
    });
    expect(enforceQuota).toHaveBeenCalledWith(
      expect.anything(),
      "orders.created",
      { restaurantId: "restaurant-1" },
    );
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        tableId: undefined,
        customerInfo: { name: "Guest" },
        orderType: "shop",
        deliveryInfo: { type: "takeaway" },
        isGuestOrder: true,
      }),
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "guest_token:gt_test_token",
      expect.stringContaining('"orderId":"501"'),
      { expirationTtl: 14400 },
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "guest_active:restaurant-1:678",
      "501",
      { expirationTtl: 7200 },
    );
    expect(meterEmit).toHaveBeenCalledWith(
      expect.anything(),
      "orders.created",
      {
        restaurantId: "restaurant-1",
        metadata: { orderId: 501, source: "guest-orders" },
      },
    );
  });

  it("rejects invalid create requests and active duplicate guest orders", async () => {
    const invalidEnv = createEnv();
    const invalidResponse = await routes.fetch(
      new Request("https://test/", {
        method: "POST",
        body: JSON.stringify(validGuestOrderBody({ items: [] })),
      }),
      invalidEnv as never,
    );

    expect(invalidResponse.status).toBe(400);
    expect(enforceQuota).not.toHaveBeenCalled();

    const duplicateEnv = createEnv();
    await duplicateEnv.CACHE_KV.put("guest_active:restaurant-1:678", "501");
    databaseMocks.selectQueue.push({
      get: {
        id: "restaurant-1",
        isActive: true,
        isAvailable: true,
        settings: { allowGuestOrders: true },
      },
    });

    const duplicateResponse = await routes.fetch(
      new Request("https://test/", {
        method: "POST",
        body: JSON.stringify(validGuestOrderBody()),
      }),
      duplicateEnv as never,
    );

    expect(duplicateResponse.status).toBe(429);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      success: false,
    });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("validates restaurant, table, and seat availability before creating", async () => {
    databaseMocks.selectQueue.push({
      get: {
        id: "restaurant-1",
        isActive: true,
        isAvailable: false,
        settings: { allowGuestOrders: true },
      },
    });

    const unavailableResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://test/", {
          method: "POST",
          body: JSON.stringify(validGuestOrderBody()),
        }),
        createEnv() as never,
      ),
    );
    expect(unavailableResponse.status).toBe(500);

    databaseMocks.selectQueue.push(
      {
        get: {
          id: "restaurant-1",
          isActive: true,
          isAvailable: true,
          settings: { allowGuestOrders: true },
        },
      },
      { get: { id: 7, restaurantId: "restaurant-2" } },
    );
    const tableResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://test/", {
          method: "POST",
          body: JSON.stringify(
            validGuestOrderBody({ orderType: "table", tableId: 7 }),
          ),
        }),
        createEnv() as never,
      ),
    );
    expect(tableResponse.status).toBe(500);

    databaseMocks.selectQueue.push(
      {
        get: {
          id: "restaurant-1",
          isActive: true,
          isAvailable: true,
          settings: { allowGuestOrders: true },
        },
      },
      { get: { id: 7, restaurantId: "restaurant-1" } },
      { get: { id: 11, tableId: 8 } },
    );
    const seatResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://test/", {
          method: "POST",
          body: JSON.stringify(
            validGuestOrderBody({
              orderType: "seat",
              tableId: 7,
              seatId: 11,
            }),
          ),
        }),
        createEnv() as never,
      ),
    );
    expect(seatResponse.status).toBe(500);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("maps known order creation conflicts", async () => {
    databaseMocks.selectQueue.push({
      get: {
        id: "restaurant-1",
        isActive: true,
        isAvailable: true,
        settings: { allowGuestOrders: true },
      },
    });
    createOrder.mockRejectedValue(new Error("Menu item 101 is not available"));

    const response = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://test/", {
          method: "POST",
          body: JSON.stringify(validGuestOrderBody()),
        }),
        createEnv() as never,
      ),
    );

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Internal Server Error");
  });

  it("returns guest order details for token-authenticated guests", async () => {
    getOrder.mockResolvedValue({
      id: 501,
      orderNumber: "G001",
      status: "pending",
    });

    const response = await routes.fetch(
      new Request("https://test/501", {
        headers: { Authorization: "Bearer gt_test_token" },
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { order: { id: 501 } },
    });
    expect(getOrder).toHaveBeenCalledWith("501", true);
  });

  it("validates guest item additions and order state", async () => {
    const invalidResponse = await routes.fetch(
      new Request("https://test/501/items", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      }),
      createEnv() as never,
    );
    expect(invalidResponse.status).toBe(400);

    getOrder.mockResolvedValueOnce({
      id: 501,
      status: "ready",
      items: [],
    });
    const stateResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://test/501/items", {
          method: "POST",
          body: JSON.stringify({ items: [{ menuItemId: 101, quantity: 1 }] }),
        }),
        createEnv() as never,
      ),
    );
    expect(stateResponse.status).toBe(500);

    getOrder.mockResolvedValueOnce({
      id: 501,
      status: "pending",
      notes: "existing",
      items: Array.from({ length: 20 }, (_, index) => ({ id: index + 1 })),
    });
    const limitResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://test/501/items", {
          method: "POST",
          body: JSON.stringify({ items: [{ menuItemId: 101, quantity: 1 }] }),
        }),
        createEnv() as never,
      ),
    );
    expect(limitResponse.status).toBe(500);
  });

  it("adds items to pending guest orders", async () => {
    getOrder.mockResolvedValueOnce({
      id: 501,
      status: "confirmed",
      notes: "existing",
      items: [{ id: 1 }],
    });
    addItemsToOrder.mockResolvedValue({
      id: 501,
      status: "confirmed",
      notes: "existing",
      items: [{ id: 1 }, { id: 2, menuItemId: 101, quantity: 1 }],
    });
    const addedItems = [{ menuItemId: 101, quantity: 1, notes: "extra" }];

    const response = await routes.fetch(
      new Request("https://test/501/items", {
        method: "POST",
        body: JSON.stringify({ items: addedItems }),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: "Items added successfully",
      data: { order: { id: 501 } },
    });
    expect(addItemsToOrder).toHaveBeenCalledWith("501", addedItems);
    expect(updateOrder).not.toHaveBeenCalled();
  });

  it("cancels pending guest orders and clears guest access keys", async () => {
    getOrder.mockResolvedValue({
      id: 501,
      status: "pending",
    });
    cancelOrder.mockResolvedValue({
      id: 501,
      status: "cancelled",
    });
    const env = createEnv();

    const response = await routes.fetch(
      new Request("https://test/501/cancel", {
        method: "POST",
        headers: { Authorization: "Bearer gt_test_token" },
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: "Order cancelled successfully",
      data: { order: { status: "cancelled" } },
    });
    expect(cancelOrder).toHaveBeenCalledWith("501", "Cancelled by guest");
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith(
      "guest_active:restaurant-1:678",
    );
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("guest_active_lookup:501");
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith(
      "guest_token:gt_test_token",
    );
  });

  it("rejects cancelling completed guest orders", async () => {
    getOrder.mockResolvedValue({
      id: 501,
      status: "completed",
    });

    const response = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://test/501/cancel", {
          method: "POST",
          headers: { Authorization: "Bearer gt_test_token" },
        }),
        createEnv() as never,
      ),
    );

    expect(response.status).toBe(500);
    expect(cancelOrder).not.toHaveBeenCalled();
  });
});
