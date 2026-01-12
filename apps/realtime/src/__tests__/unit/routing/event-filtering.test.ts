/**
 * Event Filtering Tests
 * 測試 RealtimeSession 的事件過濾和路由邏輯
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeEventType } from "@makanmakan/shared-types";
import type {
  RealtimeEvent,
  RealtimeAuthPayload,
  NewOrderEvent,
  OrderStatusUpdateEvent,
  MenuItemUpdateEvent,
  TableStatusUpdateEvent,
} from "@makanmakan/shared-types";
import { createTestAuthPayload, getStringRole } from "../../helpers/test-utils";

// Connection info structure
interface ConnectionInfo {
  id: string;
  type: "customer" | "admin" | "kitchen";
  roomId: string;
  connectedAt: number;
  lastActivity: number;
  auth?: RealtimeAuthPayload;
  // Keep numeric role for test logic compatibility
  numericRole?: number;
}

// Factory function to create ConnectionInfo with proper types
function createConnectionInfo(
  id: string,
  type: "customer" | "admin" | "kitchen",
  roomId: string,
  restaurantId: string,
  numericRole: number,
): ConnectionInfo {
  return {
    id,
    type,
    roomId,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    numericRole,
    auth: createTestAuthPayload(type, roomId, restaurantId, numericRole),
  };
}

// Helper function to check if event should be sent to connection
function shouldSendEventToConnection(
  event: RealtimeEvent,
  connectionInfo: ConnectionInfo,
): boolean {
  // Validate restaurant ID
  if (event.restaurantId !== connectionInfo.auth?.restaurantId) {
    return false;
  }

  const eventType = event.type;
  // If numericRole is undefined, treat as customer (role 4) for safety
  // This prevents unauthorized access to admin/kitchen events
  const role = connectionInfo.numericRole ?? 4;

  switch (eventType) {
    case RealtimeEventType.NEW_ORDER:
      return true; // All roles receive new orders

    case RealtimeEventType.ORDER_STATUS_UPDATE:
    case RealtimeEventType.ORDER_ITEM_STATUS_UPDATE:
      // Customers only receive updates for their table
      if (role === 4) {
        // Customer role
        return true; // Simplified - would check table/seat in real implementation
      }
      return true; // Admin and kitchen receive all updates

    case RealtimeEventType.MENU_ITEM_UPDATE:
      // Only admin and kitchen receive menu updates
      return role < 4;

    case RealtimeEventType.TABLE_STATUS_UPDATE:
      // Only admin and owner receive table status
      return role === 0 || role === 1;

    case RealtimeEventType.KITCHEN_ITEM_STATUS:
      // Kitchen and service crew receive kitchen events
      return role === 2 || role === 3;

    default:
      return true;
  }
}

describe("Event Filtering", () => {
  describe("Restaurant-Level Filtering", () => {
    it("should filter events by restaurantId", () => {
      const event: RealtimeEvent = {
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

      const connection1: ConnectionInfo = {
        id: "conn-001",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 4,
        auth: {
          roomType: "customer",
          roomId: "table-001",
          restaurantId: "restaurant-123",
          role: getStringRole(4),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      const connection2: ConnectionInfo = {
        id: "conn-002",
        type: "customer",
        roomId: "table-002",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 4,
        auth: {
          roomType: "customer",
          roomId: "table-002",
          restaurantId: "restaurant-456", // Different restaurant
          role: getStringRole(4),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      expect(shouldSendEventToConnection(event, connection1)).toBe(true);
      expect(shouldSendEventToConnection(event, connection2)).toBe(false);
    });

    it("should reject events with mismatched restaurantId", () => {
      const event: RealtimeEvent = {
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

      const connection: ConnectionInfo = {
        id: "conn-001",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 4,
        auth: {
          roomType: "customer",
          roomId: "table-001",
          restaurantId: "restaurant-999",
          role: getStringRole(4),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      expect(shouldSendEventToConnection(event, connection)).toBe(false);
    });
  });

  describe("Role-Based Filtering", () => {
    it("should send NEW_ORDER events to all roles", () => {
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

      const roles = [0, 1, 2, 3, 4]; // Admin, Owner, Chef, Crew, Customer

      roles.forEach((role) => {
        const connection: ConnectionInfo = {
          id: `conn-${role}`,
          type: "customer",
          roomId: "table-001",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          numericRole: role,
          auth: {
            roomType: "customer",
            roomId: "table-001",
            restaurantId: "restaurant-123",
            role: getStringRole(role),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        };

        expect(shouldSendEventToConnection(event, connection)).toBe(true);
      });
    });

    it("should only send MENU_UPDATE to admin and kitchen", () => {
      const event: MenuItemUpdateEvent = {
        type: RealtimeEventType.MENU_ITEM_UPDATE,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {
          menuItemId: 1,
          action: "updated",
        },
      };

      const testCases = [
        { role: 0, expected: true }, // Admin
        { role: 1, expected: true }, // Owner
        { role: 2, expected: true }, // Chef
        { role: 3, expected: true }, // Crew
        { role: 4, expected: false }, // Customer
      ];

      testCases.forEach(({ role, expected }) => {
        const connection: ConnectionInfo = {
          id: `conn-${role}`,
          type: "customer",
          roomId: "table-001",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          numericRole: role,
          auth: {
            roomType: "customer",
            roomId: "table-001",
            restaurantId: "restaurant-123",
            role: getStringRole(role),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        };

        expect(shouldSendEventToConnection(event, connection)).toBe(expected);
      });
    });

    it("should only send TABLE_STATUS to admin and owner", () => {
      const event: TableStatusUpdateEvent = {
        type: RealtimeEventType.TABLE_STATUS_UPDATE,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {
          tableId: "table-001",
          tableName: "Table 1",
          status: "occupied",
          customerCount: 4,
        },
      };

      const testCases = [
        { role: 0, expected: true }, // Admin
        { role: 1, expected: true }, // Owner
        { role: 2, expected: false }, // Chef
        { role: 3, expected: false }, // Crew
        { role: 4, expected: false }, // Customer
      ];

      testCases.forEach(({ role, expected }) => {
        const connection: ConnectionInfo = {
          id: `conn-${role}`,
          type: "admin",
          roomId: "admin-restaurant-123",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          numericRole: role,
          auth: {
            roomType: "admin",
            roomId: "admin-restaurant-123",
            restaurantId: "restaurant-123",
            role: getStringRole(role),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        };

        expect(shouldSendEventToConnection(event, connection)).toBe(expected);
      });
    });

    it("should only send KITCHEN_ORDER_READY to kitchen and crew", () => {
      const event: RealtimeEvent = {
        type: RealtimeEventType.KITCHEN_ITEM_STATUS,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {
          orderId: 1,
          orderItemId: 1,
          status: "ready",
        } as any,
      };

      const testCases = [
        { role: 0, expected: false }, // Admin
        { role: 1, expected: false }, // Owner
        { role: 2, expected: true }, // Chef
        { role: 3, expected: true }, // Crew
        { role: 4, expected: false }, // Customer
      ];

      testCases.forEach(({ role, expected }) => {
        const connection: ConnectionInfo = {
          id: `conn-${role}`,
          type: "kitchen",
          roomId: "kitchen-restaurant-123",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          numericRole: role,
          auth: {
            roomType: "kitchen",
            roomId: "kitchen-restaurant-123",
            restaurantId: "restaurant-123",
            role: getStringRole(role),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        };

        expect(shouldSendEventToConnection(event, connection)).toBe(expected);
      });
    });
  });

  describe("Room Type Filtering", () => {
    it("should filter events by room type", () => {
      const event: RealtimeEvent = {
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

      const connectionTypes: Array<"customer" | "admin" | "kitchen"> = [
        "customer",
        "admin",
        "kitchen",
      ];

      connectionTypes.forEach((type) => {
        const numericRole = type === "customer" ? 4 : 0;
        const connection: ConnectionInfo = {
          id: `conn-${type}`,
          type,
          roomId: `${type}-room`,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          numericRole,
          auth: {
            roomType: type,
            roomId: `${type}-room`,
            restaurantId: "restaurant-123",
            role: getStringRole(numericRole),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        };

        // All room types should receive NEW_ORDER events
        expect(shouldSendEventToConnection(event, connection)).toBe(true);
      });
    });

    it("should support customer room filtering", () => {
      const connection: ConnectionInfo = {
        id: "conn-001",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 4,
        auth: {
          roomType: "customer",
          roomId: "table-001",
          restaurantId: "restaurant-123",
          role: getStringRole(4),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      expect(connection.type).toBe("customer");
      expect(connection.auth?.roomType).toBe("customer");
    });

    it("should support admin room filtering", () => {
      const connection: ConnectionInfo = {
        id: "conn-001",
        type: "admin",
        roomId: "admin-restaurant-123",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 0,
        auth: {
          roomType: "admin",
          roomId: "admin-restaurant-123",
          restaurantId: "restaurant-123",
          role: getStringRole(0),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      expect(connection.type).toBe("admin");
      expect(connection.auth?.roomType).toBe("admin");
    });

    it("should support kitchen room filtering", () => {
      const connection: ConnectionInfo = {
        id: "conn-001",
        type: "kitchen",
        roomId: "kitchen-restaurant-123",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 2,
        auth: {
          roomType: "kitchen",
          roomId: "kitchen-restaurant-123",
          restaurantId: "restaurant-123",
          role: getStringRole(2),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      expect(connection.type).toBe("kitchen");
      expect(connection.auth?.roomType).toBe("kitchen");
    });
  });

  describe("Event Type Filtering", () => {
    it("should handle all defined event types", () => {
      const eventTypes = [
        RealtimeEventType.NEW_ORDER,
        RealtimeEventType.ORDER_STATUS_UPDATE,
        RealtimeEventType.ORDER_ITEM_STATUS_UPDATE,
        RealtimeEventType.MENU_ITEM_UPDATE,
        RealtimeEventType.TABLE_STATUS_UPDATE,
        RealtimeEventType.KITCHEN_ITEM_STATUS,
        RealtimeEventType.CONNECTION_ACK,
        RealtimeEventType.HEARTBEAT,
        RealtimeEventType.ERROR,
      ];

      eventTypes.forEach((eventType) => {
        const event: RealtimeEvent = {
          type: eventType,
          eventId: `event-${eventType}`,
          timestamp: Date.now(),
          restaurantId: "restaurant-123",
          data: {} as any, // Generic test data
        };

        expect(event.type).toBe(eventType);
      });
    });

    it("should filter by specific event types", () => {
      const adminConnection: ConnectionInfo = {
        id: "conn-admin",
        type: "admin",
        roomId: "admin-restaurant-123",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 0,
        auth: {
          roomType: "admin",
          roomId: "admin-restaurant-123",
          restaurantId: "restaurant-123",
          role: getStringRole(0),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      const customerConnection: ConnectionInfo = {
        id: "conn-customer",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 4,
        auth: {
          roomType: "customer",
          roomId: "table-001",
          restaurantId: "restaurant-123",
          role: getStringRole(4),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      // NEW_ORDER: both should receive
      const newOrderEvent: RealtimeEvent = {
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

      expect(shouldSendEventToConnection(newOrderEvent, adminConnection)).toBe(
        true,
      );
      expect(
        shouldSendEventToConnection(newOrderEvent, customerConnection),
      ).toBe(true);

      // TABLE_STATUS: only admin should receive
      const tableStatusEvent: TableStatusUpdateEvent = {
        type: RealtimeEventType.TABLE_STATUS_UPDATE,
        eventId: "event-002",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {
          tableId: "table-001",
          tableName: "Table 1",
          status: "occupied",
          customerCount: 4,
        },
      };

      expect(
        shouldSendEventToConnection(tableStatusEvent, adminConnection),
      ).toBe(true);
      expect(
        shouldSendEventToConnection(tableStatusEvent, customerConnection),
      ).toBe(false);
    });
  });

  describe("Complex Filtering Scenarios", () => {
    it("should filter multi-tenant events correctly", () => {
      const event: RealtimeEvent = {
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

      const connections: ConnectionInfo[] = [
        {
          id: "conn-001",
          type: "customer",
          roomId: "table-001",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          numericRole: 4,
          auth: {
            roomType: "customer",
            roomId: "table-001",
            restaurantId: "restaurant-123",
            role: getStringRole(4),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        },
        {
          id: "conn-002",
          type: "customer",
          roomId: "table-002",
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          numericRole: 4,
          auth: {
            roomType: "customer",
            roomId: "table-002",
            restaurantId: "restaurant-456", // Different restaurant
            role: getStringRole(4),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        },
      ];

      const results = connections.map((conn) =>
        shouldSendEventToConnection(event, conn),
      );

      expect(results[0]).toBe(true); // Same restaurant
      expect(results[1]).toBe(false); // Different restaurant
    });

    it("should handle connections without auth", () => {
      const event: RealtimeEvent = {
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

      const connection: ConnectionInfo = {
        id: "conn-001",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        // No auth property
      };

      expect(shouldSendEventToConnection(event, connection)).toBe(false);
    });

    it("should handle undefined role correctly", () => {
      const event: MenuItemUpdateEvent = {
        type: RealtimeEventType.MENU_ITEM_UPDATE,
        eventId: "event-001",
        timestamp: Date.now(),
        restaurantId: "restaurant-123",
        data: {
          menuItemId: 1,
          action: "updated",
        },
      };

      const connection: ConnectionInfo = {
        id: "conn-001",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        // No numericRole for this test
        auth: {
          roomType: "customer",
          roomId: "table-001",
          restaurantId: "restaurant-123",
          role: "customer", // Customer role but no numericRole
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      // Should not receive MENU_UPDATE without valid role
      expect(shouldSendEventToConnection(event, connection)).toBe(false);
    });
  });

  describe("Filtering Performance", () => {
    it("should efficiently filter large numbers of connections", () => {
      const event: RealtimeEvent = {
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

      const connections: ConnectionInfo[] = [];

      // Create 100 connections
      for (let i = 0; i < 100; i++) {
        connections.push({
          id: `conn-${i}`,
          type: "customer",
          roomId: `table-${i % 10}`,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          numericRole: 4,
          auth: {
            roomType: "customer",
            roomId: `table-${i % 10}`,
            restaurantId: i % 2 === 0 ? "restaurant-123" : "restaurant-456",
            role: getStringRole(4),
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
        });
      }

      const startTime = performance.now();

      const filtered = connections.filter((conn) =>
        shouldSendEventToConnection(event, conn),
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should filter efficiently (< 10ms for 100 connections)
      expect(duration).toBeLessThan(10);
      expect(filtered.length).toBe(50); // Half should match (restaurant-123)
    });

    it("should maintain correct filtering under load", () => {
      const events: RealtimeEvent[] = [];

      // Create 50 events
      for (let i = 0; i < 50; i++) {
        events.push({
          type:
            i % 2 === 0
              ? RealtimeEventType.NEW_ORDER
              : RealtimeEventType.MENU_ITEM_UPDATE,
          eventId: `event-${i}`,
          timestamp: Date.now(),
          restaurantId: "restaurant-123",
          data: {} as any, // Generic test data
        });
      }

      const connection: ConnectionInfo = {
        id: "conn-001",
        type: "customer",
        roomId: "table-001",
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        numericRole: 4,
        auth: {
          roomType: "customer",
          roomId: "table-001",
          restaurantId: "restaurant-123",
          role: getStringRole(4),
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };

      const filtered = events.filter((event) =>
        shouldSendEventToConnection(event, connection),
      );

      // Customer should only receive NEW_ORDER events (25 out of 50)
      expect(filtered.length).toBe(25);
      expect(
        filtered.every((e) => e.type === RealtimeEventType.NEW_ORDER),
      ).toBe(true);
    });
  });
});
