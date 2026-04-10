/**
 * Message Routing Logic Tests
 * 測試訊息路由核心邏輯
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeEventType } from "@makanmakan/shared-types";
import type {
  RealtimeEvent,
  RealtimeAuthPayload,
} from "@makanmakan/shared-types";
import {
  realtimeAuthFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

/**
 * 模擬 shouldSendEventToConnection 邏輯
 * 這是從 RealtimeSession 抽取出來的核心路由邏輯
 */
function shouldSendEventToConnection(
  event: RealtimeEvent,
  connectionInfo: {
    auth?: RealtimeAuthPayload;
  },
): boolean {
  // 驗證餐廳 ID 匹配
  if (event.restaurantId !== connectionInfo.auth?.restaurantId) {
    return false;
  }

  const eventType = event.type;
  const role = connectionInfo.auth?.role || "customer";

  // 根據事件類型和連線角色決定是否發送
  switch (eventType) {
    // 訂單事件 - 所有角色都接收
    case RealtimeEventType.NEW_ORDER:
      return true;

    case RealtimeEventType.ORDER_STATUS_UPDATE:
    case RealtimeEventType.ORDER_ITEM_STATUS_UPDATE:
      // 顧客只接收與自己相關的訂單更新
      if (role === "customer") {
        // 這裡需要檢查訂單是否屬於該顧客的桌號/座位
        // 暫時允許所有顧客接收（之後可以優化）
        return true;
      }
      // 廚房和管理員接收所有訂單更新
      return role === "staff" || role === "admin";

    case RealtimeEventType.ORDER_CANCELLED:
      return true;

    // 廚房事件 - 只有廚房和管理員接收
    case RealtimeEventType.KITCHEN_ITEM_STATUS:
    case RealtimeEventType.KITCHEN_QUEUE_UPDATE:
      return role === "staff" || role === "admin";

    // 桌台事件 - 所有角色接收
    case RealtimeEventType.TABLE_STATUS_UPDATE:
    case RealtimeEventType.TABLE_CALL_SERVICE:
      return true;

    // 菜單事件 - 所有角色接收
    case RealtimeEventType.MENU_AVAILABILITY_UPDATE:
    case RealtimeEventType.MENU_ITEM_UPDATE:
      return true;

    // 系統事件 - 所有角色接收
    case RealtimeEventType.SYSTEM_NOTIFICATION:
    case RealtimeEventType.RESTAURANT_STATUS_UPDATE:
      return true;

    // 連線和心跳事件 - 不通過 broadcast（直接發送）
    case RealtimeEventType.CONNECTION_ACK:
    case RealtimeEventType.HEARTBEAT:
    case RealtimeEventType.ERROR:
      return false;

    default:
      // 未知事件類型 - 只發送給管理員
      return role === "admin";
  }
}

/** Helper: wrap a RealtimeAuthPayload in a connection-like object */
function connWith(authOverrides: Partial<RealtimeAuthPayload>) {
  return { auth: realtimeAuthFactory.build({ overrides: authOverrides }) };
}

describe("Message Routing Logic", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  describe("餐廳 ID 隔離", () => {
    it("應該只發送給相同餐廳 ID 的連線", () => {
      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_1",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {} as any,
      };

      const matchingConnection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      const differentRestaurantConnection = connWith({
        roomType: "customer",
        roomId: "room_2",
        restaurantId: "rest_2",
        role: "customer",
      });

      expect(shouldSendEventToConnection(event, matchingConnection)).toBe(true);
      expect(
        shouldSendEventToConnection(event, differentRestaurantConnection),
      ).toBe(false);
    });
  });

  describe("NEW_ORDER 事件路由", () => {
    const newOrderEvent: RealtimeEvent = {
      type: RealtimeEventType.NEW_ORDER,
      eventId: "evt_new_1",
      timestamp: Date.now(),
      restaurantId: "rest_1",
      data: {} as any,
    };

    it("應該發送給所有角色", () => {
      const customerConnection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      const staffConnection = connWith({
        roomType: "kitchen",
        roomId: "kitchen_1",
        restaurantId: "rest_1",
        role: "staff",
      });

      const adminConnection = connWith({
        roomType: "admin",
        roomId: "admin_1",
        restaurantId: "rest_1",
        role: "admin",
      });

      expect(
        shouldSendEventToConnection(newOrderEvent, customerConnection),
      ).toBe(true);
      expect(shouldSendEventToConnection(newOrderEvent, staffConnection)).toBe(
        true,
      );
      expect(shouldSendEventToConnection(newOrderEvent, adminConnection)).toBe(
        true,
      );
    });
  });

  describe("ORDER_STATUS_UPDATE 事件路由", () => {
    const statusUpdateEvent: RealtimeEvent = {
      type: RealtimeEventType.ORDER_STATUS_UPDATE,
      eventId: "evt_status_1",
      timestamp: Date.now(),
      restaurantId: "rest_1",
      data: {
        orderId: 1,
        orderNumber: "ORD-001",
        status: "preparing",
        previousStatus: "pending",
      },
    };

    it("應該發送給顧客", () => {
      const customerConnection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      expect(
        shouldSendEventToConnection(statusUpdateEvent, customerConnection),
      ).toBe(true);
    });

    it("應該發送給廚房員工", () => {
      const staffConnection = connWith({
        roomType: "kitchen",
        roomId: "kitchen_1",
        restaurantId: "rest_1",
        role: "staff",
      });

      expect(
        shouldSendEventToConnection(statusUpdateEvent, staffConnection),
      ).toBe(true);
    });

    it("應該發送給管理員", () => {
      const adminConnection = connWith({
        roomType: "admin",
        roomId: "admin_1",
        restaurantId: "rest_1",
        role: "admin",
      });

      expect(
        shouldSendEventToConnection(statusUpdateEvent, adminConnection),
      ).toBe(true);
    });
  });

  describe("KITCHEN_ITEM_STATUS 事件路由", () => {
    const kitchenEvent: RealtimeEvent = {
      type: RealtimeEventType.KITCHEN_ITEM_STATUS,
      eventId: "evt_kitchen_1",
      timestamp: Date.now(),
      restaurantId: "rest_1",
      data: {
        orderId: 1,
        orderItemId: 1,
        menuItemName: "Test Item",
        status: "pending",
      },
    };

    it("應該發送給廚房員工", () => {
      const staffConnection = connWith({
        roomType: "kitchen",
        roomId: "kitchen_1",
        restaurantId: "rest_1",
        role: "staff",
      });

      expect(shouldSendEventToConnection(kitchenEvent, staffConnection)).toBe(
        true,
      );
    });

    it("應該發送給管理員", () => {
      const adminConnection = connWith({
        roomType: "admin",
        roomId: "admin_1",
        restaurantId: "rest_1",
        role: "admin",
      });

      expect(shouldSendEventToConnection(kitchenEvent, adminConnection)).toBe(
        true,
      );
    });

    it("不應該發送給顧客", () => {
      const customerConnection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      expect(
        shouldSendEventToConnection(kitchenEvent, customerConnection),
      ).toBe(false);
    });
  });

  describe("MENU_AVAILABILITY_UPDATE 事件路由", () => {
    const menuEvent: RealtimeEvent = {
      type: RealtimeEventType.MENU_AVAILABILITY_UPDATE,
      eventId: "evt_menu_1",
      timestamp: Date.now(),
      restaurantId: "rest_1",
      data: {
        menuItemId: 1,
        menuItemName: "Test Item",
        isAvailable: false,
      },
    };

    it("應該發送給所有角色", () => {
      const customerConnection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      const staffConnection = connWith({
        roomType: "kitchen",
        roomId: "kitchen_1",
        restaurantId: "rest_1",
        role: "staff",
      });

      const adminConnection = connWith({
        roomType: "admin",
        roomId: "admin_1",
        restaurantId: "rest_1",
        role: "admin",
      });

      expect(shouldSendEventToConnection(menuEvent, customerConnection)).toBe(
        true,
      );
      expect(shouldSendEventToConnection(menuEvent, staffConnection)).toBe(
        true,
      );
      expect(shouldSendEventToConnection(menuEvent, adminConnection)).toBe(
        true,
      );
    });
  });

  describe("系統事件路由", () => {
    const systemEvent: RealtimeEvent = {
      type: RealtimeEventType.SYSTEM_NOTIFICATION,
      eventId: "evt_system_1",
      timestamp: Date.now(),
      restaurantId: "rest_1",
      data: {
        notificationId: "notif_1",
        level: "info" as const,
        title: "Test",
        message: "Test message",
      },
    };

    it("應該發送給所有角色", () => {
      const customerConnection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      const staffConnection = connWith({
        roomType: "kitchen",
        roomId: "kitchen_1",
        restaurantId: "rest_1",
        role: "staff",
      });

      const adminConnection = connWith({
        roomType: "admin",
        roomId: "admin_1",
        restaurantId: "rest_1",
        role: "admin",
      });

      expect(shouldSendEventToConnection(systemEvent, customerConnection)).toBe(
        true,
      );
      expect(shouldSendEventToConnection(systemEvent, staffConnection)).toBe(
        true,
      );
      expect(shouldSendEventToConnection(systemEvent, adminConnection)).toBe(
        true,
      );
    });
  });

  describe("內部事件過濾", () => {
    it("不應該通過 broadcast 發送 CONNECTION_ACK", () => {
      const connectionAckEvent: RealtimeEvent = {
        type: RealtimeEventType.CONNECTION_ACK,
        eventId: "evt_ack_1",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          connectionId: "conn_1",
          roomType: "customer" as const,
          roomId: "room_1",
          connectedAt: Date.now(),
          activeConnections: 1,
        },
      };

      const connection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      expect(shouldSendEventToConnection(connectionAckEvent, connection)).toBe(
        false,
      );
    });

    it("不應該通過 broadcast 發送 HEARTBEAT", () => {
      const heartbeatEvent: RealtimeEvent = {
        type: RealtimeEventType.HEARTBEAT,
        eventId: "evt_heartbeat_1",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          serverTime: Date.now(),
        },
      };

      const connection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      expect(shouldSendEventToConnection(heartbeatEvent, connection)).toBe(
        false,
      );
    });
  });

  describe("未知事件類型", () => {
    it("未知事件應該只發送給管理員", () => {
      const unknownEvent = {
        type: "UNKNOWN_EVENT_TYPE" as any,
        eventId: "evt_unknown_1",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          isOpen: true,
        },
      } as RealtimeEvent;

      const customerConnection = connWith({
        roomType: "customer",
        roomId: "room_1",
        restaurantId: "rest_1",
        role: "customer",
      });

      const staffConnection = connWith({
        roomType: "kitchen",
        roomId: "kitchen_1",
        restaurantId: "rest_1",
        role: "staff",
      });

      const adminConnection = connWith({
        roomType: "admin",
        roomId: "admin_1",
        restaurantId: "rest_1",
        role: "admin",
      });

      expect(
        shouldSendEventToConnection(unknownEvent, customerConnection),
      ).toBe(false);
      expect(shouldSendEventToConnection(unknownEvent, staffConnection)).toBe(
        false,
      );
      expect(shouldSendEventToConnection(unknownEvent, adminConnection)).toBe(
        true,
      );
    });
  });
});
