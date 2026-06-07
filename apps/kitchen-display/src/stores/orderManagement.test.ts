import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useOrderManagementStore } from "./orderManagement";
import { useOrdersStore } from "./orders";
import { useSettingsStore } from "./settings";
import { kitchenApi } from "@/services/kitchenApi";
import type { KitchenOrder, ItemStatus } from "@/types";

vi.mock("@/services/kitchenApi", () => ({
  kitchenApi: {
    batchUpdateItemStatus: vi.fn(),
  },
}));

const item = (
  id: number,
  status: ItemStatus,
  name = `Item ${id}`,
): KitchenOrder["items"][number] => ({
  id,
  name,
  quantity: 1,
  status,
  priority: "normal",
});

const order = (overrides: Partial<KitchenOrder> = {}): KitchenOrder => ({
  id: 1001,
  orderNumber: "A001",
  tableId: 12,
  tableName: "Table 12",
  status: "confirmed",
  deliveryInfo: { type: "dine_in" },
  orderSource: "direct",
  items: [item(501, "pending", "Beef Noodles")],
  customerName: "Lin Mei",
  notes: "Less salt",
  createdAt: "2026-06-07T01:00:00.000Z",
  totalItems: 1,
  priority: "normal",
  elapsedTime: 5,
  totalAmount: 120,
  ...overrides,
});

beforeEach(() => {
  setActivePinia(createPinia());
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("useOrderManagementStore", () => {
  it("tracks selected orders and visible order navigation", () => {
    const store = useOrderManagementStore();
    const visible = [order({ id: 1 }), order({ id: 2 }), order({ id: 3 })];

    store.selectOrder(1);
    store.toggleOrderSelection(2);
    store.toggleOrderSelection(1);
    expect(store.isOrderSelected(1)).toBe(false);
    expect(store.selectedOrdersCount).toBe(1);
    expect(store.hasSelectedOrders).toBe(true);

    store.selectFirstOrder(visible);
    expect(store.focusedOrderId).toBe(1);
    store.selectNextOrder(visible);
    expect(store.focusedOrderId).toBe(2);
    store.selectPreviousOrder(visible);
    expect(store.focusedOrderId).toBe(1);
    store.selectLastOrder(visible);
    expect(store.focusedOrderId).toBe(3);
  });

  it("filters orders by status, priority, search, notes, type, source, and customizations", () => {
    const store = useOrderManagementStore();
    const orders = [
      order({
        id: 1,
        status: "confirmed",
        priority: "urgent",
        items: [
          {
            ...item(501, "pending", "Spicy Dumplings"),
            customizations: ["extra spicy"],
          },
        ],
        notes: "No peanuts",
        deliveryInfo: { type: "takeaway" },
        orderSource: "market_checkout",
      }),
      order({
        id: 2,
        status: "ready",
        priority: "normal",
        orderNumber: "B002",
        customerName: "Chen",
        tableId: 8,
        tableName: "Table 8",
        items: [item(601, "ready", "Tea")],
        notes: "",
        deliveryInfo: { type: "dine_in" },
        orderSource: "direct",
      }),
    ];

    store.setFilter("status", ["confirmed"]);
    store.setFilter("priority", ["urgent"]);
    store.setFilter("searchText", "dumplings");
    store.setFilter("hasNotes", true);
    store.setFilter("hasCustomizations", true);
    store.setFilter("orderTypes", ["takeaway"]);
    store.setFilter("orderSources", ["market_checkout"]);

    expect(store.filterOrders(orders).map((entry) => entry.id)).toEqual([1]);
    expect(store.hasActiveFilters).toBe(true);

    store.clearFilters();
    expect(store.filterOrders(orders).map((entry) => entry.id)).toEqual([1, 2]);
    expect(store.hasActiveFilters).toBe(false);
  });

  it("sorts orders and computes priorities from kitchen thresholds", () => {
    const settings = useSettingsStore();
    const store = useOrderManagementStore();
    settings.setWarningThreshold(10);
    settings.setUrgentThreshold(15);
    const orders = [
      order({ id: 1, createdAt: "2026-06-07T01:00:00.000Z", elapsedTime: 8 }),
      order({ id: 2, createdAt: "2026-06-07T00:30:00.000Z", elapsedTime: 16 }),
      order({ id: 3, createdAt: "2026-06-07T00:45:00.000Z", elapsedTime: 12 }),
    ];

    store.setSorting("createdAt", "desc");
    expect(store.sortOrders(orders).map((entry) => entry.id)).toEqual([
      1, 3, 2,
    ]);

    expect(
      store.updateOrderPriorities(orders).map((entry) => entry.priority),
    ).toEqual(["normal", "urgent", "high"]);
  });

  it("computes item status flow, progress, and batch summaries", () => {
    const store = useOrderManagementStore();
    const selected = [
      order({
        id: 1,
        items: [item(1, "pending"), item(2, "preparing"), item(3, "ready")],
      }),
      order({ id: 2, items: [item(4, "completed")] }),
    ];

    expect(store.getNextItemStatus("pending")).toBe("preparing");
    expect(store.getNextItemStatus("preparing")).toBe("ready");
    expect(store.canAdvanceItemStatus("ready")).toBe(false);
    expect(store.getItemsByStatus(selected[0], "preparing")).toEqual([
      item(2, "preparing"),
    ]);
    expect(store.getOrderProgress(selected[0])).toBe(33);
    expect(store.canBatchStartCooking(selected)).toBe(true);
    expect(store.canBatchMarkReady(selected)).toBe(true);
    expect(store.getBatchOperationSummary(selected)).toEqual({
      totalOrders: 2,
      totalItems: 4,
      pendingItems: 1,
      preparingItems: 1,
    });
  });

  it("builds batch update requests and refreshes orders after successful API completion", async () => {
    vi.mocked(kitchenApi.batchUpdateItemStatus).mockResolvedValue({
      success: true,
      data: { updatedCount: 2 },
      timestamp: "2026-06-07T01:00:00.000Z",
    });
    const ordersStore = useOrdersStore();
    const fetchOrders = vi
      .spyOn(ordersStore, "fetchOrders")
      .mockResolvedValue(undefined);
    ordersStore.orders = [
      order({
        id: 1,
        items: [item(11, "pending"), item(12, "preparing"), item(13, "ready")],
      }),
      order({ id: 2, items: [item(21, "pending")] }),
    ];
    const store = useOrderManagementStore();

    await store.batchOperation("start_cooking", [1, 2], 42);

    expect(kitchenApi.batchUpdateItemStatus).toHaveBeenCalledWith(42, [
      { orderId: 1, itemId: 11, status: "preparing" },
      { orderId: 2, itemId: 21, status: "preparing" },
    ]);
    expect(fetchOrders).toHaveBeenCalledWith(42);
  });

  it("resets filters, view, selection, and focus management state", () => {
    const store = useOrderManagementStore();
    store.selectAll([order({ id: 1 }), order({ id: 2 })]);
    store.setFilter("priority", ["urgent"]);
    store.setSorting("priority", "desc");
    store.setViewMode("compact");
    store.toggleCompletedOrders();
    store.toggleAutoRefresh();
    store.selectFirstOrder([order({ id: 1 })]);

    store.resetManagementState();

    expect(store.selectedOrdersCount).toBe(0);
    expect(store.filters).toEqual({});
    expect(store.sortBy).toEqual({ field: "createdAt", direction: "asc" });
    expect(store.viewMode).toBe("card");
    expect(store.showCompletedOrders).toBe(false);
    expect(store.autoRefreshEnabled).toBe(true);
    expect(store.focusedOrderId).toBeNull();
  });
});
