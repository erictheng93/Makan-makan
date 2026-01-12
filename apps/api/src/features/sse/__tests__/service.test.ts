/**
 * SSEService Unit Tests
 *
 * Comprehensive test suite for the SSEService class
 * Tests connection management, broadcasting, and cleanup logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SSEService } from "../services/SSEService";
import type { SSEConnection, BroadcastEvent, SSEEvent } from "../types";

// Helper to create mock controller with all required properties
const createMockController = (
  overrides?: Partial<ReadableStreamDefaultController>,
) =>
  ({
    enqueue: vi.fn(),
    close: vi.fn(),
    error: vi.fn(),
    desiredSize: 1,
    ...overrides,
  }) as unknown as ReadableStreamDefaultController;

// Mock ConsoleLogger - must be a class that returns an instance with methods
vi.mock("../../../core/monitoring", () => {
  class MockConsoleLogger {
    info = vi.fn();
    warn = vi.fn();
    debug = vi.fn();
    error = vi.fn();
    constructor(_name?: string) {}
  }
  return {
    ConsoleLogger: MockConsoleLogger,
  };
});

describe("SSEService", () => {
  let service: SSEService;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = {
      DB: {},
      CACHE_KV: {},
      JWT_SECRET: "test-secret",
    };
    service = new SSEService(mockEnv);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================
  // Connection Management Tests
  // =============================================
  describe("registerConnection", () => {
    it("should register a new connection", () => {
      const connection: SSEConnection = {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
      };

      service.registerConnection("conn-1", connection);

      const status = service.getConnectionStatus();
      expect(status.totalConnections).toBe(1);
    });

    it("should overwrite existing connection with same id", () => {
      const connection1: SSEConnection = {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
      };

      const connection2: SSEConnection = {
        id: "conn-1",
        restaurantId: 2,
        userId: 2,
        role: 1,
        lastHeartbeat: Date.now(),
      };

      service.registerConnection("conn-1", connection1);
      service.registerConnection("conn-1", connection2);

      const status = service.getConnectionStatus();
      expect(status.totalConnections).toBe(1);
      expect(status.connectionsByRestaurant[2]).toBe(1);
    });

    it("should register multiple connections", () => {
      for (let i = 1; i <= 5; i++) {
        service.registerConnection(`conn-${i}`, {
          id: `conn-${i}`,
          restaurantId: i % 2 === 0 ? 1 : 2,
          userId: i,
          role: i % 3,
          lastHeartbeat: Date.now(),
        });
      }

      const status = service.getConnectionStatus();
      expect(status.totalConnections).toBe(5);
    });
  });

  describe("removeConnection", () => {
    it("should remove an existing connection", () => {
      const connection: SSEConnection = {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
      };

      service.registerConnection("conn-1", connection);
      expect(service.getConnectionStatus().totalConnections).toBe(1);

      service.removeConnection("conn-1");
      expect(service.getConnectionStatus().totalConnections).toBe(0);
    });

    it("should handle removing non-existent connection gracefully", () => {
      // Should not throw
      expect(() => service.removeConnection("non-existent")).not.toThrow();
    });
  });

  describe("getConnectionsByRestaurant", () => {
    it("should return connections for a specific restaurant", () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 1,
        userId: 2,
        role: 1,
        lastHeartbeat: Date.now(),
      });
      service.registerConnection("conn-3", {
        id: "conn-3",
        restaurantId: 2,
        userId: 3,
        role: 0,
        lastHeartbeat: Date.now(),
      });

      const restaurant1Connections = service.getConnectionsByRestaurant(1);
      expect(restaurant1Connections).toHaveLength(2);

      const restaurant2Connections = service.getConnectionsByRestaurant(2);
      expect(restaurant2Connections).toHaveLength(1);
    });

    it("should return empty array when no connections for restaurant", () => {
      const connections = service.getConnectionsByRestaurant(999);
      expect(connections).toHaveLength(0);
    });
  });

  describe("getConnectionsByRole", () => {
    it("should return connections for a specific role", () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0, // Admin
        lastHeartbeat: Date.now(),
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 1,
        userId: 2,
        role: 1, // Owner
        lastHeartbeat: Date.now(),
      });
      service.registerConnection("conn-3", {
        id: "conn-3",
        restaurantId: 2,
        userId: 3,
        role: 1, // Owner
        lastHeartbeat: Date.now(),
      });

      const adminConnections = service.getConnectionsByRole(0);
      expect(adminConnections).toHaveLength(1);

      const ownerConnections = service.getConnectionsByRole(1);
      expect(ownerConnections).toHaveLength(2);
    });

    it("should return empty array when no connections for role", () => {
      const connections = service.getConnectionsByRole(4);
      expect(connections).toHaveLength(0);
    });
  });

  // =============================================
  // Broadcasting Tests
  // =============================================
  describe("broadcast", () => {
    let mockController: any;

    beforeEach(() => {
      mockController = createMockController();
    });

    it("should broadcast to all connections when no filters", async () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 2,
        userId: 2,
        role: 1,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
      };

      await service.broadcast(event);

      expect(mockController.enqueue).toHaveBeenCalledTimes(2);
    });

    it("should broadcast only to specific restaurant", async () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 2,
        userId: 2,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
        restaurantId: 1,
      };

      await service.broadcast(event);

      expect(mockController.enqueue).toHaveBeenCalledTimes(1);
    });

    it("should broadcast only to specific roles", async () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0, // Admin
        lastHeartbeat: Date.now(),
        controller: mockController,
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 1,
        userId: 2,
        role: 1, // Owner
        lastHeartbeat: Date.now(),
        controller: mockController,
      });
      service.registerConnection("conn-3", {
        id: "conn-3",
        restaurantId: 1,
        userId: 3,
        role: 2, // Chef
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
        targetRoles: [1, 2], // Owner and Chef only
      };

      await service.broadcast(event);

      expect(mockController.enqueue).toHaveBeenCalledTimes(2);
    });

    it("should broadcast with both restaurant and role filters", async () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 1, // Owner
        lastHeartbeat: Date.now(),
        controller: mockController,
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 1,
        userId: 2,
        role: 2, // Chef
        lastHeartbeat: Date.now(),
        controller: mockController,
      });
      service.registerConnection("conn-3", {
        id: "conn-3",
        restaurantId: 2,
        userId: 3,
        role: 1, // Owner but different restaurant
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
        restaurantId: 1,
        targetRoles: [1], // Only owners of restaurant 1
      };

      await service.broadcast(event);

      expect(mockController.enqueue).toHaveBeenCalledTimes(1);
    });

    it("should handle connections without controller", async () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        // No controller
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
      };

      // Should not throw
      await expect(service.broadcast(event)).resolves.not.toThrow();
    });

    it("should remove failed connections during broadcast", async () => {
      const failingController = createMockController({
        enqueue: vi.fn().mockImplementation(() => {
          throw new Error("Connection closed");
        }),
      });

      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: failingController,
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
      };

      await service.broadcast(event);

      // Connection should be removed after failure
      expect(service.getConnectionStatus().totalConnections).toBe(0);
    });

    it("should update lastHeartbeat on successful send", async () => {
      const before = Date.now() - 1000;
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: before,
        controller: mockController,
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
      };

      await service.broadcast(event);

      const connections = service.getConnectionsByRestaurant(1);
      expect(connections[0].lastHeartbeat).toBeGreaterThan(before);
    });
  });

  describe("broadcastToRestaurant", () => {
    it("should broadcast to specific restaurant", async () => {
      const mockController = createMockController();

      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 2,
        userId: 2,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: SSEEvent = {
        id: "123",
        event: "order_update",
        data: { orderId: 1 },
      };

      await service.broadcastToRestaurant(1, event);

      expect(mockController.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe("broadcastToRole", () => {
    it("should broadcast to specific role", async () => {
      const mockController = createMockController();

      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0, // Admin
        lastHeartbeat: Date.now(),
        controller: mockController,
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 1,
        userId: 2,
        role: 2, // Chef
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: SSEEvent = {
        id: "123",
        event: "kitchen_alert",
        data: { message: "New order!" },
      };

      await service.broadcastToRole(2, event);

      expect(mockController.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================
  // Status & Health Tests
  // =============================================
  describe("getConnectionStatus", () => {
    it("should return zero connections initially", () => {
      const status = service.getConnectionStatus();

      expect(status.totalConnections).toBe(0);
      expect(status.connectionsByRestaurant).toEqual({});
      expect(status.connectionsByRole).toEqual({});
    });

    it("should return correct counts by restaurant", () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 1,
        userId: 2,
        role: 1,
        lastHeartbeat: Date.now(),
      });
      service.registerConnection("conn-3", {
        id: "conn-3",
        restaurantId: 2,
        userId: 3,
        role: 0,
        lastHeartbeat: Date.now(),
      });

      const status = service.getConnectionStatus();

      expect(status.totalConnections).toBe(3);
      expect(status.connectionsByRestaurant[1]).toBe(2);
      expect(status.connectionsByRestaurant[2]).toBe(1);
    });

    it("should return correct counts by role", () => {
      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0, // Admin
        lastHeartbeat: Date.now(),
      });
      service.registerConnection("conn-2", {
        id: "conn-2",
        restaurantId: 1,
        userId: 2,
        role: 1, // Owner
        lastHeartbeat: Date.now(),
      });
      service.registerConnection("conn-3", {
        id: "conn-3",
        restaurantId: 2,
        userId: 3,
        role: 1, // Owner
        lastHeartbeat: Date.now(),
      });

      const status = service.getConnectionStatus();

      expect(status.connectionsByRole[0]).toBe(1);
      expect(status.connectionsByRole[1]).toBe(2);
    });
  });

  describe("cleanupExpiredConnections", () => {
    it("should remove connections older than 5 minutes", () => {
      const now = Date.now();
      const fiveMinutesAgo = now - 6 * 60 * 1000; // 6 minutes ago

      service.registerConnection("conn-fresh", {
        id: "conn-fresh",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: now,
      });
      service.registerConnection("conn-expired", {
        id: "conn-expired",
        restaurantId: 1,
        userId: 2,
        role: 0,
        lastHeartbeat: fiveMinutesAgo,
      });

      service.cleanupExpiredConnections();

      const status = service.getConnectionStatus();
      expect(status.totalConnections).toBe(1);

      const connections = service.getConnectionsByRestaurant(1);
      expect(connections[0].id).toBe("conn-fresh");
    });

    it("should not remove connections within 5 minutes", () => {
      const now = Date.now();
      const fourMinutesAgo = now - 4 * 60 * 1000; // 4 minutes ago

      service.registerConnection("conn-recent", {
        id: "conn-recent",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: fourMinutesAgo,
      });

      service.cleanupExpiredConnections();

      const status = service.getConnectionStatus();
      expect(status.totalConnections).toBe(1);
    });

    it("should handle empty connections gracefully", () => {
      // Should not throw
      expect(() => service.cleanupExpiredConnections()).not.toThrow();
    });
  });

  // =============================================
  // Test & Debug Tests
  // =============================================
  describe("broadcastTest", () => {
    it("should send test broadcast with timestamp", async () => {
      const mockController = createMockController();

      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      await service.broadcastTest({
        event: "test_event",
        message: "Hello World",
        timestamp: new Date().toISOString(),
        connectionId: "test-conn",
      });

      expect(mockController.enqueue).toHaveBeenCalled();
      // Verify the broadcast contains the test data
      const call = (mockController.enqueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const decoded = new TextDecoder().decode(call);
      expect(decoded).toContain("test");
    });
  });

  // =============================================
  // Edge Cases & Error Handling
  // =============================================
  describe("Edge Cases", () => {
    it("should handle rapid connection/disconnection", () => {
      for (let i = 0; i < 100; i++) {
        service.registerConnection(`conn-${i}`, {
          id: `conn-${i}`,
          restaurantId: 1,
          userId: i,
          role: i % 5,
          lastHeartbeat: Date.now(),
        });
      }

      expect(service.getConnectionStatus().totalConnections).toBe(100);

      for (let i = 0; i < 50; i++) {
        service.removeConnection(`conn-${i}`);
      }

      expect(service.getConnectionStatus().totalConnections).toBe(50);
    });

    it("should broadcast to all when targetRoles is empty array", async () => {
      // Note: Empty targetRoles array is treated as "no filter" because
      // the code checks `targetRoles.length > 0` before filtering
      const mockController = createMockController();

      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
        targetRoles: [], // Empty array - treated as "no role filter"
      };

      await service.broadcast(event);

      // With empty targetRoles, the length > 0 check fails, so no filter is applied
      // All connections receive the message
      expect(mockController.enqueue).toHaveBeenCalledTimes(1);
    });

    it("should handle broadcast to non-existent restaurant", async () => {
      const mockController = createMockController();

      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: BroadcastEvent = {
        type: "test_event",
        data: { message: "Hello" },
        restaurantId: 999, // Non-existent
      };

      await service.broadcast(event);

      expect(mockController.enqueue).not.toHaveBeenCalled();
    });

    it("should correctly format SSE event data", async () => {
      const mockController = createMockController();

      service.registerConnection("conn-1", {
        id: "conn-1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
        controller: mockController,
      });

      const event: BroadcastEvent = {
        type: "order_update",
        data: { orderId: 123, status: "preparing" },
      };

      await service.broadcast(event);

      expect(mockController.enqueue).toHaveBeenCalled();
      const encoded = (mockController.enqueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const decoded = new TextDecoder().decode(encoded);

      expect(decoded).toContain("id:");
      expect(decoded).toContain("event: order_update");
      expect(decoded).toContain('data: {"orderId":123,"status":"preparing"}');
      expect(decoded).toMatch(/\n\n$/); // Should end with double newline
    });
  });
});
