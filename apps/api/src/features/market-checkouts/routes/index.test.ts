import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";
import {
  mockMarketCheckoutProviderPaidWebhookPayload,
  mockMarketCheckoutProviderPaidStatusResponse,
  mockMarketCheckoutProviderPendingResponse,
  signMockMarketCheckoutWebhook,
} from "../testing/mockMarketCheckoutProviderContract";

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
          parentPayment: {
            paymentId: string;
            status: string;
            provider: string;
            splitMode: string;
            idempotencyKey: string;
            amountCents: number;
            paidAmountCents: number;
            refundedAmountCents: number;
            childPaymentIds: string[];
          };
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
      parentPayment: {
        paymentId: "market_pay_checkout-1",
        status: "paid",
        provider: "line_pay",
        splitMode: "child_transactions",
        idempotencyKey: "market-pay-1",
        amountCents: 20000,
        paidAmountCents: 20000,
        refundedAmountCents: 0,
        childPaymentIds: ["pay-1001", "pay-1002"],
      },
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
          parentPayment: {
            paymentId: "market_pay_checkout-1",
            status: "paid",
            provider: "line_pay",
            splitMode: "child_transactions",
            idempotencyKey: "market-pay-1",
            amountCents: 20000,
            paidAmountCents: 20000,
            refundedAmountCents: 0,
            childPaymentIds: ["pay-1001", "pay-1002"],
            createdAt: "2026-06-01T10:10:00.000Z",
            updatedAt: "2026-06-01T10:10:00.000Z",
          },
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
          parentPayment: {
            paymentId: string;
            status: string;
            refundedAmountCents: number;
            childPaymentIds: string[];
          };
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
      parentPayment: {
        paymentId: "market_pay_checkout-1",
        status: "refunded",
        refundedAmountCents: 20000,
        childPaymentIds: ["pay-1001", "pay-1002"],
      },
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
    const ledgerPrepareCallIndex = env.DB.prepare.mock.calls.findIndex(
      ([sql]) =>
        typeof sql === "string" &&
        sql.includes("INSERT INTO market_checkout_payments"),
    );
    expect(ledgerPrepareCallIndex).toBeGreaterThanOrEqual(0);
    const ledgerBind = env.DB.prepare.mock.results[ledgerPrepareCallIndex]
      ?.value.bind as ReturnType<typeof vi.fn>;
    expect(ledgerBind).toHaveBeenCalledWith(
      "market_pay_checkout-1",
      "checkout-1",
      "market-1",
      "line_pay",
      "child_transactions",
      "market-pay-1",
      "refunded",
      20000,
      20000,
      20000,
      "TWD",
      "TW",
      JSON.stringify(["pay-1001", "pay-1002"]),
      null,
      expect.stringContaining('"source":"market-checkouts"'),
      expect.any(Number),
      expect.any(Number),
      null,
      expect.any(Number),
      null,
    );
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

  it("persists provider split gateway failures as failed payment attempts", async () => {
    const env = createEnv() as ReturnType<typeof createEnv> & {
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split";
    };
    env.MARKET_CHECKOUT_SPLIT_MODE = "provider_split";
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
            totalAmountCents: 12000,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
        ],
        subtotal: 12000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );

    const response = await routes.fetch(
      new Request("https://test/checkout-1/pay", {
        method: "POST",
        body: JSON.stringify({ method: "stripe_connect" }),
      }),
      env as never,
    );

    expect(response.status).toBe(202);
    const json = (await response.json()) as {
      data: {
        payment: {
          status: string;
          paidAmountCents: number;
          childPayments: Array<{
            orderId: number;
            status: string;
            errorMessage?: string;
          }>;
          parentPayment: {
            status: string;
            splitMode: string;
            provider: string;
            paidAmountCents: number;
          };
        };
      };
    };
    expect(json.data.payment).toMatchObject({
      status: "failed",
      paidAmountCents: 0,
      childPayments: [
        {
          orderId: 1001,
          status: "failed",
          errorMessage:
            "Market checkout provider split gateway is not configured",
        },
      ],
      parentPayment: {
        status: "failed",
        provider: "stripe_connect",
        splitMode: "provider_split",
        paidAmountCents: 0,
      },
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:checkout-1",
      expect.stringContaining('"status":"failed"'),
      { expirationTtl: 14400 },
    );
    expect(databaseMocks.updateValues[0]).toMatchObject({
      paymentStatus: "failed",
      paymentSummary: expect.objectContaining({
        status: "failed",
        paidAmountCents: 0,
      }),
    });
  });

  it("persists provider split next actions as pending payment attempts", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            provider: "future_provider",
            providerTransactionId: "intent-market-1",
            status: "requires_action",
            authorizedAmountCents: 0,
            allocations: [],
            nextAction: {
              type: "redirect",
              redirectUrl:
                "https://payments.example.test/confirm/intent-market-1",
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const env = {
      ...createEnv(),
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
      MARKET_CHECKOUT_PROVIDER_SPLIT_URL:
        "https://payments.example.test/market-split",
    };
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
            totalAmountCents: 12000,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
        ],
        subtotal: 12000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );

    const response = await routes.fetch(
      new Request("https://test/checkout-1/pay", {
        method: "POST",
        body: JSON.stringify({ method: "future_provider" }),
      }),
      env as never,
    );

    const json = (await response.json()) as {
      data: {
        payment: {
          status: string;
          paidAmountCents: number;
          childPayments: unknown[];
          parentPayment: {
            status: string;
            provider: string;
            providerTransactionId?: string;
            nextAction?: {
              type: string;
              redirectUrl?: string;
            };
          };
        };
      };
    };
    expect(fetcher).toHaveBeenCalled();
    expect(json.data.payment).toMatchObject({
      status: "pending",
      paidAmountCents: 0,
      childPayments: [],
      parentPayment: {
        status: "pending",
        provider: "future_provider",
        providerTransactionId: "intent-market-1",
        nextAction: {
          type: "redirect",
          redirectUrl: "https://payments.example.test/confirm/intent-market-1",
        },
      },
    });
    expect(response.status).toBe(202);
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:checkout-1",
      expect.stringContaining('"status":"pending"'),
      { expirationTtl: 14400 },
    );
    expect(databaseMocks.updateValues[0]).toMatchObject({
      paymentStatus: "pending",
      paymentSummary: expect.objectContaining({
        status: "pending",
        paidAmountCents: 0,
      }),
    });
  });

  it("runs the mock provider pending redirect and paid webhook route flow", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(mockMarketCheckoutProviderPendingResponse)),
    );
    vi.stubGlobal("fetch", fetcher);
    const dbRows: unknown[] = [];
    const env = {
      ...createEnv(dbRows),
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
      MARKET_CHECKOUT_PROVIDER_SPLIT_URL:
        "https://payments.example.test/market-split",
      MARKET_CHECKOUT_WEBHOOK_SECRET: "market-secret",
    };
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
            restaurantName: "Chicken Stall",
            orderId: 101,
            orderNumber: "A001",
            totalAmount: 160,
            totalAmountCents: 16000,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
          {
            restaurantId: "restaurant-2",
            restaurantName: "Dessert Stall",
            orderId: 102,
            orderNumber: "A002",
            totalAmount: 80,
            totalAmountCents: 8000,
            tokenExpiresAt: "2026-06-01T12:00:00.000Z",
          },
        ],
        subtotal: 24000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );

    const payResponse = await routes.fetch(
      new Request("https://test/checkout-1/pay", {
        method: "POST",
        body: JSON.stringify({ method: "market_online" }),
      }),
      env as never,
    );

    expect(payResponse.status).toBe(202);
    await expect(payResponse.json()).resolves.toMatchObject({
      data: {
        payment: {
          status: "pending",
          parentPayment: {
            paymentId: "market_pay_checkout-1",
            provider: "mock_market_provider",
            providerTransactionId: "intent-market-checkout-1",
            nextAction: {
              type: "redirect",
              redirectUrl:
                "https://payments.example.test/confirm/intent-market-checkout-1",
            },
          },
        },
      },
    });

    dbRows.push({
      payment_id: "market_pay_checkout-1",
      checkout_id: "checkout-1",
      market_id: "market-1",
      provider: "mock_market_provider",
      split_mode: "provider_split",
      idempotency_key: "market-checkout:checkout-1",
      status: "pending",
      amount_cents: 24000,
      paid_amount_cents: 0,
      refunded_amount_cents: 0,
      currency: "TWD",
      country_code: "TW",
      child_payment_ids: JSON.stringify([]),
      provider_transaction_id: "intent-market-checkout-1",
      provider_payload: JSON.stringify({
        source: "market-checkouts",
        nextAction: mockMarketCheckoutProviderPendingResponse.nextAction,
      }),
      created_at_ms: Date.parse("2026-06-01T10:00:00.000Z"),
      updated_at_ms: Date.parse("2026-06-01T10:05:00.000Z"),
      session_payment_summary: JSON.stringify({
        status: "pending",
        method: "market_online",
        currency: "TWD",
        country: "TW",
        totalAmount: 240,
        totalAmountCents: 24000,
        paidAmount: 0,
        paidAmountCents: 0,
        childPayments: [],
        parentPayment: {
          paymentId: "market_pay_checkout-1",
          status: "pending",
          provider: "mock_market_provider",
          splitMode: "provider_split",
          idempotencyKey: "market-checkout:checkout-1",
          providerTransactionId: "intent-market-checkout-1",
          nextAction: mockMarketCheckoutProviderPendingResponse.nextAction,
          amountCents: 24000,
          paidAmountCents: 0,
          refundedAmountCents: 0,
          childPaymentIds: [],
          createdAt: "2026-06-01T10:00:00.000Z",
          updatedAt: "2026-06-01T10:05:00.000Z",
        },
      }),
    });
    const rawWebhookBody = JSON.stringify(
      mockMarketCheckoutProviderPaidWebhookPayload,
    );

    const webhookResponse = await routes.fetch(
      new Request("https://test/payment-webhooks/mock_market_provider", {
        method: "POST",
        headers: {
          "x-webhook-signature": await signMockMarketCheckoutWebhook(
            "market-secret",
            rawWebhookBody,
          ),
        },
        body: rawWebhookBody,
      }),
      env as never,
    );

    expect(webhookResponse.status).toBe(200);
    await expect(webhookResponse.json()).resolves.toMatchObject({
      data: {
        provider: "mock_market_provider",
        eventId: "evt-market-checkout-paid-1",
        eventType: "market_checkout.payment_paid",
        reconciled: true,
        checkoutId: "checkout-1",
        paymentId: "market_pay_checkout-1",
        status: "paid",
      },
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:checkout-1",
      expect.stringContaining('"status":"paid"'),
      { expirationTtl: 14400 },
    );
  });

  it("reconciles a pending provider split checkout from the provider status endpoint", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify(mockMarketCheckoutProviderPaidStatusResponse),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const dbRows: unknown[] = [
      {
        payment_id: "market_pay_checkout-1",
        checkout_id: "checkout-1",
        market_id: "market-1",
        provider: "mock_market_provider",
        split_mode: "provider_split",
        idempotency_key: "market-checkout:checkout-1",
        status: "pending",
        amount_cents: 24000,
        paid_amount_cents: 0,
        refunded_amount_cents: 0,
        currency: "TWD",
        country_code: "TW",
        child_payment_ids: JSON.stringify([]),
        provider_transaction_id: "intent-market-checkout-1",
        provider_payload: JSON.stringify({
          source: "market-checkouts",
          nextAction: mockMarketCheckoutProviderPendingResponse.nextAction,
        }),
        created_at_ms: Date.parse("2026-06-01T10:00:00.000Z"),
        updated_at_ms: Date.parse("2026-06-01T10:05:00.000Z"),
        session_payment_summary: JSON.stringify({
          status: "pending",
          method: "market_online",
          currency: "TWD",
          country: "TW",
          totalAmount: 240,
          totalAmountCents: 24000,
          paidAmount: 0,
          paidAmountCents: 0,
          childPayments: [],
          parentPayment: {
            paymentId: "market_pay_checkout-1",
            status: "pending",
            provider: "mock_market_provider",
            splitMode: "provider_split",
            idempotencyKey: "market-checkout:checkout-1",
            providerTransactionId: "intent-market-checkout-1",
            nextAction: mockMarketCheckoutProviderPendingResponse.nextAction,
            amountCents: 24000,
            paidAmountCents: 0,
            refundedAmountCents: 0,
            childPaymentIds: [],
            createdAt: "2026-06-01T10:00:00.000Z",
            updatedAt: "2026-06-01T10:05:00.000Z",
          },
        }),
      },
    ];
    const env = {
      ...createEnv(dbRows),
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
      MARKET_CHECKOUT_PROVIDER_STATUS_URL:
        "https://payments.example.test/market-split/status",
      MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN: "provider-token",
      MARKET_CHECKOUT_PROVIDER_SPLIT_SIGNING_SECRET: "provider-secret",
    };
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
          status: "pending",
          method: "market_online",
          currency: "TWD",
          country: "TW",
          totalAmount: 240,
          totalAmountCents: 24000,
          paidAmount: 0,
          paidAmountCents: 0,
          childPayments: [],
        },
        subtotal: 24000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );

    const response = await routes.fetch(
      new Request("https://test/admin/checkout-1/reconcile", {
        method: "POST",
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledWith(
      "https://payments.example.test/market-split/status",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer provider-token",
          "x-market-checkout-signature-algorithm": "hmac-sha256",
        }),
      }),
    );
    const statusRequest = fetcher.mock.calls[0]?.[1] as
      | { body?: string }
      | undefined;
    expect(JSON.parse(statusRequest?.body ?? "{}")).toMatchObject({
      checkoutId: "checkout-1",
      paymentId: "market_pay_checkout-1",
      provider: "mock_market_provider",
      providerTransactionId: "intent-market-checkout-1",
    });
    const json = (await response.json()) as {
      data: {
        reconciliation: {
          status: string;
          provider: string;
          checkoutId: string;
          paymentId: string;
        };
      };
    };
    expect(json.data.reconciliation).toMatchObject({
      status: "paid",
      provider: "mock_market_provider",
      checkoutId: "checkout-1",
      paymentId: "market_pay_checkout-1",
    });
    expect(env.CACHE_KV.put).toHaveBeenCalledWith(
      "market_checkout:checkout-1",
      expect.stringContaining('"status":"paid"'),
      { expirationTtl: 14400 },
    );
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
          paymentSummary: {
            status: "partial_paid",
            method: "market_online",
            currency: "TWD",
            country: "TW",
            totalAmount: 120,
            totalAmountCents: 12000,
            paidAmount: 0,
            paidAmountCents: 0,
            childPayments: [],
            parentPayment: {
              paymentId: "market_pay_checkout-1",
              status: "pending",
              provider: "mock_market_provider",
              splitMode: "provider_split",
              idempotencyKey: "market-checkout:checkout-1",
              providerTransactionId: "intent-market-checkout-1",
              amountCents: 12000,
              paidAmountCents: 0,
              refundedAmountCents: 0,
              childPaymentIds: [],
              createdAt: "2026-06-01T09:00:00.000Z",
              updatedAt: "2026-06-01T09:00:00.000Z",
            },
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
          paymentStatus: "partial_paid",
          subtotalCents: 8000,
          childOrderCount: 1,
          paymentSummary: {
            status: "partial_paid",
            method: "market_online",
            currency: "TWD",
            country: "TW",
            totalAmount: 80,
            totalAmountCents: 8000,
            paidAmount: 0,
            paidAmountCents: 0,
            childPayments: [],
            parentPayment: {
              paymentId: "market_pay_checkout-2",
              status: "pending",
              provider: "mock_market_provider",
              splitMode: "provider_split",
              idempotencyKey: "market-checkout:checkout-2",
              providerTransactionId: "intent-market-checkout-2",
              lastWebhook: {
                provider: "mock_market_provider",
                eventId: "evt-market-checkout-failed-2",
                eventType: "market_checkout.payment_failed",
                status: "failed",
                receivedAt: "2026-05-31T10:04:00.000Z",
              },
              amountCents: 8000,
              paidAmountCents: 0,
              refundedAmountCents: 0,
              childPaymentIds: [],
              createdAt: "2026-05-31T10:00:00.000Z",
              updatedAt: "2026-05-31T10:05:00.000Z",
            },
          },
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
          operationAlerts: Array<{ type: string; label: string }>;
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
      operationAlerts: expect.arrayContaining([
        expect.objectContaining({ type: "provider_pending_stale" }),
        expect.objectContaining({ type: "provider_webhook_missing" }),
      ]),
    });

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
          paymentSummary: {
            status: "partial_paid",
            method: "market_online",
            currency: "TWD",
            country: "TW",
            totalAmount: 120,
            totalAmountCents: 12000,
            paidAmount: 0,
            paidAmountCents: 0,
            childPayments: [],
            parentPayment: {
              paymentId: "market_pay_checkout-1",
              status: "pending",
              provider: "mock_market_provider",
              splitMode: "provider_split",
              idempotencyKey: "market-checkout:checkout-1",
              providerTransactionId: "intent-market-checkout-1",
              amountCents: 12000,
              paidAmountCents: 0,
              refundedAmountCents: 0,
              childPaymentIds: [],
              createdAt: "2026-06-01T09:00:00.000Z",
              updatedAt: "2026-06-01T09:00:00.000Z",
            },
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
          paymentStatus: "partial_paid",
          subtotalCents: 8000,
          childOrderCount: 1,
          paymentSummary: {
            status: "partial_paid",
            method: "market_online",
            currency: "TWD",
            country: "TW",
            totalAmount: 80,
            totalAmountCents: 8000,
            paidAmount: 0,
            paidAmountCents: 0,
            childPayments: [],
            parentPayment: {
              paymentId: "market_pay_checkout-2",
              status: "pending",
              provider: "mock_market_provider",
              splitMode: "provider_split",
              idempotencyKey: "market-checkout:checkout-2",
              providerTransactionId: "intent-market-checkout-2",
              lastWebhook: {
                provider: "mock_market_provider",
                eventId: "evt-market-checkout-failed-2",
                eventType: "market_checkout.payment_failed",
                status: "failed",
                receivedAt: "2026-05-31T10:04:00.000Z",
              },
              amountCents: 8000,
              paidAmountCents: 0,
              refundedAmountCents: 0,
              childPaymentIds: [],
              createdAt: "2026-05-31T10:00:00.000Z",
              updatedAt: "2026-05-31T10:05:00.000Z",
            },
          },
          createdAt: new Date("2026-05-31T10:00:00.000Z"),
          updatedAt: new Date("2026-05-31T10:05:00.000Z"),
        },
      ],
    });

    const alertResponse = await routes.fetch(
      new Request(
        "https://test/admin?paymentStatus=partial_paid&operationAlert=provider_webhook_failed",
      ),
      env as never,
    );
    expect(alertResponse.status).toBe(200);
    const alertJson = (await alertResponse.json()) as {
      data: {
        checkouts: Array<{
          id: string;
          operationAlerts: Array<{ type: string }>;
        }>;
        total: number;
      };
    };
    expect(alertJson.data.total).toBe(1);
    expect(alertJson.data.checkouts[0]).toMatchObject({
      id: "checkout-2",
      operationAlerts: expect.arrayContaining([
        expect.objectContaining({ type: "provider_webhook_failed" }),
      ]),
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

  it("reports market checkout provider configuration status for platform admins", async () => {
    const childModeResponse = await routes.fetch(
      new Request("https://test/admin/provider-status"),
      createEnv() as never,
    );
    expect(childModeResponse.status).toBe(200);
    await expect(childModeResponse.json()).resolves.toMatchObject({
      data: {
        splitMode: "child_transactions",
        readiness: "warning",
        providerKind: "internal_child_transactions",
      },
    });

    const missingGatewayEnv = {
      ...createEnv(),
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
    };
    const missingGatewayResponse = await routes.fetch(
      new Request("https://test/admin/provider-status"),
      missingGatewayEnv as never,
    );
    await expect(missingGatewayResponse.json()).resolves.toMatchObject({
      data: {
        splitMode: "provider_split",
        readiness: "not_configured",
        missingConfiguration: ["MARKET_CHECKOUT_PROVIDER_SPLIT_URL"],
      },
    });

    const missingWebhookEnv = {
      ...createEnv(),
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
      MARKET_CHECKOUT_PROVIDER_SPLIT_URL:
        "https://payments.example.test/market-split",
    };
    const missingWebhookResponse = await routes.fetch(
      new Request("https://test/admin/provider-status"),
      missingWebhookEnv as never,
    );
    await expect(missingWebhookResponse.json()).resolves.toMatchObject({
      data: {
        splitMode: "provider_split",
        readiness: "warning",
        providerSplitUrlConfigured: true,
        providerWebhookSecretConfigured: false,
        providerStatusUrlConfigured: false,
        missingConfiguration: [
          "MARKET_CHECKOUT_WEBHOOK_SECRET",
          "MARKET_CHECKOUT_PROVIDER_STATUS_URL",
        ],
      },
    });

    const readyEnv = {
      ...createEnv(),
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
      MARKET_CHECKOUT_PROVIDER_SPLIT_URL:
        "https://payments.example.test/market-split",
      MARKET_CHECKOUT_PROVIDER_STATUS_URL:
        "https://payments.example.test/market-split/status",
      MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN: "split-token",
      MARKET_CHECKOUT_WEBHOOK_SECRET: "webhook-secret",
    };
    const readyResponse = await routes.fetch(
      new Request("https://test/admin/provider-status"),
      readyEnv as never,
    );
    await expect(readyResponse.json()).resolves.toMatchObject({
      data: {
        splitMode: "provider_split",
        readiness: "ready",
        providerSplitUrlConfigured: true,
        providerSplitHealthUrlConfigured: false,
        providerStatusUrlConfigured: true,
        providerSplitTokenConfigured: true,
        providerSplitSigningConfigured: false,
        providerWebhookSecretConfigured: true,
      },
    });
  });

  it("checks market checkout provider split connectivity through the health URL", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: "Provider gateway ready",
            capabilities: ["aggregate_authorization"],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const env = {
      ...createEnv(),
      MARKET_CHECKOUT_SPLIT_MODE: "provider_split",
      MARKET_CHECKOUT_PROVIDER_SPLIT_URL:
        "https://payments.example.test/market-split",
      MARKET_CHECKOUT_PROVIDER_SPLIT_HEALTH_URL:
        "https://payments.example.test/health",
      MARKET_CHECKOUT_PROVIDER_SPLIT_TOKEN: "split-token",
    };

    const response = await routes.fetch(
      new Request("https://test/admin/provider-status/check", {
        method: "POST",
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        status: "passed",
        splitMode: "provider_split",
        target: "https://payments.example.test/health",
        responseStatus: 200,
        message: "Provider gateway ready",
        capabilities: ["aggregate_authorization"],
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://payments.example.test/health",
      {
        method: "GET",
        headers: { authorization: "Bearer split-token" },
      },
    );
    vi.unstubAllGlobals();
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
            refundedAmount: 50,
            refundedAmountCents: 5000,
            childPayments: [
              {
                restaurantId: "restaurant-1",
                restaurantName: "雞排攤",
                orderId: 1001,
                orderNumber: "A-001",
                paymentId: "pay-child-1",
                status: "paid",
                amount: 120,
                amountCents: 12000,
              },
              {
                restaurantId: "restaurant-2",
                restaurantName: "甜點攤",
                orderId: 1002,
                orderNumber: "A-002",
                status: "failed",
                amount: 80,
                amountCents: 8000,
                errorMessage: "Card declined",
              },
            ],
            parentPayment: {
              paymentId: "market_pay_checkout-1",
              status: "paid",
              provider: "line_pay",
              splitMode: "provider_split",
              idempotencyKey: "market-checkout:checkout-1",
              providerTransactionId: "txn-parent-1",
              lastWebhook: {
                provider: "line_pay",
                eventId: "evt-checkout-1-paid",
                eventType: "market_checkout.payment_paid",
                status: "paid",
                receivedAt: "2026-06-01T10:06:00.000Z",
              },
              lastReconciliation: {
                provider: "line_pay",
                eventId: "reconcile-checkout-1",
                eventType: "market_checkout.payment_paid",
                status: "paid",
                receivedAt: "2026-06-01T10:07:00.000Z",
              },
              amountCents: 20000,
              paidAmountCents: 20000,
              refundedAmountCents: 5000,
              childPaymentIds: ["pay-child-1"],
              createdAt: "2026-06-01T10:01:00.000Z",
              updatedAt: "2026-06-01T10:05:00.000Z",
            },
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
    const [headers, paidRow] = csv
      .trim()
      .split("\n")
      .map((line) => line.split(","));
    expect(headers).toEqual([
      "checkout_id",
      "market_slug",
      "market_name",
      "status",
      "payment_status",
      "payment_method",
      "payment_provider",
      "split_mode",
      "parent_payment_id",
      "provider_transaction_id",
      "last_webhook_status",
      "last_webhook_event_type",
      "last_webhook_received_at",
      "last_reconciliation_status",
      "last_reconciliation_event_type",
      "last_reconciliation_received_at",
      "child_order_count",
      "child_payment_count",
      "failed_child_payment_count",
      "subtotal_cents",
      "paid_amount_cents",
      "refunded_amount_cents",
      "net_paid_amount_cents",
      "created_at",
      "updated_at",
    ]);
    expect(paidRow).toHaveLength(headers.length);
    expect(paidRow).toEqual([
      "checkout-1",
      "fengjia",
      "逢甲夜市",
      "submitted",
      "paid",
      "line_pay",
      "line_pay",
      "provider_split",
      "market_pay_checkout-1",
      "txn-parent-1",
      "paid",
      "market_checkout.payment_paid",
      "2026-06-01T10:06:00.000Z",
      "paid",
      "market_checkout.payment_paid",
      "2026-06-01T10:07:00.000Z",
      "2",
      "2",
      "1",
      "20000",
      "20000",
      "5000",
      "15000",
      "2026-06-01T10:00:00.000Z",
      "2026-06-01T10:05:00.000Z",
    ]);
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
              settlement: {
                platformFeeRateBps: 350,
                platformFeeCents: 700,
                vendorNetAmountCents: 19300,
                vendorAllocations: [
                  {
                    restaurantId: "restaurant-1",
                    restaurantName: "雞排攤",
                    orderId: 1001,
                    orderNumber: "A001",
                    grossAmountCents: 12000,
                    refundedAmountCents: 0,
                    platformFeeCents: 420,
                    netAmountCents: 11580,
                  },
                  {
                    restaurantId: "restaurant-2",
                    restaurantName: "甜點攤",
                    orderId: 1002,
                    orderNumber: "A002",
                    grossAmountCents: 8000,
                    refundedAmountCents: 0,
                    platformFeeCents: 280,
                    netAmountCents: 7720,
                  },
                ],
              },
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
              settlement: {
                platformFeeRateBps: 350,
                platformFeeCents: 0,
                vendorNetAmountCents: 0,
                vendorAllocations: [
                  {
                    restaurantId: "restaurant-1",
                    restaurantName: "雞排攤",
                    orderId: 1003,
                    orderNumber: "A003",
                    grossAmountCents: 12000,
                    refundedAmountCents: 12000,
                    platformFeeCents: 0,
                    netAmountCents: 0,
                  },
                ],
              },
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
          platformFeeCents: number;
          vendorNetAmountCents: number;
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
        platformFeeCents: 420,
        vendorNetAmountCents: 11580,
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
        platformFeeCents: 280,
        vendorNetAmountCents: 7720,
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
              settlement: {
                platformFeeRateBps: 350,
                platformFeeCents: 0,
                vendorNetAmountCents: 0,
                vendorAllocations: [
                  {
                    restaurantId: "restaurant-1",
                    restaurantName: "雞排攤",
                    orderId: 1001,
                    orderNumber: "A001",
                    grossAmountCents: 12000,
                    refundedAmountCents: 12000,
                    platformFeeCents: 0,
                    netAmountCents: 0,
                  },
                ],
              },
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
    expect(csv).toContain(
      "restaurant-1,雞排攤,1,1,12000,12000,12000,0,0,0,1,0",
    );
    expect(csv).not.toContain("restaurant-9");
  });

  it("exports settlement accounting journal entries as CSV", async () => {
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
              paidAt: "2026-06-01T10:01:00.000Z",
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
              parentPayment: {
                paymentId: "market_pay_checkout-1",
                status: "refunded",
                provider: "line_pay",
                splitMode: "child_transactions",
                idempotencyKey: "market-checkout:checkout-1",
                amountCents: 12000,
                paidAmountCents: 12000,
                refundedAmountCents: 12000,
                childPaymentIds: ["pay-1001"],
                createdAt: "2026-06-01T10:01:00.000Z",
                updatedAt: "2026-06-01T10:05:00.000Z",
              },
              settlement: {
                platformFeeRateBps: 350,
                platformFeeCents: 0,
                vendorNetAmountCents: 0,
                vendorAllocations: [
                  {
                    restaurantId: "restaurant-1",
                    restaurantName: "雞排攤",
                    orderId: 1001,
                    orderNumber: "A001",
                    grossAmountCents: 12000,
                    refundedAmountCents: 12000,
                    platformFeeCents: 0,
                    netAmountCents: 0,
                  },
                ],
              },
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
              paidAt: "2026-06-01T11:01:00.000Z",
              childPayments: [],
              parentPayment: {
                paymentId: "market_pay_checkout-2",
                status: "paid",
                provider: "line_pay",
                splitMode: "provider_split",
                idempotencyKey: "market-checkout:checkout-2",
                providerTransactionId: "txn-parent-2",
                lastWebhook: {
                  provider: "line_pay",
                  eventId: "evt-checkout-2-paid",
                  eventType: "market_checkout.payment_paid",
                  status: "paid",
                  receivedAt: "2026-06-01T11:06:00.000Z",
                },
                lastReconciliation: {
                  provider: "line_pay",
                  eventId: "reconcile-checkout-2",
                  eventType: "market_checkout.payment_paid",
                  status: "paid",
                  receivedAt: "2026-06-01T11:07:00.000Z",
                },
                amountCents: 20000,
                paidAmountCents: 20000,
                refundedAmountCents: 0,
                childPaymentIds: [],
                createdAt: "2026-06-01T11:01:00.000Z",
                updatedAt: "2026-06-01T11:05:00.000Z",
              },
              settlement: {
                platformFeeRateBps: 350,
                platformFeeCents: 700,
                vendorNetAmountCents: 19300,
                vendorAllocations: [
                  {
                    restaurantId: "restaurant-1",
                    restaurantName: "雞排攤",
                    orderId: 1002,
                    orderNumber: "A002",
                    grossAmountCents: 12000,
                    refundedAmountCents: 0,
                    platformFeeCents: 420,
                    netAmountCents: 11580,
                  },
                  {
                    restaurantId: "restaurant-2",
                    restaurantName: "甜點攤",
                    orderId: 1003,
                    orderNumber: "A003",
                    grossAmountCents: 8000,
                    refundedAmountCents: 0,
                    platformFeeCents: 280,
                    netAmountCents: 7720,
                  },
                ],
              },
            },
            createdAt: new Date("2026-06-01T11:00:00.000Z"),
            updatedAt: new Date("2026-06-01T11:05:00.000Z"),
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
            restaurantId: "restaurant-1",
            restaurantName: "雞排攤",
            orderId: 1002,
            orderNumber: "A002",
            totalAmount: 120,
            totalAmountCents: 12000,
            tokenExpiresAt: new Date("2026-06-01T15:00:00.000Z"),
          },
          {
            checkoutId: "checkout-2",
            restaurantId: "restaurant-2",
            restaurantName: "甜點攤",
            orderId: 1003,
            orderNumber: "A003",
            totalAmount: 80,
            totalAmountCents: 8000,
            tokenExpiresAt: new Date("2026-06-01T15:00:00.000Z"),
          },
        ],
      },
    );

    const response = await routes.fetch(
      new Request(
        "https://test/admin/accounting/export?marketSlug=fengjia&dateFrom=2026-06-01&dateTo=2026-06-01",
      ),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      "market-checkout-accounting-",
    );
    const csv = await response.text();
    expect(csv).toContain(
      "entry_date,checkout_id,market_slug,market_name,restaurant_id,restaurant_name,order_id,order_number,payment_provider,split_mode,provider_transaction_id,last_webhook_status,last_webhook_received_at,last_reconciliation_status,last_reconciliation_received_at,account_code,account_name,direction,amount_cents,currency,source_type,source_id,memo",
    );
    expect(csv).toContain(
      "2026-06-01T11:01:00.000Z,checkout-2,fengjia,逢甲夜市,restaurant-1,雞排攤,1002,A002,line_pay,provider_split,txn-parent-2,paid,2026-06-01T11:06:00.000Z,paid,2026-06-01T11:07:00.000Z,1100,payment_clearing,debit,12000,TWD,market_checkout_settlement,market_pay_checkout-2,net paid amount before platform fee",
    );
    expect(csv).toContain(
      "restaurant-1,雞排攤,1002,A002,line_pay,provider_split,txn-parent-2,paid,2026-06-01T11:06:00.000Z,paid,2026-06-01T11:07:00.000Z,2200,vendor_payable,credit,11580,TWD,market_checkout_settlement,market_pay_checkout-2,vendor net payable",
    );
    expect(csv).toContain(
      "restaurant-1,雞排攤,1002,A002,line_pay,provider_split,txn-parent-2,paid,2026-06-01T11:06:00.000Z,paid,2026-06-01T11:07:00.000Z,4100,platform_fee_revenue,credit,420,TWD,market_checkout_settlement,market_pay_checkout-2,platform fee revenue",
    );
    expect(csv).toContain(
      "restaurant-1,雞排攤,1001,A001,line_pay,child_transactions,,,,,,1300,refund_clearing,debit,12000,TWD,market_checkout_refund,market_pay_checkout-1,refund issued to customer",
    );
    expect(csv).toContain(
      "restaurant-1,雞排攤,1001,A001,line_pay,child_transactions,,,,,,1100,payment_clearing,credit,12000,TWD,market_checkout_refund,market_pay_checkout-1,cash clearing reversal for refund",
    );
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

  it("hydrates parent payment from the persisted checkout payment ledger", async () => {
    const env = createEnv([
      {
        payment_id: "market_pay_checkout-1",
        provider: "line_pay",
        split_mode: "child_transactions",
        idempotency_key: "market-pay-checkout-1",
        status: "partial_refunded",
        amount_cents: 20000,
        paid_amount_cents: 20000,
        refunded_amount_cents: 8000,
        currency: "TWD",
        country_code: "TW",
        child_payment_ids: JSON.stringify(["pay-1001", "pay-1002"]),
        provider_payload: JSON.stringify({
          source: "market-checkouts",
          lastWebhook: {
            provider: "mock_market_provider",
            eventId: "evt-market-checkout-paid-1",
            eventType: "market_checkout.payment_paid",
            status: "paid",
            receivedAt: "2026-06-01T10:09:00.000Z",
            payload: {
              data: {
                object: {
                  id: "intent-market-checkout-1",
                  status: "succeeded",
                  amount_received: 20000,
                  currency: "TWD",
                  metadata: {
                    marketCheckoutId: "checkout-1",
                    customerPhone: "+886912345678",
                  },
                },
              },
            },
          },
          lastReconciliation: {
            provider: "mock_market_provider",
            eventId: "reconcile-market-checkout-1",
            eventType: "market_checkout.payment_paid",
            status: "paid",
            receivedAt: "2026-06-01T10:11:00.000Z",
            payload: {
              providerTransactionId: "intent-market-checkout-1",
              status: "paid",
              amountReceivedCents: 20000,
              currency: "TWD",
              providerPayload: {
                metadata: {
                  marketCheckoutId: "checkout-1",
                  internalTrace: "trace-secret",
                },
              },
            },
          },
        }),
        created_at_ms: 1780308000000,
        updated_at_ms: 1780308600000,
      },
    ]);
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
          ],
          parentPayment: {
            paymentId: "market_pay_checkout-1",
            status: "paid",
            provider: "line_pay",
            splitMode: "child_transactions",
            idempotencyKey: "market-pay-checkout-1",
            amountCents: 20000,
            paidAmountCents: 20000,
            refundedAmountCents: 0,
            childPaymentIds: ["pay-1001"],
            createdAt: "2026-06-01T10:00:00.000Z",
            updatedAt: "2026-06-01T10:00:00.000Z",
          },
        },
        subtotal: 20000,
        createdAt: "2026-06-01T10:00:00.000Z",
      }),
    );
    getOrder.mockResolvedValueOnce(null);

    const response = await routes.fetch(
      new Request("https://test/admin/checkout-1"),
      env as never,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: {
        checkout: {
          payment: {
            status: string;
            refundedAmountCents?: number;
            parentPayment: {
              status: string;
              refundedAmountCents: number;
              childPaymentIds: string[];
              updatedAt: string;
              lastWebhook?: {
                provider: string;
                eventId: string;
                eventType: string;
                status: string;
                receivedAt: string;
                payloadSummary?: {
                  objectId?: string;
                  status?: string;
                  amountReceivedCents?: number;
                  currency?: string;
                  metadataKeys?: string[];
                };
              };
              lastReconciliation?: {
                provider: string;
                eventId: string;
                eventType: string;
                status: string;
                receivedAt: string;
                payloadSummary?: {
                  providerTransactionId?: string;
                  status?: string;
                  amountReceivedCents?: number;
                  currency?: string;
                  metadataKeys?: string[];
                };
              };
            };
          };
        };
      };
    };
    expect(json.data.checkout.payment).toMatchObject({
      status: "partial_refunded",
      refundedAmountCents: 8000,
      parentPayment: {
        status: "partial_refunded",
        refundedAmountCents: 8000,
        childPaymentIds: ["pay-1001", "pay-1002"],
        updatedAt: "2026-06-01T10:10:00.000Z",
        lastWebhook: {
          provider: "mock_market_provider",
          eventId: "evt-market-checkout-paid-1",
          eventType: "market_checkout.payment_paid",
          status: "paid",
          receivedAt: "2026-06-01T10:09:00.000Z",
          payloadSummary: {
            objectId: "intent-market-checkout-1",
            status: "succeeded",
            amountReceivedCents: 20000,
            currency: "TWD",
            metadataKeys: ["customerPhone", "marketCheckoutId"],
          },
        },
        lastReconciliation: {
          provider: "mock_market_provider",
          eventId: "reconcile-market-checkout-1",
          eventType: "market_checkout.payment_paid",
          status: "paid",
          receivedAt: "2026-06-01T10:11:00.000Z",
          payloadSummary: {
            providerTransactionId: "intent-market-checkout-1",
            status: "paid",
            amountReceivedCents: 20000,
            currency: "TWD",
            metadataKeys: ["internalTrace", "marketCheckoutId"],
          },
        },
      },
    });
    expect(JSON.stringify(json)).not.toContain("+886912345678");
    expect(JSON.stringify(json)).not.toContain("trace-secret");
  });
});
