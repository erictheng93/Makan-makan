/**
 * Order Store Tests
 * 測試訂單 store 的狀態管理
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useOrderStore } from "../order";
import { OrderStatus } from "@/types";
import type { Order } from "@/types";
import { orderFactory, resetAllFactories } from "@makanmakan/testing-utils";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "@/services/api";

function createMockOrder(id: number, status: OrderStatus): Order {
  const fo = orderFactory.build({
    overrides: {
      id,
      status,
      tableId: id,
      totalAmount: 1000 + id * 100,
    },
  });
  return {
    id: fo.id!,
    orderNumber: `ORD-${id.toString().padStart(3, "0")}`,
    tableId: fo.tableId!,
    tableName: `T${id}`,
    status,
    totalAmount: fo.totalAmount,
    createdAt: new Date(fo.createdAt).toISOString(),
    updatedAt: new Date(fo.updatedAt).toISOString(),
    items: [],
  };
}

describe("Order Store", () => {
  beforeEach(() => {
    resetAllFactories();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should have empty orders array", () => {
      const store = useOrderStore();
      expect(store.orders).toEqual([]);
    });

    it("should not be loading", () => {
      const store = useOrderStore();
      expect(store.isLoading).toBe(false);
    });

    it("should have no error", () => {
      const store = useOrderStore();
      expect(store.error).toBeNull();
    });
  });

  describe("Computed Filters", () => {
    it("should filter pending orders", async () => {
      const store = useOrderStore();
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            createMockOrder(1, OrderStatus.PENDING),
            createMockOrder(2, OrderStatus.CONFIRMED),
            createMockOrder(3, OrderStatus.PENDING),
          ],
        },
      });
      await store.fetchOrders();

      expect(store.pendingOrders).toHaveLength(2);
    });

    it("should filter confirmed orders", async () => {
      const store = useOrderStore();
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            createMockOrder(1, OrderStatus.CONFIRMED),
            createMockOrder(2, OrderStatus.PREPARING),
            createMockOrder(3, OrderStatus.CONFIRMED),
          ],
        },
      });
      await store.fetchOrders();

      expect(store.confirmedOrders).toHaveLength(2);
    });

    it("should filter preparing orders", async () => {
      const store = useOrderStore();
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            createMockOrder(1, OrderStatus.PREPARING),
            createMockOrder(2, OrderStatus.READY),
          ],
        },
      });
      await store.fetchOrders();

      expect(store.preparingOrders).toHaveLength(1);
    });

    it("should filter ready orders", async () => {
      const store = useOrderStore();
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            createMockOrder(1, OrderStatus.READY),
            createMockOrder(2, OrderStatus.COMPLETED),
          ],
        },
      });
      await store.fetchOrders();

      expect(store.readyOrders).toHaveLength(1);
    });

    it("should filter completed orders", async () => {
      const store = useOrderStore();
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            createMockOrder(1, OrderStatus.COMPLETED),
            createMockOrder(2, OrderStatus.CANCELLED),
          ],
        },
      });
      await store.fetchOrders();

      expect(store.completedOrders).toHaveLength(1);
    });

    it("should count pending orders", async () => {
      const store = useOrderStore();
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            createMockOrder(1, OrderStatus.PENDING),
            createMockOrder(2, OrderStatus.PENDING),
          ],
        },
      });
      await store.fetchOrders();

      expect(store.pendingOrdersCount).toBe(2);
    });

    it("should count active orders", async () => {
      const store = useOrderStore();
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            createMockOrder(1, OrderStatus.PENDING),
            createMockOrder(2, OrderStatus.CONFIRMED),
            createMockOrder(3, OrderStatus.PREPARING),
            createMockOrder(4, OrderStatus.READY),
            createMockOrder(5, OrderStatus.COMPLETED),
          ],
        },
      });
      await store.fetchOrders();

      expect(store.activeOrdersCount).toBe(4);
    });
  });

  describe("fetchOrders", () => {
    it("should fetch orders successfully", async () => {
      const store = useOrderStore();
      const mockOrders = [
        createMockOrder(1, OrderStatus.PENDING),
        createMockOrder(2, OrderStatus.CONFIRMED),
      ];

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockOrders },
      });

      await store.fetchOrders();

      expect(store.orders).toEqual(mockOrders);
      expect(store.error).toBeNull();
    });

    it("should set loading state during fetch", async () => {
      const store = useOrderStore();

      vi.mocked(api.get).mockImplementation(() => {
        expect(store.isLoading).toBe(true);
        return Promise.resolve({
          data: { success: true, data: [] },
        });
      });

      await store.fetchOrders();
      expect(store.isLoading).toBe(false);
    });

    it("should handle fetch with status filter", async () => {
      const store = useOrderStore();

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [] },
      });

      await store.fetchOrders({
        status: [OrderStatus.PENDING, OrderStatus.CONFIRMED],
      });

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining("status="));
    });

    it("should handle fetch with pagination", async () => {
      const store = useOrderStore();

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [] },
      });

      await store.fetchOrders({ page: 2, limit: 20 });

      expect(api.get).toHaveBeenCalledWith(expect.stringContaining("page=2"));
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining("limit=20"));
    });

    it("should handle fetch error", async () => {
      const store = useOrderStore();

      vi.mocked(api.get).mockRejectedValue({
        response: {
          data: { error: { message: "Fetch failed" } },
        },
      });

      await store.fetchOrders();

      expect(store.error).toBe("Fetch failed");
      expect(store.isLoading).toBe(false);
    });
  });

  describe("updateOrderStatus", () => {
    it("should update order status successfully", async () => {
      const store = useOrderStore();
      const mockOrder = createMockOrder(1, OrderStatus.PENDING);

      // 先透過 fetchOrders 填充 orders
      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [mockOrder] },
      });
      await store.fetchOrders();

      vi.mocked(api.patch).mockResolvedValue({
        data: { success: true },
      });

      const result = await store.updateOrderStatus(1, OrderStatus.CONFIRMED);

      expect(result).toBe(true);
      expect(store.orders[0].status).toBe(OrderStatus.CONFIRMED);
    });

    it("should update completedAt when status is completed", async () => {
      const store = useOrderStore();
      const mockOrder = createMockOrder(1, OrderStatus.READY);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [mockOrder] },
      });
      await store.fetchOrders();

      vi.mocked(api.patch).mockResolvedValue({
        data: { success: true },
      });

      await store.updateOrderStatus(1, "completed");

      expect(store.orders[0].completedAt).toBeDefined();
    });

    it("should handle update error", async () => {
      const store = useOrderStore();
      const mockOrder = createMockOrder(1, OrderStatus.PENDING);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [mockOrder] },
      });
      await store.fetchOrders();

      vi.mocked(api.patch).mockRejectedValue(new Error("Update failed"));

      const result = await store.updateOrderStatus(1, OrderStatus.CONFIRMED);

      expect(result).toBe(false);
      expect(store.orders[0].status).toBe(OrderStatus.PENDING);
    });

    it("should not update if order not found", async () => {
      const store = useOrderStore();
      const mockOrder = createMockOrder(1, OrderStatus.PENDING);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [mockOrder] },
      });
      await store.fetchOrders();

      vi.mocked(api.patch).mockResolvedValue({
        data: { success: true },
      });

      await store.updateOrderStatus(999, OrderStatus.CONFIRMED);

      expect(store.orders[0].status).toBe(OrderStatus.PENDING);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty orders array", () => {
      const store = useOrderStore();

      expect(store.pendingOrders).toEqual([]);
      expect(store.activeOrdersCount).toBe(0);
    });

    it("should handle all orders with same status", async () => {
      const store = useOrderStore();
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            createMockOrder(1, OrderStatus.COMPLETED),
            createMockOrder(2, OrderStatus.COMPLETED),
            createMockOrder(3, OrderStatus.COMPLETED),
          ],
        },
      });
      await store.fetchOrders();

      expect(store.completedOrders).toHaveLength(3);
      expect(store.activeOrdersCount).toBe(0);
    });

    it("should handle concurrent status updates", async () => {
      const store = useOrderStore();
      const mockOrders = [
        createMockOrder(1, OrderStatus.PENDING),
        createMockOrder(2, OrderStatus.PENDING),
      ];

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockOrders },
      });
      await store.fetchOrders();

      vi.mocked(api.patch).mockResolvedValue({
        data: { success: true },
      });

      await Promise.all([
        store.updateOrderStatus(1, OrderStatus.CONFIRMED),
        store.updateOrderStatus(2, OrderStatus.CONFIRMED),
      ]);

      expect(store.orders[0].status).toBe(OrderStatus.CONFIRMED);
      expect(store.orders[1].status).toBe(OrderStatus.CONFIRMED);
    });
  });
});
