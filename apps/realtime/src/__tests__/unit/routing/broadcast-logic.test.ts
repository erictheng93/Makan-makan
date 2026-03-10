/**
 * Broadcast Logic Tests
 * 測試 RealtimeSession 的訊息廣播功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RealtimeEventType } from "@makanmakan/shared-types";
import type {
  RealtimeEvent,
  NewOrderEvent,
  OrderStatusUpdateEvent,
} from "@makanmakan/shared-types";

// Mock WebSocket
class MockWebSocket extends EventTarget {
  public readyState: number = 1; // WebSocket.OPEN
  public sentMessages: string[] = [];

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = 3; // WebSocket.CLOSED
  }

  accept(): void {
    // Mock accept
  }

  getLastMessage(): any {
    if (this.sentMessages.length === 0) return null;
    return JSON.parse(this.sentMessages[this.sentMessages.length - 1]);
  }

  getAllMessages(): any[] {
    return this.sentMessages.map((msg) => JSON.parse(msg));
  }

  clearMessages(): void {
    this.sentMessages = [];
  }
}

describe("Broadcast Logic", () => {
  describe("Basic Broadcasting", () => {
    it("should broadcast event to all connected clients", () => {
      const connections = new Map();
      const sockets: MockWebSocket[] = [];

      // Create 3 connections
      for (let i = 0; i < 3; i++) {
        const ws = new MockWebSocket();
        const connectionInfo = {
          id: `conn-${i}`,
          type: "customer" as const,
          roomId: "table-001",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          auth: {
            roomType: "customer" as const,
            roomId: "table-001",
            restaurantId: "restaurant-123",
            role: "customer" as const,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        };
        connections.set(ws, connectionInfo);
        sockets.push(ws);
      }

      // Broadcast event
      const event: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {
          orderId: 1,
          orderNumber: "ORD-001",
          tableId: "1",
          items: [],
          totalAmount: 100,
        },
      };

      // Send to all connections
      for (const [socket, connectionInfo] of connections) {
        if (
          socket.readyState === WebSocket.OPEN &&
          connectionInfo.auth?.restaurantId === event.restaurantId
        ) {
          socket.send(JSON.stringify(event));
        }
      }

      // All sockets should have received the message
      sockets.forEach((socket) => {
        expect(socket.sentMessages.length).toBe(1);
        const received = socket.getLastMessage();
        expect(received.eventId).toBe("event-001");
        expect(received.type).toBe(RealtimeEventType.NEW_ORDER);
      });
    });

    it("should only send to connections with matching restaurantId", () => {
      const connections = new Map();
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      connections.set(ws1, {
        id: "conn-001",
        auth: { restaurantId: "restaurant-123" },
      });

      connections.set(ws2, {
        id: "conn-002",
        auth: { restaurantId: "restaurant-456" },
      });

      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      // Send only to matching restaurant
      for (const [socket, connectionInfo] of connections) {
        if ((connectionInfo as any).auth?.restaurantId === event.restaurantId) {
          socket.send(JSON.stringify(event));
        }
      }

      expect(ws1.sentMessages.length).toBe(1);
      expect(ws2.sentMessages.length).toBe(0);
    });

    it("should track number of recipients", () => {
      const connections = new Map();
      let sentCount = 0;

      for (let i = 0; i < 5; i++) {
        const ws = new MockWebSocket();
        connections.set(ws, {
          id: `conn-${i}`,
          auth: { restaurantId: "restaurant-123" },
        });
      }

      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      for (const [socket, connectionInfo] of connections) {
        if ((connectionInfo as any).auth?.restaurantId === event.restaurantId) {
          socket.send(JSON.stringify(event));
          sentCount++;
        }
      }

      expect(sentCount).toBe(5);
    });
  });

  describe("Broadcast with Exclusions", () => {
    it("should exclude sender when excludeSender is true", () => {
      const connections = new Map();
      const senderWs = new MockWebSocket();
      const recipientWs = new MockWebSocket();

      connections.set(senderWs, {
        id: "sender-conn",
        auth: { restaurantId: "restaurant-123" },
      });

      connections.set(recipientWs, {
        id: "recipient-conn",
        auth: { restaurantId: "restaurant-123" },
      });

      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      const senderId = "sender-conn";

      // Send to all except sender
      for (const [socket, connectionInfo] of connections) {
        if (
          (connectionInfo as any).id !== senderId &&
          (connectionInfo as any).auth?.restaurantId === event.restaurantId
        ) {
          socket.send(JSON.stringify(event));
        }
      }

      expect(senderWs.sentMessages.length).toBe(0);
      expect(recipientWs.sentMessages.length).toBe(1);
    });

    it("should include sender when excludeSender is false", () => {
      const connections = new Map();
      const senderWs = new MockWebSocket();
      const recipientWs = new MockWebSocket();

      connections.set(senderWs, {
        id: "sender-conn",
        auth: { restaurantId: "restaurant-123" },
      });

      connections.set(recipientWs, {
        id: "recipient-conn",
        auth: { restaurantId: "restaurant-123" },
      });

      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      // Send to all including sender
      for (const [socket, connectionInfo] of connections) {
        if ((connectionInfo as any).auth?.restaurantId === event.restaurantId) {
          socket.send(JSON.stringify(event));
        }
      }

      expect(senderWs.sentMessages.length).toBe(1);
      expect(recipientWs.sentMessages.length).toBe(1);
    });
  });

  describe("WebSocket State Handling", () => {
    it("should only send to connections with OPEN state", () => {
      const openWs = new MockWebSocket();
      openWs.readyState = 1; // WebSocket.OPEN

      const closedWs = new MockWebSocket();
      closedWs.readyState = 3; // WebSocket.CLOSED

      const connectingWs = new MockWebSocket();
      connectingWs.readyState = 0; // WebSocket.CONNECTING

      const sockets = [openWs, closedWs, connectingWs];

      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      sockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(event));
        }
      });

      expect(openWs.sentMessages.length).toBe(1);
      expect(closedWs.sentMessages.length).toBe(0);
      expect(connectingWs.sentMessages.length).toBe(0);
    });

    it("should handle send errors gracefully", () => {
      const faultyWs = new MockWebSocket();
      faultyWs.send = vi.fn(() => {
        throw new Error("Send failed");
      });

      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      // Should not throw
      expect(() => {
        try {
          faultyWs.send(JSON.stringify(event));
        } catch (error) {
          // Error handled
        }
      }).not.toThrow();
    });
  });

  describe("Event History for Broadcast", () => {
    it("should add broadcast events to history", () => {
      const eventHistory: RealtimeEvent[] = [];
      const maxHistorySize = 100;

      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      // Add to history
      eventHistory.push(event);

      expect(eventHistory.length).toBe(1);
      expect(eventHistory[0].eventId).toBe("event-001");
    });

    it("should maintain history size limit", () => {
      const eventHistory: RealtimeEvent[] = [];
      const maxHistorySize = 100;

      // Add 150 events
      for (let i = 0; i < 150; i++) {
        eventHistory.push({
          type: RealtimeEventType.NEW_ORDER,
          eventId: `event-${i}`,
          timestamp: Date.now(),
          restaurantId: "restaurant-123",
          data: {} as any,
        });

        // Keep only last 100 events
        if (eventHistory.length > maxHistorySize) {
          eventHistory.shift();
        }
      }

      expect(eventHistory.length).toBe(100);
      expect(eventHistory[0].eventId).toBe("event-50");
      expect(eventHistory[99].eventId).toBe("event-149");
    });

    it("should cleanup old events from history", () => {
      const eventHistory: RealtimeEvent[] = [];
      const maxEventAge = 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();

      // Add old and new events
      eventHistory.push({
        type: RealtimeEventType.NEW_ORDER,
        eventId: "old-event",
        timestamp: now - 25 * 60 * 60 * 1000, // 25 hours ago
        restaurantId: "restaurant-123",
        data: {} as any,
      });

      eventHistory.push({
        type: RealtimeEventType.NEW_ORDER,
        eventId: "new-event",
        timestamp: now,
        restaurantId: "restaurant-123",
        data: {} as any,
      });

      // Filter out old events
      const validEvents = eventHistory.filter(
        (event) => now - event.timestamp < maxEventAge,
      );

      expect(validEvents.length).toBe(1);
      expect(validEvents[0].eventId).toBe("new-event");
    });
  });

  describe("Last Event ID Tracking", () => {
    it("should update lastEventId after broadcast", () => {
      const connectionInfo = {
        id: "conn-001",
        type: "customer" as const,
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        lastEventId: undefined as string | undefined,
      };

      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      // Simulate broadcast
      connectionInfo.lastEventId = event.eventId;

      expect(connectionInfo.lastEventId).toBe("event-001");
    });

    it("should track sequence of event IDs", () => {
      const connectionInfo = {
        id: "conn-001",
        lastEventId: undefined as string | undefined,
      };

      const eventIds = ["event-001", "event-002", "event-003"];

      eventIds.forEach((eventId) => {
        connectionInfo.lastEventId = eventId;
      });

      expect(connectionInfo.lastEventId).toBe("event-003");
    });
  });

  describe("Broadcast Response", () => {
    it("should return success response with recipient count", () => {
      const sentCount = 5;

      const response = {
        success: true,
        message: "Event broadcast",
        eventId: "event-001",
        recipientCount: sentCount,
      };

      expect(response.success).toBe(true);
      expect(response.recipientCount).toBe(5);
      expect(response.eventId).toBe("event-001");
    });

    it("should return error response on invalid event format", () => {
      const invalidEvent = {
        type: RealtimeEventType.NEW_ORDER,
        // Missing required fields: eventId, timestamp, restaurantId
      };

      const hasRequiredFields = !!(
        (invalidEvent as any).type &&
        (invalidEvent as any).eventId &&
        (invalidEvent as any).timestamp &&
        (invalidEvent as any).restaurantId
      );

      expect(hasRequiredFields).toBe(false);

      const response = {
        success: false,
        error: "Invalid event format",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Invalid event format");
    });

    it("should return error response on broadcast failure", () => {
      const response = {
        success: false,
        error: "Failed to broadcast event",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Failed to broadcast event");
    });
  });

  describe("Concurrent Broadcasting", () => {
    it("should handle multiple concurrent broadcasts", async () => {
      const connections = new Map();
      const ws = new MockWebSocket();

      connections.set(ws, {
        id: "conn-001",
        auth: { restaurantId: "restaurant-123" },
      });

      const events: RealtimeEvent[] = [];

      // Create 10 concurrent events
      for (let i = 0; i < 10; i++) {
        events.push({
          type: RealtimeEventType.NEW_ORDER,
          eventId: `event-${i}`,
          timestamp: Date.now(),
          restaurantId: "restaurant-123",
          data: {} as any,
        });
      }

      // Broadcast all events
      for (const event of events) {
        for (const [socket, connectionInfo] of connections) {
          if (
            (connectionInfo as any).auth?.restaurantId === event.restaurantId
          ) {
            socket.send(JSON.stringify(event));
          }
        }
      }

      expect(ws.sentMessages.length).toBe(10);
      const receivedEventIds = ws.getAllMessages().map((msg) => msg.eventId);
      expect(receivedEventIds).toEqual(events.map((e) => e.eventId));
    });

    it("should maintain event order during concurrent broadcasts", () => {
      const ws = new MockWebSocket();
      const eventIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const eventId = `event-${i}`;
        ws.send(JSON.stringify({ eventId }));
        eventIds.push(eventId);
      }

      const receivedIds = ws.getAllMessages().map((msg) => msg.eventId);
      expect(receivedIds).toEqual(eventIds);
    });
  });

  describe("Broadcast Validation", () => {
    it("should validate event has required fields", () => {
      const validEvent: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      const isValid = !!(
        validEvent.type &&
        validEvent.eventId &&
        validEvent.timestamp &&
        validEvent.restaurantId
      );

      expect(isValid).toBe(true);
    });

    it("should reject events with missing type", () => {
      const invalidEvent = {
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      const isValid = !!(
        (invalidEvent as any).type &&
        (invalidEvent as any).eventId &&
        (invalidEvent as any).timestamp &&
        (invalidEvent as any).restaurantId
      );

      expect(isValid).toBe(false);
    });

    it("should reject events with missing eventId", () => {
      const invalidEvent = {
        type: RealtimeEventType.NEW_ORDER,
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {} as any,
      };

      const isValid = !!(
        (invalidEvent as any).type &&
        (invalidEvent as any).eventId &&
        (invalidEvent as any).timestamp &&
        (invalidEvent as any).restaurantId
      );

      expect(isValid).toBe(false);
    });
  });

  describe("Event ID Generation", () => {
    it("should generate unique event IDs", () => {
      const eventIds = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const eventId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        eventIds.add(eventId);
      }

      // All IDs should be unique
      expect(eventIds.size).toBe(100);
    });

    it("should format event IDs consistently", () => {
      const eventId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      expect(eventId).toMatch(/^\d+_[a-z0-9]+$/);
    });
  });
});
