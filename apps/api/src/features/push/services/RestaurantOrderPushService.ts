import type { Env } from "../../../types/env";

interface PushSubscriptionRecord {
  id: string;
  restaurantId: string | null;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

export interface RestaurantOrderPushInput {
  restaurantId: string;
  orderId: string;
  orderNumber: string;
  orderSource?: string | null;
  totalAmount: number;
  itemCount: number;
  customerName?: string;
  notes?: string | null;
}

const SUBSCRIPTION_PREFIX = "push:subscription:";

export class RestaurantOrderPushService {
  constructor(private readonly env: Env) {}

  async notifyNewOrder(input: RestaurantOrderPushInput) {
    if (!this.env.WEB_PUSH_DELIVERER) {
      return { attempted: 0, delivered: 0 };
    }

    const subscriptions = await this.listRestaurantSubscriptions(
      input.restaurantId,
    );
    let delivered = 0;

    await Promise.all(
      subscriptions.map(async ({ key, record }) => {
        const result = await this.env.WEB_PUSH_DELIVERER?.({
          subscription: {
            id: record.id,
            endpoint: record.subscription.endpoint,
            p256dhKey: record.subscription.keys.p256dh,
            authKey: record.subscription.keys.auth,
          },
          payload: buildNewOrderPayload(input),
        });

        if (result?.ok) {
          delivered += 1;
          return;
        }
        if (result?.status === 404 || result?.status === 410) {
          await this.env.CACHE_KV.delete(key);
        }
      }),
    );

    return { attempted: subscriptions.length, delivered };
  }

  private async listRestaurantSubscriptions(restaurantId: string) {
    const prefix = `${SUBSCRIPTION_PREFIX}${keySegment(restaurantId)}:`;
    const listed = await this.env.CACHE_KV.list({ prefix });
    const records = await Promise.all(
      listed.keys.map(async ({ name }) => {
        const record = await this.env.CACHE_KV.get<PushSubscriptionRecord>(
          name,
          "json",
        );
        if (!isPushSubscriptionRecord(record, restaurantId)) return null;
        return { key: name, record };
      }),
    );

    return records.filter(
      (record): record is { key: string; record: PushSubscriptionRecord } =>
        record !== null,
    );
  }
}

function buildNewOrderPayload(input: RestaurantOrderPushInput) {
  const isMarketCheckout = input.orderSource === "market_checkout";

  return {
    type: "new_order",
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    orderSource: input.orderSource ?? "direct",
    title: isMarketCheckout ? "市場結帳新訂單" : "新訂單",
    body: `${input.orderNumber} · ${input.itemCount} items · ${formatAmount(
      input.totalAmount,
    )}`,
    tag: `order-${input.orderId}`,
    priority: isMarketCheckout ? "high" : "normal",
    requireInteraction: isMarketCheckout,
    data: {
      orderId: input.orderId,
      restaurantId: input.restaurantId,
      orderSource: input.orderSource ?? "direct",
      customerName: input.customerName,
      notes: input.notes ?? undefined,
    },
  };
}

function isPushSubscriptionRecord(
  value: unknown,
  restaurantId: string,
): value is PushSubscriptionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PushSubscriptionRecord>;
  return (
    record.restaurantId === restaurantId &&
    typeof record.id === "string" &&
    typeof record.subscription?.endpoint === "string" &&
    typeof record.subscription.keys?.p256dh === "string" &&
    typeof record.subscription.keys.auth === "string"
  );
}

function keySegment(value: string) {
  return encodeURIComponent(value.trim());
}

function formatAmount(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}
