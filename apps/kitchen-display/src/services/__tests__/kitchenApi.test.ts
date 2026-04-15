import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the authApi module (default export is the axios instance)
vi.mock("@/services/authApi", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

import api from "@/services/authApi";
import { kitchenApi } from "@/services/kitchenApi";

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe("kitchenApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ─── getOrders ──────────────────────────────────────────────

  describe("getOrders", () => {
    it("should return orders on success", async () => {
      const ordersData = { orders: [{ id: 1, table: "A1" }] };
      mockApi.get.mockResolvedValue({
        data: {
          data: ordersData,
          timestamp: "2026-01-01T00:00:00Z",
        },
      });

      const result = await kitchenApi.getOrders(42);

      expect(mockApi.get).toHaveBeenCalledWith("/kitchen/42/orders");
      expect(result).toEqual({
        success: true,
        data: ordersData,
        timestamp: "2026-01-01T00:00:00Z",
      });
    });

    it("should return error with response.data.message on failure", async () => {
      const error = {
        response: { data: { message: "Unauthorized" } },
        message: "Request failed",
      };
      mockApi.get.mockRejectedValue(error);

      const result = await kitchenApi.getOrders(42);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
      expect(result.timestamp).toBeDefined();
    });

    it("should return error with error.message when no response data", async () => {
      const error = { message: "Network Error" };
      mockApi.get.mockRejectedValue(error);

      const result = await kitchenApi.getOrders(42);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network Error");
    });

    it("should return default Chinese message when no error details", async () => {
      mockApi.get.mockRejectedValue({});

      const result = await kitchenApi.getOrders(42);

      expect(result.success).toBe(false);
      expect(result.error).toBe("獲取訂單失敗");
    });
  });

  // ─── updateItemStatus ───────────────────────────────────────

  describe("updateItemStatus", () => {
    const request = { status: "preparing" as const, notes: "extra spicy" };

    it("should send PUT request and return data on success", async () => {
      const responseData = { itemId: 5, status: "preparing" };
      mockApi.put.mockResolvedValue({
        data: {
          data: responseData,
          timestamp: "2026-01-01T00:00:00Z",
        },
      });

      const result = await kitchenApi.updateItemStatus(1, 10, 5, request);

      expect(mockApi.put).toHaveBeenCalledWith(
        "/kitchen/1/orders/10/items/5",
        request,
      );
      expect(result).toEqual({
        success: true,
        data: responseData,
        timestamp: "2026-01-01T00:00:00Z",
      });
    });

    it("should return error with response.data.message on failure", async () => {
      const error = {
        response: { data: { message: "Item not found" } },
        message: "Request failed",
      };
      mockApi.put.mockRejectedValue(error);

      const result = await kitchenApi.updateItemStatus(1, 10, 5, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Item not found");
    });

    it("should return error with error.message when no response data", async () => {
      const error = { message: "Timeout" };
      mockApi.put.mockRejectedValue(error);

      const result = await kitchenApi.updateItemStatus(1, 10, 5, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Timeout");
    });

    it("should return default Chinese message when no error details", async () => {
      mockApi.put.mockRejectedValue({});

      const result = await kitchenApi.updateItemStatus(1, 10, 5, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("更新狀態失敗");
    });
  });

  // ─── batchUpdateItemStatus ──────────────────────────────────

  describe("batchUpdateItemStatus", () => {
    it("should resolve all updates and return updatedCount on success", async () => {
      mockApi.put.mockResolvedValue({
        data: {
          data: { status: "preparing" },
          timestamp: "2026-01-01T00:00:00Z",
        },
      });

      const updates = [
        { orderId: 10, itemId: 1, status: "preparing" as const },
        { orderId: 10, itemId: 2, status: "preparing" as const },
      ];

      const result = await kitchenApi.batchUpdateItemStatus(1, updates);

      expect(mockApi.put).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ updatedCount: 2 });
      expect(result.timestamp).toBeDefined();
    });

    it("should report failure count when some updates fail", async () => {
      // First call succeeds, second fails
      mockApi.put
        .mockResolvedValueOnce({
          data: {
            data: { status: "preparing" },
            timestamp: "2026-01-01T00:00:00Z",
          },
        })
        .mockRejectedValueOnce({
          response: { data: { message: "Item locked" } },
        });

      const updates = [
        { orderId: 10, itemId: 1, status: "preparing" as const },
        { orderId: 10, itemId: 2, status: "preparing" as const },
      ];

      const result = await kitchenApi.batchUpdateItemStatus(1, updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe("1 個更新失敗");
    });

    it("should report all failures when every update fails", async () => {
      mockApi.put.mockRejectedValue({ message: "Server Error" });

      const updates = [
        { orderId: 10, itemId: 1, status: "ready" as const },
        { orderId: 10, itemId: 2, status: "ready" as const },
        { orderId: 10, itemId: 3, status: "ready" as const },
      ];

      const result = await kitchenApi.batchUpdateItemStatus(1, updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe("3 個更新失敗");
    });

    it("should handle empty updates array as success", async () => {
      const result = await kitchenApi.batchUpdateItemStatus(1, []);

      expect(mockApi.put).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ updatedCount: 0 });
    });

    it("should pass notes through to individual update calls", async () => {
      mockApi.put.mockResolvedValue({
        data: {
          data: { status: "preparing" },
          timestamp: "2026-01-01T00:00:00Z",
        },
      });

      const updates = [
        {
          orderId: 10,
          itemId: 1,
          status: "preparing" as const,
          notes: "no onion",
        },
      ];

      await kitchenApi.batchUpdateItemStatus(1, updates);

      expect(mockApi.put).toHaveBeenCalledWith("/kitchen/1/orders/10/items/1", {
        status: "preparing",
        notes: "no onion",
      });
    });
  });

  // ─── startCooking ──────────────────────────────────────────

  describe("startCooking", () => {
    it("should call updateItemStatus with 'preparing' status", async () => {
      mockApi.put.mockResolvedValue({
        data: {
          data: { status: "preparing" },
          timestamp: "2026-01-01T00:00:00Z",
        },
      });

      const result = await kitchenApi.startCooking(1, 10, 5);

      expect(mockApi.put).toHaveBeenCalledWith("/kitchen/1/orders/10/items/5", {
        status: "preparing",
      });
      expect(result.success).toBe(true);
    });

    it("should propagate errors from updateItemStatus", async () => {
      mockApi.put.mockRejectedValue({
        response: { data: { message: "Already cooking" } },
      });

      const result = await kitchenApi.startCooking(1, 10, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Already cooking");
    });
  });

  // ─── markItemReady ──────────────────────────────────────────

  describe("markItemReady", () => {
    it("should call updateItemStatus with 'ready' status", async () => {
      mockApi.put.mockResolvedValue({
        data: {
          data: { status: "ready" },
          timestamp: "2026-01-01T00:00:00Z",
        },
      });

      const result = await kitchenApi.markItemReady(1, 10, 5);

      expect(mockApi.put).toHaveBeenCalledWith("/kitchen/1/orders/10/items/5", {
        status: "ready",
      });
      expect(result.success).toBe(true);
    });

    it("should propagate errors from updateItemStatus", async () => {
      mockApi.put.mockRejectedValue({ message: "Not found" });

      const result = await kitchenApi.markItemReady(1, 10, 5);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Not found");
    });
  });

  // ─── startAllItems ──────────────────────────────────────────

  describe("startAllItems", () => {
    it("should batch update all items with 'preparing' status", async () => {
      mockApi.put.mockResolvedValue({
        data: {
          data: { status: "preparing" },
          timestamp: "2026-01-01T00:00:00Z",
        },
      });

      const result = await kitchenApi.startAllItems(1, 10, [1, 2, 3]);

      expect(mockApi.put).toHaveBeenCalledTimes(3);
      expect(mockApi.put).toHaveBeenCalledWith("/kitchen/1/orders/10/items/1", {
        status: "preparing",
      });
      expect(mockApi.put).toHaveBeenCalledWith("/kitchen/1/orders/10/items/2", {
        status: "preparing",
      });
      expect(mockApi.put).toHaveBeenCalledWith("/kitchen/1/orders/10/items/3", {
        status: "preparing",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ updatedCount: 3 });
    });

    it("should handle empty itemIds array", async () => {
      const result = await kitchenApi.startAllItems(1, 10, []);

      expect(mockApi.put).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ updatedCount: 0 });
    });

    it("should report failures from batch operation", async () => {
      mockApi.put
        .mockResolvedValueOnce({
          data: { data: {}, timestamp: "2026-01-01T00:00:00Z" },
        })
        .mockRejectedValueOnce({ message: "Error" });

      const result = await kitchenApi.startAllItems(1, 10, [1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("1 個更新失敗");
    });
  });

  // ─── markAllItemsReady ──────────────────────────────────────

  describe("markAllItemsReady", () => {
    it("should batch update all items with 'ready' status", async () => {
      mockApi.put.mockResolvedValue({
        data: {
          data: { status: "ready" },
          timestamp: "2026-01-01T00:00:00Z",
        },
      });

      const result = await kitchenApi.markAllItemsReady(1, 10, [4, 5]);

      expect(mockApi.put).toHaveBeenCalledTimes(2);
      expect(mockApi.put).toHaveBeenCalledWith("/kitchen/1/orders/10/items/4", {
        status: "ready",
      });
      expect(mockApi.put).toHaveBeenCalledWith("/kitchen/1/orders/10/items/5", {
        status: "ready",
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ updatedCount: 2 });
    });

    it("should handle empty itemIds array", async () => {
      const result = await kitchenApi.markAllItemsReady(1, 10, []);

      expect(mockApi.put).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ updatedCount: 0 });
    });

    it("should report failures from batch operation", async () => {
      mockApi.put.mockRejectedValue({});

      const result = await kitchenApi.markAllItemsReady(1, 10, [1, 2]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("2 個更新失敗");
    });
  });
});
