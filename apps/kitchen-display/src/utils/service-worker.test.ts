import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ServiceWorkerHandler = (event: {
  data?: { json?: () => unknown; text?: () => string };
  notification?: {
    close: () => void;
    data?: { url?: string };
  };
  waitUntil: (promise: Promise<unknown>) => void;
}) => void;

function loadKitchenServiceWorker() {
  const listeners = new Map<string, ServiceWorkerHandler>();
  const showNotification = vi.fn(async () => undefined);
  const skipWaiting = vi.fn(async () => undefined);
  const claim = vi.fn(async () => undefined);
  const matchAll = vi.fn(async () => []);
  const openWindow = vi.fn(async () => undefined);
  const context = {
    URL,
    URLSearchParams,
    self: {
      location: { origin: "https://kitchen.example.test" },
      registration: {
        showNotification,
      },
      clients: {
        claim,
        matchAll,
        openWindow,
      },
      skipWaiting,
      addEventListener: (eventName: string, handler: ServiceWorkerHandler) => {
        listeners.set(eventName, handler);
      },
    },
  };
  context.self.self = context.self;

  const source = readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8");
  vm.runInNewContext(source, context);

  return {
    listeners,
    showNotification,
    matchAll,
    openWindow,
  };
}

describe("kitchen service worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an interactive notification for market checkout child orders", async () => {
    const worker = loadKitchenServiceWorker();
    const waitUntilPromises: Array<Promise<unknown>> = [];

    worker.listeners.get("push")?.({
      data: {
        json: () => ({
          type: "new_order",
          orderId: 1001,
          orderNumber: "A001",
          orderSource: "market_checkout",
          title: "市場結帳新訂單",
          body: "A001 · 2 items · 200.00",
          tag: "order-1001",
          priority: "high",
          data: {
            restaurantId: "restaurant-1",
            orderSource: "market_checkout",
          },
        }),
      },
      waitUntil: (promise) => waitUntilPromises.push(promise),
    });
    await Promise.all(waitUntilPromises);

    expect(worker.showNotification).toHaveBeenCalledWith(
      "市場結帳新訂單",
      expect.objectContaining({
        body: "A001 · 2 items · 200.00",
        tag: "order-1001",
        requireInteraction: true,
        data: expect.objectContaining({
          restaurantId: "restaurant-1",
          orderId: 1001,
          orderSource: "market_checkout",
          url: "/kitchen/restaurant-1?orderId=1001",
        }),
        actions: [{ action: "view_order", title: "查看訂單" }],
      }),
    );
  });

  it("focuses and navigates an existing kitchen window on notification click", async () => {
    const worker = loadKitchenServiceWorker();
    const navigate = vi.fn(async () => undefined);
    const focus = vi.fn(async () => ({
      url: "https://kitchen.example.test/kitchen/restaurant-1",
      navigate,
    }));
    worker.matchAll.mockResolvedValueOnce([
      {
        url: "https://kitchen.example.test/kitchen/restaurant-1",
        focus,
      },
    ]);
    const close = vi.fn();
    const waitUntilPromises: Array<Promise<unknown>> = [];

    worker.listeners.get("notificationclick")?.({
      notification: {
        close,
        data: { url: "/kitchen/restaurant-1?orderId=1001" },
      },
      waitUntil: (promise) => waitUntilPromises.push(promise),
    });
    await Promise.all(waitUntilPromises);

    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      "https://kitchen.example.test/kitchen/restaurant-1?orderId=1001",
    );
    expect(worker.openWindow).not.toHaveBeenCalled();
  });
});
