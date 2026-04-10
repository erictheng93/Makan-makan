/**
 * Durable Object Persistence Integration Tests
 * 測試 Durable Object 的狀態持久化功能
 *
 * 測試範圍：
 * - 連接狀態在 DO 重啟後的恢復
 * - 事件歷史的持久化和恢復
 * - Room 資訊的持久化
 * - 連接元數據的保存和讀取
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type {
  RealtimeAuthPayload,
  RealtimeEvent,
  NewOrderEvent,
  OrderStatusUpdateEvent,
  OrderStatus,
} from "@makanmakan/shared-types";
import { RealtimeEventType } from "@makanmakan/shared-types";

// Use mapping for event types to match actual enum values
const _EventTypes = {
  ORDER_CREATED: RealtimeEventType.NEW_ORDER,
  ORDER_STATUS_CHANGED: RealtimeEventType.ORDER_STATUS_UPDATE,
} as const;

// Helper to create a NewOrderEvent for testing
function createNewOrderEvent(
  eventId: string,
  orderId: number,
  restaurantId = "restaurant-123",
): NewOrderEvent {
  return {
    eventId,
    type: RealtimeEventType.NEW_ORDER,
    timestamp: Date.now(),
    restaurantId,
    data: {
      orderId,
      orderNumber: `ORD-${orderId}`,
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
  };
}

// Helper to create an OrderStatusUpdateEvent for testing
function createOrderStatusUpdateEvent(
  eventId: string,
  orderId: number,
  status: OrderStatus = "preparing",
  previousStatus: OrderStatus = "pending",
  restaurantId = "restaurant-123",
): OrderStatusUpdateEvent {
  return {
    eventId,
    type: RealtimeEventType.ORDER_STATUS_UPDATE,
    timestamp: Date.now(),
    restaurantId,
    data: {
      orderId,
      orderNumber: `ORD-${orderId}`,
      status,
      previousStatus,
    },
  };
}
import {
  createTestAuthPayload,
  MockWebSocketPair,
} from "../helpers/test-utils";

// Mock Durable Object Storage
class MockDurableObjectStorage {
  private storage: Map<string, any> = new Map();

  // Overloaded get method
  async get<T>(
    keyOrKeys: string | string[],
  ): Promise<T | undefined | Map<string, T>> {
    if (Array.isArray(keyOrKeys)) {
      const result = new Map<string, T>();
      for (const key of keyOrKeys) {
        if (this.storage.has(key)) {
          result.set(key, this.storage.get(key));
        }
      }
      return result;
    }
    return this.storage.get(keyOrKeys);
  }

  // Overloaded put method
  async put(
    keyOrEntries: string | Record<string, any>,
    value?: any,
  ): Promise<void> {
    if (typeof keyOrEntries === "string") {
      this.storage.set(keyOrEntries, value);
    } else {
      for (const [k, v] of Object.entries(keyOrEntries)) {
        this.storage.set(k, v);
      }
    }
  }

  // Overloaded delete method
  async delete(keyOrKeys: string | string[]): Promise<boolean | number> {
    if (Array.isArray(keyOrKeys)) {
      let count = 0;
      for (const key of keyOrKeys) {
        if (this.storage.delete(key)) count++;
      }
      return count;
    }
    return this.storage.delete(keyOrKeys);
  }

  async list(): Promise<Map<string, any>> {
    return new Map(this.storage);
  }

  // Test helper to clear storage
  clear(): void {
    this.storage.clear();
  }

  // Test helper to get all data
  getAll(): Map<string, any> {
    return new Map(this.storage);
  }
}

// Mock Durable Object State
class MockDurableObjectState {
  storage: MockDurableObjectStorage;
  id: { toString: () => string };

  constructor() {
    this.storage = new MockDurableObjectStorage();
    this.id = { toString: () => "test-durable-object-id" };
  }

  waitUntil(_promise: Promise<any>): void {
    // No-op for tests
  }
}

// Simulated RealtimeSession for testing persistence
class TestableRealtimeSession {
  private state: MockDurableObjectState;
  private connections: Map<string, any> = new Map();
  private roomInfo: { type: string; id: string } | null = null;
  private eventHistory: RealtimeEvent[] = [];
  private readonly MAX_EVENT_HISTORY = 100;

  constructor(state: MockDurableObjectState) {
    this.state = state;
  }

  // Initialize from storage (simulate DO wake-up)
  async initialize(): Promise<void> {
    // Restore room info
    const savedRoomInfo = (await this.state.storage.get<{
      type: string;
      id: string;
    }>("roomInfo")) as { type: string; id: string } | undefined;
    if (savedRoomInfo) {
      this.roomInfo = savedRoomInfo;
    }

    // Restore event history
    const savedHistory = (await this.state.storage.get<RealtimeEvent[]>(
      "eventHistory",
    )) as RealtimeEvent[] | undefined;
    if (savedHistory) {
      this.eventHistory = savedHistory;
    }

    // Restore connection metadata (not actual connections)
    const savedConnections =
      await this.state.storage.get<Map<string, any>>("connectionMetadata");
    if (savedConnections) {
      // Note: Actual WebSocket connections cannot be restored
      // But we can restore metadata for reconnection handling
    }
  }

  // Save state to storage
  async persistState(): Promise<void> {
    await this.state.storage.put("roomInfo", this.roomInfo);
    await this.state.storage.put("eventHistory", this.eventHistory);

    // Save connection metadata (without actual WebSocket references)
    const connectionMetadata: Record<string, any> = {};
    this.connections.forEach((info, id) => {
      connectionMetadata[id] = {
        id: info.id,
        type: info.type,
        roomId: info.roomId,
        connectedAt: info.connectedAt,
        lastActivity: info.lastActivity,
        auth: info.auth,
        lastEventId: info.lastEventId,
      };
    });
    await this.state.storage.put("connectionMetadata", connectionMetadata);
  }

  // Set room info
  setRoomInfo(type: string, id: string): void {
    this.roomInfo = { type, id };
  }

  getRoomInfo(): { type: string; id: string } | null {
    return this.roomInfo;
  }

  // Add connection
  addConnection(connectionId: string, info: any): void {
    this.connections.set(connectionId, info);
  }

  getConnection(connectionId: string): any {
    return this.connections.get(connectionId);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  // Add event to history
  addEvent(event: RealtimeEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.MAX_EVENT_HISTORY) {
      this.eventHistory.shift();
    }
  }

  getEventHistory(): RealtimeEvent[] {
    return [...this.eventHistory];
  }

  getEventsSince(eventId: string): RealtimeEvent[] {
    const index = this.eventHistory.findIndex((e) => e.eventId === eventId);
    if (index === -1) return this.eventHistory;
    return this.eventHistory.slice(index + 1);
  }

  // Get storage for verification
  getStorage(): MockDurableObjectStorage {
    return this.state.storage;
  }
}

describe("Durable Object Persistence", () => {
  let state: MockDurableObjectState;
  let session: TestableRealtimeSession;

  beforeEach(() => {
    (globalThis as any).WebSocketPair = MockWebSocketPair;
    state = new MockDurableObjectState();
    session = new TestableRealtimeSession(state);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Room Info Persistence", () => {
    it("應該持久化 room 資訊", async () => {
      session.setRoomInfo("customer", "table-001");
      await session.persistState();

      const savedRoomInfo = await state.storage.get<{
        type: string;
        id: string;
      }>("roomInfo");
      expect(savedRoomInfo).toEqual({ type: "customer", id: "table-001" });
    });

    it("應該在初始化時恢復 room 資訊", async () => {
      // 先保存
      session.setRoomInfo("admin", "restaurant-123");
      await session.persistState();

      // 模擬新的 session（DO 重啟）
      const newSession = new TestableRealtimeSession(state);
      await newSession.initialize();

      expect(newSession.getRoomInfo()).toEqual({
        type: "admin",
        id: "restaurant-123",
      });
    });

    it("應該處理空的 room 資訊", async () => {
      await session.initialize();
      expect(session.getRoomInfo()).toBeNull();
    });
  });

  describe("Event History Persistence", () => {
    it("應該持久化事件歷史", async () => {
      const events: RealtimeEvent[] = [
        createNewOrderEvent("event-1", 1, "table-001"),
        createOrderStatusUpdateEvent(
          "event-2",
          1,
          "preparing",
          "pending",
          "table-001",
        ),
      ];

      events.forEach((e) => session.addEvent(e));
      await session.persistState();

      const savedHistory = (await state.storage.get<RealtimeEvent[]>(
        "eventHistory",
      )) as RealtimeEvent[];
      expect(savedHistory).toHaveLength(2);
      expect(savedHistory![0].eventId).toBe("event-1");
      expect(savedHistory![1].eventId).toBe("event-2");
    });

    it("應該在初始化時恢復事件歷史", async () => {
      const event: RealtimeEvent = createNewOrderEvent(
        "event-001",
        1,
        "restaurant-123",
      );

      session.addEvent(event);
      await session.persistState();

      const newSession = new TestableRealtimeSession(state);
      await newSession.initialize();

      const history = newSession.getEventHistory();
      expect(history).toHaveLength(1);
      expect(history[0].eventId).toBe("event-001");
    });

    it("應該限制事件歷史大小", async () => {
      // 添加超過 MAX_EVENT_HISTORY 的事件
      for (let i = 0; i < 150; i++) {
        session.addEvent(createNewOrderEvent(`event-${i}`, i, "table-001"));
      }

      const history = session.getEventHistory();
      expect(history.length).toBeLessThanOrEqual(100);
      // 應該保留最新的事件
      expect(history[history.length - 1].eventId).toBe("event-149");
    });

    it("應該能獲取特定事件之後的歷史", async () => {
      for (let i = 0; i < 10; i++) {
        session.addEvent(createNewOrderEvent(`event-${i}`, i, "table-001"));
      }

      const eventsSince = session.getEventsSince("event-5");
      expect(eventsSince).toHaveLength(4); // event-6, 7, 8, 9
      expect(eventsSince[0].eventId).toBe("event-6");
    });
  });

  describe("Connection Metadata Persistence", () => {
    it("應該持久化連接元數據", async () => {
      const authPayload = createTestAuthPayload(
        "customer",
        "table-001",
        "restaurant-123",
        4,
      );

      session.addConnection("conn-001", {
        id: "conn-001",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        auth: authPayload,
        lastEventId: "event-5",
      });

      await session.persistState();

      const savedMetadata = (await state.storage.get<Record<string, any>>(
        "connectionMetadata",
      )) as Record<string, any>;
      expect(savedMetadata).toBeDefined();
      expect(savedMetadata["conn-001"]).toBeDefined();
      expect(savedMetadata["conn-001"].id).toBe("conn-001");
      expect(savedMetadata["conn-001"].type).toBe("customer");
      expect(savedMetadata["conn-001"].lastEventId).toBe("event-5");
    });

    it("應該持久化多個連接的元數據", async () => {
      for (let i = 0; i < 3; i++) {
        session.addConnection(`conn-${i}`, {
          id: `conn-${i}`,
          type: "customer",
          roomId: "table-001",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        });
      }

      await session.persistState();

      const savedMetadata = (await state.storage.get<Record<string, any>>(
        "connectionMetadata",
      )) as Record<string, any>;
      expect(Object.keys(savedMetadata!).length).toBe(3);
    });
  });

  describe("State Recovery After Restart", () => {
    it("應該在 DO 重啟後完整恢復狀態", async () => {
      // 設置初始狀態
      session.setRoomInfo("kitchen", "restaurant-456");

      session.addConnection("conn-001", {
        id: "conn-001",
        type: "kitchen",
        roomId: "restaurant-456",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      session.addEvent(
        createOrderStatusUpdateEvent(
          "event-001",
          1,
          "ready",
          "preparing",
          "restaurant-456",
        ),
      );

      await session.persistState();

      // 模擬 DO 重啟
      const newSession = new TestableRealtimeSession(state);
      await newSession.initialize();

      // 驗證恢復
      expect(newSession.getRoomInfo()).toEqual({
        type: "kitchen",
        id: "restaurant-456",
      });
      expect(newSession.getEventHistory()).toHaveLength(1);
      expect(newSession.getEventHistory()[0].eventId).toBe("event-001");
    });

    it("應該處理空的初始狀態", async () => {
      const freshState = new MockDurableObjectState();
      const freshSession = new TestableRealtimeSession(freshState);

      await freshSession.initialize();

      expect(freshSession.getRoomInfo()).toBeNull();
      expect(freshSession.getEventHistory()).toHaveLength(0);
      expect(freshSession.getConnectionCount()).toBe(0);
    });
  });

  describe("Storage Operations", () => {
    it("應該正確處理存儲的讀寫操作", async () => {
      await state.storage.put("testKey", { value: "test" });
      const result = await state.storage.get<{ value: string }>("testKey");
      expect(result).toEqual({ value: "test" });
    });

    it("應該正確處理不存在的鍵", async () => {
      const result = await state.storage.get("nonExistentKey");
      expect(result).toBeUndefined();
    });

    it("應該正確刪除存儲的數據", async () => {
      await state.storage.put("toDelete", "value");
      expect(await state.storage.get("toDelete")).toBe("value");

      await state.storage.delete("toDelete");
      expect(await state.storage.get("toDelete")).toBeUndefined();
    });

    it("應該正確列出所有存儲的數據", async () => {
      await state.storage.put("key1", "value1");
      await state.storage.put("key2", "value2");

      const all = await state.storage.list();
      expect(all.size).toBe(2);
      expect(all.get("key1")).toBe("value1");
      expect(all.get("key2")).toBe("value2");
    });
  });

  describe("Edge Cases", () => {
    it("應該處理大量事件的持久化", async () => {
      // 添加 100 個事件
      for (let i = 0; i < 100; i++) {
        session.addEvent(createNewOrderEvent(`event-${i}`, i, "table-001"));
      }

      await session.persistState();
      const savedHistory = (await state.storage.get<RealtimeEvent[]>(
        "eventHistory",
      )) as RealtimeEvent[];
      expect(savedHistory).toHaveLength(100);
    });

    it("應該處理特殊字符的 room ID", async () => {
      session.setRoomInfo("customer", "table-特殊字符-001");
      await session.persistState();

      const newSession = new TestableRealtimeSession(state);
      await newSession.initialize();

      expect(newSession.getRoomInfo()?.id).toBe("table-特殊字符-001");
    });

    it("應該處理 null 和 undefined 值", async () => {
      session.setRoomInfo("customer", "table-001");
      session.addConnection("conn-001", {
        id: "conn-001",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        auth: null, // null auth
        lastEventId: undefined, // undefined lastEventId
      });

      await session.persistState();

      const savedMetadata = (await state.storage.get<Record<string, any>>(
        "connectionMetadata",
      )) as Record<string, any>;
      expect(savedMetadata["conn-001"].auth).toBeNull();
      expect(savedMetadata["conn-001"].lastEventId).toBeUndefined();
    });
  });
});
