import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { kitchenApi } from "@/services/kitchenApi";
import { offlineService } from "@/services/offlineService";
import { useOrdersStore } from "./orders";
import type { KitchenOrder } from "@/types";

vi.mock("@/services/kitchenApi", () => ({
  kitchenApi: {
    getOrders: vi.fn(),
    startCooking: vi.fn(),
    markItemReady: vi.fn(),
    startAllItems: vi.fn(),
    markAllItemsReady: vi.fn(),
  },
}));

vi.mock("@/services/offlineService", () => ({
  offlineService: {
    isOnline: { value: true },
    queueAction: vi.fn(),
    cacheOrders: vi.fn(),
    getCachedOrders: vi.fn(() => []),
  },
}));

const order = (status: KitchenOrder["items"][number]["status"]) => {
  const orderStatus: KitchenOrder["status"] =
    status === "pending"
      ? "confirmed"
      : status === "completed"
        ? "ready"
        : status;

  return {
    id: 1001,
    orderNumber: "A001",
    status: orderStatus,
    deliveryInfo: { type: "dine_in" },
    items: [
      {
        id: 501,
        name: "Noodles",
        quantity: 1,
        status,
        priority: "normal",
      },
    ],
    createdAt: "2026-06-08T01:00:00.000Z",
    totalItems: 1,
    priority: "normal",
    elapsedTime: 5,
  } satisfies KitchenOrder;
};

describe("orders store actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    offlineService.isOnline.value = true;
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("applies successful online start and ready actions", async () => {
    const store = useOrdersStore();
    store.orders = [order("pending")];
    vi.mocked(kitchenApi.startCooking).mockResolvedValue({
      success: true,
      timestamp: "2026-06-08T01:00:00.000Z",
    });
    vi.mocked(kitchenApi.markItemReady).mockResolvedValue({
      success: true,
      timestamp: "2026-06-08T01:00:00.000Z",
    });

    await store.startCooking("restaurant-1", 1001, 501);
    expect(store.orders[0].status).toBe("preparing");
    expect(store.orders[0].items[0].status).toBe("preparing");

    await store.markReady("restaurant-1", 1001, 501);
    expect(store.orders[0].status).toBe("ready");
    expect(store.orders[0].items[0].status).toBe("ready");
  });

  it("throws API errors without applying failed online actions", async () => {
    const store = useOrdersStore();
    store.orders = [order("pending")];
    vi.mocked(kitchenApi.startCooking).mockResolvedValue({
      success: false,
      error: "status conflict",
      timestamp: "2026-06-08T01:00:00.000Z",
    });

    await expect(store.startCooking("restaurant-1", 1001, 501)).rejects.toThrow(
      "status conflict",
    );

    expect(store.orders[0].status).toBe("confirmed");
    expect(store.orders[0].items[0].status).toBe("pending");
  });

  it("uses batch APIs online and leaves missing/no-op orders unchanged", async () => {
    const store = useOrdersStore();
    store.orders = [order("pending")];
    vi.mocked(kitchenApi.startAllItems).mockResolvedValue({
      success: true,
      timestamp: "2026-06-08T01:00:00.000Z",
    });
    vi.mocked(kitchenApi.markAllItemsReady).mockResolvedValue({
      success: true,
      timestamp: "2026-06-08T01:00:00.000Z",
    });

    await store.startAllItems("restaurant-1", 1001);
    await store.startAllItems("restaurant-1", 9999);
    await store.markAllReady("restaurant-1", 1001);

    expect(kitchenApi.startAllItems).toHaveBeenCalledWith(
      "restaurant-1",
      1001,
      [501],
    );
    expect(kitchenApi.markAllItemsReady).not.toHaveBeenCalled();
  });

  it("updates direct order state helpers and reset state", () => {
    const store = useOrdersStore();
    store.orders = [order("pending")];
    store.error = "old error";

    expect(store.getOrderById(1001)?.orderNumber).toBe("A001");
    store.updateItemStatus(1001, 501, "preparing");
    expect(store.orders[0].status).toBe("preparing");
    expect(store.stats.preparingCount).toBe(1);

    store.updateOrderStatus("1001", "ready");
    expect(store.orders[0].status).toBe("ready");

    store.clearError();
    expect(store.error).toBeNull();

    store.clearOrders();
    expect(store.orders).toEqual([]);

    store.orders = [order("pending")];
    store.reset();
    expect(store.orders).toEqual([]);
    expect(store.stats.pendingCount).toBe(0);
    expect(store.lastUpdated).toBeNull();
  });
});
