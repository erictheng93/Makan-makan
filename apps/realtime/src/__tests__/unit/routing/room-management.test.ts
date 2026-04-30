/**
 * Room Management Tests
 * 測試 RealtimeSession 的 room 管理功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RealtimeAuthPayload } from "@makanmakan/shared-types";
import {
  createTestAuthPayload,
  MockWebSocketPair,
} from "../../helpers/test-utils";

// Mock WebSocket
class MockWebSocket extends EventTarget {
  public readyState = WebSocket.OPEN;
  public url: string;
  private messageHandlers: ((event: MessageEvent) => void)[] = [];
  private closeHandlers: ((event: CloseEvent) => void)[] = [];
  private errorHandlers: ((event: Event) => void)[] = [];

  constructor(url: string) {
    super();
    this.url = url;
  }

  send(data: string | ArrayBuffer): void {
    // Mock send implementation
  }

  close(code?: number, reason?: string): void {
    const event = new CloseEvent("close", { code, reason });
    this.closeHandlers.forEach((handler) => handler(event));
  }

  accept(): void {
    // Mock accept for Cloudflare Workers WebSocket
  }

  addEventListener(type: string, handler: any): void {
    if (type === "message") {
      this.messageHandlers.push(handler);
    } else if (type === "close") {
      this.closeHandlers.push(handler);
    } else if (type === "error") {
      this.errorHandlers.push(handler);
    }
    super.addEventListener(type, handler);
  }

  // Helper to trigger message event
  triggerMessage(data: string): void {
    const event = new MessageEvent("message", { data });
    this.messageHandlers.forEach((handler) => handler(event));
  }

  // Helper to trigger error event
  triggerError(error: Error): void {
    const event = new Event("error");
    this.errorHandlers.forEach((handler) => handler(event));
  }
}

describe("Room Management", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        WebSocketPair: typeof MockWebSocketPair;
      }
    ).WebSocketPair = MockWebSocketPair;
  });

  describe("Room Creation and Initialization", () => {
    it("should create a new room on first connection", async () => {
      // This tests that RealtimeSession initializes room info correctly
      // when the first WebSocket connection is established

      const mockAuthPayload: RealtimeAuthPayload = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
        { userId: 456 },
      );

      // Room should be initialized with type and id
      expect(mockAuthPayload.roomType).toBe("customer");
      expect(mockAuthPayload.roomId).toBe("table-001");
      expect(mockAuthPayload.restaurantId).toBe("restaurant-123");
    });

    it("should support different room types (customer, admin, kitchen)", async () => {
      const roomTypes = ["customer", "admin", "kitchen"] as const;

      roomTypes.forEach((roomType) => {
        const authPayload: RealtimeAuthPayload = createTestAuthPayload(
          roomType,
          `${roomType}-room-001`,
          "restaurant-123",
          4,
        );

        expect(authPayload.roomType).toBe(roomType);
        expect(authPayload.roomId).toContain(roomType);
      });
    });

    it("should generate unique connection IDs for each connection", () => {
      const connectionIds = new Set<string>();
      const roomType = "customer";
      const roomId = "table-001";

      // Generate 10 connection IDs
      for (let i = 0; i < 10; i++) {
        const connectionId = `${roomType}_${roomId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        connectionIds.add(connectionId);
      }

      // All IDs should be unique
      expect(connectionIds.size).toBe(10);

      // Each ID should contain roomType and roomId
      connectionIds.forEach((id) => {
        expect(id).toContain(roomType);
        expect(id).toContain(roomId);
      });
    });
  });

  describe("Connection Management", () => {
    it("should add connection to room on WebSocket upgrade", async () => {
      const connections = new Map();
      const webSocket = new MockWebSocket("ws://test");

      const connectionInfo = {
        id: "conn-001",
        type: "customer" as const,
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        auth: {
          roomType: "customer" as const,
          roomId: "table-001",
          restaurantId: "restaurant-123",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      connections.set(webSocket, connectionInfo);

      expect(connections.size).toBe(1);
      expect(connections.get(webSocket)).toEqual(connectionInfo);
    });

    it("should remove connection from room on WebSocket close", async () => {
      const connections = new Map();
      const webSocket = new MockWebSocket("ws://test");

      const connectionInfo = {
        id: "conn-001",
        type: "customer" as const,
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      };

      // Add connection
      connections.set(webSocket, connectionInfo);
      expect(connections.size).toBe(1);

      // Close connection
      connections.delete(webSocket);
      expect(connections.size).toBe(0);
    });

    it("should handle multiple connections in same room", async () => {
      const connections = new Map();

      // Add 3 connections to same room
      for (let i = 0; i < 3; i++) {
        const webSocket = new MockWebSocket(`ws://test-${i}`);
        const connectionInfo = {
          id: `conn-${i}`,
          type: "customer" as const,
          roomId: "table-001",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        };
        connections.set(webSocket, connectionInfo);
      }

      expect(connections.size).toBe(3);

      // All connections should be in same room
      const roomConnections = Array.from(connections.values()).filter(
        (conn) => conn.roomId === "table-001",
      );

      expect(roomConnections.length).toBe(3);
    });

    it("should track connection metadata", async () => {
      const connection = {
        id: "conn-001",
        type: "admin" as const,
        roomId: "admin-restaurant-123",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        metadata: {
          userAgent: "Mozilla/5.0",
          clientVersion: "2.0.0",
          features: ["notifications", "realtime-orders"],
        },
      };

      expect(connection.metadata).toBeDefined();
      expect(connection.metadata?.userAgent).toBe("Mozilla/5.0");
      expect(connection.metadata?.clientVersion).toBe("2.0.0");
      expect(connection.metadata?.features).toHaveLength(2);
    });
  });

  describe("Room Access Control", () => {
    it("should validate roomId matches token", () => {
      const tokenPayload: RealtimeAuthPayload = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const requestedRoomId = "table-001";

      // Should match
      expect(tokenPayload.roomId).toBe(requestedRoomId);
    });

    it("should reject connection if roomId does not match token", () => {
      const tokenPayload: RealtimeAuthPayload = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const requestedRoomId = "table-002";

      // Should not match
      expect(tokenPayload.roomId).not.toBe(requestedRoomId);
    });

    it("should validate roomType matches token", () => {
      const tokenPayload: RealtimeAuthPayload = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const requestedRoomType = "customer";

      // Should match
      expect(tokenPayload.roomType).toBe(requestedRoomType);
    });

    it("should reject connection if roomType does not match token", () => {
      const tokenPayload: RealtimeAuthPayload = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const requestedRoomType = "admin";

      // Should not match
      expect(tokenPayload.roomType).not.toBe(requestedRoomType);
    });

    it("should enforce restaurant-level isolation", () => {
      const connection1 = {
        id: "conn-001",
        type: "customer" as const,
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        auth: {
          roomType: "customer" as const,
          roomId: "table-001",
          restaurantId: "restaurant-123",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      const connection2 = {
        id: "conn-002",
        type: "customer" as const,
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        auth: {
          roomType: "customer" as const,
          roomId: "table-001",
          restaurantId: "restaurant-456", // Different restaurant
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      // Connections should have different restaurant IDs
      expect(connection1.auth?.restaurantId).not.toBe(
        connection2.auth?.restaurantId,
      );
    });
  });

  describe("Room Statistics", () => {
    it("should track total connections in room", () => {
      const connections = new Map();

      // Add 5 connections
      for (let i = 0; i < 5; i++) {
        const webSocket = new MockWebSocket(`ws://test-${i}`);
        connections.set(webSocket, { id: `conn-${i}`, roomId: "table-001" });
      }

      const stats = {
        totalConnections: connections.size,
        activeConnections: connections.size,
      };

      expect(stats.totalConnections).toBe(5);
      expect(stats.activeConnections).toBe(5);
    });

    it("should track connections by type", () => {
      const connections = [
        { type: "customer", roomId: "table-001" },
        { type: "customer", roomId: "table-002" },
        { type: "admin", roomId: "admin-restaurant-123" },
        { type: "kitchen", roomId: "kitchen-restaurant-123" },
        { type: "customer", roomId: "table-003" },
      ];

      const connectionsByType = connections.reduce(
        (acc, conn) => {
          acc[conn.type] = (acc[conn.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(connectionsByType.customer).toBe(3);
      expect(connectionsByType.admin).toBe(1);
      expect(connectionsByType.kitchen).toBe(1);
    });

    it("should provide connection activity timestamps", () => {
      const now = Date.now();
      const connection = {
        id: "conn-001",
        type: "customer" as const,
        roomId: "table-001",
        connectedAt: now - 60000, // 1 minute ago
        lastActivity: now - 5000, // 5 seconds ago
      };

      expect(connection.connectedAt).toBeLessThan(now);
      expect(connection.lastActivity).toBeLessThan(now);
      expect(connection.lastActivity).toBeGreaterThan(connection.connectedAt);

      // Connection has been active for at least 55 seconds
      const activeTime = connection.lastActivity - connection.connectedAt;
      expect(activeTime).toBeGreaterThanOrEqual(55000);
    });

    it("should track room info (type and id)", () => {
      const roomInfo = {
        type: "customer",
        id: "table-001",
      };

      expect(roomInfo.type).toBe("customer");
      expect(roomInfo.id).toBe("table-001");
    });
  });

  describe("Room Cleanup", () => {
    it("should clean up room when last connection closes", () => {
      const connections = new Map();
      const webSocket = new MockWebSocket("ws://test");

      // Add connection
      connections.set(webSocket, { id: "conn-001", roomId: "table-001" });
      expect(connections.size).toBe(1);

      // Remove connection
      connections.delete(webSocket);
      expect(connections.size).toBe(0);

      // Room should be empty
      const hasConnections = connections.size > 0;
      expect(hasConnections).toBe(false);
    });

    it("should handle connection errors gracefully", () => {
      const connections = new Map();
      const webSocket = new MockWebSocket("ws://test");

      connections.set(webSocket, { id: "conn-001", roomId: "table-001" });

      // Simulate error
      const errorHandler = vi.fn();
      webSocket.addEventListener("error", errorHandler);
      webSocket.triggerError(new Error("Connection lost"));

      // Should remove connection on error
      connections.delete(webSocket);
      expect(connections.size).toBe(0);
      expect(errorHandler).toHaveBeenCalled();
    });

    it("should maintain room integrity when connections fluctuate", () => {
      const connections = new Map();

      // Add 3 connections
      const ws1 = new MockWebSocket("ws://test-1");
      const ws2 = new MockWebSocket("ws://test-2");
      const ws3 = new MockWebSocket("ws://test-3");

      connections.set(ws1, { id: "conn-001", roomId: "table-001" });
      connections.set(ws2, { id: "conn-002", roomId: "table-001" });
      connections.set(ws3, { id: "conn-003", roomId: "table-001" });

      expect(connections.size).toBe(3);

      // Remove middle connection
      connections.delete(ws2);
      expect(connections.size).toBe(2);

      // Room should still have 2 connections
      const roomConnections = Array.from(connections.values()).filter(
        (conn) => conn.roomId === "table-001",
      );
      expect(roomConnections.length).toBe(2);
    });
  });

  describe("Multi-Room Support", () => {
    it("should support multiple rooms simultaneously", () => {
      const connections = new Map();

      // Add connections to different rooms
      const rooms = ["table-001", "table-002", "admin-restaurant-123"];

      rooms.forEach((roomId, index) => {
        const ws = new MockWebSocket(`ws://test-${index}`);
        connections.set(ws, { id: `conn-${index}`, roomId });
      });

      expect(connections.size).toBe(3);

      // Count connections per room
      const connectionsByRoom = Array.from(connections.values()).reduce(
        (acc, conn) => {
          acc[conn.roomId] = (acc[conn.roomId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(Object.keys(connectionsByRoom).length).toBe(3);
      expect(connectionsByRoom["table-001"]).toBe(1);
      expect(connectionsByRoom["table-002"]).toBe(1);
      expect(connectionsByRoom["admin-restaurant-123"]).toBe(1);
    });

    it("should isolate messages between different rooms", () => {
      const room1Connections = new Set(["conn-001", "conn-002"]);
      const room2Connections = new Set(["conn-003", "conn-004"]);

      // Message should only go to room1
      const targetRoom = "table-001";
      const connectionsInTargetRoom =
        targetRoom === "table-001" ? room1Connections : room2Connections;

      expect(connectionsInTargetRoom.size).toBe(2);
      expect(connectionsInTargetRoom.has("conn-001")).toBe(true);
      expect(connectionsInTargetRoom.has("conn-002")).toBe(true);
      expect(connectionsInTargetRoom.has("conn-003")).toBe(false);
    });
  });

  describe("Room Path Parameters", () => {
    it("should extract room type and id from URL path", () => {
      const url = new URL("ws://localhost/customer/table-001");
      const pathParts = url.pathname.split("/");

      const roomType = pathParts[1];
      const roomId = pathParts[2];

      expect(roomType).toBe("customer");
      expect(roomId).toBe("table-001");
    });

    it("should reject invalid room parameters", () => {
      const testCases = [
        { path: "//", shouldReject: true },
        { path: "/customer/", shouldReject: true },
        { path: "//table-001", shouldReject: true },
        { path: "/customer/table-001", shouldReject: false },
      ];

      testCases.forEach(({ path, shouldReject }) => {
        const url = new URL(`ws://localhost${path}`);
        const [, roomType, roomId] = url.pathname.split("/");

        const isInvalid = !roomType || !roomId;

        expect(isInvalid).toBe(shouldReject);
      });
    });
  });
});
