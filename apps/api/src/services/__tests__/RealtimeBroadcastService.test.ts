/**
 * RealtimeBroadcastService Unit Tests
 * 測試即時廣播服務的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import { RealtimeBroadcastService } from "../RealtimeBroadcastService";
import type { Env } from "../../shared/types";
import {
  type NewOrderEvent,
  type OrderStatusUpdateEvent,
  type OrderStatus,
  RealtimeEventType,
} from "@makanmakan/shared-types";

// Mock logger
vi.mock("../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
  }),
}));

describe("RealtimeBroadcastService", () => {
  let service: RealtimeBroadcastService;
  let mockEnv: Env;
  let mockDurableObjectStub: any;
  let mockDurableObjectNamespace: any;

  beforeEach(() => {
    // Mock Durable Object stub
    mockDurableObjectStub = {
      fetch: vi.fn(),
    };

    // Mock Durable Object namespace
    mockDurableObjectNamespace = {
      idFromName: vi.fn().mockReturnValue("mock-durable-object-id"),
      get: vi.fn().mockReturnValue(mockDurableObjectStub),
    };

    // Mock environment
    mockEnv = {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-key-that-is-at-least-32-chars-long",
      ENCRYPTION_KEY: "test-encryption-key-32-chars-long",
      API_VERSION: "1.0.0",
      DB: {} as any,
      CACHE_KV: {} as any,
      TOKEN_BLACKLIST: {} as any,
      IMAGES_BUCKET: {} as any,
      BACKUP_STORAGE: {} as any,
      JOB_QUEUE: {} as any,
      REALTIME_ORDERS: {} as any,
      ANALYTICS_ENGINE: {} as any,
      RATE_LIMIT_KV: {} as any,
      REALTIME_SESSION: mockDurableObjectNamespace as any,
    };

    service = new RealtimeBroadcastService(mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("broadcastEvent", () => {
    it("應該成功廣播事件到 Durable Object", async () => {
      const mockEvent: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_123",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: 1,
          orderNumber: "#001",
          items: [],
          totalAmount: 1000,
        },
      };

      // Mock successful response
      mockDurableObjectStub.fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            eventId: "evt_123",
            recipientCount: 5,
          }),
          { status: 200 },
        ),
      );

      const result = await service.broadcastEvent(
        "restaurant",
        "rest_1",
        mockEvent,
      );

      expect(result.success).toBe(true);
      expect(result.eventId).toBe("evt_123");
      expect(result.recipientCount).toBe(5);
      expect(mockDurableObjectNamespace.idFromName).toHaveBeenCalledWith(
        "restaurant:rest_1",
      );
      expect(mockDurableObjectStub.fetch).toHaveBeenCalledWith(
        "https://realtime-internal/broadcast",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mockEvent),
        }),
      );
    });

    it("應該處理廣播失敗的情況", async () => {
      const mockEvent: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_456",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: 2,
          orderNumber: "#002",
          items: [],
          totalAmount: 2000,
        },
      };

      // Mock failure response
      mockDurableObjectStub.fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: "Durable Object error",
          }),
          { status: 500 },
        ),
      );

      const result = await service.broadcastEvent(
        "restaurant",
        "rest_1",
        mockEvent,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Durable Object error");
    });

    it("應該處理網路錯誤", async () => {
      const mockEvent: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_789",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: 3,
          orderNumber: "#003",
          items: [],
          totalAmount: 3000,
        },
      };

      // Mock network error
      mockDurableObjectStub.fetch.mockRejectedValue(new Error("Network error"));

      const result = await service.broadcastEvent(
        "restaurant",
        "rest_1",
        mockEvent,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("broadcastNewOrder", () => {
    it("應該廣播新訂單事件到餐廳房間", async () => {
      const newOrderEvent: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_new_123",
        timestamp: Date.now(),
        restaurantId: "rest_123",
        data: {
          orderId: 100,
          orderNumber: "#100",
          tableId: "table_1",
          tableName: "Table 1",
          items: [
            {
              orderItemId: 1,
              menuItemId: 10,
              menuItemName: "Burger",
              quantity: 2,
              price: 500,
              notes: "No onions",
            },
          ],
          totalAmount: 1000,
          notes: "Quick service please",
        },
      };

      mockDurableObjectStub.fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            eventId: "evt_new_123",
            recipientCount: 3,
          }),
        ),
      );

      const result = await service.broadcastNewOrder(newOrderEvent);

      expect(result.success).toBe(true);
      expect(mockDurableObjectNamespace.idFromName).toHaveBeenCalledWith(
        "restaurant:rest_123",
      );
    });
  });

  describe("broadcastOrderStatusUpdate", () => {
    it("應該廣播訂單狀態更新事件", async () => {
      const updateEvent: OrderStatusUpdateEvent = {
        type: RealtimeEventType.ORDER_STATUS_UPDATE,
        eventId: "evt_update_456",
        timestamp: Date.now(),
        restaurantId: "rest_456",
        data: {
          orderId: 200,
          orderNumber: "#200",
          status: "preparing" as OrderStatus,
          previousStatus: "pending" as OrderStatus,
          estimatedTime: 15,
          message: "Order is being prepared",
          updatedBy: {
            userId: 5,
            userName: "Chef John",
            role: "staff",
          },
        },
      };

      mockDurableObjectStub.fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            eventId: "evt_update_456",
            recipientCount: 4,
          }),
        ),
      );

      const result = await service.broadcastOrderStatusUpdate(updateEvent);

      expect(result.success).toBe(true);
      expect(mockDurableObjectNamespace.idFromName).toHaveBeenCalledWith(
        "restaurant:rest_456",
      );
    });
  });

  describe("generateEventId", () => {
    it("應該生成唯一的事件 ID", () => {
      const eventId1 = service.generateEventId();
      const eventId2 = service.generateEventId();

      expect(eventId1).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(eventId2).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(eventId1).not.toBe(eventId2);
    });

    it("應該生成帶有時間戳的 ID", () => {
      const beforeTimestamp = Date.now();
      const eventId = service.generateEventId();
      const afterTimestamp = Date.now();

      const timestampMatch = eventId.match(/^evt_(\d+)_/);
      expect(timestampMatch).not.toBeNull();

      if (timestampMatch) {
        const extractedTimestamp = parseInt(timestampMatch[1]);
        expect(extractedTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
        expect(extractedTimestamp).toBeLessThanOrEqual(afterTimestamp);
      }
    });
  });

  describe("broadcastOrderItemStatusUpdate", () => {
    it("應該廣播訂單項目狀態更新", async () => {
      const itemUpdateEvent = {
        type: RealtimeEventType.ORDER_ITEM_STATUS_UPDATE,
        eventId: "evt_item_789",
        timestamp: Date.now(),
        restaurantId: "rest_789",
        data: {
          orderId: 300,
          orderNumber: "#300",
          orderItemId: 50,
          menuItemName: "Pizza",
          status: "ready",
          previousStatus: "preparing",
        },
      };

      mockDurableObjectStub.fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            eventId: "evt_item_789",
            recipientCount: 2,
          }),
        ),
      );

      const result = await service.broadcastOrderItemStatusUpdate(
        itemUpdateEvent as any,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("broadcastKitchenItemStatus", () => {
    it("應該廣播廚房項目狀態", async () => {
      const kitchenEvent = {
        type: RealtimeEventType.KITCHEN_ITEM_STATUS,
        eventId: "evt_kitchen_101",
        timestamp: Date.now(),
        restaurantId: "rest_101",
        data: {
          kitchenItemId: "ki_1",
          orderId: 400,
          orderNumber: "#400",
          menuItemName: "Salad",
          status: "cooking",
          estimatedTime: 10,
          station: "cold-kitchen",
        },
      };

      mockDurableObjectStub.fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            eventId: "evt_kitchen_101",
            recipientCount: 1,
          }),
        ),
      );

      const result = await service.broadcastKitchenItemStatus(
        kitchenEvent as any,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("broadcastMenuAvailabilityUpdate", () => {
    it("應該廣播菜單可用性更新", async () => {
      const menuEvent = {
        type: RealtimeEventType.MENU_AVAILABILITY_UPDATE,
        eventId: "evt_menu_202",
        timestamp: Date.now(),
        restaurantId: "rest_202",
        data: {
          menuItemId: 20,
          menuItemName: "Steak",
          available: false,
          reason: "Sold out",
          estimatedAvailableTime: Date.now() + 3600000,
        },
      };

      mockDurableObjectStub.fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            eventId: "evt_menu_202",
            recipientCount: 10,
          }),
        ),
      );

      const result = await service.broadcastMenuAvailabilityUpdate(
        menuEvent as any,
      );

      expect(result.success).toBe(true);
    });
  });
});
