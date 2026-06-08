import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOrdersStore } from "./orders";
import { kitchenApi } from "@/services/kitchenApi";
import { offlineService } from "@/services/offlineService";
import type { KitchenOrder } from "@/types";

vi.mock("@/services/kitchenApi", () => ({
  kitchenApi: {
    startCooking: vi.fn(),
    markItemReady: vi.fn(),
  },
}));

vi.mock("@/services/offlineService", () => ({
  offlineService: {
    isOnline: { value: false },
    queueAction: vi.fn(),
  },
}));

const order = (status: KitchenOrder["items"][number]["status"]) =>
  ({
    id: 1001,
    orderNumber: "A001",
    status: status === "ready" ? "preparing" : "confirmed",
    deliveryInfo: { type: "dine_in" },
    items: [
      {
        id: 501,
        name: "Beef Noodles",
        quantity: 1,
        status,
        priority: "normal",
      },
    ],
    createdAt: "2026-06-08T01:00:00.000Z",
    totalItems: 1,
    priority: "normal",
    elapsedTime: 5,
    totalAmount: 120,
  }) satisfies KitchenOrder;

describe("orders store offline workflow", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    offlineService.isOnline.value = false;
  });

  it("queues start cooking and updates local state while offline", async () => {
    const store = useOrdersStore();
    store.orders = [order("pending")];

    await store.startCooking("restaurant-1", 1001, 501);

    expect(kitchenApi.startCooking).not.toHaveBeenCalled();
    expect(offlineService.queueAction).toHaveBeenCalledWith(
      "start_cooking",
      1001,
      { restaurantId: "restaurant-1", status: "preparing" },
      501,
    );
    expect(store.orders[0].status).toBe("preparing");
    expect(store.orders[0].items[0].status).toBe("preparing");
    expect(store.orders[0].items[0].startedAt).toBeTruthy();
  });

  it("queues mark ready and updates local state while offline", async () => {
    const store = useOrdersStore();
    store.orders = [order("preparing")];

    await store.markReady("restaurant-1", 1001, 501);

    expect(kitchenApi.markItemReady).not.toHaveBeenCalled();
    expect(offlineService.queueAction).toHaveBeenCalledWith(
      "mark_ready",
      1001,
      { restaurantId: "restaurant-1", status: "ready" },
      501,
    );
    expect(store.orders[0].status).toBe("ready");
    expect(store.orders[0].items[0].status).toBe("ready");
    expect(store.orders[0].items[0].completedAt).toBeTruthy();
  });
});
