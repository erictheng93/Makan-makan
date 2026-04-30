/**
 * Kitchen Service Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { KitchenService } from "../services/KitchenService";

// Mock dependencies - use hoisted mock function for flexibility
const mockGetOrders = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    orders: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  }),
);
const mockGetDailyStats = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ completedToday: 0, cancelledToday: 0 }),
);
const mockUpdateItemStatus = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("../../orders/services/OrdersService", () => {
  return {
    OrdersService: class MockOrdersService {
      getOrders = mockGetOrders;
      getDailyStats = mockGetDailyStats;
      updateItemStatus = mockUpdateItemStatus;
    },
  };
});

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  }),
}));

// Mock environment
const createMockEnv = () => ({
  NODE_ENV: "test",
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    })),
  },
  CACHE_KV: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
});

describe("KitchenService", () => {
  let service: KitchenService;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    service = new KitchenService(mockEnv as unknown as ApiTestEnv);
  });

  describe("Kitchen Operations", () => {
    describe("getKitchenOrders", () => {
      it("should fetch and transform kitchen orders", async () => {
        mockGetOrders.mockResolvedValue({
          orders: [
            {
              id: 1,
              orderNumber: "ORD-001",
              tableId: 5,
              status: "confirmed",
              items: [
                {
                  id: 1,
                  menuItem: { name: "Nasi Lemak" },
                  quantity: 2,
                  status: "pending",
                  notes: "",
                },
              ],
              customerInfo: { name: "John" },
              notes: "No spicy",
              createdAt: new Date().toISOString(),
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });

        const result = await service.getKitchenOrders("test-restaurant-1", 100);

        expect(result).toHaveProperty("pending");
        expect(result).toHaveProperty("preparing");
        expect(result).toHaveProperty("ready");
        expect(result).toHaveProperty("stats");
      });

      it("should handle empty orders", async () => {
        mockGetOrders.mockResolvedValue({
          orders: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });

        const result = await service.getKitchenOrders("test-restaurant-1", 100);

        expect(result).toHaveProperty("pending");
        expect(result).toHaveProperty("preparing");
        expect(result).toHaveProperty("ready");
        expect(result).toHaveProperty("stats");
      });
    });

    describe("updateOrderItemStatus", () => {
      it("should update item status and return result", async () => {
        const result = await service.updateOrderItemStatus(
          "test-restaurant-1",
          100,
          50,
          { status: "preparing", notes: "Started cooking" },
          100,
        );

        expect(result.orderId).toBe(100);
        expect(result.itemId).toBe(50);
        expect(result.status).toBe("preparing");
        expect(result.updatedAt).toBeDefined();
        expect(mockUpdateItemStatus).toHaveBeenCalledOnce();
        expect(mockUpdateItemStatus).toHaveBeenCalledWith(
          50,
          "preparing",
          "Started cooking",
        );
      });

      it("should handle update without notes", async () => {
        const result = await service.updateOrderItemStatus(
          "test-restaurant-1",
          100,
          50,
          { status: "ready" },
          100,
        );

        expect(result.status).toBe("ready");
        expect(mockUpdateItemStatus).toHaveBeenCalledWith(
          50,
          "ready",
          undefined,
        );
      });
    });
  });

  describe("validateChefAccess", () => {
    it("should allow admin (role 0)", () => {
      expect(service.validateChefAccess(1, 0, "test-restaurant-1")).toBe(true);
    });

    it("should allow owner (role 1)", () => {
      expect(service.validateChefAccess(1, 1, "test-restaurant-1")).toBe(true);
    });

    it("should allow chef (role 2)", () => {
      expect(service.validateChefAccess(1, 2, "test-restaurant-1")).toBe(true);
    });

    it("should allow service crew (role 3)", () => {
      expect(service.validateChefAccess(1, 3, "test-restaurant-1")).toBe(true);
    });

    it("should deny cashier (role 4)", () => {
      expect(service.validateChefAccess(1, 4, "test-restaurant-1")).toBe(false);
    });

    it("should deny customer (role 5)", () => {
      expect(service.validateChefAccess(1, 5, "test-restaurant-1")).toBe(false);
    });

    it("should deny unknown roles", () => {
      expect(service.validateChefAccess(1, 99, "test-restaurant-1")).toBe(
        false,
      );
    });
  });
});
