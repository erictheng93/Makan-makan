/**
 * Cross-Room Communication Integration Tests
 * 測試不同 room 之間的通訊功能
 *
 * 測試範圍：
 * - 跨房間廣播
 * - 餐廳級別的事件傳播（廚房、管理後台、顧客端）
 * - 多餐廳隔離
 * - 訂單相關事件的跨房間傳播
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type {
  RealtimeEvent,
  OrderStatusUpdateEvent,
} from "@makanmakan/shared-types";
import { RealtimeEventType, OrderStatus } from "@makanmakan/shared-types";

// Use mapping for event types to match actual enum values
const EventTypes = {
  ORDER_CREATED: RealtimeEventType.NEW_ORDER,
  ORDER_STATUS_CHANGED: RealtimeEventType.ORDER_STATUS_UPDATE,
  ORDER_CANCELLED: RealtimeEventType.ORDER_CANCELLED,
  KITCHEN_QUEUE_UPDATE: RealtimeEventType.KITCHEN_QUEUE_UPDATE,
  TABLE_STATUS_UPDATE: RealtimeEventType.TABLE_STATUS_UPDATE,
} as const;
import { MockWebSocketPair } from "../helpers/test-utils";

// Mock Room Manager 模擬跨房間通訊
interface RoomConnection {
  id: string;
  roomType: "customer" | "admin" | "kitchen";
  roomId: string;
  restaurantId: string;
  messages: RealtimeEvent[];
}

class MockRoomManager {
  private rooms: Map<string, Map<string, RoomConnection>> = new Map();

  // 建立連接到特定房間
  connect(
    connectionId: string,
    roomType: "customer" | "admin" | "kitchen",
    roomId: string,
    restaurantId: string,
  ): RoomConnection {
    const roomKey = `${roomType}:${roomId}`;

    if (!this.rooms.has(roomKey)) {
      this.rooms.set(roomKey, new Map());
    }

    const connection: RoomConnection = {
      id: connectionId,
      roomType,
      roomId,
      restaurantId,
      messages: [],
    };

    this.rooms.get(roomKey)!.set(connectionId, connection);
    return connection;
  }

  // 斷開連接
  disconnect(connectionId: string, roomType: string, roomId: string): void {
    const roomKey = `${roomType}:${roomId}`;
    const room = this.rooms.get(roomKey);
    if (room) {
      room.delete(connectionId);
    }
  }

  // 向單一房間廣播
  broadcastToRoom(
    roomType: string,
    roomId: string,
    event: RealtimeEvent,
  ): number {
    const roomKey = `${roomType}:${roomId}`;
    const room = this.rooms.get(roomKey);

    if (!room) return 0;

    room.forEach((connection) => {
      connection.messages.push(event);
    });

    return room.size;
  }

  // 向餐廳的所有相關房間廣播
  broadcastToRestaurant(
    restaurantId: string,
    event: RealtimeEvent,
    targetRoomTypes?: ("customer" | "admin" | "kitchen")[],
  ): { [key: string]: number } {
    const result: { [key: string]: number } = {};

    this.rooms.forEach((connections, roomKey) => {
      connections.forEach((connection) => {
        if (connection.restaurantId === restaurantId) {
          // 檢查是否需要過濾房間類型
          if (
            !targetRoomTypes ||
            targetRoomTypes.includes(connection.roomType)
          ) {
            connection.messages.push(event);

            if (!result[roomKey]) {
              result[roomKey] = 0;
            }
            result[roomKey]++;
          }
        }
      });
    });

    return result;
  }

  // 向所有顧客桌位廣播（同一餐廳）
  broadcastToAllTables(restaurantId: string, event: RealtimeEvent): number {
    let count = 0;

    this.rooms.forEach((connections) => {
      connections.forEach((connection) => {
        if (
          connection.restaurantId === restaurantId &&
          connection.roomType === "customer"
        ) {
          connection.messages.push(event);
          count++;
        }
      });
    });

    return count;
  }

  // 獲取連接
  getConnection(
    roomType: string,
    roomId: string,
    connectionId: string,
  ): RoomConnection | undefined {
    const roomKey = `${roomType}:${roomId}`;
    const room = this.rooms.get(roomKey);
    return room?.get(connectionId);
  }

  // 獲取房間的所有連接
  getRoomConnections(roomType: string, roomId: string): RoomConnection[] {
    const roomKey = `${roomType}:${roomId}`;
    const room = this.rooms.get(roomKey);
    return room ? Array.from(room.values()) : [];
  }

  // 獲取餐廳的所有連接
  getRestaurantConnections(restaurantId: string): RoomConnection[] {
    const connections: RoomConnection[] = [];

    this.rooms.forEach((room) => {
      room.forEach((connection) => {
        if (connection.restaurantId === restaurantId) {
          connections.push(connection);
        }
      });
    });

    return connections;
  }

  // 清除所有連接
  clear(): void {
    this.rooms.clear();
  }

  // 獲取統計資訊
  getStats(): {
    totalRooms: number;
    totalConnections: number;
    connectionsByType: Record<string, number>;
  } {
    let totalConnections = 0;
    const connectionsByType: Record<string, number> = {};

    this.rooms.forEach((room, roomKey) => {
      const roomType = roomKey.split(":")[0];
      totalConnections += room.size;

      if (!connectionsByType[roomType]) {
        connectionsByType[roomType] = 0;
      }
      connectionsByType[roomType] += room.size;
    });

    return {
      totalRooms: this.rooms.size,
      totalConnections,
      connectionsByType,
    };
  }
}

describe("Cross-Room Communication", () => {
  let roomManager: MockRoomManager;

  beforeEach(() => {
    (globalThis as any).WebSocketPair = MockWebSocketPair;
    roomManager = new MockRoomManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
    roomManager.clear();
  });

  describe("Basic Room Operations", () => {
    it("應該能建立連接到房間", () => {
      const connection = roomManager.connect(
        "conn-001",
        "customer",
        "table-001",
        "restaurant-123",
      );

      expect(connection.id).toBe("conn-001");
      expect(connection.roomType).toBe("customer");
      expect(connection.roomId).toBe("table-001");
      expect(connection.restaurantId).toBe("restaurant-123");
    });

    it("應該能建立多個連接到同一房間", () => {
      roomManager.connect(
        "conn-001",
        "customer",
        "table-001",
        "restaurant-123",
      );
      roomManager.connect(
        "conn-002",
        "customer",
        "table-001",
        "restaurant-123",
      );
      roomManager.connect(
        "conn-003",
        "customer",
        "table-001",
        "restaurant-123",
      );

      const connections = roomManager.getRoomConnections(
        "customer",
        "table-001",
      );
      expect(connections.length).toBe(3);
    });

    it("應該能斷開連接", () => {
      roomManager.connect(
        "conn-001",
        "customer",
        "table-001",
        "restaurant-123",
      );
      roomManager.disconnect("conn-001", "customer", "table-001");

      const connections = roomManager.getRoomConnections(
        "customer",
        "table-001",
      );
      expect(connections.length).toBe(0);
    });
  });

  describe("Room Broadcasting", () => {
    it("應該能向單一房間廣播訊息", () => {
      roomManager.connect(
        "conn-001",
        "customer",
        "table-001",
        "restaurant-123",
      );
      roomManager.connect(
        "conn-002",
        "customer",
        "table-001",
        "restaurant-123",
      );

      const event: RealtimeEvent = {
        eventId: "event-001",
        type: EventTypes.ORDER_CREATED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          tableId: "table-001",
          items: [
            {
              orderItemId: 1,
              menuItemId: 1,
              menuItemName: "Test Item",
              quantity: 2,
              price: 100,
            },
          ],
          totalAmount: 200,
        },
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
      };

      const count = roomManager.broadcastToRoom("customer", "table-001", event);

      expect(count).toBe(2);

      const conn1 = roomManager.getConnection(
        "customer",
        "table-001",
        "conn-001",
      );
      const conn2 = roomManager.getConnection(
        "customer",
        "table-001",
        "conn-002",
      );

      expect(conn1?.messages).toHaveLength(1);
      expect(conn2?.messages).toHaveLength(1);
      expect(conn1?.messages[0].eventId).toBe("event-001");
    });

    it("應該不影響其他房間", () => {
      roomManager.connect(
        "conn-001",
        "customer",
        "table-001",
        "restaurant-123",
      );
      roomManager.connect(
        "conn-002",
        "customer",
        "table-002",
        "restaurant-123",
      );

      const event: RealtimeEvent = {
        eventId: "event-001",
        type: EventTypes.ORDER_CREATED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          tableId: "table-001",
          items: [
            {
              orderItemId: 1,
              menuItemId: 1,
              menuItemName: "Test Item",
              quantity: 1,
              price: 100,
            },
          ],
          totalAmount: 100,
        },
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
      };

      roomManager.broadcastToRoom("customer", "table-001", event);

      const conn1 = roomManager.getConnection(
        "customer",
        "table-001",
        "conn-001",
      );
      const conn2 = roomManager.getConnection(
        "customer",
        "table-002",
        "conn-002",
      );

      expect(conn1?.messages).toHaveLength(1);
      expect(conn2?.messages).toHaveLength(0);
    });
  });

  describe("Restaurant-Level Broadcasting", () => {
    beforeEach(() => {
      // 設置餐廳 123 的連接
      roomManager.connect(
        "customer-1",
        "customer",
        "table-001",
        "restaurant-123",
      );
      roomManager.connect(
        "customer-2",
        "customer",
        "table-002",
        "restaurant-123",
      );
      roomManager.connect(
        "admin-1",
        "admin",
        "restaurant-123",
        "restaurant-123",
      );
      roomManager.connect(
        "kitchen-1",
        "kitchen",
        "restaurant-123",
        "restaurant-123",
      );

      // 設置餐廳 456 的連接（應被隔離）
      roomManager.connect(
        "customer-3",
        "customer",
        "table-001",
        "restaurant-456",
      );
      roomManager.connect(
        "admin-2",
        "admin",
        "restaurant-456",
        "restaurant-456",
      );
    });

    it("應該能向餐廳的所有房間廣播", () => {
      const event: RealtimeEvent = {
        eventId: "event-001",
        type: RealtimeEventType.MENU_ITEM_UPDATE,
        data: { menuItemId: 1, action: "updated" as const },
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
      };

      const result = roomManager.broadcastToRestaurant("restaurant-123", event);

      // 應該通知餐廳 123 的所有連接
      expect(Object.values(result).reduce((a, b) => a + b, 0)).toBe(4);

      // 餐廳 456 的連接不應收到訊息
      const conn456 = roomManager.getConnection(
        "customer",
        "table-001",
        "customer-3",
      );
      expect(conn456?.messages).toHaveLength(0);
    });

    it("應該能只向特定類型的房間廣播", () => {
      const event: RealtimeEvent = {
        eventId: "event-001",
        type: EventTypes.ORDER_CREATED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          items: [
            {
              orderItemId: 1,
              menuItemId: 1,
              menuItemName: "Test Item",
              quantity: 1,
              price: 100,
            },
          ],
          totalAmount: 100,
        },
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
      };

      // 只向管理後台和廚房廣播
      roomManager.broadcastToRestaurant("restaurant-123", event, [
        "admin",
        "kitchen",
      ]);

      const adminConn = roomManager.getConnection(
        "admin",
        "restaurant-123",
        "admin-1",
      );
      const kitchenConn = roomManager.getConnection(
        "kitchen",
        "restaurant-123",
        "kitchen-1",
      );
      const customerConn = roomManager.getConnection(
        "customer",
        "table-001",
        "customer-1",
      );

      expect(adminConn?.messages).toHaveLength(1);
      expect(kitchenConn?.messages).toHaveLength(1);
      expect(customerConn?.messages).toHaveLength(0);
    });

    it("應該能向所有顧客桌位廣播", () => {
      const event: RealtimeEvent = {
        eventId: "event-001",
        type: RealtimeEventType.RESTAURANT_STATUS_UPDATE,
        data: { isOpen: false },
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
      };

      const count = roomManager.broadcastToAllTables("restaurant-123", event);

      expect(count).toBe(2); // 只有 customer-1 和 customer-2

      const conn1 = roomManager.getConnection(
        "customer",
        "table-001",
        "customer-1",
      );
      const conn2 = roomManager.getConnection(
        "customer",
        "table-002",
        "customer-2",
      );
      const adminConn = roomManager.getConnection(
        "admin",
        "restaurant-123",
        "admin-1",
      );

      expect(conn1?.messages).toHaveLength(1);
      expect(conn2?.messages).toHaveLength(1);
      expect(adminConn?.messages).toHaveLength(0);
    });
  });

  describe("Order Event Propagation", () => {
    beforeEach(() => {
      // 設置完整的餐廳環境
      roomManager.connect(
        "customer-1",
        "customer",
        "table-001",
        "restaurant-123",
      );
      roomManager.connect(
        "admin-1",
        "admin",
        "restaurant-123",
        "restaurant-123",
      );
      roomManager.connect(
        "kitchen-1",
        "kitchen",
        "restaurant-123",
        "restaurant-123",
      );
    });

    it("新訂單應該通知廚房和管理後台", () => {
      const orderEvent: RealtimeEvent = {
        eventId: "event-001",
        type: EventTypes.ORDER_CREATED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          tableId: "table-001",
          items: [
            {
              orderItemId: 1,
              menuItemId: 1,
              menuItemName: "Test Item",
              quantity: 2,
              price: 100,
            },
          ],
          totalAmount: 200,
        },
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
      };

      // 訂單建立應該通知廚房和管理後台
      roomManager.broadcastToRestaurant("restaurant-123", orderEvent, [
        "admin",
        "kitchen",
      ]);

      const adminConn = roomManager.getConnection(
        "admin",
        "restaurant-123",
        "admin-1",
      );
      const kitchenConn = roomManager.getConnection(
        "kitchen",
        "restaurant-123",
        "kitchen-1",
      );

      expect(adminConn?.messages).toHaveLength(1);
      expect(kitchenConn?.messages).toHaveLength(1);
      expect(adminConn?.messages[0].type).toBe(EventTypes.ORDER_CREATED);
    });

    it("訂單狀態更新應該通知顧客", () => {
      const statusEvent: RealtimeEvent = {
        eventId: "event-002",
        type: EventTypes.ORDER_STATUS_CHANGED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          status: OrderStatus.PREPARING,
          previousStatus: OrderStatus.CONFIRMED,
        },
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
      };

      // 狀態更新應該通知對應桌位的顧客
      roomManager.broadcastToRoom("customer", "table-001", statusEvent);

      const customerConn = roomManager.getConnection(
        "customer",
        "table-001",
        "customer-1",
      );
      expect(customerConn?.messages).toHaveLength(1);
      const receivedEvent = customerConn?.messages[0] as OrderStatusUpdateEvent;
      expect(receivedEvent.data.status).toBe(OrderStatus.PREPARING);
    });

    it("訂單完成應該通知所有相關方", () => {
      const readyEvent: RealtimeEvent = {
        eventId: "event-003",
        type: EventTypes.ORDER_STATUS_CHANGED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          status: OrderStatus.READY,
          previousStatus: OrderStatus.PREPARING,
        },
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
      };

      // 訂單完成應該通知顧客、管理後台
      roomManager.broadcastToRestaurant("restaurant-123", readyEvent, [
        "customer",
        "admin",
      ]);

      const customerConn = roomManager.getConnection(
        "customer",
        "table-001",
        "customer-1",
      );
      const adminConn = roomManager.getConnection(
        "admin",
        "restaurant-123",
        "admin-1",
      );
      const kitchenConn = roomManager.getConnection(
        "kitchen",
        "restaurant-123",
        "kitchen-1",
      );

      expect(customerConn?.messages).toHaveLength(1);
      expect(adminConn?.messages).toHaveLength(1);
      expect(kitchenConn?.messages).toHaveLength(0);
    });
  });

  describe("Multi-Restaurant Isolation", () => {
    beforeEach(() => {
      // 餐廳 A
      roomManager.connect(
        "a-customer",
        "customer",
        "table-001",
        "restaurant-A",
      );
      roomManager.connect("a-admin", "admin", "restaurant-A", "restaurant-A");
      roomManager.connect(
        "a-kitchen",
        "kitchen",
        "restaurant-A",
        "restaurant-A",
      );

      // 餐廳 B
      roomManager.connect(
        "b-customer",
        "customer",
        "table-001",
        "restaurant-B",
      );
      roomManager.connect("b-admin", "admin", "restaurant-B", "restaurant-B");
      roomManager.connect(
        "b-kitchen",
        "kitchen",
        "restaurant-B",
        "restaurant-B",
      );
    });

    it("餐廳 A 的事件不應影響餐廳 B", () => {
      const event: RealtimeEvent = {
        eventId: "event-001",
        type: EventTypes.ORDER_CREATED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          items: [
            {
              orderItemId: 1,
              menuItemId: 1,
              menuItemName: "Test Item",
              quantity: 1,
              price: 100,
            },
          ],
          totalAmount: 100,
        },
        timestamp: Date.now(),
        restaurantId: "restaurant-A",
      };

      roomManager.broadcastToRestaurant("restaurant-A", event);

      // 餐廳 A 的連接應收到訊息
      const aCustomer = roomManager.getConnection(
        "customer",
        "table-001",
        "a-customer",
      );
      const aAdmin = roomManager.getConnection(
        "admin",
        "restaurant-A",
        "a-admin",
      );
      expect(aCustomer?.messages).toHaveLength(1);
      expect(aAdmin?.messages).toHaveLength(1);

      // 餐廳 B 的連接不應收到訊息
      const bCustomer = roomManager.getConnection(
        "customer",
        "table-001",
        "b-customer",
      );
      const bAdmin = roomManager.getConnection(
        "admin",
        "restaurant-B",
        "b-admin",
      );
      expect(bCustomer?.messages).toHaveLength(0);
      expect(bAdmin?.messages).toHaveLength(0);
    });

    it("應該能獲取特定餐廳的所有連接", () => {
      const connectionsA = roomManager.getRestaurantConnections("restaurant-A");
      const connectionsB = roomManager.getRestaurantConnections("restaurant-B");

      expect(connectionsA.length).toBe(3);
      expect(connectionsB.length).toBe(3);

      connectionsA.forEach((conn) => {
        expect(conn.restaurantId).toBe("restaurant-A");
      });

      connectionsB.forEach((conn) => {
        expect(conn.restaurantId).toBe("restaurant-B");
      });
    });
  });

  describe("Connection Statistics", () => {
    it("應該正確統計連接數", () => {
      roomManager.connect("c1", "customer", "table-001", "r1");
      roomManager.connect("c2", "customer", "table-002", "r1");
      roomManager.connect("a1", "admin", "r1", "r1");
      roomManager.connect("k1", "kitchen", "r1", "r1");
      roomManager.connect("k2", "kitchen", "r2", "r2");

      const stats = roomManager.getStats();

      expect(stats.totalRooms).toBe(5);
      expect(stats.totalConnections).toBe(5);
      expect(stats.connectionsByType.customer).toBe(2);
      expect(stats.connectionsByType.admin).toBe(1);
      expect(stats.connectionsByType.kitchen).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("應該處理廣播到空房間", () => {
      const event: RealtimeEvent = {
        eventId: "event-001",
        type: EventTypes.ORDER_CREATED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          items: [
            {
              orderItemId: 1,
              menuItemId: 1,
              menuItemName: "Test Item",
              quantity: 1,
              price: 100,
            },
          ],
          totalAmount: 100,
        },
        timestamp: Date.now(),
        restaurantId: "non-existent",
      };

      const count = roomManager.broadcastToRoom(
        "customer",
        "non-existent",
        event,
      );
      expect(count).toBe(0);
    });

    it("應該處理廣播到不存在的餐廳", () => {
      const event: RealtimeEvent = {
        eventId: "event-001",
        type: EventTypes.ORDER_CREATED,
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          items: [
            {
              orderItemId: 1,
              menuItemId: 1,
              menuItemName: "Test Item",
              quantity: 1,
              price: 100,
            },
          ],
          totalAmount: 100,
        },
        timestamp: Date.now(),
        restaurantId: "non-existent",
      };

      const result = roomManager.broadcastToRestaurant(
        "non-existent-restaurant",
        event,
      );
      expect(Object.keys(result).length).toBe(0);
    });

    it("應該處理重複的連接 ID", () => {
      roomManager.connect("conn-001", "customer", "table-001", "r1");
      roomManager.connect("conn-001", "customer", "table-001", "r1"); // 重複

      const connections = roomManager.getRoomConnections(
        "customer",
        "table-001",
      );
      expect(connections.length).toBe(1); // Map 會覆蓋重複的 key
    });
  });
});
