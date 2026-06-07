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

vi.mock("../../../middleware/guestAuth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../middleware/guestAuth")>();
  return {
    ...actual,
    guestSessionAuth: vi.fn(async (c, next) => {
      c.set("guestSession", {
        restaurantId: "restaurant-1",
        phoneLastDigits: "6789",
      });
      await next();
    }),
    guestTokenAuth: vi.fn(async (_c, next) => next()),
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

describe("orders routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(serviceMocks)) {
      mock.mockReset();
    }
    gateMocks.enforceQuota.mockReset();
    gateMocks.meterEmit.mockReset();
    authState.user = {
      id: 42,
      role: 1,
      restaurantId: "restaurant-1",
    };
    authState.customer = { id: "customer-42" };
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
        paymentStatus: [1, 2],
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
      55,
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

  it("cancels orders and clears guest active lookup keys", async () => {
    const env = createEnv();
    await env.CACHE_KV.put("guest_active_lookup:55", "guest_active:r:p");
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
      55,
      "Cancelled by user",
      42,
      expect.any(Object),
      expect.objectContaining({ id: 55 }),
    );
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("guest_active:r:p");
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("guest_active_lookup:55");
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
    expect(serviceMocks.generateReceipt).toHaveBeenCalledWith(55);
    expect(gateMocks.meterEmit).toHaveBeenCalledWith(
      expect.anything(),
      "print.jobs",
      {
        restaurantId: "restaurant-1",
        metadata: { orderId: 55 },
      },
    );
  });
});
