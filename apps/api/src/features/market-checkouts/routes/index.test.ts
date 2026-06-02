import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";

const databaseMocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  selectQueue: [] as Array<{ get?: unknown; all?: unknown[] }>,
  insertValues: [] as unknown[],
  updateValues: [] as unknown[],
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
  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn(() => chain),
      get: vi.fn(async () => databaseMocks.selectQueue.shift()?.get),
      all: vi.fn(async () => databaseMocks.selectQueue.shift()?.all ?? []),
    };
    return chain;
  };

  return {
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: unknown) => {
        databaseMocks.insertValues.push(values);
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => ({
        where: vi.fn(async () => {
          databaseMocks.updateValues.push(values);
        }),
      })),
    })),
  };
}

function createEnv(dbFirstRows: unknown[] = []) {
  const kv = new Map<string, string>();
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => dbFirstRows.shift() ?? null),
          run: vi.fn(async () => ({ meta: { changes: 1 } })),
        })),
      })),
    },
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

describe("market checkout routes", () => {
  beforeEach(() => {
    databaseMocks.selectQueue.length = 0;
    databaseMocks.insertValues.length = 0;
    databaseMocks.updateValues.length = 0;
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
          platformFeeRateBps: 350,
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
          notes: "全單備註",
          vendors: [
            {
              restaurantId: "restaurant-1",
              items: [{ menuItemId: 101, quantity: 2 }],
              notes: "雞排攤備註",
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
          id: string;
          market: { slug: string; name: string };
          status: string;
          subtotal: number;
          childOrders: unknown[];
        };
      };
    };
    expect(json.data.checkout).toMatchObject({
      market: {
        slug: "fengjia",
        name: "逢甲夜市",
        platformFeeRateBps: 350,
      },
      status: "submitted",
      subtotal: 20000,
    });
    expect(json.data.checkout.childOrders).toHaveLength(2);
    expect(createOrder).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        restaurantId: "restaurant-1",
        orderSource: "market_checkout",
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
    const firstOrderInput = createOrder.mock.calls[0]?.[0] as
      | { notes?: string }
      | undefined;
    expect(firstOrderInput?.notes).toContain("市場結帳");
    expect(firstOrderInput?.notes).toContain("逢甲夜市");
    expect(firstOrderInput?.notes).toContain(json.data.checkout.id);
    expect(firstOrderInput?.notes).toContain("全單備註");
    expect(firstOrderInput?.notes).toContain("雞排攤備註");
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      expect.stringMatching(/^market_checkout:/),
      expect.stringContaining('"restaurantId":"restaurant-1"'),
      { expirationTtl: 14400 },
    );
    expect(databaseMocks.insertValues[0]).toMatchObject({
      id: json.data.checkout.id,
      marketId: "market-1",
      marketSlug: "fengjia",
      marketName: "逢甲夜市",
      platformFeeRateBps: 350,
      status: "submitted",
      paymentStatus: "pending",
      phoneLastDigits: "789",
      subtotalCents: 20000,
      childOrderCount: 2,
    });
    expect(databaseMocks.insertValues[1]).toEqual([
      expect.objectContaining({
        checkoutId: json.data.checkout.id,
        restaurantId: "restaurant-1",
        restaurantName: "雞排攤",
        orderId: 1001,
        orderNumber: "A001",
        totalAmountCents: 12000,
      }),
      expect.objectContaining({
        checkoutId: json.data.checkout.id,
        restaurantId: "restaurant-2",
        restaurantName: "甜點攤",
        orderId: 1002,
        orderNumber: "A002",
        totalAmountCents: 8000,
      }),
    ]);
    expect(enforceQuota).toHaveBeenCalledTimes(2);
    expect(meterEmit).toHaveBeenCalledTimes(2);
  });

  it("hydrates child order status when reading a market checkout", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          platformFeeRateBps: 350,
        },
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

  it("reissues a child guest token for a persisted market checkout", async () => {
    databaseMocks.selectQueue.push(
      {
        get: {
          id: "checkout-1",
          marketId: "market-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          status: "submitted",
          paymentStatus: "pending",
          phoneLastDigits: "789",
          subtotalCents: 12000,
          childOrderCount: 1,
          paymentSummary: null,
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
          updatedAt: new Date("2026-06-01T10:00:00.000Z"),
        },
      },
      {
        all: [
          {
            checkoutId: "checkout-1",
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
            totalAmountCents: 12000,
            tokenExpiresAt: new Date("2026-06-01T12:00:00.000Z"),
          },
        ],
      },
    );
    const env = createEnv();

    const response = await routes.fetch(
      new Request("https://test/checkout-1/guest-token", {
        method: "POST",
        body: JSON.stringify({
          orderId: 1001,
          phoneLastDigits: "789",
        }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: { orderId: number; guestToken: string; tokenExpiresAt: string };
    };
    expect(json.data).toMatchObject({
      orderId: 1001,
      guestToken: "guest-token-1",
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "guest_token:guest-token-1",
      expect.stringContaining('"orderId":"1001"'),
      { expirationTtl: 14400 },
    );
  });

  it("rejects guest token recovery when phone digits do not match", async () => {
    databaseMocks.selectQueue.push(
      {
        get: {
          id: "checkout-1",
          marketId: "market-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          status: "submitted",
          paymentStatus: "pending",
          phoneLastDigits: "789",
          subtotalCents: 12000,
          childOrderCount: 1,
          paymentSummary: null,
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
          updatedAt: new Date("2026-06-01T10:00:00.000Z"),
        },
      },
      { all: [] },
    );
    const env = createEnv();

    const response = await routes.fetch(
      new Request("https://test/checkout-1/guest-token", {
        method: "POST",
        body: JSON.stringify({
          orderId: 1001,
          phoneLastDigits: "123",
        }),
      }),
      env as never,
    );

    expect(response.status).toBe(403);
    expect(env.CACHE_KV.put).not.toHaveBeenCalledWith(
      "guest_token:guest-token-1",
      expect.any(String),
      expect.any(Object),
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout_recover_attempts:checkout-1",
      "1",
      { expirationTtl: 3600 },
    );
  });

  it("locks guest token recovery after repeated phone verification failures", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          platformFeeRateBps: 350,
        },
        status: "submitted",
        phoneLastDigits: "789",
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
    await env.CACHE_KV.put("market_checkout_recover_attempts:checkout-1", "5");

    const response = await routes.fetch(
      new Request("https://test/checkout-1/guest-token", {
        method: "POST",
        body: JSON.stringify({
          orderId: 1001,
          phoneLastDigits: "789",
        }),
      }),
      env as never,
    );

    expect(response.status).toBe(429);
    expect(env.CACHE_KV.put).not.toHaveBeenCalledWith(
      "guest_token:guest-token-1",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("clears guest token recovery failures after successful verification", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          platformFeeRateBps: 350,
        },
        status: "submitted",
        phoneLastDigits: "789",
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
    await env.CACHE_KV.put("market_checkout_recover_attempts:checkout-1", "2");

    const response = await routes.fetch(
      new Request("https://test/checkout-1/guest-token", {
        method: "POST",
        body: JSON.stringify({
          orderId: 1001,
          phoneLastDigits: "789",
        }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith(
      "market_checkout_recover_attempts:checkout-1",
    );
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "guest_token:guest-token-1",
      expect.stringContaining('"orderId":"1001"'),
      { expirationTtl: 14400 },
    );
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
        market: {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          platformFeeRateBps: 350,
        },
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
          settlement: {
            platformFeeRateBps: number;
            platformFeeCents: number;
            vendorNetAmountCents: number;
            vendorAllocations: Array<{
              restaurantId: string;
              grossAmountCents: number;
              refundedAmountCents: number;
              platformFeeCents: number;
              netAmountCents: number;
            }>;
          };
          childPayments: Array<{ paymentId: string }>;
        };
      };
    };
    expect(json.data.payment).toMatchObject({
      status: "paid",
      method: "line_pay",
      totalAmount: 200,
      childPayments: [{ paymentId: "pay-1001" }, { paymentId: "pay-1002" }],
      settlement: {
        platformFeeRateBps: 350,
        platformFeeCents: 700,
        vendorNetAmountCents: 19300,
        vendorAllocations: [
          {
            restaurantId: "restaurant-1",
            grossAmountCents: 12000,
            refundedAmountCents: 0,
            platformFeeCents: 420,
            netAmountCents: 11580,
          },
          {
            restaurantId: "restaurant-2",
            grossAmountCents: 8000,
            refundedAmountCents: 0,
            platformFeeCents: 280,
            netAmountCents: 7720,
          },
        ],
      },
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
    expect(databaseMocks.updateValues[0]).toMatchObject({
      paymentStatus: "paid",
      paymentSummary: expect.objectContaining({
        status: "paid",
        totalAmount: 200,
      }),
    });
  });

  it("replays an already paid market checkout without charging twice", async () => {
    const env = createEnv();
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          platformFeeRateBps: 350,
        },
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

  it("refunds paid child payments for a market checkout", async () => {
    const env = createEnv([
      {
        id: 1001,
        restaurant_id: "restaurant-1",
        total_amount: 120,
        total_amount_cents: 12000,
        refund_amount: null,
        refund_amount_cents: null,
        payment_method: "line_pay",
        payment_status: "paid",
      },
      {
        id: 1002,
        restaurant_id: "restaurant-2",
        total_amount: 80,
        total_amount_cents: 8000,
        refund_amount: null,
        refund_amount_cents: null,
        payment_method: "line_pay",
        payment_status: "paid",
      },
    ]);
    await env.CACHE_KV.put(
      "market_checkout:checkout-1",
      JSON.stringify({
        id: "checkout-1",
        market: {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          platformFeeRateBps: 350,
        },
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
          childPayments: [
            {
              restaurantId: "restaurant-1",
              restaurantName: "雞排攤",
              orderId: 1001,
              orderNumber: "A001",
              paymentId: "pay-1001",
              status: "paid",
              amount: 120,
              amountCents: 12000,
            },
            {
              restaurantId: "restaurant-2",
              restaurantName: "甜點攤",
              orderId: 1002,
              orderNumber: "A002",
              paymentId: "pay-1002",
              status: "paid",
              amount: 80,
              amountCents: 8000,
            },
          ],
        },
        subtotal: 20000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );

    const response = await routes.fetch(
      new Request("https://test/checkout-1/refund", {
        method: "POST",
        body: JSON.stringify({ reason: "customer_request" }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        payment: {
          status: string;
          refundedAmount: number;
          settlement: {
            platformFeeRateBps: number;
            vendorNetAmountCents: number;
            vendorAllocations: Array<{
              restaurantId: string;
              grossAmountCents: number;
              refundedAmountCents: number;
              platformFeeCents: number;
              netAmountCents: number;
            }>;
          };
          childPayments: Array<{ status: string; refundId?: string }>;
        };
        refunds: Array<{ transactionId: string; amount: number }>;
      };
    };
    expect(json.data.payment).toMatchObject({
      status: "refunded",
      refundedAmount: 200,
      settlement: {
        platformFeeRateBps: 350,
        vendorNetAmountCents: 0,
        vendorAllocations: [
          {
            restaurantId: "restaurant-1",
            grossAmountCents: 12000,
            refundedAmountCents: 12000,
            platformFeeCents: 0,
            netAmountCents: 0,
          },
          {
            restaurantId: "restaurant-2",
            grossAmountCents: 8000,
            refundedAmountCents: 8000,
            platformFeeCents: 0,
            netAmountCents: 0,
          },
        ],
      },
    });
    expect(json.data.payment.childPayments).toEqual([
      expect.objectContaining({
        status: "refunded",
        refundId: expect.any(String),
      }),
      expect.objectContaining({
        status: "refunded",
        refundId: expect.any(String),
      }),
    ]);
    expect(json.data.refunds).toEqual([
      expect.objectContaining({ transactionId: "pay-1001", amount: 120 }),
      expect.objectContaining({ transactionId: "pay-1002", amount: 80 }),
    ]);
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:index",
      expect.stringContaining('"paymentStatus":"refunded"'),
      { expirationTtl: 14400 },
    );
    expect(databaseMocks.updateValues[0]).toMatchObject({
      paymentStatus: "refunded",
      paymentSummary: expect.objectContaining({
        status: "refunded",
        refundedAmount: 200,
      }),
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
    databaseMocks.selectQueue.push({
      all: [
        {
          id: "checkout-1",
          marketId: "market-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          status: "submitted",
          paymentStatus: "partial_paid",
          subtotalCents: 12000,
          childOrderCount: 1,
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
          updatedAt: new Date("2026-06-01T10:05:00.000Z"),
        },
        {
          id: "checkout-2",
          marketId: "market-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          status: "submitted",
          paymentStatus: "partial_paid",
          subtotalCents: 8000,
          childOrderCount: 1,
          createdAt: new Date("2026-05-31T10:00:00.000Z"),
          updatedAt: new Date("2026-05-31T10:05:00.000Z"),
        },
      ],
    });

    const response = await routes.fetch(
      new Request(
        "https://test/admin?paymentStatus=partial_paid&dateFrom=2026-06-01&dateTo=2026-06-01",
      ),
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

  it("summarizes market checkout operations for platform admins", async () => {
    const env = createEnv();
    databaseMocks.selectQueue.push({
      all: [
        {
          id: "checkout-1",
          marketId: "market-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          status: "submitted",
          paymentStatus: "paid",
          subtotalCents: 20000,
          childOrderCount: 2,
          paymentSummary: {
            status: "paid",
            method: "line_pay",
            currency: "TWD",
            country: "TW",
            totalAmount: 200,
            totalAmountCents: 20000,
            paidAmount: 200,
            paidAmountCents: 20000,
            childPayments: [],
          },
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
          updatedAt: new Date("2026-06-01T10:05:00.000Z"),
        },
        {
          id: "checkout-2",
          marketId: "market-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          status: "submitted",
          paymentStatus: "refunded",
          subtotalCents: 12000,
          childOrderCount: 1,
          paymentSummary: {
            status: "refunded",
            method: "line_pay",
            currency: "TWD",
            country: "TW",
            totalAmount: 120,
            totalAmountCents: 12000,
            paidAmount: 120,
            paidAmountCents: 12000,
            refundedAmount: 120,
            refundedAmountCents: 12000,
            childPayments: [],
          },
          createdAt: new Date("2026-06-01T11:00:00.000Z"),
          updatedAt: new Date("2026-06-01T11:05:00.000Z"),
        },
        {
          id: "checkout-3",
          marketId: "market-2",
          marketSlug: "ximen",
          marketName: "西門町商圈",
          status: "submitted",
          paymentStatus: "failed",
          subtotalCents: 8000,
          childOrderCount: 1,
          paymentSummary: {
            status: "failed",
            method: "line_pay",
            currency: "TWD",
            country: "TW",
            totalAmount: 80,
            totalAmountCents: 8000,
            paidAmount: 0,
            paidAmountCents: 0,
            childPayments: [],
          },
          createdAt: new Date("2026-06-01T12:00:00.000Z"),
          updatedAt: new Date("2026-06-01T12:05:00.000Z"),
        },
        {
          id: "checkout-4",
          marketId: "market-3",
          marketSlug: "outside-range",
          marketName: "區間外商圈",
          status: "submitted",
          paymentStatus: "paid",
          subtotalCents: 50000,
          childOrderCount: 5,
          paymentSummary: {
            status: "paid",
            method: "line_pay",
            currency: "TWD",
            country: "TW",
            totalAmount: 500,
            totalAmountCents: 50000,
            paidAmount: 500,
            paidAmountCents: 50000,
            childPayments: [],
          },
          createdAt: new Date("2026-05-31T12:00:00.000Z"),
          updatedAt: new Date("2026-05-31T12:05:00.000Z"),
        },
      ],
    });

    const response = await routes.fetch(
      new Request(
        "https://test/admin/summary?dateFrom=2026-06-01&dateTo=2026-06-01",
      ),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        totalCheckouts: number;
        totalSubtotalCents: number;
        paidAmountCents: number;
        refundedAmountCents: number;
        netPaidAmountCents: number;
        childOrderCount: number;
        paymentStatusCounts: Record<string, number>;
        topMarkets: Array<{
          slug: string;
          checkoutCount: number;
          subtotalCents: number;
          paidAmountCents: number;
          refundedAmountCents: number;
        }>;
      };
    };
    expect(json.data).toMatchObject({
      totalCheckouts: 3,
      totalSubtotalCents: 40000,
      paidAmountCents: 32000,
      refundedAmountCents: 12000,
      netPaidAmountCents: 20000,
      childOrderCount: 4,
      paymentStatusCounts: expect.objectContaining({
        paid: 1,
        refunded: 1,
        failed: 1,
      }),
    });
    expect(json.data.topMarkets[0]).toMatchObject({
      slug: "fengjia",
      checkoutCount: 2,
      subtotalCents: 32000,
      paidAmountCents: 32000,
      refundedAmountCents: 12000,
    });
  });

  it("filters market checkout operation summaries by payment status", async () => {
    const env = createEnv();
    databaseMocks.selectQueue.push({
      all: [
        {
          id: "checkout-1",
          marketId: "market-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          status: "submitted",
          paymentStatus: "paid",
          subtotalCents: 20000,
          childOrderCount: 2,
          paymentSummary: {
            status: "paid",
            method: "line_pay",
            currency: "TWD",
            country: "TW",
            totalAmount: 200,
            totalAmountCents: 20000,
            paidAmount: 200,
            paidAmountCents: 20000,
            childPayments: [],
          },
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
          updatedAt: new Date("2026-06-01T10:05:00.000Z"),
        },
        {
          id: "checkout-2",
          marketId: "market-2",
          marketSlug: "ximen",
          marketName: "西門町商圈",
          status: "submitted",
          paymentStatus: "failed",
          subtotalCents: 8000,
          childOrderCount: 1,
          paymentSummary: null,
          createdAt: new Date("2026-06-01T12:00:00.000Z"),
          updatedAt: new Date("2026-06-01T12:05:00.000Z"),
        },
      ],
    });

    const response = await routes.fetch(
      new Request("https://test/admin/summary?paymentStatus=paid"),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        totalCheckouts: number;
        totalSubtotalCents: number;
        paymentStatusCounts: Record<string, number>;
      };
    };
    expect(json.data).toMatchObject({
      totalCheckouts: 1,
      totalSubtotalCents: 20000,
      paymentStatusCounts: expect.objectContaining({
        paid: 1,
        failed: 0,
      }),
    });
  });

  it("exports filtered market checkout operations as CSV", async () => {
    const env = createEnv();
    databaseMocks.selectQueue.push({
      all: [
        {
          id: "checkout-1",
          marketId: "market-1",
          marketSlug: "fengjia",
          marketName: "逢甲夜市",
          status: "submitted",
          paymentStatus: "paid",
          subtotalCents: 20000,
          childOrderCount: 2,
          paymentSummary: {
            status: "paid",
            method: "line_pay",
            currency: "TWD",
            country: "TW",
            totalAmount: 200,
            totalAmountCents: 20000,
            paidAmount: 200,
            paidAmountCents: 20000,
            childPayments: [],
          },
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
          updatedAt: new Date("2026-06-01T10:05:00.000Z"),
        },
        {
          id: "checkout-2",
          marketId: "market-2",
          marketSlug: "ximen",
          marketName: "西門町商圈",
          status: "submitted",
          paymentStatus: "failed",
          subtotalCents: 8000,
          childOrderCount: 1,
          paymentSummary: {
            status: "failed",
            method: "line_pay",
            currency: "TWD",
            country: "TW",
            totalAmount: 80,
            totalAmountCents: 8000,
            paidAmount: 0,
            paidAmountCents: 0,
            childPayments: [],
          },
          createdAt: new Date("2026-06-01T12:00:00.000Z"),
          updatedAt: new Date("2026-06-01T12:05:00.000Z"),
        },
      ],
    });

    const response = await routes.fetch(
      new Request(
        "https://test/admin/export?paymentStatus=paid&dateFrom=2026-06-01&dateTo=2026-06-01",
      ),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      "market-checkouts-",
    );
    const csv = await response.text();
    expect(csv).toContain(
      "checkout_id,market_slug,market_name,status,payment_status",
    );
    expect(csv).toContain("checkout-1,fengjia");
    expect(csv).toContain(",20000,20000,0,20000,");
    expect(csv).not.toContain("checkout-2");
  });

  it("summarizes market checkout settlement totals by vendor", async () => {
    const env = createEnv();
    databaseMocks.selectQueue.push(
      {
        all: [
          {
            id: "checkout-1",
            marketId: "market-1",
            marketSlug: "fengjia",
            marketName: "逢甲夜市",
            status: "submitted",
            paymentStatus: "paid",
            subtotalCents: 20000,
            childOrderCount: 2,
            paymentSummary: {
              status: "paid",
              method: "line_pay",
              currency: "TWD",
              country: "TW",
              totalAmount: 200,
              totalAmountCents: 20000,
              paidAmount: 200,
              paidAmountCents: 20000,
              childPayments: [
                {
                  restaurantId: "restaurant-1",
                  restaurantName: "雞排攤",
                  orderId: 1001,
                  orderNumber: "A001",
                  paymentId: "pay-1001",
                  status: "paid",
                  amount: 120,
                  amountCents: 12000,
                },
                {
                  restaurantId: "restaurant-2",
                  restaurantName: "甜點攤",
                  orderId: 1002,
                  orderNumber: "A002",
                  paymentId: "pay-1002",
                  status: "paid",
                  amount: 80,
                  amountCents: 8000,
                },
              ],
            },
            createdAt: new Date("2026-06-01T10:00:00.000Z"),
            updatedAt: new Date("2026-06-01T10:05:00.000Z"),
          },
          {
            id: "checkout-2",
            marketId: "market-1",
            marketSlug: "fengjia",
            marketName: "逢甲夜市",
            status: "submitted",
            paymentStatus: "refunded",
            subtotalCents: 12000,
            childOrderCount: 1,
            paymentSummary: {
              status: "refunded",
              method: "line_pay",
              currency: "TWD",
              country: "TW",
              totalAmount: 120,
              totalAmountCents: 12000,
              paidAmount: 120,
              paidAmountCents: 12000,
              refundedAmount: 120,
              refundedAmountCents: 12000,
              childPayments: [
                {
                  restaurantId: "restaurant-1",
                  restaurantName: "雞排攤",
                  orderId: 1003,
                  orderNumber: "A003",
                  paymentId: "pay-1003",
                  refundId: "refund-1003",
                  status: "refunded",
                  amount: 120,
                  amountCents: 12000,
                },
              ],
            },
            createdAt: new Date("2026-06-01T11:00:00.000Z"),
            updatedAt: new Date("2026-06-01T11:05:00.000Z"),
          },
          {
            id: "checkout-3",
            marketId: "market-2",
            marketSlug: "outside",
            marketName: "區間外商圈",
            status: "submitted",
            paymentStatus: "paid",
            subtotalCents: 99900,
            childOrderCount: 1,
            paymentSummary: null,
            createdAt: new Date("2026-05-31T11:00:00.000Z"),
            updatedAt: new Date("2026-05-31T11:05:00.000Z"),
          },
        ],
      },
      {
        all: [
          {
            checkoutId: "checkout-1",
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
            totalAmountCents: 12000,
            tokenExpiresAt: new Date("2026-06-01T14:00:00.000Z"),
          },
          {
            checkoutId: "checkout-1",
            restaurantId: "restaurant-2",
            restaurantName: "甜點攤",
            orderId: 1002,
            orderNumber: "A002",
            totalAmount: 80,
            totalAmountCents: 8000,
            tokenExpiresAt: new Date("2026-06-01T14:00:00.000Z"),
          },
          {
            checkoutId: "checkout-2",
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1003,
            orderNumber: "A003",
            totalAmount: 120,
            totalAmountCents: 12000,
            tokenExpiresAt: new Date("2026-06-01T15:00:00.000Z"),
          },
          {
            checkoutId: "checkout-3",
            restaurantId: "restaurant-9",
            restaurantName: "區間外攤位",
            orderId: 1009,
            orderNumber: "A009",
            totalAmount: 999,
            totalAmountCents: 99900,
            tokenExpiresAt: new Date("2026-05-31T15:00:00.000Z"),
          },
        ],
      },
    );

    const response = await routes.fetch(
      new Request(
        "https://test/admin/vendors?marketSlug=fengjia&dateFrom=2026-06-01&dateTo=2026-06-01",
      ),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        vendors: Array<{
          restaurantId: string;
          restaurantName: string;
          checkoutCount: number;
          childOrderCount: number;
          subtotalCents: number;
          paidAmountCents: number;
          refundedAmountCents: number;
          netPaidAmountCents: number;
          refundedPaymentCount: number;
          failedPaymentCount: number;
        }>;
      };
    };
    expect(json.data.vendors).toEqual([
      {
        restaurantId: "restaurant-1",
        restaurantName: "雞排攤",
        checkoutCount: 2,
        childOrderCount: 2,
        subtotalCents: 24000,
        paidAmountCents: 24000,
        refundedAmountCents: 12000,
        netPaidAmountCents: 12000,
        refundedPaymentCount: 1,
        failedPaymentCount: 0,
      },
      {
        restaurantId: "restaurant-2",
        restaurantName: "甜點攤",
        checkoutCount: 1,
        childOrderCount: 1,
        subtotalCents: 8000,
        paidAmountCents: 8000,
        refundedAmountCents: 0,
        netPaidAmountCents: 8000,
        refundedPaymentCount: 0,
        failedPaymentCount: 0,
      },
    ]);
  });

  it("exports vendor settlement summaries as CSV", async () => {
    const env = createEnv();
    databaseMocks.selectQueue.push(
      {
        all: [
          {
            id: "checkout-1",
            marketId: "market-1",
            marketSlug: "fengjia",
            marketName: "逢甲夜市",
            status: "submitted",
            paymentStatus: "refunded",
            subtotalCents: 12000,
            childOrderCount: 1,
            paymentSummary: {
              status: "refunded",
              method: "line_pay",
              currency: "TWD",
              country: "TW",
              totalAmount: 120,
              totalAmountCents: 12000,
              paidAmount: 120,
              paidAmountCents: 12000,
              refundedAmount: 120,
              refundedAmountCents: 12000,
              childPayments: [
                {
                  restaurantId: "restaurant-1",
                  restaurantName: "雞排攤",
                  orderId: 1001,
                  orderNumber: "A001",
                  paymentId: "pay-1001",
                  refundId: "refund-1001",
                  status: "refunded",
                  amount: 120,
                  amountCents: 12000,
                },
              ],
            },
            createdAt: new Date("2026-06-01T10:00:00.000Z"),
            updatedAt: new Date("2026-06-01T10:05:00.000Z"),
          },
          {
            id: "checkout-2",
            marketId: "market-2",
            marketSlug: "outside",
            marketName: "區間外商圈",
            status: "submitted",
            paymentStatus: "paid",
            subtotalCents: 99900,
            childOrderCount: 1,
            paymentSummary: null,
            createdAt: new Date("2026-05-31T10:00:00.000Z"),
            updatedAt: new Date("2026-05-31T10:05:00.000Z"),
          },
        ],
      },
      {
        all: [
          {
            checkoutId: "checkout-1",
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1001,
            orderNumber: "A001",
            totalAmount: 120,
            totalAmountCents: 12000,
            tokenExpiresAt: new Date("2026-06-01T14:00:00.000Z"),
          },
          {
            checkoutId: "checkout-2",
            restaurantId: "restaurant-9",
            restaurantName: "區間外攤位",
            orderId: 1009,
            orderNumber: "A009",
            totalAmount: 999,
            totalAmountCents: 99900,
            tokenExpiresAt: new Date("2026-05-31T14:00:00.000Z"),
          },
        ],
      },
    );

    const response = await routes.fetch(
      new Request(
        "https://test/admin/vendors/export?marketSlug=fengjia&dateFrom=2026-06-01&dateTo=2026-06-01",
      ),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      "market-checkout-vendors-",
    );
    const csv = await response.text();
    expect(csv).toContain(
      "restaurant_id,restaurant_name,checkout_count,child_order_count",
    );
    expect(csv).toContain("restaurant-1,雞排攤,1,1,12000,12000,12000,0,1,0");
    expect(csv).not.toContain("restaurant-9");
  });

  it("falls back to the KV index when no persisted checkout sessions exist", async () => {
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

  it("hydrates child order status when platform admins read checkout details", async () => {
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
    getOrder.mockResolvedValueOnce({
      id: 1001,
      orderNumber: "A001",
      totalAmount: 120,
      totalAmountCents: 12000,
      status: "ready",
      paymentStatus: "completed",
      updatedAt: 1780308400000,
    });

    const response = await routes.fetch(
      new Request("https://test/admin/checkout-1"),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(getOrder).toHaveBeenCalledWith(1001, false);
    const json = (await response.json()) as {
      data: {
        checkout: {
          childOrders: Array<{
            status?: string;
            paymentStatus?: string;
            totalAmountCents?: number;
          }>;
        };
      };
    };
    expect(json.data.checkout.childOrders[0]).toMatchObject({
      status: "ready",
      paymentStatus: "completed",
      totalAmountCents: 12000,
    });
  });
});
