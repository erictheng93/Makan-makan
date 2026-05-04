/**
 * Multi-Client Integration Tests
 * 測試多個客戶端同時連接的場景
 *
 * 測試範圍：
 * - 同一房間多客戶端連接
 * - 訊息廣播到所有客戶端
 * - 客戶端斷開對其他客戶端的影響
 * - 連接數量限制
 * - 併發連接處理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { RealtimeAuthPayload } from "@makanmasak/shared-types";
import { RealtimeEventType } from "@makanmasak/shared-types";

// Test-local event interface for mock connection management testing.
// Intentionally differs from production TestRealtimeEvent which uses eventId/data/restaurantId,
// since these tests validate multi-client connection logic, not event shape compliance.
interface TestRealtimeEvent {
  id?: string;
  type: RealtimeEventType;
  payload?: Record<string, unknown>;
  timestamp: number;
  roomType?: string;
  roomId?: string;
}

// Use mapping for event types to match actual enum values
const EventTypes = {
  ORDER_CREATED: RealtimeEventType.NEW_ORDER,
  ORDER_STATUS_CHANGED: RealtimeEventType.ORDER_STATUS_UPDATE,
  CART_UPDATED: RealtimeEventType.MENU_ITEM_UPDATE,
} as const;
import {
  createTestAuthPayload,
  MockWebSocketPair,
} from "../helpers/test-utils";

// Mock WebSocket Connection
interface MockClientConnection {
  id: string;
  roomType: "customer" | "admin" | "kitchen";
  roomId: string;
  restaurantId: string;
  auth: RealtimeAuthPayload;
  receivedMessages: TestRealtimeEvent[];
  isConnected: boolean;
  connectedAt: number;
  lastActivity: number;
}

// Mock Connection Manager for Multi-Client Testing
class MockConnectionManager {
  private connections: Map<string, MockClientConnection> = new Map();
  private roomConnections: Map<string, Set<string>> = new Map(); // roomKey -> connectionIds
  private connectionIdCounter = 0;
  private readonly maxConnectionsPerRoom: number;
  private readonly maxTotalConnections: number;

  constructor(options?: {
    maxConnectionsPerRoom?: number;
    maxTotalConnections?: number;
  }) {
    this.maxConnectionsPerRoom = options?.maxConnectionsPerRoom ?? 100;
    this.maxTotalConnections = options?.maxTotalConnections ?? 1000;
  }

  // Connect a new client
  connect(auth: RealtimeAuthPayload): {
    success: boolean;
    connectionId?: string;
    error?: string;
  } {
    // Check total connection limit
    if (this.connections.size >= this.maxTotalConnections) {
      return { success: false, error: "MAX_TOTAL_CONNECTIONS_REACHED" };
    }

    const roomKey = this.getRoomKey(auth.roomType, auth.roomId);
    const roomConnectionIds = this.roomConnections.get(roomKey) ?? new Set();

    // Check room connection limit
    if (roomConnectionIds.size >= this.maxConnectionsPerRoom) {
      return { success: false, error: "MAX_ROOM_CONNECTIONS_REACHED" };
    }

    const connectionId = `conn_${++this.connectionIdCounter}_${Date.now()}`;
    const now = Date.now();

    const connection: MockClientConnection = {
      id: connectionId,
      roomType: auth.roomType as "customer" | "admin" | "kitchen",
      roomId: auth.roomId,
      restaurantId: auth.restaurantId,
      auth,
      receivedMessages: [],
      isConnected: true,
      connectedAt: now,
      lastActivity: now,
    };

    this.connections.set(connectionId, connection);
    roomConnectionIds.add(connectionId);
    this.roomConnections.set(roomKey, roomConnectionIds);

    return { success: true, connectionId };
  }

  // Disconnect a client
  disconnect(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.isConnected = false;

    const roomKey = this.getRoomKey(connection.roomType, connection.roomId);
    const roomConnectionIds = this.roomConnections.get(roomKey);
    if (roomConnectionIds) {
      roomConnectionIds.delete(connectionId);
      if (roomConnectionIds.size === 0) {
        this.roomConnections.delete(roomKey);
      }
    }

    this.connections.delete(connectionId);
    return true;
  }

  // Broadcast message to all clients in a room
  broadcastToRoom(
    roomType: string,
    roomId: string,
    event: TestRealtimeEvent,
    excludeConnectionId?: string,
  ): number {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomConnectionIds = this.roomConnections.get(roomKey);
    if (!roomConnectionIds) return 0;

    let deliveredCount = 0;
    for (const connId of roomConnectionIds) {
      if (connId === excludeConnectionId) continue;

      const connection = this.connections.get(connId);
      if (connection && connection.isConnected) {
        connection.receivedMessages.push(event);
        connection.lastActivity = Date.now();
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  // Broadcast to all connections of a specific restaurant
  broadcastToRestaurant(
    restaurantId: string,
    event: TestRealtimeEvent,
    targetRoomTypes?: ("customer" | "admin" | "kitchen")[],
  ): number {
    let deliveredCount = 0;

    for (const connection of this.connections.values()) {
      if (connection.restaurantId !== restaurantId) continue;
      if (!connection.isConnected) continue;
      if (targetRoomTypes && !targetRoomTypes.includes(connection.roomType))
        continue;

      connection.receivedMessages.push(event);
      connection.lastActivity = Date.now();
      deliveredCount++;
    }

    return deliveredCount;
  }

  // Send message to a specific client
  sendToClient(connectionId: string, event: TestRealtimeEvent): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isConnected) return false;

    connection.receivedMessages.push(event);
    connection.lastActivity = Date.now();
    return true;
  }

  // Get connection by ID
  getConnection(connectionId: string): MockClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  // Get all connections in a room
  getRoomConnections(roomType: string, roomId: string): MockClientConnection[] {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomConnectionIds = this.roomConnections.get(roomKey);
    if (!roomConnectionIds) return [];

    return Array.from(roomConnectionIds)
      .map((id) => this.connections.get(id))
      .filter((conn): conn is MockClientConnection => conn !== undefined);
  }

  // Get connection count for a room
  getRoomConnectionCount(roomType: string, roomId: string): number {
    const roomKey = this.getRoomKey(roomType, roomId);
    return this.roomConnections.get(roomKey)?.size ?? 0;
  }

  // Get total connection count
  getTotalConnectionCount(): number {
    return this.connections.size;
  }

  // Get all active connections
  getAllConnections(): MockClientConnection[] {
    return Array.from(this.connections.values());
  }

  // Clear received messages for all connections
  clearAllMessages(): void {
    for (const connection of this.connections.values()) {
      connection.receivedMessages = [];
    }
  }

  // Clear all connections
  clearAll(): void {
    this.connections.clear();
    this.roomConnections.clear();
    this.connectionIdCounter = 0;
  }

  private getRoomKey(roomType: string, roomId: string): string {
    return `${roomType}:${roomId}`;
  }
}

describe("Multi-Client Integration Tests", () => {
  let connectionManager: MockConnectionManager;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        WebSocketPair: typeof MockWebSocketPair;
      }
    ).WebSocketPair = MockWebSocketPair;
    connectionManager = new MockConnectionManager();
  });

  afterEach(() => {
    connectionManager.clearAll();
    vi.clearAllMocks();
  });

  describe("同一房間多客戶端連接", () => {
    it("應該允許多個客戶端連接到同一房間", () => {
      const auths = [
        createTestAuthPayload("customer", "table-001", "restaurant-123", 4),
        createTestAuthPayload("customer", "table-001", "restaurant-123", 4),
        createTestAuthPayload("customer", "table-001", "restaurant-123", 4),
      ];

      const connectionIds: string[] = [];
      for (const auth of auths) {
        const result = connectionManager.connect(auth);
        expect(result.success).toBe(true);
        expect(result.connectionId).toBeDefined();
        connectionIds.push(result.connectionId!);
      }

      expect(
        connectionManager.getRoomConnectionCount("customer", "table-001"),
      ).toBe(3);
      expect(connectionIds).toHaveLength(3);
      // All connection IDs should be unique
      expect(new Set(connectionIds).size).toBe(3);
    });

    it("應該追蹤每個連接的獨立狀態", () => {
      const auth1 = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
        {
          userId: 1,
        },
      );
      const auth2 = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
        {
          userId: 2,
        },
      );

      const result1 = connectionManager.connect(auth1);
      const result2 = connectionManager.connect(auth2);

      const conn1 = connectionManager.getConnection(result1.connectionId!);
      const conn2 = connectionManager.getConnection(result2.connectionId!);

      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();
      expect(conn1!.auth.userId).toBe(1);
      expect(conn2!.auth.userId).toBe(2);
      expect(conn1!.connectedAt).toBeLessThanOrEqual(conn2!.connectedAt);
    });

    it("應該區分不同房間的連接", () => {
      const authTable1 = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const authTable2 = createTestAuthPayload(
        "customer",
        "table-002",
        "restaurant-123",
        4,
      );
      const authKitchen = createTestAuthPayload(
        "kitchen",
        "restaurant-123",
        "restaurant-123",
        2,
      );

      connectionManager.connect(authTable1);
      connectionManager.connect(authTable1);
      connectionManager.connect(authTable2);
      connectionManager.connect(authKitchen);

      expect(
        connectionManager.getRoomConnectionCount("customer", "table-001"),
      ).toBe(2);
      expect(
        connectionManager.getRoomConnectionCount("customer", "table-002"),
      ).toBe(1);
      expect(
        connectionManager.getRoomConnectionCount("kitchen", "restaurant-123"),
      ).toBe(1);
      expect(connectionManager.getTotalConnectionCount()).toBe(4);
    });
  });

  describe("訊息廣播到所有客戶端", () => {
    it("應該將訊息廣播到房間內所有客戶端", () => {
      const auth1 = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const auth2 = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const auth3 = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      connectionManager.connect(auth1);
      connectionManager.connect(auth2);
      connectionManager.connect(auth3);

      const event: TestRealtimeEvent = {
        id: "event-001",
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 1, items: [] },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const deliveredCount = connectionManager.broadcastToRoom(
        "customer",
        "table-001",
        event,
      );

      expect(deliveredCount).toBe(3);

      const connections = connectionManager.getRoomConnections(
        "customer",
        "table-001",
      );
      for (const conn of connections) {
        expect(conn.receivedMessages).toHaveLength(1);
        expect(conn.receivedMessages[0].id).toBe("event-001");
      }
    });

    it("應該能排除特定連接不接收廣播", () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const result1 = connectionManager.connect(auth);
      const result2 = connectionManager.connect(auth);
      const result3 = connectionManager.connect(auth);

      const event: TestRealtimeEvent = {
        id: "event-002",
        type: EventTypes.ORDER_STATUS_CHANGED,
        payload: { orderId: 1, status: "preparing" },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      // Exclude connection 2
      const deliveredCount = connectionManager.broadcastToRoom(
        "customer",
        "table-001",
        event,
        result2.connectionId,
      );

      expect(deliveredCount).toBe(2);

      const conn1 = connectionManager.getConnection(result1.connectionId!);
      const conn2 = connectionManager.getConnection(result2.connectionId!);
      const conn3 = connectionManager.getConnection(result3.connectionId!);

      expect(conn1!.receivedMessages).toHaveLength(1);
      expect(conn2!.receivedMessages).toHaveLength(0); // Excluded
      expect(conn3!.receivedMessages).toHaveLength(1);
    });

    it("應該廣播到同一餐廳的所有房間", () => {
      const customerAuth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const adminAuth = createTestAuthPayload(
        "admin",
        "restaurant-123",
        "restaurant-123",
        0,
      );
      const kitchenAuth = createTestAuthPayload(
        "kitchen",
        "restaurant-123",
        "restaurant-123",
        2,
      );

      const customerResult = connectionManager.connect(customerAuth);
      const adminResult = connectionManager.connect(adminAuth);
      const kitchenResult = connectionManager.connect(kitchenAuth);

      const event: TestRealtimeEvent = {
        id: "event-003",
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 1 },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const deliveredCount = connectionManager.broadcastToRestaurant(
        "restaurant-123",
        event,
      );

      expect(deliveredCount).toBe(3);

      const customer = connectionManager.getConnection(
        customerResult.connectionId!,
      );
      const admin = connectionManager.getConnection(adminResult.connectionId!);
      const kitchen = connectionManager.getConnection(
        kitchenResult.connectionId!,
      );

      expect(customer!.receivedMessages).toHaveLength(1);
      expect(admin!.receivedMessages).toHaveLength(1);
      expect(kitchen!.receivedMessages).toHaveLength(1);
    });

    it("應該能按角色過濾廣播目標", () => {
      const customerAuth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const adminAuth = createTestAuthPayload(
        "admin",
        "restaurant-123",
        "restaurant-123",
        0,
      );
      const kitchenAuth = createTestAuthPayload(
        "kitchen",
        "restaurant-123",
        "restaurant-123",
        2,
      );

      const customerResult = connectionManager.connect(customerAuth);
      const adminResult = connectionManager.connect(adminAuth);
      const kitchenResult = connectionManager.connect(kitchenAuth);

      const event: TestRealtimeEvent = {
        id: "event-004",
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 2 },
        timestamp: Date.now(),
        roomType: "admin",
        roomId: "restaurant-123",
      };

      // Only broadcast to admin and kitchen, not customer
      const deliveredCount = connectionManager.broadcastToRestaurant(
        "restaurant-123",
        event,
        ["admin", "kitchen"],
      );

      expect(deliveredCount).toBe(2);

      const customer = connectionManager.getConnection(
        customerResult.connectionId!,
      );
      const admin = connectionManager.getConnection(adminResult.connectionId!);
      const kitchen = connectionManager.getConnection(
        kitchenResult.connectionId!,
      );

      expect(customer!.receivedMessages).toHaveLength(0); // Filtered out
      expect(admin!.receivedMessages).toHaveLength(1);
      expect(kitchen!.receivedMessages).toHaveLength(1);
    });
  });

  describe("客戶端斷開對其他客戶端的影響", () => {
    it("應該在一個客戶端斷開時不影響其他客戶端", () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const result1 = connectionManager.connect(auth);
      const result2 = connectionManager.connect(auth);
      const result3 = connectionManager.connect(auth);

      expect(
        connectionManager.getRoomConnectionCount("customer", "table-001"),
      ).toBe(3);

      // Disconnect one client
      connectionManager.disconnect(result2.connectionId!);

      expect(
        connectionManager.getRoomConnectionCount("customer", "table-001"),
      ).toBe(2);

      // Remaining clients should still be able to receive messages
      const event: TestRealtimeEvent = {
        id: "event-005",
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 3 },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const deliveredCount = connectionManager.broadcastToRoom(
        "customer",
        "table-001",
        event,
      );
      expect(deliveredCount).toBe(2);

      const conn1 = connectionManager.getConnection(result1.connectionId!);
      const conn3 = connectionManager.getConnection(result3.connectionId!);

      expect(conn1!.receivedMessages).toHaveLength(1);
      expect(conn3!.receivedMessages).toHaveLength(1);
    });

    it("應該在所有客戶端斷開後清理房間", () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const result1 = connectionManager.connect(auth);
      const result2 = connectionManager.connect(auth);

      expect(
        connectionManager.getRoomConnectionCount("customer", "table-001"),
      ).toBe(2);

      connectionManager.disconnect(result1.connectionId!);
      connectionManager.disconnect(result2.connectionId!);

      expect(
        connectionManager.getRoomConnectionCount("customer", "table-001"),
      ).toBe(0);
    });

    it("應該處理不存在的連接斷開請求", () => {
      const result = connectionManager.disconnect("non-existent-connection");
      expect(result).toBe(false);
    });

    it("應該在斷開時更新連接狀態", () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const result = connectionManager.connect(auth);

      const connBefore = connectionManager.getConnection(result.connectionId!);
      expect(connBefore!.isConnected).toBe(true);

      connectionManager.disconnect(result.connectionId!);

      // Connection should no longer exist in manager
      const connAfter = connectionManager.getConnection(result.connectionId!);
      expect(connAfter).toBeUndefined();
    });
  });

  describe("連接數量限制", () => {
    it("應該在達到房間連接上限時拒絕新連接", () => {
      const manager = new MockConnectionManager({ maxConnectionsPerRoom: 3 });
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      // Connect up to limit
      for (let i = 0; i < 3; i++) {
        const result = manager.connect(auth);
        expect(result.success).toBe(true);
      }

      // Try to exceed limit
      const result = manager.connect(auth);
      expect(result.success).toBe(false);
      expect(result.error).toBe("MAX_ROOM_CONNECTIONS_REACHED");
    });

    it("應該在達到總連接上限時拒絕新連接", () => {
      const manager = new MockConnectionManager({ maxTotalConnections: 5 });

      // Connect up to limit with different rooms
      for (let i = 0; i < 5; i++) {
        const auth = createTestAuthPayload(
          "customer",
          `table-${i}`,
          "restaurant-123",
          4,
        );
        const result = manager.connect(auth);
        expect(result.success).toBe(true);
      }

      // Try to exceed total limit
      const auth = createTestAuthPayload(
        "customer",
        "table-new",
        "restaurant-123",
        4,
      );
      const result = manager.connect(auth);
      expect(result.success).toBe(false);
      expect(result.error).toBe("MAX_TOTAL_CONNECTIONS_REACHED");
    });

    it("應該在連接斷開後允許新連接", () => {
      const manager = new MockConnectionManager({ maxConnectionsPerRoom: 2 });
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const result1 = manager.connect(auth);
      const _result2 = manager.connect(auth);

      // Room is full
      const resultFull = manager.connect(auth);
      expect(resultFull.success).toBe(false);

      // Disconnect one
      manager.disconnect(result1.connectionId!);

      // Should be able to connect now
      const resultNew = manager.connect(auth);
      expect(resultNew.success).toBe(true);
    });
  });

  describe("併發連接處理", () => {
    it("應該處理多個同時連接的請求", async () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      // Simulate concurrent connections
      const connectionPromises = Array.from({ length: 10 }, () =>
        Promise.resolve(connectionManager.connect(auth)),
      );

      const results = await Promise.all(connectionPromises);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);
      expect(
        connectionManager.getRoomConnectionCount("customer", "table-001"),
      ).toBe(10);
    });

    it("應該處理同時廣播多條訊息", async () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      // Create multiple connections
      connectionManager.connect(auth);
      connectionManager.connect(auth);
      connectionManager.connect(auth);

      // Broadcast multiple messages concurrently
      const events: TestRealtimeEvent[] = Array.from({ length: 5 }, (_, i) => ({
        id: `event-concurrent-${i}`,
        type: EventTypes.ORDER_STATUS_CHANGED,
        payload: { orderId: i, status: "preparing" },
        timestamp: Date.now(),
        roomType: "customer" as const,
        roomId: "table-001",
      }));

      const broadcastPromises = events.map((event) =>
        Promise.resolve(
          connectionManager.broadcastToRoom("customer", "table-001", event),
        ),
      );

      const results = await Promise.all(broadcastPromises);

      // All broadcasts should deliver to 3 clients
      expect(results.every((count) => count === 3)).toBe(true);

      // Each client should have received all messages
      const connections = connectionManager.getRoomConnections(
        "customer",
        "table-001",
      );
      for (const conn of connections) {
        expect(conn.receivedMessages).toHaveLength(5);
      }
    });

    it("應該正確處理連接和斷開的併發操作", async () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      // Connect some initial clients
      const initialResults: string[] = [];
      for (let i = 0; i < 5; i++) {
        const result = connectionManager.connect(auth);
        initialResults.push(result.connectionId!);
      }

      // Concurrently disconnect some and connect new ones
      const operations = [
        Promise.resolve(connectionManager.disconnect(initialResults[0])),
        Promise.resolve(connectionManager.disconnect(initialResults[1])),
        Promise.resolve(connectionManager.connect(auth)),
        Promise.resolve(connectionManager.connect(auth)),
        Promise.resolve(connectionManager.connect(auth)),
      ];

      await Promise.all(operations);

      // Should have: 5 initial - 2 disconnected + 3 new = 6
      expect(
        connectionManager.getRoomConnectionCount("customer", "table-001"),
      ).toBe(6);
    });
  });

  describe("訊息傳送到特定客戶端", () => {
    it("應該能傳送訊息到單一客戶端", () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      const result1 = connectionManager.connect(auth);
      const result2 = connectionManager.connect(auth);

      const event: TestRealtimeEvent = {
        id: "event-private",
        type: EventTypes.CART_UPDATED,
        payload: { cartItems: [] },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const sent = connectionManager.sendToClient(result1.connectionId!, event);
      expect(sent).toBe(true);

      const conn1 = connectionManager.getConnection(result1.connectionId!);
      const conn2 = connectionManager.getConnection(result2.connectionId!);

      expect(conn1!.receivedMessages).toHaveLength(1);
      expect(conn2!.receivedMessages).toHaveLength(0);
    });

    it("應該在客戶端不存在時返回失敗", () => {
      const event: TestRealtimeEvent = {
        id: "event-test",
        type: EventTypes.CART_UPDATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const sent = connectionManager.sendToClient("non-existent", event);
      expect(sent).toBe(false);
    });

    it("應該在客戶端已斷開時返回失敗", () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const result = connectionManager.connect(auth);

      connectionManager.disconnect(result.connectionId!);

      const event: TestRealtimeEvent = {
        id: "event-test",
        type: EventTypes.CART_UPDATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const sent = connectionManager.sendToClient(result.connectionId!, event);
      expect(sent).toBe(false);
    });
  });

  describe("連接活動追蹤", () => {
    it("應該追蹤每個連接的最後活動時間", async () => {
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const result = connectionManager.connect(auth);

      const conn = connectionManager.getConnection(result.connectionId!);
      const initialActivity = conn!.lastActivity;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Send a message
      const event: TestRealtimeEvent = {
        id: "event-activity",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      connectionManager.sendToClient(result.connectionId!, event);

      const connAfter = connectionManager.getConnection(result.connectionId!);
      expect(connAfter!.lastActivity).toBeGreaterThanOrEqual(initialActivity);
    });

    it("應該記錄連接建立時間", () => {
      const before = Date.now();
      const auth = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );
      const result = connectionManager.connect(auth);
      const after = Date.now();

      const conn = connectionManager.getConnection(result.connectionId!);
      expect(conn!.connectedAt).toBeGreaterThanOrEqual(before);
      expect(conn!.connectedAt).toBeLessThanOrEqual(after);
    });
  });

  describe("多餐廳隔離", () => {
    it("應該隔離不同餐廳的連接", () => {
      const authRest1 = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-1",
        4,
      );
      const authRest2 = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-2",
        4,
      );

      connectionManager.connect(authRest1);
      connectionManager.connect(authRest1);
      connectionManager.connect(authRest2);

      const event: TestRealtimeEvent = {
        id: "event-rest1",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const deliveredCount = connectionManager.broadcastToRestaurant(
        "restaurant-1",
        event,
      );

      expect(deliveredCount).toBe(2);

      // Check restaurant-2 connections did not receive the message
      const allConnections = connectionManager.getAllConnections();
      const rest2Connections = allConnections.filter(
        (c) => c.restaurantId === "restaurant-2",
      );
      expect(
        rest2Connections.every((c) => c.receivedMessages.length === 0),
      ).toBe(true);
    });
  });
});
