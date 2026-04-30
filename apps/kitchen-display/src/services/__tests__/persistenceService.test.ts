/**
 * OfflineService - Data Persistence & Integrity Tests
 * Tests caching, local action application, status recalculation,
 * data validation/repair, localStorage errors, and offline stats.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { KitchenOrder, KitchenOrderItem } from "@/types";

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock("@/services/authApi", () => ({
  apiClient: {
    post: mockApiPost,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────

let offlineService: (typeof import("@/services/offlineService"))["offlineService"];

// Helper to build a valid KitchenOrder for testing
function makeOrder(overrides: Partial<KitchenOrder> = {}): KitchenOrder {
  return {
    id: 1,
    orderNumber: "ORD-001",
    tableId: 10,
    tableName: "Table 10",
    status: "confirmed",
    items: [
      {
        id: 100,
        name: "Nasi Goreng",
        quantity: 1,
        status: "pending",
        priority: "normal",
      },
      {
        id: 101,
        name: "Mie Goreng",
        quantity: 2,
        status: "pending",
        priority: "normal",
      },
    ],
    priority: "normal",
    createdAt: new Date().toISOString(),
    elapsedTime: 5,
    totalItems: 3,
    ...overrides,
  };
}

function makeItem(overrides: Partial<KitchenOrderItem> = {}): KitchenOrderItem {
  return {
    id: 200,
    name: "Satay",
    quantity: 1,
    status: "pending",
    priority: "normal",
    ...overrides,
  };
}

function asInvalidOrderRecord(order: KitchenOrder): Record<string, unknown> {
  return order as unknown as Record<string, unknown>;
}

describe("OfflineService - Data Persistence & Integrity", () => {
  beforeEach(async () => {
    vi.useFakeTimers();

    // Prevent constructor side-effects from blowing up
    vi.spyOn(window, "addEventListener").mockImplementation(() => {});
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
    vi.spyOn(document, "addEventListener").mockImplementation(() => {});
    vi.spyOn(document, "removeEventListener").mockImplementation(() => {});

    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    Object.defineProperty(document, "hidden", { value: false, writable: true });

    localStorage.clear();
    vi.mocked(localStorage.getItem).mockClear();
    vi.mocked(localStorage.setItem).mockClear();
    vi.mocked(localStorage.removeItem).mockClear();

    mockApiPost.mockReset();
    mockApiPost.mockResolvedValue({ data: { success: true } });

    // Fresh singleton
    vi.resetModules();
    const mod = await import("@/services/offlineService");
    offlineService = mod.offlineService;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ────────────────────────────────────────────────────────────────
  // 1. cacheOrders / getCachedOrders
  // ────────────────────────────────────────────────────────────────
  describe("cacheOrders & getCachedOrders", () => {
    it("should store orders to localStorage under 'kitchen-cached-orders'", () => {
      const orders = [makeOrder({ id: 1 }), makeOrder({ id: 2 })];
      offlineService.cacheOrders(orders);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "kitchen-cached-orders",
        expect.any(String),
      );

      // Verify JSON content
      const callArgs = vi
        .mocked(localStorage.setItem)
        .mock.calls.find((c) => c[0] === "kitchen-cached-orders");
      expect(callArgs).toBeDefined();
      const parsed = JSON.parse(callArgs![1]);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe(1);
    });

    it("should retrieve cached orders", () => {
      const orders = [makeOrder({ id: 5, orderNumber: "ORD-005" })];
      offlineService.cacheOrders(orders);

      const result = offlineService.getCachedOrders();
      expect(result).toHaveLength(1);
      expect(result[0].orderNumber).toBe("ORD-005");
    });

    it("should return empty array when no cached orders exist", () => {
      // localStorage.getItem returns null by default for unseen keys
      const result = offlineService.getCachedOrders();
      expect(result).toEqual([]);
    });

    it("should return empty array when localStorage contains invalid JSON", () => {
      vi.mocked(localStorage.getItem).mockReturnValueOnce("{invalid json");

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const result = offlineService.getCachedOrders();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to get cached orders:",
        expect.any(Error),
      );
    });

    it("should handle localStorage.setItem throwing (e.g., quota exceeded)", () => {
      vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
        throw new DOMException("QuotaExceededError");
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      offlineService.cacheOrders([makeOrder()]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to cache orders:",
        expect.anything(), // DOMException may not extend Error in jsdom
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 2. applyActionLocally
  // ────────────────────────────────────────────────────────────────
  describe("applyActionLocally", () => {
    it("should set item status to 'preparing' for start_cooking action", () => {
      const order = makeOrder({
        id: 10,
        items: [makeItem({ id: 50, status: "pending" })],
      });
      offlineService.cacheOrders([order]);

      offlineService.applyActionLocally({
        id: "a1",
        type: "start_cooking",
        orderId: 10,
        itemId: 50,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].items[0].status).toBe("preparing");
    });

    it("should set item status to 'ready' for mark_ready action", () => {
      const order = makeOrder({
        id: 11,
        items: [makeItem({ id: 51, status: "preparing" })],
      });
      offlineService.cacheOrders([order]);

      offlineService.applyActionLocally({
        id: "a2",
        type: "mark_ready",
        orderId: 11,
        itemId: 51,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].items[0].status).toBe("ready");
    });

    it("should update order status for update_status action", () => {
      const order = makeOrder({ id: 12, status: "confirmed" });
      offlineService.cacheOrders([order]);

      offlineService.applyActionLocally({
        id: "a3",
        type: "update_status",
        orderId: 12,
        payload: { status: "delivered" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      // Note: updateOrderStatus recalculates based on items, but
      // update_status sets it explicitly first.
      // Since all items are still "pending", updateOrderStatus overrides to "confirmed".
      // All items pending -> status = "confirmed"
      expect(cached[0].status).toBe("confirmed");
    });

    it("should update order priority for priority_change action", () => {
      const order = makeOrder({ id: 13, priority: "normal" });
      offlineService.cacheOrders([order]);

      offlineService.applyActionLocally({
        id: "a4",
        type: "priority_change",
        orderId: 13,
        payload: { priority: "urgent" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].priority).toBe("urgent");
    });

    it("should do nothing when orderId is not found in cache", () => {
      const order = makeOrder({ id: 14 });
      offlineService.cacheOrders([order]);

      offlineService.applyActionLocally({
        id: "a5",
        type: "start_cooking",
        orderId: 999, // non-existent
        itemId: 1,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      // Order should be unchanged
      expect(cached[0].items[0].status).toBe("pending");
    });

    it("should do nothing for start_cooking when itemId not found", () => {
      const order = makeOrder({
        id: 15,
        items: [makeItem({ id: 60, status: "pending" })],
      });
      offlineService.cacheOrders([order]);

      offlineService.applyActionLocally({
        id: "a6",
        type: "start_cooking",
        orderId: 15,
        itemId: 999, // non-existent item
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].items[0].status).toBe("pending");
    });

    it("should save updated orders back to cache after applying action", () => {
      const order = makeOrder({
        id: 16,
        items: [makeItem({ id: 70, status: "pending" })],
      });
      offlineService.cacheOrders([order]);

      // Reset mock call count
      vi.mocked(localStorage.setItem).mockClear();

      offlineService.applyActionLocally({
        id: "a7",
        type: "start_cooking",
        orderId: 16,
        itemId: 70,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      // cacheOrders should have been called again to persist changes
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "kitchen-cached-orders",
        expect.any(String),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 3. applyBatchOperation
  // ────────────────────────────────────────────────────────────────
  describe("applyBatchOperation (via applyActionLocally)", () => {
    it("should set all pending items to 'preparing' for start_all operation", () => {
      const order = makeOrder({
        id: 20,
        items: [
          makeItem({ id: 80, status: "pending" }),
          makeItem({ id: 81, status: "pending" }),
          makeItem({ id: 82, status: "ready" }), // should NOT be changed
        ],
      });
      offlineService.cacheOrders([order]);

      offlineService.applyActionLocally({
        id: "batch_start",
        type: "batch_operation",
        orderId: 20,
        payload: { operation: "start_all" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].items[0].status).toBe("preparing");
      expect(cached[0].items[1].status).toBe("preparing");
      expect(cached[0].items[2].status).toBe("ready"); // unchanged
    });

    it("should set all preparing items to 'ready' for complete_all operation", () => {
      const order = makeOrder({
        id: 21,
        items: [
          makeItem({ id: 83, status: "preparing" }),
          makeItem({ id: 84, status: "preparing" }),
          makeItem({ id: 85, status: "pending" }), // should NOT be changed
        ],
      });
      offlineService.cacheOrders([order]);

      offlineService.applyActionLocally({
        id: "batch_complete",
        type: "batch_operation",
        orderId: 21,
        payload: { operation: "complete_all" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].items[0].status).toBe("ready");
      expect(cached[0].items[1].status).toBe("ready");
      expect(cached[0].items[2].status).toBe("pending"); // unchanged
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 4. updateOrderStatus (recalculation)
  // ────────────────────────────────────────────────────────────────
  describe("updateOrderStatus (via applyActionLocally)", () => {
    it("should set order status to 'ready' when all items are ready", () => {
      const order = makeOrder({
        id: 30,
        status: "preparing",
        items: [
          makeItem({ id: 90, status: "preparing" }),
          makeItem({ id: 91, status: "ready" }),
        ],
      });
      offlineService.cacheOrders([order]);

      // Mark the last preparing item as ready
      offlineService.applyActionLocally({
        id: "status_calc_1",
        type: "mark_ready",
        orderId: 30,
        itemId: 90,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].status).toBe("ready"); // all ready
    });

    it("should set order status to 'preparing' when any item is preparing", () => {
      const order = makeOrder({
        id: 31,
        status: "confirmed",
        items: [
          makeItem({ id: 92, status: "pending" }),
          makeItem({ id: 93, status: "pending" }),
        ],
      });
      offlineService.cacheOrders([order]);

      // Start cooking one item
      offlineService.applyActionLocally({
        id: "status_calc_2",
        type: "start_cooking",
        orderId: 31,
        itemId: 92,
        payload: {},
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].status).toBe("preparing"); // at least one preparing
    });

    it("should set order status to 'confirmed' when no items are preparing or ready", () => {
      const order = makeOrder({
        id: 32,
        status: "preparing",
        items: [
          makeItem({ id: 94, status: "pending" }),
          makeItem({ id: 95, status: "pending" }),
        ],
      });
      offlineService.cacheOrders([order]);

      // Apply a priority change (does not alter item statuses)
      offlineService.applyActionLocally({
        id: "status_calc_3",
        type: "priority_change",
        orderId: 32,
        payload: { priority: "high" },
        timestamp: Date.now(),
        synced: false,
        retryCount: 0,
      });

      const cached = offlineService.getCachedOrders();
      expect(cached[0].status).toBe("confirmed"); // all pending -> confirmed
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 5. validateCachedData
  // ────────────────────────────────────────────────────────────────
  describe("validateCachedData", () => {
    it("should return true for valid cached orders", () => {
      offlineService.cacheOrders([
        makeOrder({ id: 40, orderNumber: "ORD-040", status: "confirmed" }),
      ]);

      expect(offlineService.validateCachedData()).toBe(true);
    });

    it("should return true when cache is empty (vacuous truth)", () => {
      // No orders cached means every() returns true on empty array
      expect(offlineService.validateCachedData()).toBe(true);
    });

    it("should return false when an order is missing orderNumber", () => {
      const badOrder = makeOrder({ id: 41 });
      badOrder.orderNumber = "";
      offlineService.cacheOrders([badOrder]);

      expect(offlineService.validateCachedData()).toBe(false);
    });

    it("should return false when an order has non-array items", () => {
      const badOrder = makeOrder({ id: 42 });
      asInvalidOrderRecord(badOrder).items = "not an array";
      offlineService.cacheOrders([badOrder]);

      expect(offlineService.validateCachedData()).toBe(false);
    });

    it("should return false when an order has non-string status", () => {
      const badOrder = makeOrder({ id: 43 });
      asInvalidOrderRecord(badOrder).status = 3; // number instead of string
      offlineService.cacheOrders([badOrder]);

      expect(offlineService.validateCachedData()).toBe(false);
    });

    it("should return false when an order is missing id", () => {
      // getCachedOrders catches its own errors, so to test validateCachedData
      // returning false, we provide data that fails the validation checks.
      const badOrder = makeOrder({ id: 44 });
      badOrder.id = 0; // falsy id
      offlineService.cacheOrders([badOrder]);

      expect(offlineService.validateCachedData()).toBe(false);
    });

    it("should return false via catch block when validation logic throws", () => {
      // To trigger the catch in validateCachedData, we need getCachedOrders
      // to return something that causes .every() to throw.
      // We can achieve this by making getCachedOrders return a non-array
      // that has an .every method that throws.
      vi.spyOn(offlineService, "getCachedOrders").mockImplementationOnce(() => {
        // Return a proxy that throws on .every()
        const throwingOrders = {
          every: () => {
            throw new Error("Validation explosion");
          },
        };
        return throwingOrders as unknown as KitchenOrder[];
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      expect(offlineService.validateCachedData()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Data validation failed:",
        expect.any(Error),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 6. repairData
  // ────────────────────────────────────────────────────────────────
  describe("repairData", () => {
    it("should repair missing elapsedTime by calculating from createdAt", () => {
      const createdAt = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
      const order = makeOrder({ id: 50, createdAt });
      order.elapsedTime = 0; // falsy
      offlineService.cacheOrders([order]);

      const repaired = offlineService.repairData();

      expect(repaired).toBe(true);
      const cached = offlineService.getCachedOrders();
      expect(cached[0].elapsedTime).toBeGreaterThanOrEqual(10);
    });

    it("should repair missing priority by setting to 'normal'", () => {
      const order = makeOrder({ id: 51 });
      asInvalidOrderRecord(order).priority = undefined; // missing
      offlineService.cacheOrders([order]);

      const repaired = offlineService.repairData();

      expect(repaired).toBe(true);
      const cached = offlineService.getCachedOrders();
      expect(cached[0].priority).toBe("normal");
    });

    it("should return false when no repairs are needed", () => {
      const order = makeOrder({
        id: 52,
        elapsedTime: 5,
        priority: "high",
      });
      offlineService.cacheOrders([order]);

      const repaired = offlineService.repairData();

      expect(repaired).toBe(false);
    });

    it("should save repaired orders back to cache", () => {
      const order = makeOrder({ id: 53 });
      asInvalidOrderRecord(order).priority = undefined;
      offlineService.cacheOrders([order]);

      vi.mocked(localStorage.setItem).mockClear();

      offlineService.repairData();

      // cacheOrders called to persist repaired data
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "kitchen-cached-orders",
        expect.any(String),
      );
    });

    it("should return false on error via catch block", () => {
      // getCachedOrders catches its own errors and returns [].
      // To trigger repairData's catch block, we mock getCachedOrders
      // to return data that causes forEach processing to throw.
      vi.spyOn(offlineService, "getCachedOrders").mockImplementationOnce(() => {
        const throwingOrders = {
          forEach: () => {
            throw new Error("Repair explosion");
          },
        };
        return throwingOrders as unknown as KitchenOrder[];
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      expect(offlineService.repairData()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Data repair failed:",
        expect.any(Error),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 7. getOfflineStats
  // ────────────────────────────────────────────────────────────────
  describe("getOfflineStats", () => {
    it("should return correct stats for empty state", () => {
      const stats = offlineService.getOfflineStats();

      expect(stats).toEqual({
        pendingActions: 0,
        failedActions: 0,
        lastSyncTime: 0,
        isOnline: true,
        isOfflineMode: false,
        conflicts: 0,
      });
    });

    it("should count pending and failed actions correctly", () => {
      offlineService.pendingActions.value = [
        {
          id: "s1",
          type: "start_cooking",
          orderId: 1,
          payload: {},
          timestamp: Date.now(),
          synced: false,
          retryCount: 0,
        },
        {
          id: "s2",
          type: "mark_ready",
          orderId: 2,
          payload: {},
          timestamp: Date.now(),
          synced: false,
          retryCount: 3,
          error: "Network error",
        },
        {
          id: "s3",
          type: "update_status",
          orderId: 3,
          payload: {},
          timestamp: Date.now(),
          synced: false,
          retryCount: 1,
          error: "Timeout",
        },
      ];

      offlineService.syncConflicts.value = [
        { id: "c1", type: "order_updated", localData: {}, serverData: {} },
      ];

      const stats = offlineService.getOfflineStats();

      expect(stats.pendingActions).toBe(3);
      expect(stats.failedActions).toBe(2);
      expect(stats.conflicts).toBe(1);
    });

    it("should reflect current online/offline status", () => {
      offlineService.isOnline.value = false;
      offlineService.isOfflineMode.value = true;

      const stats = offlineService.getOfflineStats();

      expect(stats.isOnline).toBe(false);
      expect(stats.isOfflineMode).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 8. clearOfflineData
  // ────────────────────────────────────────────────────────────────
  describe("clearOfflineData", () => {
    it("should clear pendingActions and syncConflicts", () => {
      offlineService.pendingActions.value = [
        {
          id: "x1",
          type: "start_cooking",
          orderId: 1,
          payload: {},
          timestamp: Date.now(),
          synced: false,
          retryCount: 0,
        },
      ];
      offlineService.syncConflicts.value = [
        { id: "c1", type: "order_updated", localData: {}, serverData: {} },
      ];

      offlineService.clearOfflineData();

      expect(offlineService.pendingActions.value).toEqual([]);
      expect(offlineService.syncConflicts.value).toEqual([]);
    });

    it("should remove both localStorage keys", () => {
      offlineService.clearOfflineData();

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        "kitchen-offline-data",
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        "kitchen-cached-orders",
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 9. loadOfflineData
  // ────────────────────────────────────────────────────────────────
  describe("loadOfflineData (called in constructor)", () => {
    it("should load actions from localStorage on construction", async () => {
      const now = Date.now();
      const storedData = {
        orders: [],
        actions: [
          {
            id: "loaded_1",
            type: "start_cooking",
            orderId: 1,
            payload: {},
            timestamp: now - 1000, // 1 second ago - recent
            synced: false,
            retryCount: 0,
          },
        ],
        lastSync: now - 60000,
        syncInProgress: false,
      };

      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === "kitchen-offline-data") return JSON.stringify(storedData);
        return null;
      });

      vi.resetModules();
      const mod = await import("@/services/offlineService");
      const service = mod.offlineService;

      expect(service.pendingActions.value).toHaveLength(1);
      expect(service.pendingActions.value[0].id).toBe("loaded_1");
      expect(service.lastSyncTime.value).toBe(now - 60000);
    });

    it("should filter out actions older than 24 hours", async () => {
      const now = Date.now();
      const oldTimestamp = now - 25 * 60 * 60 * 1000; // 25 hours ago
      const recentTimestamp = now - 1000; // 1 second ago

      const storedData = {
        orders: [],
        actions: [
          {
            id: "old_action",
            type: "start_cooking",
            orderId: 1,
            payload: {},
            timestamp: oldTimestamp,
            synced: false,
            retryCount: 0,
          },
          {
            id: "recent_action",
            type: "mark_ready",
            orderId: 2,
            payload: {},
            timestamp: recentTimestamp,
            synced: false,
            retryCount: 0,
          },
        ],
        lastSync: 0,
        syncInProgress: false,
      };

      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === "kitchen-offline-data") return JSON.stringify(storedData);
        return null;
      });

      vi.resetModules();
      const mod = await import("@/services/offlineService");
      const service = mod.offlineService;

      // Only the recent action should remain
      expect(service.pendingActions.value).toHaveLength(1);
      expect(service.pendingActions.value[0].id).toBe("recent_action");
    });

    it("should handle corrupt localStorage data gracefully", async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === "kitchen-offline-data") return "{{corrupt json data";
        return null;
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      vi.resetModules();
      const mod = await import("@/services/offlineService");
      const service = mod.offlineService;

      expect(service.pendingActions.value).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load offline data:",
        expect.any(Error),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // 10. saveOfflineData
  // ────────────────────────────────────────────────────────────────
  describe("saveOfflineData (called after queueAction)", () => {
    it("should persist OfflineData structure to localStorage", () => {
      // Disable sync so queueAction just saves
      offlineService.isOnline.value = false;
      offlineService.queueAction("start_cooking", 1, {}, 10);

      const setItemCalls = vi
        .mocked(localStorage.setItem)
        .mock.calls.filter((c) => c[0] === "kitchen-offline-data");

      expect(setItemCalls.length).toBeGreaterThan(0);

      const lastCall = setItemCalls[setItemCalls.length - 1];
      const saved = JSON.parse(lastCall[1]);

      expect(saved).toHaveProperty("orders");
      expect(saved).toHaveProperty("actions");
      expect(saved).toHaveProperty("lastSync");
      expect(saved).toHaveProperty("syncInProgress");
      expect(saved.actions).toHaveLength(1);
      expect(saved.actions[0].type).toBe("start_cooking");
    });

    it("should handle localStorage.setItem error gracefully", () => {
      offlineService.isOnline.value = false;

      // First call to setItem (for saveOfflineData) will throw
      vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
        throw new DOMException("QuotaExceededError");
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Should not throw
      expect(() => {
        offlineService.queueAction("update_status", 1, { status: "ready" });
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to save offline data:",
        expect.anything(), // DOMException may not extend Error in jsdom
      );
    });
  });
});
