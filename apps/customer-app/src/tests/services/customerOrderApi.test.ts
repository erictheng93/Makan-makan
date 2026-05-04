import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/i18n", () => ({
  i18n: { global: { t: (k: string) => k } },
}));

import { customerOrderApi } from "@/services/customerOrderApi";
import { apiClient } from "@/services/api";
import type { OrderStatus } from "@makanmasak/shared-types";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>;

describe("customerOrderApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMyOrders", () => {
    it("should GET /customers/me/orders without params", async () => {
      mockGet.mockResolvedValueOnce({
        orders: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      const result = await customerOrderApi.getMyOrders();

      expect(mockGet).toHaveBeenCalledWith("/customers/me/orders");
      expect(result.orders).toEqual([]);
    });

    it("should include page and limit params", async () => {
      mockGet.mockResolvedValueOnce({
        orders: [],
        pagination: { page: 2, limit: 20, total: 50, totalPages: 3 },
      });

      await customerOrderApi.getMyOrders({ page: 2, limit: 20 });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("page=2");
      expect(url).toContain("limit=20");
    });

    it("should handle single status filter", async () => {
      mockGet.mockResolvedValueOnce({
        orders: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      await customerOrderApi.getMyOrders({ status: "confirmed" });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("status=confirmed");
    });

    it("should handle array status filter", async () => {
      mockGet.mockResolvedValueOnce({
        orders: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      const statuses: OrderStatus[] = ["pending", "confirmed"];
      await customerOrderApi.getMyOrders({ status: statuses });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("status=pending");
      expect(url).toContain("status=confirmed");
    });

    it("should include date range params", async () => {
      mockGet.mockResolvedValueOnce({
        orders: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      await customerOrderApi.getMyOrders({
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
      });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain("dateFrom=2026-01-01");
      expect(url).toContain("dateTo=2026-01-31");
    });
  });

  describe("getOrderDetail", () => {
    it("should GET /orders/:id", async () => {
      mockGet.mockResolvedValueOnce({ id: 5, status: "confirmed" });

      const result = await customerOrderApi.getOrderDetail(5);

      expect(mockGet).toHaveBeenCalledWith("/orders/5");
      expect(result.id).toBe(5);
    });
  });

  describe("cancelOrder", () => {
    it("should DELETE /orders/:id without reason", async () => {
      mockDelete.mockResolvedValueOnce({ id: 1, status: "cancelled" });

      await customerOrderApi.cancelOrder(1);

      expect(mockDelete).toHaveBeenCalledWith("/orders/1");
    });

    it("should DELETE /orders/:id with encoded reason", async () => {
      mockDelete.mockResolvedValueOnce({ id: 1, status: "cancelled" });

      await customerOrderApi.cancelOrder(1, "Too slow");

      const url = mockDelete.mock.calls[0][0] as string;
      expect(url).toContain("reason=Too%20slow");
    });
  });

  describe("getOrderReceipt", () => {
    it("should GET /orders/:id/receipt", async () => {
      mockGet.mockResolvedValueOnce({ orderNumber: "ORD-001" });

      const result = await customerOrderApi.getOrderReceipt(1);

      expect(mockGet).toHaveBeenCalledWith("/orders/1/receipt");
      expect(result.orderNumber).toBe("ORD-001");
    });
  });

  describe("getMyProfile", () => {
    it("should GET /customers/me", async () => {
      mockGet.mockResolvedValueOnce({
        id: 1,
        username: "testuser",
        fullName: "Test",
        role: 5,
      });

      const result = await customerOrderApi.getMyProfile();

      expect(mockGet).toHaveBeenCalledWith("/customers/me");
      expect(result.username).toBe("testuser");
    });
  });
});
