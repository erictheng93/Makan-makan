import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../types/env";
import { RestaurantOrderPushService } from "./RestaurantOrderPushService";

function createEnv(options: {
  deliverer?: Env["WEB_PUSH_DELIVERER"];
  subscriptionStatus?: number;
}): Env {
  const subscriptionKey =
    "push:subscription:restaurant-1:user-1:subscription-1";

  return {
    WEB_PUSH_DELIVERER: options.deliverer,
    CACHE_KV: {
      list: vi.fn(async ({ prefix }: { prefix?: string } = {}) => ({
        keys:
          prefix === "push:subscription:restaurant-1:"
            ? [{ name: subscriptionKey }]
            : [],
      })),
      get: vi.fn(async (key: string) => {
        if (key !== subscriptionKey) return null;
        return {
          id: "subscription-1",
          restaurantId: "restaurant-1",
          subscription: {
            endpoint: "https://push.example/subscription-1",
            keys: {
              p256dh: "p256dh-key",
              auth: "auth-key",
            },
          },
        };
      }),
      put: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as Env;
}

describe("RestaurantOrderPushService", () => {
  it("delivers new order notifications to restaurant subscriptions", async () => {
    const deliverer = vi.fn(async () => ({ ok: true, status: 201 }));
    const env = createEnv({ deliverer });

    const result = await new RestaurantOrderPushService(env).notifyNewOrder({
      restaurantId: "restaurant-1",
      orderId: 1001,
      orderNumber: "A001",
      orderSource: "market_checkout",
      totalAmount: 120,
      itemCount: 2,
      customerName: "Market Guest",
      notes: "市場結帳：逢甲夜市 / fengjia / checkout-1",
    });

    expect(result).toEqual({ attempted: 1, delivered: 1 });
    expect(deliverer).toHaveBeenCalledWith({
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

  it("cleans up expired push subscriptions", async () => {
    const deliverer = vi.fn(async () => ({ ok: false, status: 410 }));
    const env = createEnv({ deliverer });

    const result = await new RestaurantOrderPushService(env).notifyNewOrder({
      restaurantId: "restaurant-1",
      orderId: 1002,
      orderNumber: "A002",
      totalAmount: 80,
      itemCount: 1,
    });

    expect(result).toEqual({ attempted: 1, delivered: 0 });
    expect(env.CACHE_KV.delete).toHaveBeenCalledWith(
      "push:subscription:restaurant-1:user-1:subscription-1",
    );
  });

  it("does not read subscriptions when no push deliverer is configured", async () => {
    const env = createEnv({});

    const result = await new RestaurantOrderPushService(env).notifyNewOrder({
      restaurantId: "restaurant-1",
      orderId: 1003,
      orderNumber: "A003",
      totalAmount: 60,
      itemCount: 1,
    });

    expect(result).toEqual({ attempted: 0, delivered: 0 });
    expect(env.CACHE_KV.list).not.toHaveBeenCalled();
  });
});
