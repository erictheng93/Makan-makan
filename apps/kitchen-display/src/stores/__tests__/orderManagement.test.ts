/**
 * OrderManagement Store Tests
 * 測試訂單管理 store 的功能
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useOrderManagementStore } from "../orderManagement";
import type { KitchenOrder, OrderStatus, ItemStatus } from "@/types";
import { orderFactory, resetAllFactories } from "@makanmasak/testing-utils";

function createMockOrder(
  id: number,
  overrides: Partial<KitchenOrder> = {},
): KitchenOrder {
  const base = orderFactory.build();
  return {
    id,
    orderNumber: `ORD-${id.toString().padStart(3, "0")}`,
    tableName: `T${id}`,
    tableId: id,
    status: "confirmed" as OrderStatus,
    priority: "normal",
    createdAt: new Date().toISOString(),
    elapsedTime: 10,
    estimatedTime: base.estimatedPrepTime ?? 15,
    totalItems: 2,
    items: [
      {
        id: id * 10 + 1,
        name: "宮保雞丁",
        quantity: 1,
        status: "pending" as ItemStatus,
        priority: "normal" as const,
      },
    ],
    ...overrides,
  };
}

describe("OrderManagement Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetAllFactories();
  });

  describe("Selection Management", () => {
    it("should select an order", () => {
      const store = useOrderManagementStore();

      store.selectOrder(1);

      expect(store.isOrderSelected(1)).toBe(true);
    });

    it("should deselect an order", () => {
      const store = useOrderManagementStore();

      store.selectOrder(1);
      store.deselectOrder(1);

      expect(store.isOrderSelected(1)).toBe(false);
    });

    it("should toggle order selection", () => {
      const store = useOrderManagementStore();

      store.toggleOrderSelection(1);
      expect(store.isOrderSelected(1)).toBe(true);

      store.toggleOrderSelection(1);
      expect(store.isOrderSelected(1)).toBe(false);
    });

    it("should select all orders", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1),
        createMockOrder(2),
        createMockOrder(3),
      ];

      store.selectAll(orders);

      expect(store.selectedOrdersCount).toBe(3);
    });

    it("should deselect all orders", () => {
      const store = useOrderManagementStore();

      store.selectOrder(1);
      store.selectOrder(2);
      store.deselectAll();

      expect(store.selectedOrdersCount).toBe(0);
    });

    it("should track selected orders count", () => {
      const store = useOrderManagementStore();

      store.selectOrder(1);
      store.selectOrder(2);

      expect(store.selectedOrdersCount).toBe(2);
    });

    it("should indicate if has selected orders", () => {
      const store = useOrderManagementStore();

      expect(store.hasSelectedOrders).toBe(false);

      store.selectOrder(1);

      expect(store.hasSelectedOrders).toBe(true);
    });
  });

  describe("Filtering", () => {
    it("should filter orders by status", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { status: "confirmed" }),
        createMockOrder(2, { status: "preparing" }),
        createMockOrder(3, { status: "confirmed" }),
      ];

      store.setFilter("status", ["confirmed"]);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(2);
    });

    it("should filter orders by priority", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { priority: "normal" }),
        createMockOrder(2, { priority: "urgent" }),
        createMockOrder(3, { priority: "normal" }),
      ];

      store.setFilter("priority", ["urgent"]);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].priority).toBe("urgent");
    });

    it("should filter orders by search text", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { orderNumber: "ORD-001" }),
        createMockOrder(2, { orderNumber: "ORD-002" }),
        createMockOrder(3, { tableName: "T5" }),
      ];

      store.setFilter("searchText", "ORD-001");
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].orderNumber).toBe("ORD-001");
    });

    it("should filter by customer name", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { customerName: "張三" }),
        createMockOrder(2, { customerName: "李四" }),
      ];

      store.setFilter("searchText", "張三");
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].customerName).toBe("張三");
    });

    it("should filter by item name", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, {
          items: [
            {
              id: 1,
              name: "宮保雞丁",
              quantity: 1,
              status: "pending" as ItemStatus,
              priority: "normal" as const,
            },
          ],
        }),
        createMockOrder(2, {
          items: [
            {
              id: 2,
              name: "麻婆豆腐",
              quantity: 1,
              status: "pending" as ItemStatus,
              priority: "normal" as const,
            },
          ],
        }),
      ];

      store.setFilter("searchText", "宮保");
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
    });

    it("should filter by elapsed time range", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { elapsedTime: 5 }),
        createMockOrder(2, { elapsedTime: 15 }),
        createMockOrder(3, { elapsedTime: 25 }),
      ];

      store.setFilter("minElapsedTime", 10);
      store.setFilter("maxElapsedTime", 20);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].elapsedTime).toBe(15);
    });

    it("should filter by table IDs", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { tableId: 1 }),
        createMockOrder(2, { tableId: 2 }),
        createMockOrder(3, { tableId: 3 }),
      ];

      store.setFilter("tableIds", [1, 3]);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(2);
    });

    it("should filter by has notes", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { notes: "Special request" }),
        createMockOrder(2),
        createMockOrder(3, { notes: "Another note" }),
      ];

      store.setFilter("hasNotes", true);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(2);
    });

    it("should filter by has customizations", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, {
          items: [
            {
              id: 1,
              name: "Item",
              quantity: 1,
              status: "pending" as ItemStatus,
              customizations: ["Extra spicy"],
              priority: "normal" as const,
            },
          ],
        }),
        createMockOrder(2),
      ];

      store.setFilter("hasCustomizations", true);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
    });

    it("should clear all filters", () => {
      const store = useOrderManagementStore();

      store.setFilter("status", ["confirmed"]);
      store.setFilter("priority", ["urgent"]);
      store.clearFilters();

      expect(store.hasActiveFilters).toBe(false);
    });

    it("should detect active filters", () => {
      const store = useOrderManagementStore();

      expect(store.hasActiveFilters).toBe(false);

      store.setFilter("status", ["confirmed"]);

      expect(store.hasActiveFilters).toBe(true);
    });
  });

  describe("Sorting", () => {
    it("should sort by created time ascending", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { createdAt: "2025-11-15T14:30:00" }),
        createMockOrder(2, { createdAt: "2025-11-15T14:00:00" }),
        createMockOrder(3, { createdAt: "2025-11-15T14:45:00" }),
      ];

      store.setSorting("createdAt", "asc");
      const sorted = store.sortOrders(orders);

      expect(sorted[0].id).toBe(2);
      expect(sorted[2].id).toBe(3);
    });

    it("should sort by created time descending", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { createdAt: "2025-11-15T14:30:00" }),
        createMockOrder(2, { createdAt: "2025-11-15T14:00:00" }),
        createMockOrder(3, { createdAt: "2025-11-15T14:45:00" }),
      ];

      store.setSorting("createdAt", "desc");
      const sorted = store.sortOrders(orders);

      expect(sorted[0].id).toBe(3);
      expect(sorted[2].id).toBe(2);
    });

    it("should sort by elapsed time", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { elapsedTime: 20 }),
        createMockOrder(2, { elapsedTime: 5 }),
        createMockOrder(3, { elapsedTime: 15 }),
      ];

      store.setSorting("elapsedTime", "asc");
      const sorted = store.sortOrders(orders);

      expect(sorted[0].elapsedTime).toBe(5);
      expect(sorted[2].elapsedTime).toBe(20);
    });

    it("should sort by priority", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { priority: "normal" }),
        createMockOrder(2, { priority: "urgent" }),
        createMockOrder(3, { priority: "high" }),
      ];

      store.setSorting("priority", "desc");
      const sorted = store.sortOrders(orders);

      expect(sorted[0].priority).toBe("urgent");
      expect(sorted[2].priority).toBe("normal");
    });

    it("should toggle sort direction", () => {
      const store = useOrderManagementStore();

      store.setSorting("createdAt", "asc");
      expect(store.sortBy.direction).toBe("asc");

      store.setSorting("createdAt");
      expect(store.sortBy.direction).toBe("desc");
    });
  });

  describe("Priority Management", () => {
    it("should calculate urgent priority for old orders", () => {
      const store = useOrderManagementStore();
      const order = createMockOrder(1, { elapsedTime: 20 });

      const priority = store.calculateOrderPriority(order);

      expect(priority).toBe("urgent");
    });

    it("should calculate high priority for warning threshold", () => {
      const store = useOrderManagementStore();
      const order = createMockOrder(1, { elapsedTime: 12 });

      const priority = store.calculateOrderPriority(order);

      expect(priority).toBe("high");
    });

    it("should calculate normal priority for new orders", () => {
      const store = useOrderManagementStore();
      const order = createMockOrder(1, { elapsedTime: 5 });

      const priority = store.calculateOrderPriority(order);

      expect(priority).toBe("normal");
    });

    it("should update order priorities", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { elapsedTime: 5, priority: "normal" }),
        createMockOrder(2, { elapsedTime: 20, priority: "normal" }),
      ];

      const updated = store.updateOrderPriorities(orders);

      expect(updated[0].priority).toBe("normal");
      expect(updated[1].priority).toBe("urgent");
    });
  });

  describe("Time Management", () => {
    it("should calculate elapsed time", () => {
      const store = useOrderManagementStore();
      const createdAt = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago
      const order = createMockOrder(1, { createdAt });

      const elapsed = store.calculateElapsedTime(order);

      expect(elapsed).toBeGreaterThanOrEqual(9);
      expect(elapsed).toBeLessThanOrEqual(11);
    });

    it("should update elapsed times for all orders", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, {
          createdAt: new Date(Date.now() - 300000).toISOString(),
        }),
        createMockOrder(2, {
          createdAt: new Date(Date.now() - 600000).toISOString(),
        }),
      ];

      const updated = store.updateElapsedTimes(orders);

      expect(updated[0].elapsedTime).toBeGreaterThanOrEqual(4);
      expect(updated[1].elapsedTime).toBeGreaterThanOrEqual(9);
    });
  });

  describe("Item Status Management", () => {
    it("should get next item status", () => {
      const store = useOrderManagementStore();

      expect(store.getNextItemStatus("pending")).toBe("preparing");
      expect(store.getNextItemStatus("preparing")).toBe("ready");
      expect(store.getNextItemStatus("ready")).toBe("completed");
    });

    it("should check if can advance item status", () => {
      const store = useOrderManagementStore();

      expect(store.canAdvanceItemStatus("pending")).toBe(true);
      expect(store.canAdvanceItemStatus("preparing")).toBe(true);
      expect(store.canAdvanceItemStatus("ready")).toBe(false);
      expect(store.canAdvanceItemStatus("completed")).toBe(false);
    });

    it("should get items by status", () => {
      const store = useOrderManagementStore();
      const order = createMockOrder(1, {
        items: [
          {
            id: 1,
            name: "Item 1",
            quantity: 1,
            status: "pending" as ItemStatus,
            priority: "normal" as const,
          },
          {
            id: 2,
            name: "Item 2",
            quantity: 1,
            status: "preparing" as ItemStatus,
            priority: "normal" as const,
          },
          {
            id: 3,
            name: "Item 3",
            quantity: 1,
            status: "pending" as ItemStatus,
            priority: "normal" as const,
          },
        ],
      });

      const pendingItems = store.getItemsByStatus(order, "pending");

      expect(pendingItems).toHaveLength(2);
    });

    it("should calculate order progress", () => {
      const store = useOrderManagementStore();
      const order = createMockOrder(1, {
        items: [
          {
            id: 1,
            name: "Item 1",
            quantity: 1,
            status: "ready" as ItemStatus,
            priority: "normal" as const,
          },
          {
            id: 2,
            name: "Item 2",
            quantity: 1,
            status: "preparing" as ItemStatus,
            priority: "normal" as const,
          },
          {
            id: 3,
            name: "Item 3",
            quantity: 1,
            status: "ready" as ItemStatus,
            priority: "normal" as const,
          },
          {
            id: 4,
            name: "Item 4",
            quantity: 1,
            status: "pending" as ItemStatus,
            priority: "normal" as const,
          },
        ],
      });

      const progress = store.getOrderProgress(order);

      expect(progress).toBe(50); // 2 out of 4 items ready
    });
  });

  describe("Batch Operations", () => {
    it("should get selected orders data", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1),
        createMockOrder(2),
        createMockOrder(3),
      ];

      store.selectOrder(1);
      store.selectOrder(3);

      const selected = store.getSelectedOrdersData(orders);

      expect(selected).toHaveLength(2);
      expect(selected[0].id).toBe(1);
      expect(selected[1].id).toBe(3);
    });

    it("should check if can batch start cooking", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, {
          items: [
            {
              id: 1,
              name: "Item",
              quantity: 1,
              status: "pending" as ItemStatus,
              priority: "normal" as const,
            },
          ],
        }),
      ];

      expect(store.canBatchStartCooking(orders)).toBe(true);
    });

    it("should check if can batch mark ready", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, {
          items: [
            {
              id: 1,
              name: "Item",
              quantity: 1,
              status: "preparing" as ItemStatus,
              priority: "normal" as const,
            },
          ],
        }),
      ];

      expect(store.canBatchMarkReady(orders)).toBe(true);
    });

    it("should get batch operation summary", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, {
          items: [
            {
              id: 1,
              name: "Item 1",
              quantity: 1,
              status: "pending" as ItemStatus,
              priority: "normal" as const,
            },
            {
              id: 2,
              name: "Item 2",
              quantity: 1,
              status: "preparing" as ItemStatus,
              priority: "normal" as const,
            },
          ],
        }),
        createMockOrder(2, {
          items: [
            {
              id: 3,
              name: "Item 3",
              quantity: 1,
              status: "pending" as ItemStatus,
              priority: "normal" as const,
            },
          ],
        }),
      ];

      const summary = store.getBatchOperationSummary(orders);

      expect(summary.totalOrders).toBe(2);
      expect(summary.totalItems).toBe(3);
      expect(summary.pendingItems).toBe(2);
      expect(summary.preparingItems).toBe(1);
    });
  });

  describe("View Management", () => {
    it("should set view mode", () => {
      const store = useOrderManagementStore();

      store.setViewMode("list");

      expect(store.viewMode).toBe("list");
    });

    it("should toggle completed orders visibility", () => {
      const store = useOrderManagementStore();

      expect(store.showCompletedOrders).toBe(false);

      store.toggleCompletedOrders();

      expect(store.showCompletedOrders).toBe(true);
    });

    it("should toggle auto refresh", () => {
      const store = useOrderManagementStore();

      expect(store.autoRefreshEnabled).toBe(true);

      store.toggleAutoRefresh();

      expect(store.autoRefreshEnabled).toBe(false);
    });
  });

  describe("Quick Filters", () => {
    it("should apply urgent only filter", () => {
      const store = useOrderManagementStore();

      store.quickFilters.showUrgentOnly();

      expect(store.filters.priority).toEqual(["urgent"]);
    });

    it("should apply pending only filter", () => {
      const store = useOrderManagementStore();

      store.quickFilters.showPendingOnly();

      expect(store.filters.status).toEqual(["confirmed"]);
    });

    it("should apply preparing only filter", () => {
      const store = useOrderManagementStore();

      store.quickFilters.showPreparingOnly();

      expect(store.filters.status).toEqual(["preparing"]);
    });

    it("should apply with notes filter", () => {
      const store = useOrderManagementStore();

      store.quickFilters.showWithNotes();

      expect(store.filters.hasNotes).toBe(true);
    });

    it("should apply overdue filter", () => {
      const store = useOrderManagementStore();

      store.quickFilters.showOverdue();

      expect(store.filters.minElapsedTime).toBeGreaterThan(0);
    });
  });

  describe("Focus Management", () => {
    it("should select next order", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1),
        createMockOrder(2),
        createMockOrder(3),
      ];

      store.selectNextOrder(orders);

      expect(store.focusedOrderId).toBe(1);
      expect(store.isOrderSelected(1)).toBe(true);
    });

    it("should select previous order", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1),
        createMockOrder(2),
        createMockOrder(3),
      ];

      store.focusedOrderId = 2;
      store.selectPreviousOrder(orders);

      expect(store.focusedOrderId).toBe(1);
    });

    it("should wrap around when selecting next from last", () => {
      const store = useOrderManagementStore();
      const orders = [createMockOrder(1), createMockOrder(2)];

      store.focusedOrderId = 2;
      store.selectNextOrder(orders);

      expect(store.focusedOrderId).toBe(1);
    });

    it("should select first order", () => {
      const store = useOrderManagementStore();
      const orders = [createMockOrder(1), createMockOrder(2)];

      store.selectFirstOrder(orders);

      expect(store.focusedOrderId).toBe(1);
    });

    it("should select last order", () => {
      const store = useOrderManagementStore();
      const orders = [createMockOrder(1), createMockOrder(2)];

      store.selectLastOrder(orders);

      expect(store.focusedOrderId).toBe(2);
    });

    it("should select all visible orders", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1),
        createMockOrder(2),
        createMockOrder(3),
      ];

      store.selectAllVisibleOrders(orders);

      expect(store.selectedOrdersCount).toBe(3);
    });
  });

  describe("Reset State", () => {
    it("should reset all management state", () => {
      const store = useOrderManagementStore();

      // Set some state
      store.selectOrder(1);
      store.setFilter("status", ["confirmed"]);
      store.setSorting("elapsedTime", "desc");
      store.setViewMode("list");
      store.toggleCompletedOrders();
      store.toggleAutoRefresh();

      // Reset
      store.resetManagementState();

      expect(store.selectedOrdersCount).toBe(0);
      expect(store.hasActiveFilters).toBe(false);
      expect(store.sortBy.field).toBe("createdAt");
      expect(store.sortBy.direction).toBe("asc");
      expect(store.viewMode).toBe("card");
      expect(store.showCompletedOrders).toBe(false);
      expect(store.autoRefreshEnabled).toBe(true);
    });
  });

  describe("Order Type Filtering", () => {
    it("should filter orders by orderType 'takeaway'", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { deliveryInfo: { type: "dine_in" } }),
        createMockOrder(2, { deliveryInfo: { type: "takeaway" } }),
        createMockOrder(3, { deliveryInfo: { type: "delivery" } }),
      ];

      store.setFilter("orderTypes", ["takeaway"]);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].deliveryInfo?.type).toBe("takeaway");
    });

    it("should filter orders by orderType 'delivery'", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { deliveryInfo: { type: "dine_in" } }),
        createMockOrder(2, { deliveryInfo: { type: "takeaway" } }),
        createMockOrder(3, { deliveryInfo: { type: "delivery" } }),
      ];

      store.setFilter("orderTypes", ["delivery"]);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].deliveryInfo?.type).toBe("delivery");
    });

    it("should filter orders by multiple orderTypes", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { deliveryInfo: { type: "dine_in" } }),
        createMockOrder(2, { deliveryInfo: { type: "takeaway" } }),
        createMockOrder(3, { deliveryInfo: { type: "delivery" } }),
      ];

      store.setFilter("orderTypes", ["takeaway", "delivery"]);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((o) => o.deliveryInfo?.type)).toEqual(
        expect.arrayContaining(["takeaway", "delivery"]),
      );
    });

    it("should show all orders when orderTypes filter is empty", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, { deliveryInfo: { type: "dine_in" } }),
        createMockOrder(2, { deliveryInfo: { type: "takeaway" } }),
        createMockOrder(3, { deliveryInfo: { type: "delivery" } }),
      ];

      store.setFilter("orderTypes", []);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(3);
    });

    it("should treat orders without deliveryInfo as dine_in for filtering", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1), // no deliveryInfo — defaults to dine_in
        createMockOrder(2, { deliveryInfo: { type: "takeaway" } }),
      ];

      store.setFilter("orderTypes", ["dine_in"]);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it("should combine orderType filter with status filter", () => {
      const store = useOrderManagementStore();
      const orders = [
        createMockOrder(1, {
          status: "confirmed",
          deliveryInfo: { type: "takeaway" },
        }),
        createMockOrder(2, {
          status: "preparing",
          deliveryInfo: { type: "takeaway" },
        }),
        createMockOrder(3, {
          status: "confirmed",
          deliveryInfo: { type: "dine_in" },
        }),
      ];

      store.setFilter("orderTypes", ["takeaway"]);
      store.setFilter("status", ["confirmed"]);
      const filtered = store.filterOrders(orders);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty orders array", () => {
      const store = useOrderManagementStore();

      const filtered = store.filterOrders([]);
      const sorted = store.sortOrders([]);

      expect(filtered).toHaveLength(0);
      expect(sorted).toHaveLength(0);
    });

    it("should handle order with no items", () => {
      const store = useOrderManagementStore();
      const order = createMockOrder(1, { items: [] });

      const progress = store.getOrderProgress(order);

      expect(progress).toBe(0);
    });

    it("should handle selecting non-existent order", () => {
      const store = useOrderManagementStore();

      store.selectOrder(999);

      expect(store.isOrderSelected(999)).toBe(true);
    });

    it("should handle deselecting non-selected order", () => {
      const store = useOrderManagementStore();

      store.deselectOrder(999);

      expect(store.isOrderSelected(999)).toBe(false);
    });
  });
});
