import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOrderStore } from "./order";
import { api } from "@/services/api";
import type { Order } from "@/types";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  unwrapApiList: vi.fn((payload: unknown) => payload),
}));

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
}));

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    restaurantId: "restaurant-1",
    orderNumber: "A001",
    status: "pending",
    totalAmount: 120,
    items: [],
    // The API sends both of these as Unix milliseconds -- see the response
    // assembly in packages/database/src/services/order.ts, which runs every
    // timestamp through toMillis().
    createdAt: 1786000000000,
    updatedAt: 1786000000000,
    ...overrides,
  };
}

describe("admin order store — local status updates keep the API's time format", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  /**
   * The store patches the row in place rather than refetching, so whatever it
   * writes has to be the same shape the API sent. Writing an ISO string here
   * gave one field two runtime types depending on how it was last touched,
   * which is how `createdAt` ended up crashing the orders table.
   */
  it("stamps updatedAt as Unix milliseconds after a status change", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: [buildOrder()] },
    });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    const store = useOrderStore();
    await store.fetchOrders();
    const before = Date.now();

    await expect(store.updateOrderStatus("order-1", "confirmed")).resolves.toBe(
      true,
    );

    const updated = store.orders[0].updatedAt;
    expect(typeof updated).toBe("number");
    expect(updated).toBeGreaterThanOrEqual(before);
  });

  it("stamps updatedAt as Unix milliseconds after a cancellation", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: [buildOrder({ status: "confirmed" })] },
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const store = useOrderStore();
    await store.fetchOrders();
    const before = Date.now();

    await expect(store.cancelOrder("order-1")).resolves.toBe(true);

    const updated = store.orders[0].updatedAt;
    expect(typeof updated).toBe("number");
    expect(updated).toBeGreaterThanOrEqual(before);
  });
});

/**
 * `t` is mocked to echo its key, so a leaked server sentence is unmistakable:
 * anything that is not a dotted key came from the response body.
 */
describe("admin order store — the server's prose never reaches the banner", () => {
  const SERVER_PROSE = "Order 41 is locked by kitchen station 3";

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  function rejectWith(status: number, code?: string) {
    return {
      response: {
        status,
        data: {
          success: false,
          error: { message: SERVER_PROSE, ...(code && { code }) },
        },
      },
    };
  }

  it("shows the localized status copy for a 403, not the server's sentence", async () => {
    vi.mocked(api.get).mockRejectedValue(rejectWith(403, "FORBIDDEN"));
    const store = useOrderStore();

    await store.fetchOrders();

    expect(store.error).toBe("errorPresentation.permissionDenied");
  });

  it("names the failed action when the response cannot be classified", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: [buildOrder()] },
    });
    vi.mocked(api.put).mockRejectedValue(rejectWith(418));
    const store = useOrderStore();
    await store.fetchOrders();

    await expect(store.updateOrderStatus("order-1", "confirmed")).resolves.toBe(
      false,
    );

    expect(store.error).toBe("orderStore.updateStatusFailed");
  });

  it("keeps the server's sentence out of every failure path", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: [buildOrder({ status: "confirmed" })] },
    });
    vi.mocked(api.delete).mockRejectedValue(
      rejectWith(409, "ORDER_ALREADY_SERVED"),
    );
    const store = useOrderStore();
    await store.fetchOrders();

    await expect(store.cancelOrder("order-1")).resolves.toBe(false);

    expect(store.error).not.toContain(SERVER_PROSE);
    expect(store.error).toBe("errorPresentation.conflict");
  });
});
