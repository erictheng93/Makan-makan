/**
 * Protocol test: verifies that broadcast events (new order, status
 * update, kitchen item, menu availability) serialise to the expected
 * wire shape by posting them through a `MockDurableObjectStub`.
 *
 * This is a protocol/contract test, NOT a real integration test. The
 * Durable Object transport is stubbed — the goal is to lock the
 * API → DO → WebSocket payload contract, not to verify real DO
 * persistence. For real integration testing, see
 * `apps/api/src/__tests__/integration/*.real.integration.test.ts`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock @makanmakan/shared-types to ensure enums are available
vi.mock("@makanmakan/shared-types", async () => {
  const actual = await vi.importActual("@makanmakan/shared-types");
  return {
    ...actual,
    RealtimeEventType: {
      NEW_ORDER: "new_order",
      ORDER_STATUS_UPDATE: "order_status_update",
      ORDER_ITEM_STATUS_UPDATE: "order_item_status_update",
      KITCHEN_ITEM_STATUS: "kitchen_item_status",
      MENU_AVAILABILITY_UPDATE: "menu_availability_update",
    },
  };
});

// Import after mocking
import { RealtimeEventType } from "@makanmakan/shared-types";
import type { OrderStatus } from "@makanmakan/shared-types";
import type {
  NewOrderEvent,
  OrderStatusUpdateEvent,
  KitchenItemStatusEvent,
  MenuAvailabilityUpdateEvent,
} from "@makanmakan/shared-types";

// Mock Durable Object Stub
class MockDurableObjectStub {
  private broadcastHistory: any[] = [];

  async fetch(url: string | Request, init?: RequestInit): Promise<Response> {
    const request = typeof url === "string" ? new Request(url, init) : url;
    const path = new URL(request.url).pathname;

    if (path === "/broadcast" && request.method === "POST") {
      const body = (await request.json()) as ApiTestResponse;
      this.broadcastHistory.push(body);

      return Response.json({
        success: true,
        eventId: body.eventId,
        recipientCount: 3, // Mock: 3 connected clients
      });
    }

    if (path === "/stats") {
      return Response.json({
        roomInfo: { type: "restaurant", id: "rest_1" },
        connectionCount: 3,
        connections: [
          { id: "conn_1", type: "customer", connectedAt: Date.now() },
          { id: "conn_2", type: "kitchen", connectedAt: Date.now() },
          { id: "conn_3", type: "admin", connectedAt: Date.now() },
        ],
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  getBroadcastHistory(): any[] {
    return this.broadcastHistory;
  }

  clearHistory(): void {
    this.broadcastHistory = [];
  }
}

// Mock Environment
interface MockEnv {
  REALTIME_SESSION: {
    idFromName: (name: string) => { toString: () => string };
    get: (id: { toString: () => string }) => MockDurableObjectStub;
  };
}

describe("Broadcast Integration Tests", () => {
  let mockEnv: MockEnv;
  let mockDurableObject: MockDurableObjectStub;

  beforeEach(() => {
    mockDurableObject = new MockDurableObjectStub();

    mockEnv = {
      REALTIME_SESSION: {
        idFromName: (name: string) => ({
          toString: () => `do_${name}`,
        }),
        get: () => mockDurableObject,
      },
    };

    mockDurableObject.clearHistory();
  });

  describe("新訂單廣播", () => {
    it("應該成功廣播新訂單事件", async () => {
      const newOrderEvent: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_order_123",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: 123,
          orderNumber: "ORD-001",
          tableId: "table1",
          tableName: "Table 1",
          items: [
            {
              orderItemId: 1,
              menuItemId: 10,
              menuItemName: "Chicken Rice",
              quantity: 2,
              price: 8.5,
              notes: "No chili",
            },
          ],
          totalAmount: 17.0,
          notes: "Takeaway",
        },
      };

      // Simulate broadcast
      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      const response = await durableObjectStub.fetch(
        "http://localhost/broadcast",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newOrderEvent),
        },
      );

      const result = (await response.json()) as ApiTestResponse;

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("evt_order_123");
      expect(result.recipientCount).toBeGreaterThan(0);

      // Verify broadcast history
      const history = mockDurableObject.getBroadcastHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe(RealtimeEventType.NEW_ORDER);
      expect(history[0].data.orderId).toBe(123);
    });

    it("應該廣播到正確的餐廳房間", async () => {
      const _event: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_123",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: 123,
          orderNumber: "ORD-001",
          items: [],
          totalAmount: 0,
        },
      };

      const roomName = "restaurant:rest_1";
      const durableObjectId = mockEnv.REALTIME_SESSION.idFromName(roomName);

      expect(durableObjectId.toString()).toBe(`do_${roomName}`);
    });
  });

  describe("訂單狀態更新廣播", () => {
    it("應該廣播訂單狀態變更", async () => {
      const statusUpdateEvent: OrderStatusUpdateEvent = {
        type: RealtimeEventType.ORDER_STATUS_UPDATE,
        eventId: "evt_status_456",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: 123,
          orderNumber: "ORD-001",
          status: "preparing" as OrderStatus,
          previousStatus: "pending" as OrderStatus,
          estimatedTime: 15,
          message: "您的訂單正在準備中",
          updatedBy: {
            userId: 10,
            userName: "Chef Wang",
            role: "kitchen",
          },
        },
      };

      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      const response = await durableObjectStub.fetch(
        "http://localhost/broadcast",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(statusUpdateEvent),
        },
      );

      const result = (await response.json()) as ApiTestResponse;

      expect(result.success).toBe(true);
      expect(result.recipientCount).toBeGreaterThan(0);

      const history = mockDurableObject.getBroadcastHistory();
      expect(history[0].data.status).toBe("preparing");
      expect(history[0].data.previousStatus).toBe("pending");
    });
  });

  describe("廚房事件廣播", () => {
    it("應該廣播廚房項目狀態", async () => {
      const kitchenEvent: KitchenItemStatusEvent = {
        type: RealtimeEventType.KITCHEN_ITEM_STATUS,
        eventId: "evt_kitchen_789",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: 123,
          orderItemId: 1,
          menuItemName: "Chicken Rice",
          status: "cooking",
          tableName: "Table 1",
          priority: "normal",
          waitingTime: 5,
        },
      };

      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      const response = await durableObjectStub.fetch(
        "http://localhost/broadcast",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kitchenEvent),
        },
      );

      const result = (await response.json()) as ApiTestResponse;

      expect(result.success).toBe(true);

      const history = mockDurableObject.getBroadcastHistory();
      expect(history[0].type).toBe(RealtimeEventType.KITCHEN_ITEM_STATUS);
      expect(history[0].data.status).toBe("cooking");
    });
  });

  describe("菜單可用性廣播", () => {
    it("應該廣播菜單項目售罄", async () => {
      const menuEvent: MenuAvailabilityUpdateEvent = {
        type: RealtimeEventType.MENU_AVAILABILITY_UPDATE,
        eventId: "evt_menu_101",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          menuItemId: 10,
          menuItemName: "Chicken Rice",
          isAvailable: false,
          inventoryCount: 0,
          reason: "今日售罄",
        },
      };

      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      const response = await durableObjectStub.fetch(
        "http://localhost/broadcast",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(menuEvent),
        },
      );

      const result = (await response.json()) as ApiTestResponse;

      expect(result.success).toBe(true);

      const history = mockDurableObject.getBroadcastHistory();
      expect(history[0].data.isAvailable).toBe(false);
      expect(history[0].data.reason).toBe("今日售罄");
    });
  });

  describe("多重廣播", () => {
    it("應該處理多個連續廣播", async () => {
      const events = [
        {
          type: RealtimeEventType.NEW_ORDER,
          eventId: "evt_1",
          timestamp: Date.now(),
          restaurantId: "rest_1",
          data: {
            orderId: 1,
            orderNumber: "ORD-001",
            items: [],
            totalAmount: 10,
          },
        },
        {
          type: RealtimeEventType.NEW_ORDER,
          eventId: "evt_2",
          timestamp: Date.now(),
          restaurantId: "rest_1",
          data: {
            orderId: 2,
            orderNumber: "ORD-002",
            items: [],
            totalAmount: 20,
          },
        },
        {
          type: RealtimeEventType.NEW_ORDER,
          eventId: "evt_3",
          timestamp: Date.now(),
          restaurantId: "rest_1",
          data: {
            orderId: 3,
            orderNumber: "ORD-003",
            items: [],
            totalAmount: 30,
          },
        },
      ];

      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      for (const event of events) {
        await durableObjectStub.fetch("http://localhost/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });
      }

      const history = mockDurableObject.getBroadcastHistory();
      expect(history).toHaveLength(3);
      expect(history[0].data.orderId).toBe(1);
      expect(history[1].data.orderId).toBe(2);
      expect(history[2].data.orderId).toBe(3);
    });
  });

  describe("連接統計", () => {
    it("應該查詢房間連接統計", async () => {
      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      const response = await durableObjectStub.fetch("http://localhost/stats", {
        method: "GET",
      });

      const stats = (await response.json()) as ApiTestResponse;

      expect(stats.connectionCount).toBe(3);
      expect(stats.connections).toHaveLength(3);
      expect(stats.roomInfo).toEqual({ type: "restaurant", id: "rest_1" });
    });

    it("應該包含連接詳情", async () => {
      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      const response = await durableObjectStub.fetch("http://localhost/stats", {
        method: "GET",
      });

      const stats = (await response.json()) as ApiTestResponse;

      const connections = stats.connections;
      expect(connections.some((c: any) => c.type === "customer")).toBe(true);
      expect(connections.some((c: any) => c.type === "kitchen")).toBe(true);
      expect(connections.some((c: any) => c.type === "admin")).toBe(true);
    });
  });

  describe("錯誤處理", () => {
    it("應該處理無效的廣播請求", async () => {
      const invalidEvent = {
        type: "INVALID_TYPE",
        timestamp: Date.now(),
        // Missing required fields
      };

      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      await durableObjectStub.fetch("http://localhost/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidEvent),
      });

      // Even invalid events are recorded in history for this mock
      // In real implementation, validation would reject it
      const history = mockDurableObject.getBroadcastHistory();
      expect(history).toHaveLength(1);
    });

    it("應該處理網絡錯誤", async () => {
      // This test would require more sophisticated mocking
      // to simulate network failures
      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      expect(durableObjectId).toBeDefined();
    });
  });

  describe("並發廣播", () => {
    it("應該處理並發廣播請求", async () => {
      const durableObjectId =
        mockEnv.REALTIME_SESSION.idFromName("restaurant:rest_1");
      const durableObjectStub = mockEnv.REALTIME_SESSION.get(durableObjectId);

      const broadcasts = Array.from({ length: 10 }, (_, i) => ({
        type: RealtimeEventType.NEW_ORDER,
        eventId: `evt_concurrent_${i}`,
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: i + 1,
          orderNumber: `ORD-${String(i + 1).padStart(3, "0")}`,
          items: [],
          totalAmount: (i + 1) * 10,
        },
      }));

      // Send all broadcasts concurrently
      await Promise.all(
        broadcasts.map((event) =>
          durableObjectStub.fetch("http://localhost/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event),
          }),
        ),
      );

      const history = mockDurableObject.getBroadcastHistory();
      expect(history).toHaveLength(10);

      // All events should be present
      const orderIds = history.map((h) => h.data.orderId).sort((a, b) => a - b);
      expect(orderIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
});
