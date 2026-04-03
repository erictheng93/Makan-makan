import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock api client
vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock i18n
vi.mock("@/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));

import { orderApi } from "@/services/orderApi";
import { apiClient } from "@/services/api";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>;

describe("orderApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockClear();
  });

  describe("createOrder", () => {
    it("should POST to /orders with order data", async () => {
      const orderData = { restaurantId: "r1", items: [] } as any;
      const mockOrder = { id: 1, status: "pending" };
      mockPost.mockResolvedValueOnce(mockOrder);

      const result = await orderApi.createOrder(orderData);

      expect(mockPost).toHaveBeenCalledOnce();
      expect(mockPost).toHaveBeenCalledWith("/orders", orderData);
      expect(result).toEqual(mockOrder);
    });
  });

  describe("createGuestOrder", () => {
    it("should POST to /guest-orders and store guest token", async () => {
      const orderData = {
        restaurantId: "r1",
        guestName: "Guest",
        phoneLastDigits: "1234",
        orderType: "shop" as const,
        items: [],
      };
      const mockResponse = {
        order: { id: 1 },
        guestToken: "guest-token-123",
        tokenExpiresAt: "2026-01-01",
      };
      mockPost.mockResolvedValueOnce(mockResponse);

      const result = await orderApi.createGuestOrder(orderData);

      expect(mockPost).toHaveBeenCalledWith("/guest-orders", orderData);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "guest_auth_token",
        "guest-token-123",
      );
      expect(result.guestToken).toBe("guest-token-123");
    });
  });

  describe("getOrder", () => {
    it("should GET /orders/:id", async () => {
      const mockOrder = { id: 42, status: "confirmed" };
      mockGet.mockResolvedValueOnce(mockOrder);

      const result = await orderApi.getOrder(42);

      expect(mockGet).toHaveBeenCalledWith("/orders/42");
      expect(result.id).toBe(42);
    });
  });

  describe("getGuestOrder", () => {
    it("should GET /guest-orders/:id and unwrap order", async () => {
      mockGet.mockResolvedValueOnce({ order: { id: 5, status: "pending" } });

      const result = await orderApi.getGuestOrder(5);

      expect(mockGet).toHaveBeenCalledWith("/guest-orders/5");
      expect(result).toEqual({ id: 5, status: "pending" });
    });
  });

  describe("cancelOrder", () => {
    it("should POST to /orders/:id/cancel with reason", async () => {
      mockPost.mockResolvedValueOnce({ id: 1, status: "cancelled" });

      await orderApi.cancelOrder(1, "Changed my mind");

      expect(mockPost).toHaveBeenCalledWith("/orders/1/cancel", {
        reason: "Changed my mind",
      });
    });
  });

  describe("updateOrderItem", () => {
    it("should PATCH /orders/:id/items/:itemId", async () => {
      mockPatch.mockResolvedValueOnce({ id: 10, quantity: 3 });

      await orderApi.updateOrderItem(1, 10, { quantity: 3 });

      expect(mockPatch).toHaveBeenCalledWith("/orders/1/items/10", {
        quantity: 3,
      });
    });
  });

  describe("addOrderItem", () => {
    it("should POST to /orders/:id/items", async () => {
      const itemData = { menuItemId: 5, quantity: 2 };
      mockPost.mockResolvedValueOnce({ id: 11 });

      await orderApi.addOrderItem(1, itemData);

      expect(mockPost).toHaveBeenCalledWith("/orders/1/items", itemData);
    });
  });

  describe("removeOrderItem", () => {
    it("should DELETE /orders/:id/items/:itemId", async () => {
      mockDelete.mockResolvedValueOnce(undefined);

      await orderApi.removeOrderItem(1, 10);

      expect(mockDelete).toHaveBeenCalledWith("/orders/1/items/10");
    });
  });

  describe("calculateOrderSummary", () => {
    it("should POST to /restaurants/:id/orders/calculate", async () => {
      const items = [{ menuItemId: 1, quantity: 2 }];
      const mockSummary = {
        subtotal: 20,
        tax: 2,
        serviceCharge: 1,
        discount: 0,
        total: 23,
      };
      mockPost.mockResolvedValueOnce(mockSummary);

      const result = await orderApi.calculateOrderSummary("r1", items);

      expect(mockPost).toHaveBeenCalledWith(
        "/restaurants/r1/orders/calculate",
        { items },
      );
      expect(result.total).toBe(23);
    });
  });

  describe("getTableOrderHistory", () => {
    it("should GET with query params", async () => {
      mockGet.mockResolvedValueOnce({
        orders: [],
        total: 0,
        hasMore: false,
      });

      await orderApi.getTableOrderHistory("r1", 5, {
        limit: 10,
        offset: 20,
      });

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining("/restaurants/r1/tables/5/orders"),
      );
      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("limit=10");
      expect(url).toContain("offset=20");
    });
  });

  describe("requestService", () => {
    it("should POST to service-requests endpoint", async () => {
      mockPost.mockResolvedValueOnce({
        id: 1,
        estimatedResponseTime: 5,
        queuePosition: 2,
      });

      const result = await orderApi.requestService("r1", 3, {
        type: "water",
        priority: "normal",
      });

      expect(mockPost).toHaveBeenCalledWith(
        "/restaurants/r1/tables/3/service-requests",
        { type: "water", priority: "normal" },
      );
      expect(result.queuePosition).toBe(2);
    });
  });

  describe("submitOrderReview", () => {
    it("should POST review to /orders/:id/review", async () => {
      mockPost.mockResolvedValueOnce(undefined);

      await orderApi.submitOrderReview(1, { rating: 5, comment: "Great!" });

      expect(mockPost).toHaveBeenCalledWith("/orders/1/review", {
        rating: 5,
        comment: "Great!",
      });
    });
  });

  describe("getTableCurrentOrder", () => {
    it("should return null on 404", async () => {
      mockGet.mockRejectedValueOnce({ status: 404 });

      const result = await orderApi.getTableCurrentOrder("r1", 1);
      expect(result).toBeNull();
    });

    it("should re-throw non-404 errors", async () => {
      mockGet.mockRejectedValueOnce({ status: 500 });

      await expect(orderApi.getTableCurrentOrder("r1", 1)).rejects.toEqual({
        status: 500,
      });
    });
  });
});
