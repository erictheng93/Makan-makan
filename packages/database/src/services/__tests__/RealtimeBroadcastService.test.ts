import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@makanmasak/shared-types", async () => {
  const actual = await vi.importActual<
    typeof import("@makanmasak/shared-types")
  >("@makanmasak/shared-types");
  return {
    ...actual,
    RealtimeEventType: {
      ...actual.RealtimeEventType,
      NEW_ORDER: "new_order",
      ORDER_STATUS_UPDATE: "order_status_update",
      ORDER_ITEM_STATUS_UPDATE: "order_item_status_update",
      KITCHEN_ITEM_STATUS: "kitchen_item_status",
      MENU_AVAILABILITY_UPDATE: "menu_availability_update",
    },
  };
});

import { RealtimeBroadcastService } from "../RealtimeBroadcastService";
import {
  type NewOrderEvent,
  type OrderStatusUpdateEvent,
  type OrderStatus,
  RealtimeEventType,
} from "@makanmasak/shared-types";

interface MockEnv {
  REALTIME_SESSION: {
    idFromName: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
}

describe("RealtimeBroadcastService", () => {
  let service: RealtimeBroadcastService;
  let mockEnv: MockEnv;
  let mockDurableObjectStub: { fetch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDurableObjectStub = {
      fetch: vi.fn(),
    };

    mockEnv = {
      REALTIME_SESSION: {
        idFromName: vi.fn().mockReturnValue("mock-durable-object-id"),
        get: vi.fn().mockReturnValue(mockDurableObjectStub),
      },
    };

    service = new RealtimeBroadcastService(mockEnv as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("broadcastEvent", () => {
    it("should broadcast event to durable object", async () => {
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
      expect(mockEnv.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
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

    it("should handle broadcast failure", async () => {
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

    it("should handle network errors", async () => {
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

      mockDurableObjectStub.fetch.mockRejectedValue(new Error("Network error"));

      const result = await service.broadcastEvent(
        "restaurant",
        "rest_1",
        mockEvent,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should treat missing REALTIME_SESSION binding as best-effort skip", async () => {
      const noBindingService = new RealtimeBroadcastService({} as never);
      const mockEvent: NewOrderEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_no_binding",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: { orderId: 1, orderNumber: "#001", items: [], totalAmount: 0 },
      };

      const result = await noBindingService.broadcastEvent(
        "restaurant",
        "rest_1",
        mockEvent,
      );

      expect(result.success).toBe(true);
      expect(result.recipientCount).toBe(0);
      expect(result.eventId).toBe("evt_no_binding");
    });
  });

  describe("broadcastNewOrder", () => {
    it("should broadcast new order to restaurant room", async () => {
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
      expect(mockEnv.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
        "restaurant:rest_123",
      );
    });
  });

  describe("broadcastOrderStatusUpdate", () => {
    it("should broadcast order status update", async () => {
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
      expect(mockEnv.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
        "restaurant:rest_456",
      );
    });
  });

  describe("generateEventId", () => {
    it("should generate unique event IDs", () => {
      const eventId1 = service.generateEventId();
      const eventId2 = service.generateEventId();

      expect(eventId1).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(eventId2).toMatch(/^evt_\d+_[a-z0-9]+$/);
      expect(eventId1).not.toBe(eventId2);
    });

    it("should embed a timestamp", () => {
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
    it("should broadcast order item status update", async () => {
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
        itemUpdateEvent as never,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("broadcastKitchenItemStatus", () => {
    it("should broadcast kitchen item status", async () => {
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
        kitchenEvent as never,
      );

      expect(result.success).toBe(true);
    });
  });

  describe("broadcastMenuAvailabilityUpdate", () => {
    it("should broadcast menu availability update", async () => {
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
        menuEvent as never,
      );

      expect(result.success).toBe(true);
    });
  });
});
