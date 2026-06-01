import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";

const databaseMocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  selectQueue: [] as Array<{ get?: unknown; all?: unknown[] }>,
}));
const createOrder = vi.hoisted(() => vi.fn());
const getOrder = vi.hoisted(() => vi.fn());
const processPayment = vi.hoisted(() => vi.fn());
const enforceQuota = vi.hoisted(() => vi.fn());
const meterEmit = vi.hoisted(() => vi.fn());
const tokenCounter = vi.hoisted(() => ({ value: 0 }));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (_c, next) => next()),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

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
  generateGuestToken: () => {
    tokenCounter.value += 1;
    return `guest-token-${tokenCounter.value}`;
  },
}));

vi.mock("../../orders/services/OrdersService", () => ({
  OrdersService: function OrdersService() {
    return { createOrder, getOrder };
  },
}));

vi.mock("../../payments/services/PaymentService", () => ({
  PaymentService: function PaymentService() {
    return { processPayment };
  },
}));

function createMockDb() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => databaseMocks.selectQueue.shift()?.get),
          all: vi.fn(async () => databaseMocks.selectQueue.shift()?.all ?? []),
        })),
      })),
    })),
  };
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
    },
  };
}

describe("market checkout routes", () => {
  beforeEach(() => {
    databaseMocks.selectQueue.length = 0;
    databaseMocks.createDatabase.mockReturnValue(createMockDb());
    createOrder.mockReset();
    getOrder.mockReset();
    processPayment.mockReset();
    enforceQuota.mockReset();
    meterEmit.mockReset();
    tokenCounter.value = 0;
  });

  it("creates one child guest order per active market vendor", async () => {
    databaseMocks.selectQueue.push(
      {
        get: {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          isActive: true,
        },
      },
      {
        get: {
          id: "restaurant-1",
          name: "雞排攤",
          isActive: true,
          isAvailable: true,
          settings: { allowGuestOrders: true },
        },
      },
      { get: { restaurantId: "restaurant-1", marketId: "market-1" } },
      {
        get: {
          id: "restaurant-2",
          name: "甜點攤",
          isActive: true,
          isAvailable: true,
          settings: { allowGuestOrders: true },
        },
      },
      { get: { restaurantId: "restaurant-2", marketId: "market-1" } },
      { all: [{ id: 101 }] },
      { all: [{ id: 202 }] },
    );
    createOrder
      .mockResolvedValueOnce({
        id: 1001,
        orderNumber: "A001",
        totalAmount: 120,
      })
      .mockResolvedValueOnce({
        id: 1002,
        orderNumber: "A002",
        totalAmount: 80,
      });
    const env = createEnv();

    const response = await routes.fetch(
      new Request("https://test/", {
        method: "POST",
        body: JSON.stringify({
          marketSlug: "fengjia",
          guestName: "Guest",
          phoneLastDigits: "789",
          vendors: [
            {
              restaurantId: "restaurant-1",
              items: [{ menuItemId: 101, quantity: 2 }],
            },
            {
              restaurantId: "restaurant-2",
              items: [{ menuItemId: 202, quantity: 1 }],
            },
          ],
        }),
      }),
      env as never,
    );

    expect(response.status).toBe(201);
    const json = (await response.json()) as {
      data: {
        checkout: {
          market: { slug: string; name: string };
          status: string;
          subtotal: number;
          childOrders: unknown[];
        };
      };
    };
    expect(json.data.checkout).toMatchObject({
      market: { slug: "fengjia", name: "逢甲夜市" },
      status: "submitted",
      subtotal: 20000,
    });
    expect(json.data.checkout.childOrders).toHaveLength(2);
    expect(createOrder).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        restaurantId: "restaurant-1",
        orderType: "shop",
        deliveryInfo: { type: "takeaway" },
      }),
    );
    expect(createOrder).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        restaurantId: "restaurant-2",
        orderType: "shop",
        deliveryInfo: { type: "takeaway" },
      }),
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      expect.stringMatching(/^market_checkout:/),
      expect.stringContaining('"restaurantId":"restaurant-1"'),
      { expirationTtl: 14400 },
    );
    expect(enforceQuota).toHaveBeenCalledTimes(2);
    expect(meterEmit).toHaveBeenCalledTimes(2);
  });

  it("hydrates child order status when reading a market checkout", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
        status: "submitted",
        childOrders: [
          {
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
          {
            restaurantId: "restaurant-2",
            restaurantName: "甜點攤",
            orderId: 1002,
            orderNumber: "A002",
            totalAmount: 80,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
        ],
        subtotal: 20000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );
    getOrder
      .mockResolvedValueOnce({
        id: 1001,
        orderNumber: "A001",
        totalAmount: 120,
        status: "preparing",
        paymentStatus: "pending",
        updatedAt: 1780308300000,
      })
      .mockResolvedValueOnce({
        id: 1002,
        orderNumber: "A002",
        totalAmount: 80,
        status: "ready",
        paymentStatus: "completed",
        updatedAt: 1780308400000,
      });

    const response = await routes.fetch(
      new Request("https://test/checkout-1"),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        checkout: {
          childOrders: Array<{
            status?: string;
            paymentStatus?: string;
            updatedAt?: number;
          }>;
        };
      };
    };
    expect(getOrder).toHaveBeenNthCalledWith(1, 1001, false);
    expect(getOrder).toHaveBeenNthCalledWith(2, 1002, false);
    expect(json.data.checkout.childOrders[0]).toMatchObject({
      status: "preparing",
      paymentStatus: "pending",
      updatedAt: 1780308300000,
    });
    expect(json.data.checkout.childOrders[1]).toMatchObject({
      status: "ready",
      paymentStatus: "completed",
      updatedAt: 1780308400000,
    });
  });

  it("keeps stored child order summaries when hydration misses", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
        status: "submitted",
        childOrders: [
          {
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
        ],
        subtotal: 12000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );
    getOrder.mockResolvedValueOnce(null);

    const response = await routes.fetch(
      new Request("https://test/checkout-1"),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        checkout: {
          childOrders: Array<{ orderNumber: string; status?: string }>;
        };
      };
    };
    expect(json.data.checkout.childOrders[0]).toMatchObject({
      orderNumber: "A001",
    });
    expect(json.data.checkout.childOrders[0].status).toBeUndefined();
  });

  it("processes one aggregate market checkout payment across child orders", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
        status: "submitted",
        childOrders: [
          {
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
          {
            restaurantId: "restaurant-2",
            restaurantName: "甜點攤",
            orderId: 1002,
            orderNumber: "A002",
            totalAmount: 80,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
        ],
        subtotal: 20000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );
    processPayment
      .mockResolvedValueOnce({
        data: {
          paymentId: "pay-1001",
          orderId: 1001,
          orderStatus: "preparing",
          paymentStatus: "paid",
          authorizedTotal: 120,
        },
      })
      .mockResolvedValueOnce({
        data: {
          paymentId: "pay-1002",
          orderId: 1002,
          orderStatus: "ready",
          paymentStatus: "paid",
          authorizedTotal: 80,
        },
      });

    const response = await routes.fetch(
      new Request("https://test/checkout-1/pay", {
        method: "POST",
        headers: {
          "Idempotency-Key": "market-pay-1",
        },
        body: JSON.stringify({
          method: "line_pay",
          country: "TW",
          currency: "TWD",
          customerInfo: { name: "Guest" },
        }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(processPayment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderId: 1001,
        amount: 120,
        expectedTotal: 120,
        closeOrder: false,
        method: "line_pay",
      }),
      expect.objectContaining({
        country: "TW",
        currency: "TWD",
        idempotencyKey: "market-pay-1:1001",
        metadata: expect.objectContaining({
          source: "market-checkouts",
          marketCheckoutId: "checkout-1",
          restaurantId: "restaurant-1",
        }),
      }),
    );
    expect(processPayment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderId: 1002,
        amount: 80,
        expectedTotal: 80,
        closeOrder: false,
        method: "line_pay",
      }),
      expect.objectContaining({
        idempotencyKey: "market-pay-1:1002",
        metadata: expect.objectContaining({
          restaurantId: "restaurant-2",
        }),
      }),
    );
    const json = (await response.json()) as {
      data: {
        payment: {
          status: string;
          method: string;
          totalAmount: number;
          childPayments: Array<{ paymentId: string }>;
        };
      };
    };
    expect(json.data.payment).toMatchObject({
      status: "paid",
      method: "line_pay",
      totalAmount: 200,
      childPayments: [{ paymentId: "pay-1001" }, { paymentId: "pay-1002" }],
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:checkout-1",
      expect.stringContaining('"payment"'),
      { expirationTtl: 14400 },
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:index",
      expect.stringContaining('"paymentStatus":"paid"'),
      { expirationTtl: 14400 },
    );
  });

  it("replays an already paid market checkout without charging twice", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
        status: "submitted",
        childOrders: [],
        payment: {
          status: "paid",
          method: "line_pay",
          currency: "TWD",
          country: "TW",
          totalAmount: 200,
          totalAmountCents: 20000,
          paidAmount: 200,
          paidAmountCents: 20000,
          paidAt: "2026-06-01T10:10:00.000Z",
          childPayments: [],
        },
        subtotal: 20000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );

    const response = await routes.fetch(
      new Request("https://test/checkout-1/pay", {
        method: "POST",
        body: JSON.stringify({ method: "line_pay" }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(processPayment).not.toHaveBeenCalled();
    const json = (await response.json()) as {
      data: { payment: { status: string; method: string } };
    };
    expect(json.data.payment).toMatchObject({
      status: "paid",
      method: "line_pay",
    });
  });

  it("records partial payment failures and retries only unpaid vendors", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
        status: "submitted",
        childOrders: [
          {
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
          {
            restaurantId: "restaurant-2",
            restaurantName: "甜點攤",
            orderId: 1002,
            orderNumber: "A002",
            totalAmount: 80,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
        ],
        subtotal: 20000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );
    processPayment
      .mockResolvedValueOnce({
        data: {
          paymentId: "pay-1001",
          orderId: 1001,
          orderStatus: "preparing",
          paymentStatus: "paid",
          authorizedTotal: 120,
        },
      })
      .mockRejectedValueOnce(new Error("Gateway declined"));

    const response = await routes.fetch(
      new Request("https://test/checkout-1/pay", {
        method: "POST",
        body: JSON.stringify({ method: "line_pay" }),
      }),
      env as never,
    );

    expect(response.status).toBe(202);
    const json = (await response.json()) as {
      data: {
        payment: {
          status: string;
          paidAmount: number;
          childPayments: Array<{
            orderId: number;
            status: string;
            errorMessage?: string;
          }>;
        };
      };
    };
    expect(json.data.payment).toMatchObject({
      status: "partial_paid",
      paidAmount: 120,
    });
    expect(json.data.payment.childPayments).toEqual([
      expect.objectContaining({ orderId: 1001, status: "paid" }),
      expect.objectContaining({
        orderId: 1002,
        status: "failed",
        errorMessage: "Gateway declined",
      }),
    ]);

    processPayment.mockClear();
    processPayment.mockResolvedValueOnce({
      data: {
        paymentId: "pay-1002",
        orderId: 1002,
        orderStatus: "ready",
        paymentStatus: "paid",
        authorizedTotal: 80,
      },
    });

    const retryResponse = await routes.fetch(
      new Request("https://test/checkout-1/pay", {
        method: "POST",
        body: JSON.stringify({ method: "line_pay" }),
      }),
      env as never,
    );

    expect(retryResponse.status).toBe(200);
    expect(processPayment).toHaveBeenCalledTimes(1);
    expect(processPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 1002 }),
      expect.any(Object),
    );
    const retryJson = (await retryResponse.json()) as {
      data: { payment: { status: string; paidAmount: number } };
    };
    expect(retryJson.data.payment).toMatchObject({
      status: "paid",
      paidAmount: 200,
    });
  });

  it("lists market checkout sessions for platform admins", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
        status: "submitted",
        childOrders: [
          {
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
        ],
        payment: {
          status: "partial_paid",
          method: "line_pay",
          currency: "TWD",
          country: "TW",
          totalAmount: 120,
          totalAmountCents: 12000,
          paidAmount: 80,
          paidAmountCents: 8000,
          childPayments: [],
        },
        subtotal: 12000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );
    await env.CACHE_KV.put(
      "market_checkout:index",
      JSON.stringify([
        {
          id: "checkout-1",
          market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
          status: "submitted",
          paymentStatus: "partial_paid",
          subtotal: 12000,
          childOrderCount: 1,
          createdAt: "2026-06-01T10:00:00.000Z",
          updatedAt: "2026-06-01T10:05:00.000Z",
        },
      ]),
    );

    const response = await routes.fetch(
      new Request("https://test/admin?paymentStatus=partial_paid"),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        checkouts: Array<{
          id: string;
          market: { slug: string };
          paymentStatus: string;
          childOrderCount: number;
        }>;
        total: number;
      };
    };
    expect(json.data.total).toBe(1);
    expect(json.data.checkouts[0]).toMatchObject({
      id: "checkout-1",
      market: { slug: "fengjia" },
      paymentStatus: "partial_paid",
      childOrderCount: 1,
    });
  });
});
