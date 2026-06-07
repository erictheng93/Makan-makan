import { beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeEventType } from "@makanmakan/shared-types";
import { OrdersService } from "./OrdersService";

const createBaseOrder = vi.hoisted(() => vi.fn());
const getBaseOrder = vi.hoisted(() => vi.fn());
const getBaseOrders = vi.hoisted(() => vi.fn());
const updateBaseOrderStatus = vi.hoisted(() => vi.fn());
const cancelBaseOrder = vi.hoisted(() => vi.fn());
const updateBaseOrderItemStatus = vi.hoisted(() => vi.fn());
const getDailyOrderStats = vi.hoisted(() => vi.fn());
const validateBaseCoupon = vi.hoisted(() => vi.fn());
const broadcastNewOrder = vi.hoisted(() => vi.fn());
const broadcastOrderStatusUpdate = vi.hoisted(() => vi.fn());
const broadcastOrderCancelled = vi.hoisted(() => vi.fn());
const generateEventId = vi.hoisted(() => vi.fn());

vi.mock("@makanmakan/database", () => ({
  OrderService: function OrderService() {
    return {
      createOrder: createBaseOrder,
      getOrder: getBaseOrder,
      getOrders: getBaseOrders,
      updateOrderStatus: updateBaseOrderStatus,
      cancelOrder: cancelBaseOrder,
      updateOrderItemStatus: updateBaseOrderItemStatus,
      getDailyOrderStats,
    };
  },
  CouponService: function CouponService() {
    return {
      validateCoupon: validateBaseCoupon,
    };
  },
  RealtimeBroadcastService: function RealtimeBroadcastService() {
    return {
      broadcastNewOrder,
      broadcastOrderStatusUpdate,
      broadcastOrderCancelled,
      generateEventId,
    };
  },
}));

function createEnv(
  options: {
    cacheGet?: (key: string, type?: "json") => Promise<unknown>;
  } = {},
) {
  const subscriptionKey =
    "push:subscription:restaurant-1:user-1:subscription-1";
  const pushDeliverer = vi.fn(async () => ({ ok: true, status: 201 }));

  return {
    DB: {},
    WEB_PUSH_DELIVERER: pushDeliverer,
    CACHE_KV: {
      get: vi.fn(async (key: string, type?: "json") => {
        if (options.cacheGet) return options.cacheGet(key, type);
        if (key !== subscriptionKey) return null;
        return {
          id: "subscription-1",
          userId: 10,
          username: "kitchen",
          userRole: 2,
          userType: "kitchen",
          restaurantId: "restaurant-1",
          subscription: {
            endpoint: "https://push.example/subscription-1",
            keys: {
              p256dh: "p256dh-key",
              auth: "auth-key",
            },
          },
          deviceInfo: {},
          createdAt: "2026-06-01T10:00:00.000Z",
          updatedAt: "2026-06-01T10:00:00.000Z",
        };
      }),
      list: vi.fn(async ({ prefix }: { prefix?: string } = {}) => ({
        keys:
          prefix === "push:subscription:restaurant-1:"
            ? [{ name: subscriptionKey }]
            : [],
      })),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("OrdersService realtime broadcasts", () => {
  beforeEach(() => {
    createBaseOrder.mockReset();
    getBaseOrder.mockReset();
    getBaseOrders.mockReset();
    updateBaseOrderStatus.mockReset();
    cancelBaseOrder.mockReset();
    updateBaseOrderItemStatus.mockReset();
    getDailyOrderStats.mockReset();
    validateBaseCoupon.mockReset();
    broadcastNewOrder.mockReset();
    broadcastOrderStatusUpdate.mockReset();
    broadcastOrderCancelled.mockReset();
    generateEventId.mockReset();
    generateEventId.mockReturnValue("evt-market-order");
    broadcastNewOrder.mockResolvedValue({
      success: true,
      eventId: "evt-market-order",
      recipientCount: 2,
    });
    broadcastOrderStatusUpdate.mockResolvedValue({
      success: true,
      eventId: "evt-status",
      recipientCount: 1,
    });
    broadcastOrderCancelled.mockResolvedValue({
      success: true,
      eventId: "evt-cancelled",
      recipientCount: 1,
    });
  });

  it("broadcasts market checkout child orders to restaurant and kitchen realtime rooms", async () => {
    createBaseOrder.mockResolvedValue({
      id: 1001,
      restaurantId: "restaurant-1",
      tableId: undefined,
      orderNumber: "A001",
      orderType: "shop",
      status: "pending",
      orderSource: "market_checkout",
      totalAmount: 120,
      customerInfo: { name: "Market Guest" },
      notes: "市場結帳：逢甲夜市 / fengjia / checkout-1",
      items: [
        {
          id: 501,
          menuItemId: 101,
          quantity: 2,
          unitPrice: 60,
          notes: "不要辣",
          menuItem: { name: "雞排" },
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const env = createEnv();
    const service = new OrdersService(env as never);

    await service.createOrder({
      restaurantId: "restaurant-1",
      customerInfo: { name: "Market Guest" },
      items: [{ menuItemId: 101, quantity: 2, notes: "不要辣" }],
      notes: "市場結帳：逢甲夜市 / fengjia / checkout-1",
      orderSource: "market_checkout",
      orderType: "shop",
      deliveryInfo: { type: "takeaway" },
      isGuestOrder: true,
    });

    expect(createBaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        orderSource: "market_checkout",
        deliveryInfo: { type: "takeaway" },
      }),
    );
    expect(broadcastNewOrder).toHaveBeenCalledWith({
      type: RealtimeEventType.NEW_ORDER,
      eventId: "evt-market-order",
      timestamp: expect.any(Number),
      restaurantId: "restaurant-1",
      data: {
        orderId: 1001,
        orderNumber: "A001",
        tableId: undefined,
        items: [
          {
            orderItemId: 501,
            menuItemId: 101,
            menuItemName: "雞排",
            quantity: 2,
            price: 60,
            notes: "不要辣",
          },
        ],
        totalAmount: 120,
        orderSource: "market_checkout",
        notes: "市場結帳：逢甲夜市 / fengjia / checkout-1",
        customer: {
          name: "Market Guest",
          phone: undefined,
        },
      },
    });
    expect(env.WEB_PUSH_DELIVERER).toHaveBeenCalledWith({
      subscription: {
        id: "subscription-1",
        endpoint: "https://push.example/subscription-1",
        p256dhKey: "p256dh-key",
        authKey: "auth-key",
      },
      payload: expect.objectContaining({
        type: "new_order",
        orderId: 1001,
        orderNumber: "A001",
        orderSource: "market_checkout",
        title: "市場結帳新訂單",
        priority: "high",
        requireInteraction: true,
      }),
    });
  });
});

function createOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    restaurantId: "restaurant-1",
    tableId: 7,
    orderNumber: "ORD-42",
    orderType: "table",
    status: "confirmed",
    paymentStatus: "pending",
    paymentMethod: "cash",
    orderSource: "direct",
    subtotal: 200,
    taxAmount: 10,
    serviceCharge: 20,
    discountAmount: 15,
    totalAmount: 215,
    customerInfo: {
      name: "Ada",
      phone: "0912345678",
      email: "ada@example.test",
    },
    restaurant: {
      id: 1,
      name: "Makan Test",
      address: "1 Test St",
      phone: "02-1234-5678",
      email: "shop@example.test",
    },
    table: {
      id: 7,
      number: "A7",
      seats: 4,
    },
    items: [
      {
        id: 501,
        menuItemId: 101,
        quantity: 2,
        unitPrice: 100,
        totalPrice: 200,
        notes: "less ice",
        customizations: {
          size: { id: 1, name: "Large", price: 20 },
          options: [
            {
              optionId: 2,
              optionName: "Sugar",
              choiceId: 3,
              choiceName: "Half",
              price: 0,
            },
          ],
          addOns: [{ id: 4, name: "Pearls", price: 10, quantity: 2 }],
        },
        menuItem: { name: "Milk Tea" },
      },
    ],
    notes: "counter pickup",
    version: 3,
    createdAt: "2026-06-07T01:00:00.000Z",
    updatedAt: "2026-06-07T01:10:00.000Z",
    confirmedAt: "2026-06-07T01:02:00.000Z",
    readyAt: undefined,
    deliveredAt: undefined,
    paidAt: undefined,
    ...overrides,
  };
}

async function expectSilencedRejection(
  action: () => Promise<unknown>,
  match: Record<string, unknown>,
) {
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  try {
    await expect(action()).rejects.toMatchObject(match);
  } finally {
    consoleError.mockRestore();
  }
}

describe("OrdersService workflows", () => {
  beforeEach(() => {
    createBaseOrder.mockReset();
    getBaseOrder.mockReset();
    getBaseOrders.mockReset();
    updateBaseOrderStatus.mockReset();
    cancelBaseOrder.mockReset();
    updateBaseOrderItemStatus.mockReset();
    getDailyOrderStats.mockReset();
    validateBaseCoupon.mockReset();
    broadcastNewOrder.mockReset();
    broadcastOrderStatusUpdate.mockReset();
    broadcastOrderCancelled.mockReset();
    generateEventId.mockReset();
    generateEventId.mockReturnValue("evt-orders");
    broadcastOrderStatusUpdate.mockResolvedValue({
      success: true,
      eventId: "evt-status",
      recipientCount: 2,
    });
    broadcastOrderCancelled.mockResolvedValue({
      success: true,
      eventId: "evt-cancel",
      recipientCount: 2,
    });
  });

  it("validates direct create order inputs before delegating to the base service", async () => {
    const service = new OrdersService(createEnv() as never);
    const validOrder = {
      restaurantId: "restaurant-1",
      orderType: "table",
      items: [{ menuItemId: 101, quantity: 1 }],
    };

    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...validOrder, restaurantId: "" }, "INVALID_RESTAURANT_ID"],
      [{ ...validOrder, items: [] }, "EMPTY_ORDER_ITEMS"],
      [
        {
          ...validOrder,
          items: Array.from({ length: 101 }, () => ({
            menuItemId: 101,
            quantity: 1,
          })),
        },
        "TOO_MANY_ORDER_ITEMS",
      ],
      [
        { ...validOrder, items: [{ menuItemId: 0, quantity: 1 }] },
        "INVALID_MENU_ITEM_ID",
      ],
      [
        { ...validOrder, items: [{ menuItemId: 101, quantity: 0 }] },
        "INVALID_ITEM_QUANTITY",
      ],
      [
        { ...validOrder, items: [{ menuItemId: 101, quantity: 1000 }] },
        "ITEM_QUANTITY_EXCEEDED",
      ],
      [
        { ...validOrder, customerInfo: { phone: "abc" } },
        "INVALID_PHONE_FORMAT",
      ],
      [
        { ...validOrder, customerInfo: { email: "not-email" } },
        "INVALID_EMAIL_FORMAT",
      ],
      [{ ...validOrder, notes: "x".repeat(1001) }, "NOTES_TOO_LONG"],
      [{ ...validOrder, couponCode: "AB" }, "INVALID_COUPON_CODE_FORMAT"],
    ];

    for (const [input, code] of cases) {
      await expectSilencedRejection(() => service.createOrder(input as never), {
        code,
      });
    }
    expect(createBaseOrder).not.toHaveBeenCalled();
  });

  it("maps waiting-list base service failures to API errors", async () => {
    const service = new OrdersService(createEnv() as never);
    const input = {
      restaurantId: "restaurant-1",
      orderType: "table",
      waitingListId: 55,
      items: [{ menuItemId: 101, quantity: 1 }],
    };
    createBaseOrder
      .mockRejectedValueOnce(new Error("WAITING_LIST_PREORDER_EXISTS"))
      .mockRejectedValueOnce(new Error("WAITING_LIST_TICKET_NOT_FOUND"))
      .mockRejectedValueOnce(new Error("WAITING_LIST_TICKET_NOT_ACTIVE"))
      .mockRejectedValueOnce(new Error("WAITING_LIST_PHONE_MISMATCH"));

    await expect(service.createOrder(input as never)).rejects.toMatchObject({
      code: "WAITING_LIST_PREORDER_EXISTS",
    });
    await expect(service.createOrder(input as never)).rejects.toMatchObject({
      code: "WAITING_LIST_TICKET_NOT_FOUND",
    });
    await expect(service.createOrder(input as never)).rejects.toMatchObject({
      code: "WAITING_LIST_TICKET_NOT_ACTIVE",
    });
    await expect(service.createOrder(input as never)).rejects.toMatchObject({
      code: "WAITING_LIST_PHONE_MISMATCH",
    });
  });

  it("filters list queries by caller restaurant and strips leaked rows", async () => {
    const env = createEnv();
    getBaseOrders.mockResolvedValue({
      orders: [
        createOrder({ id: 1, restaurantId: "restaurant-1" }),
        createOrder({ id: 2, restaurantId: "restaurant-2" }),
        createOrder({ id: 3, restaurantId: undefined }),
      ],
      pagination: { page: 2, limit: 5, total: 3, totalPages: 1 },
    });
    const service = new OrdersService(env as never);

    const result = await service.getOrders(
      {
        restaurantId: "restaurant-2",
        status: ["confirmed"],
        page: 2,
        limit: 5,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      10,
      1,
      { userId: 10, userRole: 1, userRestaurantId: "restaurant-1" },
    );

    expect(getBaseOrders).toHaveBeenCalledWith(
      {
        restaurantId: "restaurant-1",
        customerId: undefined,
        status: ["confirmed"],
        tableId: undefined,
        dateRange: undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      2,
      5,
    );
    expect(result.orders.map((order) => order.id)).toEqual([1, 3]);
    expect(result.total).toBe(3);
  });

  it("enforces cached order restaurant access before returning data", async () => {
    const env = createEnv({
      cacheGet: async (key) =>
        key === "order:42:full"
          ? createOrder({ restaurantId: "restaurant-2" })
          : null,
    });
    const service = new OrdersService(env as never);

    await expect(
      service.getOrder(42, true, {
        userId: 10,
        userRole: 2,
        userRestaurantId: "restaurant-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getBaseOrder).not.toHaveBeenCalled();
  });

  it("updates order status with version guard, cache invalidation, and realtime event", async () => {
    const env = createEnv();
    const previous = createOrder({ status: "confirmed", version: 7 });
    const updated = createOrder({ status: "preparing", version: 8 });
    updateBaseOrderStatus.mockResolvedValue(updated);
    const service = new OrdersService(env as never);

    const result = await service.updateOrderStatus(
      42,
      {
        status: "preparing",
        notes: "started",
        estimatedReadyTime: new Date("2026-06-07T01:25:00.000Z"),
      },
      20,
      2,
      { userId: 20, userRole: 2, userRestaurantId: "restaurant-1" },
      previous as never,
    );

    expect(result).toBe(updated);
    expect(updateBaseOrderStatus).toHaveBeenCalledWith(42, {
      status: "preparing",
      notes: "started",
      expectedVersion: 7,
    });
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("order:42:full");
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("order:42:basic");
    expect(broadcastOrderStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: RealtimeEventType.ORDER_STATUS_UPDATE,
        restaurantId: "restaurant-1",
        data: expect.objectContaining({
          orderId: 42,
          previousStatus: "confirmed",
          status: "preparing",
          message: "started",
          updatedBy: { userId: 20, userName: "System", role: "admin" },
        }),
      }),
    );
  });

  it("rejects invalid status transitions and unauthorized role changes", async () => {
    const service = new OrdersService(createEnv() as never);

    await expect(
      service.updateOrderStatus(
        42,
        { status: "paid" },
        20,
        4,
        undefined,
        createOrder({ status: "confirmed" }) as never,
      ),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });

    await expect(
      service.updateOrderStatus(
        42,
        { status: "ready" },
        30,
        1,
        undefined,
        createOrder({ status: "preparing" }) as never,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateBaseOrderStatus).not.toHaveBeenCalled();
  });

  it("handles update, delete, and item-status service branches", async () => {
    const env = createEnv();
    const service = new OrdersService(env as never);

    getBaseOrder.mockResolvedValueOnce(null);
    await expect(
      service.updateOrder(404, { status: "ready" } as never, 10),
    ).resolves.toBeNull();

    getBaseOrder.mockResolvedValueOnce(createOrder({ status: "confirmed" }));
    await expectSilencedRejection(() => service.deleteOrder(42, 10), {
      code: "ORDER_NOT_DELETABLE",
    });

    getBaseOrder.mockResolvedValueOnce(createOrder({ status: "pending" }));
    cancelBaseOrder.mockResolvedValueOnce(createOrder({ status: "cancelled" }));
    await expect(service.deleteOrder(42, 10)).resolves.toBe(true);
    expect(cancelBaseOrder).toHaveBeenCalledWith(42, "Order deleted");
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("order:42:full");
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("order:42:basic");

    updateBaseOrderItemStatus.mockRejectedValueOnce(
      new Error("Order item status conflict: stale version"),
    );
    await expect(service.updateItemStatus(501, "ready")).rejects.toMatchObject({
      code: "ORDER_ITEM_STATUS_CONFLICT",
    });
  });

  it("covers status history, payment status, and search fallback paths", async () => {
    const env = createEnv();
    const service = new OrdersService(env as never);

    getBaseOrder.mockResolvedValueOnce(
      createOrder({
        status: "ready",
        notes: "ready for pickup",
        updatedAt: "2026-06-07T01:25:00.000Z",
      }),
    );
    await expect(service.getOrderStatusHistory(42)).resolves.toEqual([
      {
        status: "ready",
        timestamp: new Date("2026-06-07T01:25:00.000Z"),
        notes: "ready for pickup",
      },
    ]);

    getBaseOrder.mockResolvedValueOnce(null);
    await expect(service.getOrderStatusHistory(404)).resolves.toEqual([]);

    getBaseOrder.mockRejectedValueOnce(new Error("history backend down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await expect(service.getOrderStatusHistory(500)).resolves.toEqual([]);
    } finally {
      consoleError.mockRestore();
    }

    getBaseOrder.mockResolvedValueOnce(createOrder());
    await expect(
      service.updatePaymentStatus(42, "paid" as never, "cash" as never),
    ).resolves.toMatchObject({ id: 42 });
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith("order:42:full");

    getBaseOrders.mockRejectedValueOnce(new Error("search backend down"));
    const searchConsoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await expect(
        service.searchOrders(
          { query: "ORD-42" },
          { restaurantId: "restaurant-1" },
        ),
      ).resolves.toEqual([]);
    } finally {
      searchConsoleError.mockRestore();
    }
  });

  it("summarizes bulk cancellations and unsupported bulk actions", async () => {
    const service = new OrdersService(createEnv() as never);
    cancelBaseOrder
      .mockResolvedValueOnce(createOrder({ id: 10, status: "cancelled" }))
      .mockResolvedValueOnce(null);

    const cancelResult = await service.bulkUpdateOrders(
      {
        batchId: "batch-cancel",
        action: "cancel",
        orderIds: [10, 11],
        data: { reason: "closing early" },
      },
      99,
    );

    expect(cancelResult).toMatchObject({
      batchId: "batch-cancel",
      totalOrders: 2,
      successCount: 1,
      failedCount: 0,
    });
    expect(cancelResult.results).toEqual([
      { orderId: 10, success: true, data: expect.any(Object) },
      { orderId: 11, success: false, data: null },
    ]);

    const unsupported = await service.bulkUpdateOrders({
      batchId: "batch-export",
      action: "export",
      orderIds: [12],
    });

    expect(unsupported.failedCount).toBe(1);
    expect(unsupported.errors[0]).toMatchObject({
      orderId: 12,
      error: "Unsupported bulk operation: export",
    });
  });

  it("builds analytics and popular item cache entries from base stats", async () => {
    const env = createEnv();
    getDailyOrderStats.mockResolvedValue({
      totalOrders: 12,
      totalRevenue: 2400,
      avgOrderValue: 200,
      pendingOrders: 1,
      completedOrders: 9,
    });
    const service = new OrdersService(env as never);

    const analytics = await service.getOrderAnalytics({
      restaurantId: "restaurant-1",
    });
    const stats = await service.getDailyStats(
      "restaurant-1",
      new Date("2026-06-07T00:00:00.000Z"),
    );
    const popularItems = await service.getPopularItems("restaurant-1", "week");

    expect(analytics.summary).toMatchObject({
      totalOrders: 12,
      totalRevenue: 2400,
      averageOrderValue: 200,
    });
    expect(stats).toMatchObject({
      totalOrders: 12,
      averageOrderValue: 200,
      preparingOrders: 0,
      readyOrders: 0,
    });
    expect(popularItems).toEqual([]);
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      'analytics:{"restaurantId":"restaurant-1"}',
      expect.any(String),
      { expirationTtl: 900 },
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "popular-items:restaurant-1:week",
      "[]",
      { expirationTtl: 1800 },
    );
  });

  it("uses cached analytics and rejects analytics without a restaurant", async () => {
    const cachedAnalytics = {
      summary: {
        totalOrders: 3,
        totalRevenue: 900,
        averageOrderValue: 300,
        averagePreparationTime: 0,
        orderCompletionRate: 1,
        customerRetentionRate: 0,
      },
      byStatus: [],
      byPaymentStatus: [],
      byOrderType: [],
      byTime: { hourly: [], daily: [], weekly: [], monthly: [] },
      topItems: [],
      customerAnalytics: {
        newCustomers: 0,
        returningCustomers: 0,
        averageOrdersPerCustomer: 0,
        customerLifetimeValue: 0,
      },
      performanceMetrics: {
        averageOrderProcessingTime: 0,
        peakHours: [],
        busyDays: [],
        orderAccuracy: 1,
        cancellationRate: 0,
      },
    };
    const env = createEnv({
      cacheGet: async (key) =>
        key === 'analytics:{"restaurantId":"restaurant-1"}'
          ? cachedAnalytics
          : null,
    });
    const service = new OrdersService(env as never);

    await expect(
      service.getOrderAnalytics({ restaurantId: "restaurant-1" }),
    ).resolves.toBe(cachedAnalytics);
    expect(getDailyOrderStats).not.toHaveBeenCalled();

    await expectSilencedRejection(() => service.getOrderAnalytics({}), {
      code: "RESTAURANT_ID_REQUIRED",
    });
  });

  it("maps coupon validation success and converts failures to invalid previews", async () => {
    const service = new OrdersService(createEnv() as never);
    validateBaseCoupon
      .mockResolvedValueOnce({
        valid: true,
        coupon: {
          code: "SAVE20",
          name: "Twenty off",
          discountType: "percentage",
          discountValue: 20,
        },
        discountAmount: 40,
        finalAmount: 160,
      })
      .mockRejectedValueOnce(new Error("coupon backend unavailable"));

    await expect(
      service.validateCoupon({
        restaurantId: "restaurant-1",
        couponCode: "SAVE20",
        orderAmount: 200,
        userId: 5,
        menuItems: [{ menuItemId: 101, quantity: 2 }],
      }),
    ).resolves.toEqual({
      valid: true,
      coupon: {
        code: "SAVE20",
        name: "Twenty off",
        discountType: "percentage",
        discountValue: 20,
      },
      originalAmount: 200,
      discountAmount: 40,
      finalAmount: 160,
      savings: 40,
      error: undefined,
    });

    await expect(
      service.previewCoupon({
        restaurantId: "restaurant-1",
        couponCode: "DOWN",
        orderAmount: 200,
      }),
    ).resolves.toMatchObject({
      valid: false,
      originalAmount: 200,
      discountAmount: 0,
      finalAmount: 200,
      error: "coupon backend unavailable",
    });
  });

  it("generates receipts with restaurant, table, payment, and customization details", async () => {
    const env = createEnv();
    getBaseOrder.mockResolvedValue(
      createOrder({
        restaurantId: "1",
        status: "delivered",
        paymentStatus: "paid",
        paidAt: "2026-06-07T01:30:00.000Z",
        deliveredAt: "2026-06-07T01:28:00.000Z",
      }),
    );
    const service = new OrdersService(env as never);

    const receipt = await service.generateReceipt(42);

    expect(receipt).toMatchObject({
      orderNumber: "ORD-42",
      restaurantInfo: {
        id: 1,
        name: "Makan Test",
      },
      customerInfo: {
        name: "Ada",
      },
      tableInfo: {
        id: 7,
        number: "A7",
        seats: 4,
      },
      items: [
        {
          name: "Milk Tea",
          quantity: 2,
          unitPrice: 100,
          totalPrice: 200,
          customizations: ["Size: Large", "Sugar: Half", "Pearls x2"],
          notes: "less ice",
        },
      ],
      summary: {
        subtotal: 200,
        tax: 10,
        serviceCharge: 20,
        discount: 15,
        total: 215,
      },
      paymentInfo: {
        method: "cash",
        status: "paid",
      },
    });
    expect(receipt.timestamps.orderedAt).toEqual(
      new Date("2026-06-07T01:00:00.000Z"),
    );
    expect(receipt.timestamps.deliveredAt).toEqual(
      new Date("2026-06-07T01:28:00.000Z"),
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "order:42:full",
      expect.any(String),
      { expirationTtl: 300 },
    );
  });
});
