/**
 * Orders Permissions Tests
 * 測試訂單權限檢查和狀態轉換驗證
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Env } from "../../../shared/types";
import { OrdersService } from "../services/OrdersService";
import { OrderStatus } from "@makanmakan/shared-types";
import type { UserRole } from "../../../shared/constants";

// Mock services
const mockOrderServiceInstance = {
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  getOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  cancelOrder: vi.fn(),
  getDailyOrderStats: vi.fn(),
};

const mockCouponServiceInstance = {
  validateCoupon: vi.fn(),
};

const mockRealtimeBroadcastServiceInstance = {
  broadcastNewOrder: vi.fn().mockResolvedValue({
    success: true,
    eventId: "evt_test",
    recipientCount: 1,
  }),
  broadcastOrderStatusUpdate: vi.fn().mockResolvedValue({
    success: true,
    eventId: "evt_test",
    recipientCount: 1,
  }),
  generateEventId: vi.fn(() => "evt_test_123"),
};

const mockCacheKV = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
};

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockEnv: Env = {
  NODE_ENV: "test",
  JWT_SECRET: "test-jwt-secret-key-for-testing-only",
  API_VERSION: "v1",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
  DB: {} as any,
  CACHE_KV: mockCacheKV as any,
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: { writeDataPoint: vi.fn() } as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any,
  API_BASE_URL: "http://localhost:8787",
  INTERNAL_API_TOKEN: "test-token",
  SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
  CLOUDFLARE_IMAGES_KEY: "test-key",
};

// User role constants
const ROLES = {
  ADMIN: 0 as UserRole,
  OWNER: 1 as UserRole,
  CHEF: 2 as UserRole,
  SERVICE: 3 as UserRole,
  CASHIER: 4 as UserRole,
};

describe("Orders Permissions", () => {
  let ordersService: OrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    ordersService = new OrdersService(mockEnv);

    // Replace internal services with mocks
    ordersService["baseOrderService"] = mockOrderServiceInstance as any;
    ordersService["couponService"] = mockCouponServiceInstance as any;
    ordersService["realtimeBroadcastService"] =
      mockRealtimeBroadcastServiceInstance as any;
    ordersService["cacheKV"] = mockCacheKV;
    ordersService["logger"] = mockLogger as any;
  });

  describe("checkOrderPermissions", () => {
    describe("Admin Role (0)", () => {
      it("should have full permissions", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.ADMIN,
        );

        expect(permissions.canView).toBe(true);
        expect(permissions.canCreate).toBe(true);
        expect(permissions.canUpdate).toBe(true);
        expect(permissions.canCancel).toBe(true);
        expect(permissions.canUpdateStatus).toBe(true);
        expect(permissions.canUpdatePayment).toBe(true);
        expect(permissions.canViewAllRestaurants).toBe(true);
        expect(permissions.canManageItems).toBe(true);
        expect(permissions.canViewAnalytics).toBe(true);
      });

      it("should have all status transitions allowed", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.ADMIN,
        );

        expect(permissions.allowedStatusTransitions).toBeDefined();
        expect(Array.isArray(permissions.allowedStatusTransitions)).toBe(true);
      });
    });

    describe("Owner Role (1)", () => {
      it("should have management permissions", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.OWNER,
        );

        expect(permissions.canView).toBe(true);
        expect(permissions.canCreate).toBe(true);
        expect(permissions.canUpdate).toBe(true);
        expect(permissions.canCancel).toBe(true);
        expect(permissions.canUpdateStatus).toBe(true);
        expect(permissions.canUpdatePayment).toBe(true);
        expect(permissions.canManageItems).toBe(true);
        expect(permissions.canViewAnalytics).toBe(true);
      });

      it("should not view all restaurants", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.OWNER,
        );

        expect(permissions.canViewAllRestaurants).toBe(false);
      });
    });

    describe("Chef Role (2)", () => {
      it("should have kitchen-related permissions", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.CHEF,
        );

        expect(permissions.canView).toBe(true);
        expect(permissions.canCreate).toBe(true);
        expect(permissions.canUpdateStatus).toBe(true);
      });

      it("should not have management permissions", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.CHEF,
        );

        expect(permissions.canUpdate).toBe(false);
        expect(permissions.canCancel).toBe(false);
        expect(permissions.canViewAllRestaurants).toBe(false);
        expect(permissions.canManageItems).toBe(false);
        expect(permissions.canViewAnalytics).toBe(false);
      });
    });

    describe("Service Role (3)", () => {
      it("should have service-related permissions", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.SERVICE,
        );

        expect(permissions.canView).toBe(true);
        expect(permissions.canCreate).toBe(true);
        expect(permissions.canUpdateStatus).toBe(true);
      });

      it("should not have payment permissions", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.SERVICE,
        );

        expect(permissions.canUpdatePayment).toBe(false);
      });
    });

    describe("Cashier Role (4)", () => {
      it("should have payment permissions", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.CASHIER,
        );

        expect(permissions.canView).toBe(true);
        expect(permissions.canCreate).toBe(true);
        expect(permissions.canUpdateStatus).toBe(true);
        expect(permissions.canUpdatePayment).toBe(true);
      });

      it("should not have management permissions", async () => {
        const permissions = await ordersService.checkOrderPermissions(
          1,
          ROLES.CASHIER,
        );

        expect(permissions.canUpdate).toBe(false);
        expect(permissions.canCancel).toBe(false);
        expect(permissions.canManageItems).toBe(false);
      });
    });
  });

  describe("Status Transition Validation", () => {
    const createMockOrder = (status: string) => ({
      id: 1,
      restaurantId: "1",
      orderNumber: "ORD-001",
      status,
      totalAmount: 1000,
      subtotal: 900,
      taxAmount: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    });

    describe("Valid Transitions", () => {
      it("should allow pending -> confirmed", async () => {
        mockCacheKV.get.mockResolvedValueOnce(createMockOrder("pending"));
        mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({
          ...createMockOrder("pending"),
          status: "confirmed",
        });

        const result = await ordersService.updateOrderStatus(1, {
          status: "confirmed" as any,
        });

        expect(result?.status).toBe("confirmed");
      });

      it("should allow confirmed -> preparing", async () => {
        mockCacheKV.get.mockResolvedValueOnce(createMockOrder("confirmed"));
        mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({
          ...createMockOrder("confirmed"),
          status: "preparing",
        });

        const result = await ordersService.updateOrderStatus(1, {
          status: "preparing" as any,
        });

        expect(result?.status).toBe("preparing");
      });

      it("should allow preparing -> ready", async () => {
        mockCacheKV.get.mockResolvedValueOnce(createMockOrder("preparing"));
        mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({
          ...createMockOrder("preparing"),
          status: "ready",
        });

        const result = await ordersService.updateOrderStatus(1, {
          status: "ready" as any,
        });

        expect(result?.status).toBe("ready");
      });

      it("should allow ready -> delivered", async () => {
        mockCacheKV.get.mockResolvedValueOnce(createMockOrder("ready"));
        mockOrderServiceInstance.updateOrderStatus.mockResolvedValue({
          ...createMockOrder("ready"),
          status: "delivered",
        });

        const result = await ordersService.updateOrderStatus(1, {
          status: "delivered" as any,
        });

        expect(result?.status).toBe("delivered");
      });
    });

    describe("Invalid Transitions", () => {
      it("should reject delivered -> pending", async () => {
        mockCacheKV.get.mockResolvedValueOnce(createMockOrder("delivered"));

        await expect(
          ordersService.updateOrderStatus(1, { status: "pending" as any }),
        ).rejects.toThrow();
      });

      it("should reject cancelled -> any status", async () => {
        mockCacheKV.get.mockResolvedValueOnce(createMockOrder("cancelled"));

        await expect(
          ordersService.updateOrderStatus(1, { status: "confirmed" as any }),
        ).rejects.toThrow();
      });
    });

    describe("Cancellation Rules", () => {
      it("should allow cancelling pending orders", async () => {
        mockOrderServiceInstance.cancelOrder.mockResolvedValue({
          ...createMockOrder("pending"),
          status: "cancelled",
        });

        const result = await ordersService.cancelOrder(1, "Customer request");

        expect(result?.status).toBe("cancelled");
      });

      it("should allow cancelling confirmed orders", async () => {
        mockOrderServiceInstance.cancelOrder.mockResolvedValue({
          ...createMockOrder("confirmed"),
          status: "cancelled",
        });

        const result = await ordersService.cancelOrder(1, "Out of stock");

        expect(result?.status).toBe("cancelled");
      });
    });
  });

  describe("Order Access Control", () => {
    const mockOrder = {
      id: 1,
      restaurantId: "1",
      orderNumber: "ORD-001",
      status: "pending",
      totalAmount: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };

    it("should allow owner to access their restaurant orders", async () => {
      mockOrderServiceInstance.getOrders.mockResolvedValue({
        orders: [mockOrder],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await ordersService.getOrders(
        { restaurantId: "1" },
        1, // userId
        ROLES.OWNER,
      );

      expect(result.orders).toHaveLength(1);
    });

    it("should filter orders by user restaurant for non-admin", async () => {
      mockOrderServiceInstance.getOrders.mockResolvedValue({
        orders: [mockOrder],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      await ordersService.getOrders({ restaurantId: "1" }, 1, ROLES.CHEF);

      expect(mockOrderServiceInstance.getOrders).toHaveBeenCalled();
    });
  });

  describe("Delete Order Permissions", () => {
    it("should only allow deleting pending orders", async () => {
      const pendingOrder = {
        id: 1,
        restaurantId: "1",
        status: "pending",
        totalAmount: 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      };

      mockCacheKV.get.mockResolvedValueOnce(null);
      mockOrderServiceInstance.getOrder.mockResolvedValueOnce(pendingOrder);
      mockOrderServiceInstance.cancelOrder.mockResolvedValue({
        ...pendingOrder,
        status: "cancelled",
      });

      const result = await ordersService.deleteOrder(1, 1);

      expect(result).toBe(true);
    });

    it("should reject deleting non-pending orders", async () => {
      const confirmedOrder = {
        id: 1,
        restaurantId: "1",
        status: "confirmed",
        totalAmount: 1000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      };

      mockCacheKV.get.mockResolvedValueOnce(null);
      mockOrderServiceInstance.getOrder.mockResolvedValueOnce(confirmedOrder);

      await expect(ordersService.deleteOrder(1, 1)).rejects.toThrow(
        "Only pending orders can be deleted",
      );
    });

    it("should return false for non-existent orders", async () => {
      mockCacheKV.get.mockResolvedValueOnce(null);
      mockOrderServiceInstance.getOrder.mockResolvedValueOnce(null);

      const result = await ordersService.deleteOrder(999, 1);

      expect(result).toBe(false);
    });
  });
});
