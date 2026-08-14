import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

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

vi.mock("@makanmasak/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@makanmasak/database")>()),
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

function createRoutesWithApiErrorHandler() {
  const app = new Hono();
  app.route("/", routes);
  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined && { details: error.details }),
          },
        },
        error.status as never,
      );
    }
    throw error;
  });
  return app;
}

// A well-formed guest token (`gt_` + 32-byte hex). The route only rebuilds a
// lock key from tokens that match that shape, so cancel-path tests must use a
// realistic one rather than a placeholder string.
const CANCELLING_GUEST_TOKEN = `gt_${"c".repeat(64)}`;

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
        enableShopMode: true,
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
      "guest_active:restaurant-1:token:gt_test_token",
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

  it("refuses shop orders once the owner turns shop mode off", async () => {
    // The printed sticker keeps working otherwise: nothing else on this path
    // reads enableShopMode, and a shop that skips the pickup-digits screen
    // never touches the QR verify endpoint that does.
    databaseMocks.selectQueue.push({
      get: {
        id: "restaurant-1",
        isActive: true,
        isAvailable: true,
        enableShopMode: false,
        settings: { allowGuestOrders: true },
      },
    });

    const response = await createRoutesWithApiErrorHandler().fetch(
      new Request("https://test/", {
        method: "POST",
        body: JSON.stringify(validGuestOrderBody()),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: "SHOP_MODE_DISABLED" },
    });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("still accepts table orders from a shop with shop mode off", async () => {
    // enableShopMode governs the shop QR channel only — dine-in at a table is
    // a different channel and must not be collateral damage.
    databaseMocks.selectQueue.push(
      {
        get: {
          id: "restaurant-1",
          isActive: true,
          isAvailable: true,
          enableShopMode: false,
          settings: { allowGuestOrders: true },
        },
      },
      { get: { id: 3, restaurantId: "restaurant-1" } },
    );
    createOrder.mockResolvedValue({ id: 502, orderNumber: "G002" });

    const response = await routes.fetch(
      new Request("https://test/", {
        method: "POST",
        body: JSON.stringify(
          validGuestOrderBody({ orderType: "table", tableId: 3 }),
        ),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(201);
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: "table", tableId: 3 }),
    );
  });

  it("rejects invalid create requests and active duplicate guest orders", async () => {
    const invalidEnv = createEnv();
    const app = createRoutesWithApiErrorHandler();
    const invalidResponse = await app.fetch(
      new Request("https://test/", {
        method: "POST",
        body: JSON.stringify(validGuestOrderBody({ items: [] })),
      }),
      invalidEnv as never,
    );

    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: [
          {
            field: "items",
            code: "too_small",
          },
        ],
      },
    });
    expect(enforceQuota).not.toHaveBeenCalled();

    const duplicateEnv = createEnv();
    const activeGuestToken =
      "gt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    await duplicateEnv.CACHE_KV.put(
      `guest_active:restaurant-1:token:${activeGuestToken}`,
      "501",
    );
    databaseMocks.selectQueue.push({
      get: {
        id: "restaurant-1",
        isActive: true,
        isAvailable: true,
        enableShopMode: true,
        settings: { allowGuestOrders: true },
      },
    });

    const duplicateResponse = await app.fetch(
      new Request("https://test/", {
        method: "POST",
        headers: { Authorization: `Bearer ${activeGuestToken}` },
        body: JSON.stringify(validGuestOrderBody()),
      }),
      duplicateEnv as never,
    );

    expect(duplicateResponse.status).toBe(429);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "ACTIVE_GUEST_ORDER_EXISTS",
        message:
          "You already have an active order at this restaurant. Please wait for it to complete.",
      },
    });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("does not block separate anonymous guests sharing the same restaurant, table, and IP", async () => {
    databaseMocks.selectQueue.push(
      {
        get: {
          id: "restaurant-1",
          isActive: true,
          isAvailable: true,
          enableShopMode: true,
          settings: { allowGuestOrders: true },
        },
      },
      { get: { id: 7, restaurantId: "restaurant-1" } },
      {
        get: {
          id: "restaurant-1",
          isActive: true,
          isAvailable: true,
          enableShopMode: true,
          settings: { allowGuestOrders: true },
        },
      },
      { get: { id: 7, restaurantId: "restaurant-1" } },
    );
    createOrder
      .mockResolvedValueOnce({ id: 501, orderNumber: "G001" })
      .mockResolvedValueOnce({ id: 502, orderNumber: "G002" });
    const app = createRoutesWithApiErrorHandler();
    const env = createEnv();
    const body = validGuestOrderBody({
      phoneLastDigits: "000",
      orderType: "table",
      tableId: 7,
    });

    const firstResponse = await app.fetch(
      new Request("https://test/", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.10" },
        body: JSON.stringify(body),
      }),
      env as never,
    );
    const secondResponse = await app.fetch(
      new Request("https://test/", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.10" },
        body: JSON.stringify(body),
      }),
      env as never,
    );

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(createOrder).toHaveBeenCalledTimes(2);
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
          enableShopMode: true,
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
          enableShopMode: true,
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
        enableShopMode: true,
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
    const invalidResponse = await createRoutesWithApiErrorHandler().fetch(
      new Request("https://test/501/items", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      }),
      createEnv() as never,
    );
    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: [
          {
            field: "items",
            code: "too_small",
          },
        ],
      },
    });

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
        headers: { Authorization: `Bearer ${CANCELLING_GUEST_TOKEN}` },
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
    // No reverse lookup is stored, so the lock key is rebuilt from the token
    // this request presented — the same token that created the order.
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith(
      `guest_active:restaurant-1:token:${CANCELLING_GUEST_TOKEN}`,
    );
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("guest_active_lookup:501");
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith(
      `guest_token:${CANCELLING_GUEST_TOKEN}`,
    );
  });

  it("prefers the reverse lookup over the rebuilt key on guest cancel", async () => {
    getOrder.mockResolvedValue({
      id: 501,
      status: "pending",
    });
    cancelOrder.mockResolvedValue({
      id: 501,
      status: "cancelled",
    });
    const env = createEnv();
    // The device rotated its token since the order was created (it ordered
    // again elsewhere), so the key stored at creation is the authority.
    const creationKey = `guest_active:restaurant-1:token:gt_${"b".repeat(64)}`;
    await env.CACHE_KV.put("guest_active_lookup:501", creationKey);

    const response = await routes.fetch(
      new Request("https://test/501/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${CANCELLING_GUEST_TOKEN}` },
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith(creationKey);
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("guest_active_lookup:501");
    expect(env.CACHE_KV.delete).not.toHaveBeenCalledWith(
      `guest_active:restaurant-1:token:${CANCELLING_GUEST_TOKEN}`,
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
