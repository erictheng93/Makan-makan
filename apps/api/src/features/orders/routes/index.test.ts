import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";

const serviceMocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrders: vi.fn(),
  getOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
  cancelOrder: vi.fn(),
  bulkUpdateOrders: vi.fn(),
  exportOrders: vi.fn(),
  generateReceipt: vi.fn(),
  getOrderStatistics: vi.fn(),
  getOrderAnalytics: vi.fn(),
  getActiveOrders: vi.fn(),
  previewCoupon: vi.fn(),
}));
const gateMocks = vi.hoisted(() => ({
  enforceQuota: vi.fn(),
  quotaGate: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
  meterEmit: vi.fn(),
  moduleGate: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
  assertShopOrderingEnabled: vi.fn(),
}));
const authState = vi.hoisted(() => ({
  user: {
    id: 42,
    role: 1,
    restaurantId: "restaurant-1",
  },
  customer: { id: "customer-42" },
}));

vi.mock("../../../shared/middleware", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../shared/middleware")>();
  return {
    ...actual,
    customerAuthMiddleware: vi.fn(async (c, next) => {
      c.set("user", authState.user);
      c.set("customer", authState.customer);
      await next();
    }),
    requireRole: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => next(),
    ),
  };
});

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: gateMocks.moduleGate,
}));

vi.mock("../../../middleware/quotaGate", () => ({
  enforceQuota: gateMocks.enforceQuota,
  quotaGate: gateMocks.quotaGate,
}));

vi.mock("../../../shared/utils/meter", () => ({
  meterEmit: gateMocks.meterEmit,
}));

vi.mock("../services/OrdersService", () => ({
  OrdersService: function OrdersService() {
    return serviceMocks;
  },
}));

vi.mock("../services/shop-mode-gate", () => ({
  assertShopOrderingEnabled: gateMocks.assertShopOrderingEnabled,
}));

// moduleGate(...) is called once per route at registration (module import
// time), not per-request — capture the keys now, before any
// vi.clearAllMocks()-equivalent reset in beforeEach loses the call history.
const moduleGateRegistrationKeys = gateMocks.moduleGate.mock.calls.map(
  (call) => call[0],
);

function createEnv() {
  const kv = new Map<string, string>();
  return {
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

function jsonRequest(path: string, body: unknown, method = "POST") {
  return new Request(`https://orders.test${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

describe("orders routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(serviceMocks)) {
      mock.mockReset();
    }
    gateMocks.enforceQuota.mockReset();
    gateMocks.meterEmit.mockReset();
    gateMocks.assertShopOrderingEnabled.mockReset();
    authState.user = {
      id: 42,
      role: 1,
      restaurantId: "restaurant-1",
    };
    authState.customer = { id: "customer-42" };
  });

  it("previews coupon discounts for the authenticated user", async () => {
    serviceMocks.previewCoupon.mockResolvedValue({
      valid: true,
      discountAmount: 40,
    });

    const response = await routes.fetch(
      jsonRequest("/preview-coupon", {
        restaurantId: "restaurant-1",
        couponCode: "SAVE40",
        orderAmount: 200,
        menuItems: [{ menuItemId: 7, quantity: 1 }],
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { valid: true, discountAmount: 40 },
    });
    expect(serviceMocks.previewCoupon).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      couponCode: "SAVE40",
      orderAmount: 200,
      userId: 42,
      menuItems: [{ menuItemId: 7, quantity: 1 }],
    });
  });

  it("stores batch sync payloads with encoded sync ids", async () => {
    const env = createEnv();

    const response = await routes.fetch(
      jsonRequest("/batch-sync", {
        sync_id: "local batch/1",
        orders: [{ id: "offline-1" }, { id: "offline-2" }],
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        syncId: "local%20batch%2F1",
        synced: true,
        itemCount: 2,
        restaurantId: "restaurant-1",
      },
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "orders:batch-sync:restaurant-1:42:local%20batch%2F1",
      expect.stringContaining('"userId":42'),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "orders:batch-sync:restaurant-1:42:latest",
      expect.stringContaining('"local batch/1"'),
      { expirationTtl: 60 * 60 * 24 * 30 },
    );
    // /batch-sync mirrors the real order-creation flow (which requires
    // online_ordering) for offline-capable clients; gate it the same way so
    // a deactivated/kill-switched subscription can't keep writing sync data
    // through this side door (see module-gate.test.ts for the real-gate
    // proof). online_ordering already appears on 9 other routes in this
    // file, so this checks the exact total (10 = 9 + /batch-sync) rather
    // than a bare "array contains online_ordering somewhere" — a plain
    // .toContain() would stay green even if this route's gate were removed,
    // since the other 9 registrations still satisfy it.
    expect(
      moduleGateRegistrationKeys.filter((key) => key === "online_ordering")
        .length,
    ).toBe(10);
  });

  it("stores batch sync payloads with global scope and timestamp ids", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    try {
      authState.user = { id: 42, role: 0, restaurantId: null };
      const env = createEnv();

      const response = await routes.fetch(
        jsonRequest("/batch-sync", { orders: "not-an-array" }),
        env as never,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: {
          syncId: "1780790400000",
          itemCount: 0,
          restaurantId: null,
        },
      });
      expect(env.CACHE_KV.put).toHaveBeenCalledWith(
        "orders:batch-sync:global:42:1780790400000",
        expect.stringContaining('"restaurantId":null'),
        expect.anything(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates authenticated orders and serializes timestamps for the wire", async () => {
    const env = createEnv();
    serviceMocks.createOrder.mockResolvedValue({
      id: 1001,
      restaurantId: "restaurant-1",
      createdAt: new Date("2026-06-07T00:00:00.000Z"),
      updatedAt: "2026-06-07T00:01:00.000Z",
    });

    const response = await routes.fetch(
      jsonRequest("/", {
        restaurantId: "restaurant-1",
        customerName: "Dana",
        customerPhone: "0912345678",
        items: [
          {
            menuItemId: 7,
            quantity: 2,
            price: 120,
            notes: "No <b>peanuts</b>",
          },
        ],
        orderType: "table",
        tableId: 3,
      }),
      env as never,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: 1001,
        createdAt: Date.parse("2026-06-07T00:00:00.000Z"),
        updatedAt: Date.parse("2026-06-07T00:01:00.000Z"),
      },
    });
    expect(serviceMocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        tableId: 3,
        customerId: "customer-42",
        items: [
          expect.objectContaining({
            menuItemId: 7,
            quantity: 2,
            notes: "No bpeanuts/b",
          }),
        ],
      }),
      42,
    );
    expect(gateMocks.meterEmit).toHaveBeenCalledWith(
      expect.anything(),
      "orders.created",
      {
        restaurantId: "restaurant-1",
        metadata: { orderId: 1001 },
      },
    );
  });

  it("gates shop-channel orders on shop mode", async () => {
    gateMocks.assertShopOrderingEnabled.mockRejectedValue(
      Object.assign(new Error("This restaurant is not accepting shop orders"), {
        code: "SHOP_MODE_DISABLED",
      }),
    );

    const response = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/", {
          restaurantId: "restaurant-1",
          items: [{ menuItemId: 7, quantity: 1, price: 120 }],
          orderType: "shop",
        }),
        createEnv() as never,
      ),
    );

    expect(gateMocks.assertShopOrderingEnabled).toHaveBeenCalledWith(
      expect.anything(),
      "restaurant-1",
      undefined,
    );
    expect(response.status).toBe(500);
    expect(serviceMocks.createOrder).not.toHaveBeenCalled();
  });

  it("forwards the scanned code so a regenerated QR can be retired", async () => {
    serviceMocks.createOrder.mockResolvedValue({ id: 1003 });

    await routes.fetch(
      jsonRequest("/", {
        restaurantId: "restaurant-1",
        items: [{ menuItemId: 7, quantity: 1, price: 120 }],
        orderType: "shop",
        shopQrCode: "SHOP-restaurant-1-1785563580",
      }),
      createEnv() as never,
    );

    expect(gateMocks.assertShopOrderingEnabled).toHaveBeenCalledWith(
      expect.anything(),
      "restaurant-1",
      "SHOP-restaurant-1-1785563580",
    );
  });

  it("leaves table orders ungated even though orderType defaults to shop", async () => {
    // The schema default means a client that omits orderType sends a table
    // order labelled "shop". Gating on that label alone would break dine-in.
    serviceMocks.createOrder.mockResolvedValue({ id: 1002 });

    const response = await routes.fetch(
      jsonRequest("/", {
        restaurantId: "restaurant-1",
        items: [{ menuItemId: 7, quantity: 1, price: 120 }],
        tableId: 3,
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(201);
    expect(gateMocks.assertShopOrderingEnabled).not.toHaveBeenCalled();
    expect(serviceMocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 3, orderType: "shop" }),
      42,
    );
  });

  it("rejects authenticated orders for another restaurant", async () => {
    const response = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/", {
          restaurantId: "restaurant-2",
          customerName: "Dana",
          items: [{ menuItemId: 7, quantity: 1, price: 120 }],
          orderType: "shop",
        }),
        createEnv() as never,
      ),
    );

    expect(response.status).toBe(500);
    expect(serviceMocks.createOrder).not.toHaveBeenCalled();
  });

  it("maps list filters and constrains non-admins to their restaurant", async () => {
    const env = createEnv();
    serviceMocks.getOrders.mockResolvedValue({
      orders: [
        {
          id: 1,
          createdAt: "2026-06-07T00:00:00.000Z",
          updatedAt: null,
        },
      ],
      pagination: { page: 2, limit: 5, total: 1 },
    });

    const response = await routes.fetch(
      new Request(
        "https://orders.test/?status=pending,confirmed&paymentStatus=paid,failed&paymentMethod=cash,card&page=2&limit=5&dateFrom=2026-06-01T00:00:00.000Z&scheduledTimeFrom=2026-06-02T00:00:00.000Z",
      ),
      env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [{ id: 1, createdAt: Date.parse("2026-06-07T00:00:00.000Z") }],
      pagination: { page: 2, limit: 5, total: 1 },
    });
    expect(serviceMocks.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        status: ["pending", "confirmed"],
        // payment_status is a TEXT column (pending/completed/failed/refunded);
        // "paid" is normalized to the canonical "completed".
        paymentStatus: ["completed", "failed"],
        paymentMethod: ["cash", "card"],
        dateFrom: new Date("2026-06-01T00:00:00.000Z"),
        scheduledTimeFrom: new Date("2026-06-02T00:00:00.000Z"),
      }),
      42,
      1,
      expect.objectContaining({
        userId: 42,
        userRestaurantId: "restaurant-1",
      }),
    );
  });

  it("maps customer and admin list scopes", async () => {
    serviceMocks.getOrders.mockResolvedValue({
      orders: [],
      pagination: { page: 1, limit: 20, total: 0 },
    });
    const env = createEnv();

    authState.user = { id: 42, role: 5, restaurantId: null };
    const customerResponse = await routes.fetch(
      new Request("https://orders.test/"),
      env as never,
    );
    expect(customerResponse.status).toBe(200);
    expect(serviceMocks.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "42" }),
      42,
      5,
      expect.any(Object),
    );

    authState.user = { id: 1, role: 0, restaurantId: null };
    const adminResponse = await routes.fetch(
      new Request("https://orders.test/?restaurantId=restaurant-2"),
      env as never,
    );
    expect(adminResponse.status).toBe(200);
    expect(serviceMocks.getOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ restaurantId: "restaurant-2" }),
      1,
      0,
      expect.any(Object),
    );
  });

  it("returns statistics for owner and admin restaurant scopes", async () => {
    serviceMocks.getOrderStatistics.mockResolvedValue({
      totalOrders: 9,
      totalRevenue: 1080,
    });
    const env = createEnv();

    const ownerResponse = await routes.fetch(
      new Request("https://orders.test/stats?timeRange=week"),
      env as never,
    );
    expect(ownerResponse.status).toBe(200);
    expect(serviceMocks.getOrderStatistics).toHaveBeenCalledWith(
      "restaurant-1",
    );

    authState.user = { id: 1, role: 0, restaurantId: null };
    const adminResponse = await routes.fetch(
      new Request("https://orders.test/stats?restaurantId=restaurant-2"),
      env as never,
    );
    expect(adminResponse.status).toBe(200);
    expect(serviceMocks.getOrderStatistics).toHaveBeenLastCalledWith(
      "restaurant-2",
    );
  });

  it("requires a restaurant scope for admin statistics and active orders", async () => {
    authState.user = { id: 1, role: 0, restaurantId: null };

    const statsResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://orders.test/stats"),
        createEnv() as never,
      ),
    );
    expect(statsResponse.status).toBe(500);

    const activeResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://orders.test/active"),
        createEnv() as never,
      ),
    );
    expect(activeResponse.status).toBe(500);
  });

  it("returns analytics and active orders", async () => {
    serviceMocks.getOrderAnalytics.mockResolvedValue({ revenue: 500 });
    serviceMocks.getActiveOrders.mockResolvedValue([
      { id: 1, createdAt: "2026-06-07T00:00:00.000Z" },
    ]);
    const env = createEnv();

    const analyticsResponse = await routes.fetch(
      new Request(
        "https://orders.test/analytics?dateFrom=2026-06-01T00:00:00.000Z",
      ),
      env as never,
    );
    expect(analyticsResponse.status).toBe(200);
    expect(serviceMocks.getOrderAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        dateFrom: new Date("2026-06-01T00:00:00.000Z"),
      }),
      42,
      expect.any(Object),
    );

    const activeResponse = await routes.fetch(
      new Request("https://orders.test/active"),
      env as never,
    );
    expect(activeResponse.status).toBe(200);
    await expect(activeResponse.json()).resolves.toMatchObject({
      data: [{ id: 1, createdAt: Date.parse("2026-06-07T00:00:00.000Z") }],
    });
    expect(serviceMocks.getActiveOrders).toHaveBeenCalledWith("restaurant-1");
  });

  it("returns order detail and enforces customer ownership", async () => {
    serviceMocks.getOrder
      .mockResolvedValueOnce({
        id: 55,
        customerId: "42",
        restaurantId: "restaurant-1",
        createdAt: "not-a-date",
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 56,
        customerId: "99",
        restaurantId: "restaurant-1",
      });

    authState.user = { id: 42, role: 5, restaurantId: null };
    const response = await routes.fetch(
      new Request("https://orders.test/55"),
      createEnv() as never,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: 55, createdAt: "not-a-date" },
    });

    const missingResponse = await withSilencedRouteError(() =>
      routes.fetch(new Request("https://orders.test/56"), createEnv() as never),
    );
    expect(missingResponse.status).toBe(500);

    const forbiddenResponse = await withSilencedRouteError(() =>
      routes.fetch(new Request("https://orders.test/57"), createEnv() as never),
    );
    expect(forbiddenResponse.status).toBe(500);
  });

  it("updates order status after permission checks", async () => {
    const env = createEnv();
    authState.user = {
      id: 42,
      role: 0,
      restaurantId: null,
    };
    serviceMocks.getOrder.mockResolvedValue({
      id: 55,
      restaurantId: "restaurant-1",
      orderSource: "direct",
    });
    serviceMocks.updateOrderStatus.mockResolvedValue({
      id: 55,
      status: "delivered",
      readyAt: new Date("2026-06-07T00:10:00.000Z"),
    });

    const response = await routes.fetch(
      jsonRequest(
        "/55/status",
        {
          status: "delivered",
          notes: "Ready",
          estimatedReadyTime: "2026-06-07T00:10:00.000Z",
        },
        "PUT",
      ),
      env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: 55,
        status: "delivered",
        readyAt: Date.parse("2026-06-07T00:10:00.000Z"),
      },
    });
    expect(serviceMocks.updateOrderStatus).toHaveBeenCalledWith(
      "55",
      expect.objectContaining({
        status: "delivered",
        notes: "Ready",
        updatedBy: 42,
        estimatedReadyTime: new Date("2026-06-07T00:10:00.000Z"),
      }),
      42,
      0,
      expect.any(Object),
      expect.objectContaining({ id: 55 }),
    );
  });

  it("reports status update permission and service failures", async () => {
    serviceMocks.getOrder
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 55, restaurantId: "restaurant-2" })
      .mockResolvedValueOnce({ id: 55, restaurantId: "restaurant-1" });

    const missingResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/55/status", { status: "delivered" }, "PUT"),
        createEnv() as never,
      ),
    );
    expect(missingResponse.status).toBe(500);

    const forbiddenResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/55/status", { status: "delivered" }, "PUT"),
        createEnv() as never,
      ),
    );
    expect(forbiddenResponse.status).toBe(500);

    serviceMocks.updateOrderStatus.mockResolvedValue(null);
    const failedResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/55/status", { status: "delivered" }, "PUT"),
        createEnv() as never,
      ),
    );
    expect(failedResponse.status).toBe(500);
  });

  it("cancels orders through the service", async () => {
    const env = createEnv();
    serviceMocks.getOrder.mockResolvedValue({
      id: 55,
      restaurantId: "restaurant-1",
    });
    serviceMocks.cancelOrder.mockResolvedValue({ id: 55, status: "cancelled" });

    const response = await routes.fetch(
      new Request("https://orders.test/55", { method: "DELETE" }),
      env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: "Order cancelled successfully",
    });
    expect(serviceMocks.cancelOrder).toHaveBeenCalledWith(
      "55",
      "Cancelled by user",
      42,
      expect.any(Object),
      expect.objectContaining({ id: 55 }),
    );
  });

  it("passes a caller-supplied cancellation reason to the service", async () => {
    const env = createEnv();
    serviceMocks.getOrder.mockResolvedValue({
      id: 55,
      restaurantId: "restaurant-1",
    });
    serviceMocks.cancelOrder.mockResolvedValue({ id: 55, status: "cancelled" });

    const response = await routes.fetch(
      new Request("https://orders.test/55", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Customer changed their mind" }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.cancelOrder).toHaveBeenCalledWith(
      "55",
      "Customer changed their mind",
      42,
      expect.any(Object),
      expect.objectContaining({ id: 55 }),
    );
  });

  it("caps an over-long cancellation reason at 500 characters", async () => {
    const env = createEnv();
    serviceMocks.getOrder.mockResolvedValue({
      id: 55,
      restaurantId: "restaurant-1",
    });
    serviceMocks.cancelOrder.mockResolvedValue({ id: 55, status: "cancelled" });

    const response = await routes.fetch(
      new Request("https://orders.test/55", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "x".repeat(900) }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    const reasonArg = serviceMocks.cancelOrder.mock.calls[0]?.[1] as string;
    expect(reasonArg).toHaveLength(500);
  });

  it("falls back to the default reason for an absent body", async () => {
    const env = createEnv();
    serviceMocks.getOrder.mockResolvedValue({
      id: 55,
      restaurantId: "restaurant-1",
    });
    serviceMocks.cancelOrder.mockResolvedValue({ id: 55, status: "cancelled" });

    const response = await routes.fetch(
      new Request("https://orders.test/55", { method: "DELETE" }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.cancelOrder).toHaveBeenCalledWith(
      "55",
      "Cancelled by user",
      42,
      expect.any(Object),
      expect.objectContaining({ id: 55 }),
    );
  });

  it("reports cancel order failures", async () => {
    serviceMocks.getOrder
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 55, restaurantId: "restaurant-2" })
      .mockResolvedValueOnce({ id: 55, restaurantId: "restaurant-1" });

    const missingResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://orders.test/55", { method: "DELETE" }),
        createEnv() as never,
      ),
    );
    expect(missingResponse.status).toBe(500);

    const forbiddenResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://orders.test/55", { method: "DELETE" }),
        createEnv() as never,
      ),
    );
    expect(forbiddenResponse.status).toBe(500);

    serviceMocks.cancelOrder.mockResolvedValue(null);
    const failedResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://orders.test/55", { method: "DELETE" }),
        createEnv() as never,
      ),
    );
    expect(failedResponse.status).toBe(500);
  });

  it("executes bulk order operations", async () => {
    serviceMocks.bulkUpdateOrders.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
    });

    const response = await routes.fetch(
      jsonRequest("/bulk", {
        action: "update_status",
        orderIds: [55, 56],
        data: { status: "confirmed" },
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { successCount: 2, failureCount: 0 },
    });
    expect(serviceMocks.bulkUpdateOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update_status",
        orderIds: ["55", "56"],
      }),
      42,
    );
  });

  it("exports orders with format-specific response headers", async () => {
    const env = createEnv();
    serviceMocks.exportOrders.mockResolvedValue("order_id,total\n1,120\n");

    const response = await routes.fetch(
      jsonRequest(
        "/export",
        {
          format: "csv",
          includeItems: "true",
          restaurantId: "restaurant-1",
          status: "paid",
        },
        "POST",
      ),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv");
    expect(response.headers.get("content-disposition")).toContain("orders-");
    await expect(response.text()).resolves.toBe("order_id,total\n1,120\n");
    expect(serviceMocks.exportOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        status: "paid",
      }),
      "csv",
    );
  });

  it("sets export content types for excel and pdf", async () => {
    serviceMocks.exportOrders
      .mockResolvedValueOnce("excel-data")
      .mockResolvedValueOnce("pdf-data");

    const excelResponse = await routes.fetch(
      jsonRequest("/export", { format: "excel" }, "POST"),
      createEnv() as never,
    );
    expect(excelResponse.status).toBe(200);
    expect(excelResponse.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const pdfResponse = await routes.fetch(
      jsonRequest("/export", { format: "pdf" }, "POST"),
      createEnv() as never,
    );
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers.get("content-type")).toBe("application/pdf");
  });

  it("generates receipts after customer ownership checks", async () => {
    const env = createEnv();
    authState.user = { id: 42, role: 5, restaurantId: null };
    serviceMocks.getOrder.mockResolvedValue({
      id: 55,
      customerId: "42",
      restaurantId: "restaurant-1",
    });
    serviceMocks.generateReceipt.mockResolvedValue({ html: "<p>receipt</p>" });

    const response = await routes.fetch(
      new Request("https://orders.test/55/receipt"),
      env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { html: "<p>receipt</p>" },
    });
    expect(serviceMocks.generateReceipt).toHaveBeenCalledWith("55");
    expect(gateMocks.meterEmit).toHaveBeenCalledWith(
      expect.anything(),
      "print.jobs",
      {
        restaurantId: "restaurant-1",
        metadata: { orderId: "55" },
      },
    );
  });

  it("reports receipt permission failures", async () => {
    serviceMocks.getOrder
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 55,
        customerId: "99",
        restaurantId: "restaurant-1",
      })
      .mockResolvedValueOnce({
        id: 55,
        customerId: "42",
        restaurantId: "restaurant-2",
      });

    const missingResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://orders.test/55/receipt"),
        createEnv() as never,
      ),
    );
    expect(missingResponse.status).toBe(500);

    authState.user = { id: 42, role: 5, restaurantId: null };
    const customerForbiddenResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://orders.test/55/receipt"),
        createEnv() as never,
      ),
    );
    expect(customerForbiddenResponse.status).toBe(500);

    authState.user = { id: 42, role: 1, restaurantId: "restaurant-1" };
    const staffForbiddenResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://orders.test/55/receipt"),
        createEnv() as never,
      ),
    );
    expect(staffForbiddenResponse.status).toBe(500);
  });
});
