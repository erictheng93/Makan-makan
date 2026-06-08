import { beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenService } from "./KitchenService";

const serviceMocks = vi.hoisted(() => ({
  getOrders: vi.fn(),
  getDailyStats: vi.fn(),
  updateItemStatus: vi.fn(),
  ctor: vi.fn(),
}));

vi.mock("../../orders/services/OrdersService", () => ({
  OrdersService: vi.fn(function OrdersService(...args: unknown[]) {
    serviceMocks.ctor(...args);
    return {
      getOrders: serviceMocks.getOrders,
      getDailyStats: serviceMocks.getDailyStats,
      updateItemStatus: serviceMocks.updateItemStatus,
    };
  }),
}));

function createService() {
  return new KitchenService({ DB: { binding: "db" } } as never);
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    orderNumber: "A001",
    tableId: 7,
    status: "confirmed",
    orderSource: "direct",
    items: [
      {
        id: 501,
        quantity: 2,
        status: "pending",
        notes: "less spicy",
        menuItem: { name: "Laksa" },
      },
    ],
    customerInfo: { name: "Aminah" },
    notes: "rush",
    createdAt: Date.now() - 10 * 60_000,
    ...overrides,
  };
}

describe("KitchenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
    serviceMocks.getOrders.mockResolvedValue({ orders: [] });
    serviceMocks.getDailyStats.mockResolvedValue({
      totalOrders: 0,
      completedOrders: 0,
      averagePreparationTime: 0,
    });
    serviceMocks.updateItemStatus.mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(console.log).mockRestore();
    vi.mocked(console.warn).mockRestore();
    vi.mocked(console.error).mockRestore();
  });

  it("groups kitchen orders and computes operational stats", async () => {
    serviceMocks.getOrders.mockResolvedValue({
      orders: [
        order({
          id: 101,
          orderNumber: "A001",
          status: "confirmed",
          createdAt: Date.now() - 10 * 60_000,
        }),
        order({
          id: 102,
          orderNumber: "A002",
          tableId: null,
          status: "preparing",
          orderSource: "market_checkout",
          items: [
            {
              id: 502,
              quantity: 1,
              status: undefined,
              notes: null,
              menuItem: null,
            },
          ],
          customerInfo: null,
          notes: undefined,
          createdAt: Date.now() - 40 * 60_000,
        }),
        order({
          id: 103,
          orderNumber: "A003",
          status: "ready",
          items: [],
          createdAt: Date.now() - 5 * 60_000,
        }),
      ],
    });
    serviceMocks.getDailyStats.mockResolvedValue({
      totalOrders: 8,
      completedOrders: 6,
      averagePreparationTime: 14,
    });

    const result = await createService().getKitchenOrders("restaurant-1", 22);

    expect(serviceMocks.ctor).toHaveBeenCalledWith({
      DB: { binding: "db" },
    });
    expect(serviceMocks.getOrders).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      status: ["confirmed", "preparing", "ready"],
    });
    expect(serviceMocks.getDailyStats).toHaveBeenCalledWith("restaurant-1");
    expect(result.pending).toEqual([
      expect.objectContaining({
        id: 101,
        orderNumber: "A001",
        tableId: 7,
        tableName: "Table 7",
        status: "confirmed",
        customerName: "Aminah",
        totalItems: 2,
        elapsedTime: 10,
        items: [
          {
            id: 501,
            name: "Laksa",
            quantity: 2,
            status: "pending",
            notes: "less spicy",
            priority: "normal",
            estimatedTime: 15,
          },
        ],
      }),
    ]);
    expect(result.preparing).toEqual([
      expect.objectContaining({
        id: 102,
        tableId: 0,
        tableName: "No Table",
        customerName: "Guest",
        totalItems: 1,
        elapsedTime: 40,
        items: [
          expect.objectContaining({
            name: "Unknown Item",
            status: "pending",
            notes: "",
          }),
        ],
      }),
    ]);
    expect(result.ready).toEqual([
      expect.objectContaining({
        id: 103,
        totalItems: 0,
        elapsedTime: 5,
      }),
    ]);
    expect(result.stats).toEqual({
      pendingCount: 1,
      preparingCount: 1,
      readyCount: 1,
      completedToday: 6,
      averageCookingTime: 14,
      averageWaitingTime: 25,
      efficiency: 75,
      urgentOrders: 1,
    });
  });

  it("returns zeroed stats when there are no active kitchen orders", async () => {
    const result = await createService().getKitchenOrders("restaurant-1");

    expect(result).toEqual({
      pending: [],
      preparing: [],
      ready: [],
      stats: {
        pendingCount: 0,
        preparingCount: 0,
        readyCount: 0,
        completedToday: 0,
        averageCookingTime: 0,
        averageWaitingTime: 0,
        efficiency: 0,
        urgentOrders: 0,
      },
    });
  });

  it("updates item status and returns a timestamped response", async () => {
    serviceMocks.getOrders.mockResolvedValue({
      orders: [order()],
    });

    const result = await createService().updateOrderItemStatus(
      "restaurant-1",
      101,
      501,
      { status: "ready", notes: "plated" },
      22,
    );

    expect(serviceMocks.updateItemStatus).toHaveBeenCalledWith(
      501,
      "ready",
      "plated",
    );
    expect(result).toEqual({
      orderId: 101,
      itemId: 501,
      status: "ready",
      updatedAt: "2026-06-07T12:00:00.000Z",
    });
  });

  it("rejects item status updates outside the scoped restaurant order", async () => {
    serviceMocks.getOrders.mockResolvedValue({
      orders: [order({ id: 202 })],
    });

    await expect(
      createService().updateOrderItemStatus(
        "restaurant-1",
        101,
        501,
        { status: "ready" },
        22,
      ),
    ).rejects.toMatchObject({
      code: "KITCHEN_ITEM_SCOPE_DENIED",
    });

    expect(serviceMocks.updateItemStatus).not.toHaveBeenCalled();
  });

  it("validates kitchen role access", () => {
    const kitchenService = createService();

    expect(kitchenService.validateChefAccess(1, 0, "restaurant-1")).toBe(true);
    expect(kitchenService.validateChefAccess(2, 1, "restaurant-1")).toBe(true);
    expect(kitchenService.validateChefAccess(3, 2, "restaurant-1")).toBe(true);
    expect(kitchenService.validateChefAccess(4, 3, "restaurant-1")).toBe(true);
    expect(kitchenService.validateChefAccess(5, 4, "restaurant-1")).toBe(false);
    expect(kitchenService.validateChefAccess(6, 5, "restaurant-1")).toBe(false);
  });

  it("logs and rethrows order query and item update failures", async () => {
    serviceMocks.getOrders.mockRejectedValueOnce(new Error("orders down"));

    await expect(
      createService().getKitchenOrders("restaurant-1"),
    ).rejects.toThrow("orders down");

    serviceMocks.updateItemStatus.mockRejectedValueOnce(
      new Error("item update down"),
    );
    serviceMocks.getOrders.mockResolvedValueOnce({
      orders: [order()],
    });
    await expect(
      createService().updateOrderItemStatus(
        "restaurant-1",
        101,
        501,
        { status: "completed" },
        22,
      ),
    ).rejects.toThrow("item update down");
  });
});
