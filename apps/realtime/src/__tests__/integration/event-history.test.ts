/**
 * Event History Integration Tests
 * 測試事件歷史記錄、檢索和重播功能
 *
 * 測試範圍：
 * - 事件儲存和檢索
 * - 事件歷史大小限制
 * - 基於時間戳的事件查詢
 * - 事件重播機制
 * - 斷線重連後的事件同步
 * - 事件過濾和搜尋
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { RealtimeAuthPayload } from "@makanmakan/shared-types";
import { RealtimeEventType } from "@makanmakan/shared-types";

// Test-local event interface for mock event history testing.
// Intentionally differs from production TestRealtimeEvent which uses eventId/data/restaurantId,
// since these tests validate event history storage logic, not event shape compliance.
interface TestRealtimeEvent {
  id?: string;
  type: RealtimeEventType;
  payload?: Record<string, unknown>;
  timestamp: number;
  roomType?: string;
  roomId?: string;
}

// Use string literal types for testing since enum values may differ
const EventTypes = {
  ORDER_CREATED: RealtimeEventType.NEW_ORDER,
  ORDER_STATUS_CHANGED: RealtimeEventType.ORDER_STATUS_UPDATE,
  CART_UPDATED: RealtimeEventType.MENU_ITEM_UPDATE,
} as const;
import { MockWebSocketPair } from "../helpers/test-utils";

// Event History Item
interface EventHistoryItem {
  event: TestRealtimeEvent;
  storedAt: number;
  deliveredTo: Set<string>; // connectionIds that received this event
}

// Mock Event History Manager
class MockEventHistoryManager {
  private history: Map<string, EventHistoryItem[]> = new Map(); // roomKey -> events
  private readonly maxEventsPerRoom: number;
  private readonly eventTTLMs: number;
  private eventIdCounter = 0;

  constructor(options?: { maxEventsPerRoom?: number; eventTTLMs?: number }) {
    this.maxEventsPerRoom = options?.maxEventsPerRoom ?? 1000;
    this.eventTTLMs = options?.eventTTLMs ?? 24 * 60 * 60 * 1000; // 24 hours default
  }

  // Store an event
  storeEvent(
    roomType: string,
    roomId: string,
    event: TestRealtimeEvent,
  ): { eventId: string; stored: boolean } {
    const roomKey = this.getRoomKey(roomType, roomId);
    let roomHistory = this.history.get(roomKey);

    if (!roomHistory) {
      roomHistory = [];
      this.history.set(roomKey, roomHistory);
    }

    // Assign event ID if not present
    const eventId = event.id ?? `evt_${++this.eventIdCounter}_${Date.now()}`;
    const eventWithId = { ...event, id: eventId };

    const historyItem: EventHistoryItem = {
      event: eventWithId,
      storedAt: Date.now(),
      deliveredTo: new Set(),
    };

    roomHistory.push(historyItem);

    // Enforce max events limit (remove oldest)
    while (roomHistory.length > this.maxEventsPerRoom) {
      roomHistory.shift();
    }

    return { eventId, stored: true };
  }

  // Get events since a specific event ID
  getEventsSince(
    roomType: string,
    roomId: string,
    lastEventId?: string,
  ): TestRealtimeEvent[] {
    const roomKey = this.getRoomKey(roomType, roomId);
    let roomHistory = this.history.get(roomKey);

    if (!roomHistory || roomHistory.length === 0) {
      return [];
    }

    // Remove expired events first
    this.cleanupExpiredEvents(roomKey);

    // Re-fetch after cleanup since the array may have been replaced
    roomHistory = this.history.get(roomKey);
    if (!roomHistory || roomHistory.length === 0) {
      return [];
    }

    if (!lastEventId) {
      // Return all events
      return roomHistory.map((item) => item.event);
    }

    // Find the index of lastEventId
    const index = roomHistory.findIndex(
      (item) => item.event.id === lastEventId,
    );

    if (index === -1) {
      // Event not found, return all events
      return roomHistory.map((item) => item.event);
    }

    // Return events after lastEventId
    return roomHistory.slice(index + 1).map((item) => item.event);
  }

  // Get events in a time range
  getEventsInTimeRange(
    roomType: string,
    roomId: string,
    startTime: number,
    endTime: number,
  ): TestRealtimeEvent[] {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomHistory = this.history.get(roomKey);

    if (!roomHistory) {
      return [];
    }

    return roomHistory
      .filter(
        (item) =>
          item.event.timestamp >= startTime && item.event.timestamp <= endTime,
      )
      .map((item) => item.event);
  }

  // Get events by type
  getEventsByType(
    roomType: string,
    roomId: string,
    eventTypes: RealtimeEventType[],
  ): TestRealtimeEvent[] {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomHistory = this.history.get(roomKey);

    if (!roomHistory) {
      return [];
    }

    return roomHistory
      .filter((item) =>
        eventTypes.includes(item.event.type as RealtimeEventType),
      )
      .map((item) => item.event);
  }

  // Get the latest N events
  getLatestEvents(
    roomType: string,
    roomId: string,
    count: number,
  ): TestRealtimeEvent[] {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomHistory = this.history.get(roomKey);

    if (!roomHistory) {
      return [];
    }

    return roomHistory.slice(-count).map((item) => item.event);
  }

  // Get event by ID
  getEventById(
    roomType: string,
    roomId: string,
    eventId: string,
  ): TestRealtimeEvent | undefined {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomHistory = this.history.get(roomKey);

    if (!roomHistory) {
      return undefined;
    }

    const item = roomHistory.find((h) => h.event.id === eventId);
    return item?.event;
  }

  // Mark event as delivered to a connection
  markDelivered(
    roomType: string,
    roomId: string,
    eventId: string,
    connectionId: string,
  ): boolean {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomHistory = this.history.get(roomKey);

    if (!roomHistory) {
      return false;
    }

    const item = roomHistory.find((h) => h.event.id === eventId);
    if (item) {
      item.deliveredTo.add(connectionId);
      return true;
    }

    return false;
  }

  // Get undelivered events for a connection
  getUndeliveredEvents(
    roomType: string,
    roomId: string,
    connectionId: string,
  ): TestRealtimeEvent[] {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomHistory = this.history.get(roomKey);

    if (!roomHistory) {
      return [];
    }

    return roomHistory
      .filter((item) => !item.deliveredTo.has(connectionId))
      .map((item) => item.event);
  }

  // Get event count for a room
  getEventCount(roomType: string, roomId: string): number {
    const roomKey = this.getRoomKey(roomType, roomId);
    return this.history.get(roomKey)?.length ?? 0;
  }

  // Clear history for a room
  clearRoomHistory(roomType: string, roomId: string): number {
    const roomKey = this.getRoomKey(roomType, roomId);
    const count = this.history.get(roomKey)?.length ?? 0;
    this.history.delete(roomKey);
    return count;
  }

  // Clear all history
  clearAll(): void {
    this.history.clear();
    this.eventIdCounter = 0;
  }

  // Cleanup expired events for a room
  private cleanupExpiredEvents(roomKey: string): void {
    const roomHistory = this.history.get(roomKey);
    if (!roomHistory) return;

    const now = Date.now();
    const validEvents = roomHistory.filter(
      (item) => now - item.storedAt < this.eventTTLMs,
    );

    if (validEvents.length !== roomHistory.length) {
      this.history.set(roomKey, validEvents);
    }
  }

  // Get statistics for a room
  getRoomStats(
    roomType: string,
    roomId: string,
  ): { eventCount: number; oldestEvent?: number; newestEvent?: number } {
    const roomKey = this.getRoomKey(roomType, roomId);
    const roomHistory = this.history.get(roomKey);

    if (!roomHistory || roomHistory.length === 0) {
      return { eventCount: 0 };
    }

    return {
      eventCount: roomHistory.length,
      oldestEvent: roomHistory[0].event.timestamp,
      newestEvent: roomHistory[roomHistory.length - 1].event.timestamp,
    };
  }

  private getRoomKey(roomType: string, roomId: string): string {
    return `${roomType}:${roomId}`;
  }
}

// Mock Reconnection Handler
class MockReconnectionHandler {
  private eventHistory: MockEventHistoryManager;
  private lastEventIds: Map<string, string> = new Map(); // connectionId -> lastEventId

  constructor(eventHistory: MockEventHistoryManager) {
    this.eventHistory = eventHistory;
  }

  // Record the last event seen by a connection
  recordLastEvent(connectionId: string, eventId: string): void {
    this.lastEventIds.set(connectionId, eventId);
  }

  // Get missed events for a reconnecting client
  getMissedEvents(
    connectionId: string,
    roomType: string,
    roomId: string,
  ): TestRealtimeEvent[] {
    const lastEventId = this.lastEventIds.get(connectionId);
    return this.eventHistory.getEventsSince(roomType, roomId, lastEventId);
  }

  // Replay events to a connection
  replayEvents(
    connectionId: string,
    roomType: string,
    roomId: string,
    onEvent: (event: TestRealtimeEvent) => void,
  ): number {
    const missedEvents = this.getMissedEvents(connectionId, roomType, roomId);

    for (const event of missedEvents) {
      onEvent(event);
      this.eventHistory.markDelivered(
        roomType,
        roomId,
        event.id!,
        connectionId,
      );
      this.recordLastEvent(connectionId, event.id!);
    }

    return missedEvents.length;
  }

  // Clear tracking for a connection
  clearConnection(connectionId: string): void {
    this.lastEventIds.delete(connectionId);
  }
}

describe("Event History Integration Tests", () => {
  let eventHistory: MockEventHistoryManager;
  let reconnectionHandler: MockReconnectionHandler;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        WebSocketPair: typeof MockWebSocketPair;
      }
    ).WebSocketPair = MockWebSocketPair;
    eventHistory = new MockEventHistoryManager();
    reconnectionHandler = new MockReconnectionHandler(eventHistory);
  });

  afterEach(() => {
    eventHistory.clearAll();
    vi.clearAllMocks();
  });

  describe("事件儲存和檢索", () => {
    it("應該正確儲存事件", () => {
      const event: TestRealtimeEvent = {
        id: "event-001",
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 1 },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const result = eventHistory.storeEvent("customer", "table-001", event);

      expect(result.stored).toBe(true);
      expect(result.eventId).toBe("event-001");
      expect(eventHistory.getEventCount("customer", "table-001")).toBe(1);
    });

    it("應該自動分配事件 ID", () => {
      const event: TestRealtimeEvent = {
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 1 },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const result = eventHistory.storeEvent("customer", "table-001", event);

      expect(result.stored).toBe(true);
      expect(result.eventId).toMatch(/^evt_\d+_\d+$/);
    });

    it("應該能通過 ID 檢索事件", () => {
      const event: TestRealtimeEvent = {
        id: "event-lookup",
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 1, items: ["item1"] },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      eventHistory.storeEvent("customer", "table-001", event);

      const retrieved = eventHistory.getEventById(
        "customer",
        "table-001",
        "event-lookup",
      );

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe("event-lookup");
      expect(retrieved!.payload!.items).toContain("item1");
    });

    it("應該返回 undefined 當事件不存在時", () => {
      const retrieved = eventHistory.getEventById(
        "customer",
        "table-001",
        "non-existent",
      );
      expect(retrieved).toBeUndefined();
    });

    it("應該為不同房間分別儲存事件", () => {
      const event1: TestRealtimeEvent = {
        id: "event-room1",
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 1 },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      };

      const event2: TestRealtimeEvent = {
        id: "event-room2",
        type: EventTypes.ORDER_CREATED,
        payload: { orderId: 2 },
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-002",
      };

      eventHistory.storeEvent("customer", "table-001", event1);
      eventHistory.storeEvent("customer", "table-002", event2);

      expect(eventHistory.getEventCount("customer", "table-001")).toBe(1);
      expect(eventHistory.getEventCount("customer", "table-002")).toBe(1);

      const room1Events = eventHistory.getEventsSince("customer", "table-001");
      expect(room1Events[0].id).toBe("event-room1");
    });
  });

  describe("事件歷史大小限制", () => {
    it("應該在達到上限時移除舊事件", () => {
      const manager = new MockEventHistoryManager({ maxEventsPerRoom: 5 });

      // Store 7 events
      for (let i = 0; i < 7; i++) {
        manager.storeEvent("customer", "table-001", {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: { orderId: i },
          timestamp: Date.now() + i,
          roomType: "customer",
          roomId: "table-001",
        });
      }

      expect(manager.getEventCount("customer", "table-001")).toBe(5);

      // Should have kept the most recent 5 (events 2-6)
      const events = manager.getEventsSince("customer", "table-001");
      expect(events[0].id).toBe("event-2");
      expect(events[4].id).toBe("event-6");
    });

    it("應該移除過期的事件", async () => {
      const manager = new MockEventHistoryManager({ eventTTLMs: 100 });

      // Store an event
      manager.storeEvent("customer", "table-001", {
        id: "old-event",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Store another event to trigger cleanup
      manager.storeEvent("customer", "table-001", {
        id: "new-event",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      // The old event should be cleaned up when we retrieve
      const events = manager.getEventsSince("customer", "table-001");
      expect(events.find((e) => e.id === "old-event")).toBeUndefined();
      expect(events.find((e) => e.id === "new-event")).toBeDefined();
    });
  });

  describe("基於時間戳的事件查詢", () => {
    it("應該能查詢特定時間範圍內的事件", () => {
      const baseTime = Date.now();

      // Store events at different times
      for (let i = 0; i < 5; i++) {
        eventHistory.storeEvent("customer", "table-001", {
          id: `time-event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: { orderId: i },
          timestamp: baseTime + i * 1000, // 1 second apart
          roomType: "customer",
          roomId: "table-001",
        });
      }

      // Query for middle time range
      const events = eventHistory.getEventsInTimeRange(
        "customer",
        "table-001",
        baseTime + 1000,
        baseTime + 3000,
      );

      expect(events).toHaveLength(3);
      expect(events[0].id).toBe("time-event-1");
      expect(events[2].id).toBe("time-event-3");
    });

    it("應該返回空陣列當沒有匹配的事件時", () => {
      const baseTime = Date.now();

      eventHistory.storeEvent("customer", "table-001", {
        id: "event-1",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: baseTime,
        roomType: "customer",
        roomId: "table-001",
      });

      const events = eventHistory.getEventsInTimeRange(
        "customer",
        "table-001",
        baseTime + 10000,
        baseTime + 20000,
      );

      expect(events).toHaveLength(0);
    });
  });

  describe("按事件類型過濾", () => {
    it("應該能按類型過濾事件", () => {
      eventHistory.storeEvent("customer", "table-001", {
        id: "created-1",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-001", {
        id: "status-1",
        type: EventTypes.ORDER_STATUS_CHANGED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-001", {
        id: "status-2",
        type: EventTypes.ORDER_STATUS_CHANGED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      const statusEvents = eventHistory.getEventsByType(
        "customer",
        "table-001",
        [EventTypes.ORDER_STATUS_CHANGED],
      );

      expect(statusEvents).toHaveLength(2);
      expect(
        statusEvents.every((e) => e.type === EventTypes.ORDER_STATUS_CHANGED),
      ).toBe(true);
    });

    it("應該支援多種類型過濾", () => {
      eventHistory.storeEvent("customer", "table-001", {
        id: "created",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-001", {
        id: "status",
        type: EventTypes.ORDER_STATUS_CHANGED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-001", {
        id: "cart",
        type: EventTypes.CART_UPDATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      const orderEvents = eventHistory.getEventsByType(
        "customer",
        "table-001",
        [EventTypes.ORDER_CREATED, EventTypes.ORDER_STATUS_CHANGED],
      );

      expect(orderEvents).toHaveLength(2);
    });
  });

  describe("獲取最新事件", () => {
    it("應該返回最新的 N 個事件", () => {
      for (let i = 0; i < 10; i++) {
        eventHistory.storeEvent("customer", "table-001", {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: { orderId: i },
          timestamp: Date.now() + i,
          roomType: "customer",
          roomId: "table-001",
        });
      }

      const latest = eventHistory.getLatestEvents("customer", "table-001", 3);

      expect(latest).toHaveLength(3);
      expect(latest[0].id).toBe("event-7");
      expect(latest[1].id).toBe("event-8");
      expect(latest[2].id).toBe("event-9");
    });

    it("應該處理請求數量大於實際事件數的情況", () => {
      eventHistory.storeEvent("customer", "table-001", {
        id: "only-event",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      const latest = eventHistory.getLatestEvents("customer", "table-001", 10);

      expect(latest).toHaveLength(1);
      expect(latest[0].id).toBe("only-event");
    });
  });

  describe("事件重播機制", () => {
    it("應該獲取指定事件之後的所有事件", () => {
      for (let i = 0; i < 5; i++) {
        eventHistory.storeEvent("customer", "table-001", {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: { orderId: i },
          timestamp: Date.now() + i,
          roomType: "customer",
          roomId: "table-001",
        });
      }

      const eventsSince = eventHistory.getEventsSince(
        "customer",
        "table-001",
        "event-2",
      );

      expect(eventsSince).toHaveLength(2);
      expect(eventsSince[0].id).toBe("event-3");
      expect(eventsSince[1].id).toBe("event-4");
    });

    it("應該返回所有事件當指定 ID 不存在時", () => {
      for (let i = 0; i < 3; i++) {
        eventHistory.storeEvent("customer", "table-001", {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: {},
          timestamp: Date.now() + i,
          roomType: "customer",
          roomId: "table-001",
        });
      }

      const events = eventHistory.getEventsSince(
        "customer",
        "table-001",
        "non-existent",
      );

      expect(events).toHaveLength(3);
    });

    it("應該返回所有事件當沒有提供 ID 時", () => {
      for (let i = 0; i < 3; i++) {
        eventHistory.storeEvent("customer", "table-001", {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: {},
          timestamp: Date.now() + i,
          roomType: "customer",
          roomId: "table-001",
        });
      }

      const events = eventHistory.getEventsSince("customer", "table-001");

      expect(events).toHaveLength(3);
    });
  });

  describe("斷線重連後的事件同步", () => {
    it("應該追蹤連接的最後事件", () => {
      eventHistory.storeEvent("customer", "table-001", {
        id: "event-1",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      reconnectionHandler.recordLastEvent("conn-001", "event-1");

      // Add more events
      eventHistory.storeEvent("customer", "table-001", {
        id: "event-2",
        type: EventTypes.ORDER_STATUS_CHANGED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-001", {
        id: "event-3",
        type: EventTypes.ORDER_STATUS_CHANGED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      // Get missed events
      const missed = reconnectionHandler.getMissedEvents(
        "conn-001",
        "customer",
        "table-001",
      );

      expect(missed).toHaveLength(2);
      expect(missed[0].id).toBe("event-2");
      expect(missed[1].id).toBe("event-3");
    });

    it("應該能重播錯過的事件", () => {
      // Store initial events
      for (let i = 0; i < 3; i++) {
        eventHistory.storeEvent("customer", "table-001", {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: { orderId: i },
          timestamp: Date.now() + i,
          roomType: "customer",
          roomId: "table-001",
        });
      }

      // Client received event-0
      reconnectionHandler.recordLastEvent("conn-001", "event-0");

      // Replay missed events
      const receivedEvents: TestRealtimeEvent[] = [];
      const replayedCount = reconnectionHandler.replayEvents(
        "conn-001",
        "customer",
        "table-001",
        (event) => receivedEvents.push(event),
      );

      expect(replayedCount).toBe(2);
      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].id).toBe("event-1");
      expect(receivedEvents[1].id).toBe("event-2");
    });

    it("應該為新連接重播所有事件", () => {
      // Store events
      for (let i = 0; i < 3; i++) {
        eventHistory.storeEvent("customer", "table-001", {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: {},
          timestamp: Date.now() + i,
          roomType: "customer",
          roomId: "table-001",
        });
      }

      // New connection with no history
      const receivedEvents: TestRealtimeEvent[] = [];
      const replayedCount = reconnectionHandler.replayEvents(
        "new-conn",
        "customer",
        "table-001",
        (event) => receivedEvents.push(event),
      );

      expect(replayedCount).toBe(3);
      expect(receivedEvents).toHaveLength(3);
    });
  });

  describe("事件傳送追蹤", () => {
    it("應該追蹤事件的傳送狀態", () => {
      eventHistory.storeEvent("customer", "table-001", {
        id: "tracked-event",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      const marked = eventHistory.markDelivered(
        "customer",
        "table-001",
        "tracked-event",
        "conn-001",
      );

      expect(marked).toBe(true);

      // Should not appear in undelivered for conn-001
      const undelivered = eventHistory.getUndeliveredEvents(
        "customer",
        "table-001",
        "conn-001",
      );
      expect(undelivered.find((e) => e.id === "tracked-event")).toBeUndefined();
    });

    it("應該能獲取未傳送的事件", () => {
      // Store events
      eventHistory.storeEvent("customer", "table-001", {
        id: "delivered-event",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-001", {
        id: "undelivered-event",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      // Mark one as delivered
      eventHistory.markDelivered(
        "customer",
        "table-001",
        "delivered-event",
        "conn-001",
      );

      const undelivered = eventHistory.getUndeliveredEvents(
        "customer",
        "table-001",
        "conn-001",
      );

      expect(undelivered).toHaveLength(1);
      expect(undelivered[0].id).toBe("undelivered-event");
    });
  });

  describe("房間統計", () => {
    it("應該返回房間的事件統計", () => {
      const baseTime = Date.now();

      eventHistory.storeEvent("customer", "table-001", {
        id: "event-1",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: baseTime,
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-001", {
        id: "event-2",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: baseTime + 1000,
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-001", {
        id: "event-3",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: baseTime + 2000,
        roomType: "customer",
        roomId: "table-001",
      });

      const stats = eventHistory.getRoomStats("customer", "table-001");

      expect(stats.eventCount).toBe(3);
      expect(stats.oldestEvent).toBe(baseTime);
      expect(stats.newestEvent).toBe(baseTime + 2000);
    });

    it("應該處理空房間的統計", () => {
      const stats = eventHistory.getRoomStats("customer", "empty-room");

      expect(stats.eventCount).toBe(0);
      expect(stats.oldestEvent).toBeUndefined();
      expect(stats.newestEvent).toBeUndefined();
    });
  });

  describe("房間歷史清理", () => {
    it("應該能清理特定房間的歷史", () => {
      // Store events in multiple rooms
      eventHistory.storeEvent("customer", "table-001", {
        id: "event-1",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-001",
      });

      eventHistory.storeEvent("customer", "table-002", {
        id: "event-2",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId: "table-002",
      });

      const clearedCount = eventHistory.clearRoomHistory(
        "customer",
        "table-001",
      );

      expect(clearedCount).toBe(1);
      expect(eventHistory.getEventCount("customer", "table-001")).toBe(0);
      expect(eventHistory.getEventCount("customer", "table-002")).toBe(1);
    });

    it("應該能清理所有歷史", () => {
      for (let i = 0; i < 3; i++) {
        eventHistory.storeEvent("customer", `table-${i}`, {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: {},
          timestamp: Date.now(),
          roomType: "customer",
          roomId: `table-${i}`,
        });
      }

      eventHistory.clearAll();

      for (let i = 0; i < 3; i++) {
        expect(eventHistory.getEventCount("customer", `table-${i}`)).toBe(0);
      }
    });
  });

  describe("邊界情況", () => {
    it("應該處理空房間的查詢", () => {
      const events = eventHistory.getEventsSince("customer", "empty-room");
      expect(events).toHaveLength(0);
    });

    it("應該處理大量事件的儲存", () => {
      const count = 500;
      for (let i = 0; i < count; i++) {
        eventHistory.storeEvent("customer", "table-001", {
          id: `event-${i}`,
          type: EventTypes.ORDER_CREATED,
          payload: { orderId: i, data: "x".repeat(100) },
          timestamp: Date.now() + i,
          roomType: "customer",
          roomId: "table-001",
        });
      }

      expect(eventHistory.getEventCount("customer", "table-001")).toBe(count);

      const events = eventHistory.getEventsSince("customer", "table-001");
      expect(events).toHaveLength(count);
    });

    it("應該處理特殊字符的房間 ID", () => {
      const roomId = "table-特殊字符-001";

      eventHistory.storeEvent("customer", roomId, {
        id: "special-event",
        type: EventTypes.ORDER_CREATED,
        payload: {},
        timestamp: Date.now(),
        roomType: "customer",
        roomId,
      });

      expect(eventHistory.getEventCount("customer", roomId)).toBe(1);
      const event = eventHistory.getEventById(
        "customer",
        roomId,
        "special-event",
      );
      expect(event).toBeDefined();
    });

    it("應該處理並發的事件儲存", async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(
          eventHistory.storeEvent("customer", "table-001", {
            id: `concurrent-${i}`,
            type: EventTypes.ORDER_CREATED,
            payload: { orderId: i },
            timestamp: Date.now(),
            roomType: "customer",
            roomId: "table-001",
          }),
        ),
      );

      await Promise.all(promises);

      expect(eventHistory.getEventCount("customer", "table-001")).toBe(50);
    });
  });
});
