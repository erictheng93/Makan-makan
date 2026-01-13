/**
 * Kitchen Service Tests
 * 廚房服務層測試 - 提升覆蓋率
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KitchenService } from "../services/KitchenService";
import type { KitchenConnection, KitchenSSEEvent } from "../types";

// Mock dependencies - use hoisted mock function for flexibility
const mockGetOrders = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    orders: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  }),
);

vi.mock("../../orders/services/OrdersService", () => {
  return {
    OrdersService: class MockOrdersService {
      getOrders = mockGetOrders;
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
    service = new KitchenService(mockEnv as any);
  });

  afterEach(() => {
    service.destroy();
  });

  describe("Connection Management", () => {
    describe("registerConnection", () => {
      it("should register a new connection", () => {
        const connectionId = "test-conn-1";
        const connection: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now(),
        };

        service.registerConnection(connectionId, connection);
        const status = service.getConnectionStatus(1);

        expect(status.restaurantConnections).toBe(1);
        expect(status.connections[0].id).toBe(connectionId);
      });

      it("should handle multiple connections for same restaurant", () => {
        const conn1: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now(),
        };
        const conn2: KitchenConnection = {
          restaurantId: 1,
          userId: 101,
          controller: null as any,
          lastHeartbeat: Date.now(),
        };

        service.registerConnection("conn-1", conn1);
        service.registerConnection("conn-2", conn2);

        const status = service.getConnectionStatus(1);
        expect(status.restaurantConnections).toBe(2);
      });

      it("should handle connections for different restaurants", () => {
        const conn1: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now(),
        };
        const conn2: KitchenConnection = {
          restaurantId: 2,
          userId: 200,
          controller: null as any,
          lastHeartbeat: Date.now(),
        };

        service.registerConnection("conn-1", conn1);
        service.registerConnection("conn-2", conn2);

        expect(service.getConnectionStatus(1).restaurantConnections).toBe(1);
        expect(service.getConnectionStatus(2).restaurantConnections).toBe(1);
      });
    });

    describe("removeConnection", () => {
      it("should remove an existing connection", () => {
        const connection: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now(),
        };

        service.registerConnection("conn-1", connection);
        expect(service.getConnectionStatus(1).restaurantConnections).toBe(1);

        service.removeConnection("conn-1");
        expect(service.getConnectionStatus(1).restaurantConnections).toBe(0);
      });

      it("should handle removing non-existent connection gracefully", () => {
        expect(() => service.removeConnection("non-existent")).not.toThrow();
      });
    });

    describe("cleanupExpiredConnections", () => {
      it("should remove connections older than 5 minutes", () => {
        const oldConnection: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now() - 6 * 60 * 1000, // 6 minutes ago
        };
        const newConnection: KitchenConnection = {
          restaurantId: 1,
          userId: 101,
          controller: null as any,
          lastHeartbeat: Date.now(),
        };

        service.registerConnection("old-conn", oldConnection);
        service.registerConnection("new-conn", newConnection);

        service.cleanupExpiredConnections();

        const status = service.getConnectionStatus(1);
        expect(status.restaurantConnections).toBe(1);
        expect(status.connections[0].id).toBe("new-conn");
      });

      it("should keep connections within timeout", () => {
        const connection: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now() - 2 * 60 * 1000, // 2 minutes ago
        };

        service.registerConnection("conn-1", connection);
        service.cleanupExpiredConnections();

        expect(service.getConnectionStatus(1).restaurantConnections).toBe(1);
      });
    });

    describe("getConnectionStatus", () => {
      it("should return correct status for restaurant", () => {
        const connection: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now(),
        };

        service.registerConnection("conn-1", connection);
        const status = service.getConnectionStatus(1);

        expect(status.totalConnections).toBe(1);
        expect(status.restaurantConnections).toBe(1);
        expect(status.connections).toHaveLength(1);
        expect(status.connections[0].userId).toBe(100);
        expect(status.connections[0].connected).toBe(true);
      });

      it("should mark old connections as disconnected", () => {
        const connection: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now() - 2 * 60 * 1000, // 2 minutes ago
        };

        service.registerConnection("conn-1", connection);
        const status = service.getConnectionStatus(1);

        expect(status.connections[0].connected).toBe(false);
      });

      it("should return empty status for restaurant with no connections", () => {
        const status = service.getConnectionStatus(999);

        expect(status.restaurantConnections).toBe(0);
        expect(status.connections).toHaveLength(0);
      });
    });
  });

  describe("Broadcasting", () => {
    describe("broadcastToKitchen", () => {
      it("should broadcast event to all restaurant connections", () => {
        const mockWriteSSE = vi.fn();
        const connection: KitchenConnection = {
          restaurantId: 1,
          userId: 100,
          controller: { writeSSE: mockWriteSSE } as any,
          lastHeartbeat: Date.now(),
        };

        service.registerConnection("conn-1", connection);

        const event: KitchenSSEEvent = {
          id: "event-1",
          event: "test",
          data: {
            type: "NEW_ORDER",
            timestamp: new Date().toISOString(),
            restaurantId: 1,
          },
        };

        const sentCount = service.broadcastToKitchen(1, event);

        expect(sentCount).toBe(1);
        expect(mockWriteSSE).toHaveBeenCalled();
      });

      it("should not broadcast to other restaurants", () => {
        const mockWriteSSE1 = vi.fn();
        const mockWriteSSE2 = vi.fn();

        service.registerConnection("conn-1", {
          restaurantId: 1,
          userId: 100,
          controller: { writeSSE: mockWriteSSE1 } as any,
          lastHeartbeat: Date.now(),
        });
        service.registerConnection("conn-2", {
          restaurantId: 2,
          userId: 200,
          controller: { writeSSE: mockWriteSSE2 } as any,
          lastHeartbeat: Date.now(),
        });

        const event: KitchenSSEEvent = {
          data: {
            type: "NEW_ORDER",
            timestamp: new Date().toISOString(),
            restaurantId: 1,
          },
        };

        service.broadcastToKitchen(1, event);

        expect(mockWriteSSE1).toHaveBeenCalled();
        expect(mockWriteSSE2).not.toHaveBeenCalled();
      });

      it("should remove failed connections during broadcast", () => {
        const mockWriteSSE = vi.fn().mockImplementation(() => {
          throw new Error("Connection failed");
        });

        service.registerConnection("conn-1", {
          restaurantId: 1,
          userId: 100,
          controller: { writeSSE: mockWriteSSE } as any,
          lastHeartbeat: Date.now(),
        });

        const event: KitchenSSEEvent = {
          data: {
            type: "NEW_ORDER",
            timestamp: new Date().toISOString(),
            restaurantId: 1,
          },
        };

        const sentCount = service.broadcastToKitchen(1, event);

        expect(sentCount).toBe(0);
        expect(service.getConnectionStatus(1).restaurantConnections).toBe(0);
      });

      it("should return 0 when no connections exist", () => {
        const event: KitchenSSEEvent = {
          data: {
            type: "NEW_ORDER",
            timestamp: new Date().toISOString(),
            restaurantId: 1,
          },
        };

        const sentCount = service.broadcastToKitchen(1, event);
        expect(sentCount).toBe(0);
      });
    });

    describe("broadcastTestEvent", () => {
      it("should broadcast test event with default type", () => {
        const mockWriteSSE = vi.fn();
        service.registerConnection("conn-1", {
          restaurantId: 1,
          userId: 100,
          controller: { writeSSE: mockWriteSSE } as any,
          lastHeartbeat: Date.now(),
        });

        const sentCount = service.broadcastTestEvent(1, {});

        expect(sentCount).toBe(1);
        expect(mockWriteSSE).toHaveBeenCalled();
      });

      it("should broadcast test event with custom type and payload", () => {
        const mockWriteSSE = vi.fn();
        service.registerConnection("conn-1", {
          restaurantId: 1,
          userId: 100,
          controller: { writeSSE: mockWriteSSE } as any,
          lastHeartbeat: Date.now(),
        });

        const sentCount = service.broadcastTestEvent(1, {
          type: "ORDER_STATUS_UPDATE",
          payload: { orderId: 123, status: "ready" },
        });

        expect(sentCount).toBe(1);
      });
    });
  });

  describe("Kitchen Operations", () => {
    describe("getKitchenOrders", () => {
      it("should fetch and transform kitchen orders", async () => {
        // Configure hoisted mock to return order data
        mockGetOrders.mockResolvedValue({
          orders: [
            {
              id: 1,
              orderNumber: "ORD-001",
              tableId: 5,
              status: 1, // CONFIRMED
              items: [
                {
                  id: 1,
                  menuItem: { name: "Nasi Lemak" },
                  quantity: 2,
                  status: 0,
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

        // Create new service instance
        const testService = new KitchenService(mockEnv as any);
        const result = await testService.getKitchenOrders(1, 100);

        expect(result).toHaveProperty("pending");
        expect(result).toHaveProperty("preparing");
        expect(result).toHaveProperty("ready");
        expect(result).toHaveProperty("stats");

        testService.destroy();
      });

      it("should handle empty orders", async () => {
        // Configure hoisted mock to return empty orders
        mockGetOrders.mockResolvedValue({
          orders: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });

        // Create new service instance with empty orders mock
        const emptyService = new KitchenService(mockEnv as any);
        const result = await emptyService.getKitchenOrders(1, 100);

        expect(result).toHaveProperty("pending");
        expect(result).toHaveProperty("preparing");
        expect(result).toHaveProperty("ready");
        expect(result).toHaveProperty("stats");

        emptyService.destroy();
      });
    });

    describe("updateOrderItemStatus", () => {
      it("should update item status and broadcast", async () => {
        const mockWriteSSE = vi.fn();
        service.registerConnection("conn-1", {
          restaurantId: 1,
          userId: 100,
          controller: { writeSSE: mockWriteSSE } as any,
          lastHeartbeat: Date.now(),
        });

        const result = await service.updateOrderItemStatus(
          1, // restaurantId
          100, // orderId
          50, // itemId
          { status: "preparing", notes: "Started cooking" },
          100, // userId
        );

        expect(result.orderId).toBe(100);
        expect(result.itemId).toBe(50);
        expect(result.status).toBe("preparing");
        expect(result.updatedAt).toBeDefined();
        expect(result.broadcastSent).toBe(1);
      });

      it("should handle update without active connections", async () => {
        const result = await service.updateOrderItemStatus(
          1,
          100,
          50,
          { status: "ready", notes: "" },
          100,
        );

        expect(result.broadcastSent).toBe(0);
      });
    });
  });

  describe("Utilities", () => {
    describe("generateConnectionId", () => {
      it("should generate unique connection IDs", () => {
        const id1 = service.generateConnectionId();
        const id2 = service.generateConnectionId();

        expect(id1).toMatch(/^kitchen_\d+_[a-z0-9]+$/);
        expect(id2).toMatch(/^kitchen_\d+_[a-z0-9]+$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe("formatSSEEvent", () => {
      it("should format event with all fields", () => {
        const event: KitchenSSEEvent = {
          id: "event-123",
          event: "order-update",
          data: {
            type: "NEW_ORDER",
            orderId: 100,
            timestamp: "2025-12-08T10:00:00Z",
            restaurantId: 1,
          },
        };

        const formatted = service.formatSSEEvent(event);

        expect(formatted).toContain("id: event-123");
        expect(formatted).toContain("event: order-update");
        expect(formatted).toContain("data:");
        expect(formatted).toContain("NEW_ORDER");
      });

      it("should format event without optional fields", () => {
        const event: KitchenSSEEvent = {
          data: {
            type: "HEARTBEAT",
            timestamp: "2025-12-08T10:00:00Z",
            restaurantId: 1,
          },
        };

        const formatted = service.formatSSEEvent(event);

        expect(formatted).not.toContain("id:");
        expect(formatted).not.toContain("event:");
        expect(formatted).toContain("data:");
      });
    });

    describe("validateChefAccess", () => {
      it("should allow admin (role 0)", () => {
        expect(service.validateChefAccess(1, 0, 1)).toBe(true);
      });

      it("should allow owner (role 1)", () => {
        expect(service.validateChefAccess(1, 1, 1)).toBe(true);
      });

      it("should allow chef (role 2)", () => {
        expect(service.validateChefAccess(1, 2, 1)).toBe(true);
      });

      it("should allow service crew (role 3)", () => {
        expect(service.validateChefAccess(1, 3, 1)).toBe(true);
      });

      it("should deny cashier (role 4)", () => {
        expect(service.validateChefAccess(1, 4, 1)).toBe(false);
      });

      it("should deny customer (role 5)", () => {
        expect(service.validateChefAccess(1, 5, 1)).toBe(false);
      });

      it("should deny unknown roles", () => {
        expect(service.validateChefAccess(1, 99, 1)).toBe(false);
      });
    });
  });

  describe("Lifecycle", () => {
    describe("destroy", () => {
      it("should clear all connections", () => {
        service.registerConnection("conn-1", {
          restaurantId: 1,
          userId: 100,
          controller: null as any,
          lastHeartbeat: Date.now(),
        });

        expect(service.getConnectionStatus(1).totalConnections).toBe(1);

        service.destroy();

        expect(service.getConnectionStatus(1).totalConnections).toBe(0);
      });
    });
  });
});
