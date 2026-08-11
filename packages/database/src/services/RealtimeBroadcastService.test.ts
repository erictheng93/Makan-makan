import { describe, expect, it, vi } from "vitest";
import { RealtimeEventType } from "@makanmasak/shared-types";
import { RealtimeBroadcastService } from "./RealtimeBroadcastService";
import type {
  NewOrderEvent,
  OrderStatusUpdateEvent,
} from "@makanmasak/shared-types";

function createRealtimeEnv() {
  const fetch = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          eventId: "evt-market-1",
          recipientCount: 2,
        }),
      ),
    ),
  );
  const idFromName = vi.fn((name: string) => ({ name }));
  const get = vi.fn(() => ({ fetch }));

  return {
    env: {
      REALTIME_SESSION: {
        idFromName,
        get,
      },
    } as never,
    fetch,
    idFromName,
    get,
  };
}

function newOrderEvent(): NewOrderEvent {
  return {
    type: RealtimeEventType.NEW_ORDER,
    eventId: "evt-market-1",
    timestamp: 1780308000000,
    restaurantId: "restaurant-1",
    data: {
      orderId: 1001,
      orderNumber: "A001",
      items: [
        {
          orderItemId: 501,
          menuItemId: 101,
          menuItemName: "雞排",
          quantity: 2,
          price: 80,
        },
      ],
      totalAmount: 160,
      orderSource: "market_checkout",
      notes: "市場聯合結帳 checkout-1",
      customer: { name: "Guest" },
    },
  };
}

function orderStatusUpdateEvent(): OrderStatusUpdateEvent {
  return {
    type: RealtimeEventType.ORDER_STATUS_UPDATE,
    eventId: "evt-status-1",
    timestamp: 1780308000000,
    restaurantId: "restaurant-1",
    data: {
      orderId: 1001,
      orderNumber: "A001",
      status: "ready",
      updatedBy: {
        userId: "staff-1",
        userName: "Staff",
        role: "staff",
      },
    },
  };
}

describe("RealtimeBroadcastService", () => {
  it("fans out new order events to restaurant, kitchen, and admin rooms", async () => {
    const { env, idFromName, fetch } = createRealtimeEnv();
    const service = new RealtimeBroadcastService(env);

    const result = await service.broadcastNewOrder(newOrderEvent());

    expect(result).toMatchObject({
      success: true,
      eventId: "evt-market-1",
      recipientCount: 6,
    });
    expect(idFromName).toHaveBeenCalledWith("restaurant:restaurant-1");
    expect(idFromName).toHaveBeenCalledWith("kitchen:restaurant-1");
    // The admin dashboard connects to `admin:{restaurantId}`; without this room
    // it never receives order events (bug-inventory #1).
    expect(idFromName).toHaveBeenCalledWith("admin:restaurant-1");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith(
      "https://realtime-internal/broadcast",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"orderSource":"market_checkout"'),
      }),
    );
  });

  it("fans out order status updates to the order-scoped customer room", async () => {
    const { env, idFromName, fetch } = createRealtimeEnv();
    const service = new RealtimeBroadcastService(env);

    const result = await service.broadcastOrderStatusUpdate(
      orderStatusUpdateEvent(),
    );

    expect(result).toMatchObject({
      success: true,
      eventId: "evt-market-1",
      recipientCount: 8,
    });
    expect(idFromName).toHaveBeenCalledWith("customer:order:1001");
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
