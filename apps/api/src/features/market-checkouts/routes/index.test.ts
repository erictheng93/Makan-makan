import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";

const databaseMocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  selectQueue: [] as Array<{ get?: unknown; all?: unknown[] }>,
}));
const createOrder = vi.hoisted(() => vi.fn());
const enforceQuota = vi.hoisted(() => vi.fn());
const meterEmit = vi.hoisted(() => vi.fn());
const tokenCounter = vi.hoisted(() => ({ value: 0 }));

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
    return { createOrder };
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
});
