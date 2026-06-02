import { beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeEventType } from "@makanmakan/shared-types";
import { OrdersService } from "./OrdersService";

const createBaseOrder = vi.hoisted(() => vi.fn());
const broadcastNewOrder = vi.hoisted(() => vi.fn());
const generateEventId = vi.hoisted(() => vi.fn());

vi.mock("@makanmakan/database", () => ({
  OrderService: function OrderService() {
    return {
      createOrder: createBaseOrder,
    };
  },
  CouponService: function CouponService() {
    return {};
  },
  RealtimeBroadcastService: function RealtimeBroadcastService() {
    return {
      broadcastNewOrder,
      generateEventId,
    };
  },
}));

function createEnv() {
  return {
    DB: {},
    CACHE_KV: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("OrdersService realtime broadcasts", () => {
  beforeEach(() => {
    createBaseOrder.mockReset();
    broadcastNewOrder.mockReset();
    generateEventId.mockReset();
    generateEventId.mockReturnValue("evt-market-order");
    broadcastNewOrder.mockResolvedValue({
      success: true,
      eventId: "evt-market-order",
      recipientCount: 2,
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
  });
});
