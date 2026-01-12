// Realtime - Message Dispatcher 測試
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Message Dispatcher 測試
 *
 * 測試範圍：
 * - 訊息路由邏輯
 * - Room 分發
 * - 訊息過濾
 * - 廣播機制
 */

interface RealtimeMessage {
  type: string;
  roomType: "customer" | "admin" | "kitchen";
  roomId: string;
  payload: any;
  timestamp: number;
  senderId?: string;
}

interface Connection {
  id: string;
  type: "customer" | "admin" | "kitchen";
  roomId: string;
  ws: any;
}

describe("Message Dispatcher", () => {
  let connections: Map<string, Connection>;

  // Helper to create a fresh mock WebSocket for each connection
  const createMockWebSocket = () => ({
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  });

  beforeEach(() => {
    connections = new Map();
  });

  describe("訊息路由", () => {
    it("應該將訊息路由到正確的 room", () => {
      const conn1 = {
        id: "conn-1",
        type: "customer" as const,
        roomId: "table-1",
        ws: createMockWebSocket(),
      };

      const conn2 = {
        id: "conn-2",
        type: "customer" as const,
        roomId: "table-2",
        ws: createMockWebSocket(),
      };

      connections.set("conn-1", conn1);
      connections.set("conn-2", conn2);

      const message: RealtimeMessage = {
        type: "order.created",
        roomType: "customer",
        roomId: "table-1",
        payload: { orderId: "order-123" },
        timestamp: Date.now(),
      };

      const dispatch = (msg: RealtimeMessage) => {
        connections.forEach((conn) => {
          if (conn.roomId === msg.roomId && conn.type === msg.roomType) {
            conn.ws.send(JSON.stringify(msg));
          }
        });
      };

      dispatch(message);

      expect(conn1.ws.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(conn2.ws.send).not.toHaveBeenCalled();
    });

    it("應該支持多個連接在同一個 room", () => {
      const conn1 = {
        id: "conn-1",
        type: "customer" as const,
        roomId: "table-1",
        ws: createMockWebSocket(),
      };

      const conn2 = {
        id: "conn-2",
        type: "customer" as const,
        roomId: "table-1", // Same room
        ws: createMockWebSocket(),
      };

      connections.set("conn-1", conn1);
      connections.set("conn-2", conn2);

      const message: RealtimeMessage = {
        type: "menu.updated",
        roomType: "customer",
        roomId: "table-1",
        payload: {},
        timestamp: Date.now(),
      };

      const dispatch = (msg: RealtimeMessage) => {
        connections.forEach((conn) => {
          if (conn.roomId === msg.roomId && conn.type === msg.roomType) {
            conn.ws.send(JSON.stringify(msg));
          }
        });
      };

      dispatch(message);

      expect(conn1.ws.send).toHaveBeenCalled();
      expect(conn2.ws.send).toHaveBeenCalled();
    });

    it("應該根據 roomType 過濾連接", () => {
      const customerConn = {
        id: "conn-1",
        type: "customer" as const,
        roomId: "table-1",
        ws: createMockWebSocket(),
      };

      const adminConn = {
        id: "conn-2",
        type: "admin" as const,
        roomId: "dashboard-1",
        ws: createMockWebSocket(),
      };

      connections.set("conn-1", customerConn);
      connections.set("conn-2", adminConn);

      const message: RealtimeMessage = {
        type: "order.status.changed",
        roomType: "admin",
        roomId: "dashboard-1",
        payload: {},
        timestamp: Date.now(),
      };

      const dispatch = (msg: RealtimeMessage) => {
        connections.forEach((conn) => {
          if (conn.roomId === msg.roomId && conn.type === msg.roomType) {
            conn.ws.send(JSON.stringify(msg));
          }
        });
      };

      dispatch(message);

      expect(customerConn.ws.send).not.toHaveBeenCalled();
      expect(adminConn.ws.send).toHaveBeenCalled();
    });
  });

  describe("廣播機制", () => {
    it("應該廣播到所有連接", () => {
      const conn1 = {
        id: "conn-1",
        type: "customer" as const,
        roomId: "table-1",
        ws: createMockWebSocket(),
      };

      const conn2 = {
        id: "conn-2",
        type: "admin" as const,
        roomId: "dashboard-1",
        ws: createMockWebSocket(),
      };

      connections.set("conn-1", conn1);
      connections.set("conn-2", conn2);

      const message: RealtimeMessage = {
        type: "system.announcement",
        roomType: "customer",
        roomId: "broadcast",
        payload: { text: "System maintenance" },
        timestamp: Date.now(),
      };

      const broadcast = (msg: RealtimeMessage) => {
        connections.forEach((conn) => {
          conn.ws.send(JSON.stringify(msg));
        });
      };

      broadcast(message);

      expect(conn1.ws.send).toHaveBeenCalled();
      expect(conn2.ws.send).toHaveBeenCalled();
    });

    it("應該廣播到特定類型的所有連接", () => {
      const customer1 = {
        id: "conn-1",
        type: "customer" as const,
        roomId: "table-1",
        ws: createMockWebSocket(),
      };

      const customer2 = {
        id: "conn-2",
        type: "customer" as const,
        roomId: "table-2",
        ws: createMockWebSocket(),
      };

      const admin = {
        id: "conn-3",
        type: "admin" as const,
        roomId: "dashboard-1",
        ws: createMockWebSocket(),
      };

      connections.set("conn-1", customer1);
      connections.set("conn-2", customer2);
      connections.set("conn-3", admin);

      const message: RealtimeMessage = {
        type: "menu.updated",
        roomType: "customer",
        roomId: "broadcast",
        payload: {},
        timestamp: Date.now(),
      };

      const broadcastToType = (msg: RealtimeMessage, targetType: string) => {
        connections.forEach((conn) => {
          if (conn.type === targetType) {
            conn.ws.send(JSON.stringify(msg));
          }
        });
      };

      broadcastToType(message, "customer");

      expect(customer1.ws.send).toHaveBeenCalled();
      expect(customer2.ws.send).toHaveBeenCalled();
      expect(admin.ws.send).not.toHaveBeenCalled();
    });

    it("應該排除發送者本身", () => {
      const sender = {
        id: "conn-sender",
        type: "customer" as const,
        roomId: "table-1",
        ws: createMockWebSocket(),
      };

      const receiver = {
        id: "conn-receiver",
        type: "customer" as const,
        roomId: "table-1",
        ws: createMockWebSocket(),
      };

      connections.set("conn-sender", sender);
      connections.set("conn-receiver", receiver);

      const message: RealtimeMessage = {
        type: "user.typing",
        roomType: "customer",
        roomId: "table-1",
        payload: {},
        timestamp: Date.now(),
        senderId: "conn-sender",
      };

      const dispatchExcludingSender = (msg: RealtimeMessage) => {
        connections.forEach((conn) => {
          if (
            conn.roomId === msg.roomId &&
            conn.type === msg.roomType &&
            conn.id !== msg.senderId
          ) {
            conn.ws.send(JSON.stringify(msg));
          }
        });
      };

      dispatchExcludingSender(message);

      expect(sender.ws.send).not.toHaveBeenCalled();
      expect(receiver.ws.send).toHaveBeenCalled();
    });
  });

  describe("訊息過濾", () => {
    it("應該過濾無效的訊息", () => {
      const isValidMessage = (msg: any): boolean => {
        // Use Boolean() to ensure a proper boolean return value
        return Boolean(
          msg &&
          typeof msg.type === "string" &&
          typeof msg.roomType === "string" &&
          typeof msg.roomId === "string" &&
          msg.payload !== undefined,
        );
      };

      expect(
        isValidMessage({
          type: "test",
          roomType: "customer",
          roomId: "room-1",
          payload: {},
        }),
      ).toBe(true);
      expect(
        isValidMessage({
          type: "test",
          roomType: "customer",
          roomId: "room-1",
        }),
      ).toBe(false); // Missing payload
      expect(
        isValidMessage({ roomType: "customer", roomId: "room-1", payload: {} }),
      ).toBe(false); // Missing type
      expect(isValidMessage(null)).toBe(false);
    });

    it("應該驗證 roomType", () => {
      const validRoomTypes = ["customer", "admin", "kitchen"];

      const isValidRoomType = (roomType: string): boolean => {
        return validRoomTypes.includes(roomType);
      };

      expect(isValidRoomType("customer")).toBe(true);
      expect(isValidRoomType("admin")).toBe(true);
      expect(isValidRoomType("kitchen")).toBe(true);
      expect(isValidRoomType("invalid")).toBe(false);
    });

    it("應該過濾過大的訊息", () => {
      const MAX_MESSAGE_SIZE = 1024 * 64; // 64KB

      const isMessageTooLarge = (msg: RealtimeMessage): boolean => {
        const size = JSON.stringify(msg).length;
        return size > MAX_MESSAGE_SIZE;
      };

      const smallMessage: RealtimeMessage = {
        type: "test",
        roomType: "customer",
        roomId: "room-1",
        payload: { data: "small" },
        timestamp: Date.now(),
      };

      const largeMessage: RealtimeMessage = {
        type: "test",
        roomType: "customer",
        roomId: "room-1",
        payload: { data: "x".repeat(100000) },
        timestamp: Date.now(),
      };

      expect(isMessageTooLarge(smallMessage)).toBe(false);
      expect(isMessageTooLarge(largeMessage)).toBe(true);
    });
  });

  describe("錯誤處理", () => {
    it("應該處理發送失敗", () => {
      const failingWs = {
        send: vi.fn(() => {
          throw new Error("Send failed");
        }),
        readyState: 1,
      };

      const conn = {
        id: "conn-1",
        type: "customer" as const,
        roomId: "table-1",
        ws: failingWs,
      };

      connections.set("conn-1", conn);

      const message: RealtimeMessage = {
        type: "test",
        roomType: "customer",
        roomId: "table-1",
        payload: {},
        timestamp: Date.now(),
      };

      const safeSend = (conn: Connection, msg: RealtimeMessage) => {
        try {
          conn.ws.send(JSON.stringify(msg));
          return { success: true };
        } catch (error) {
          console.error(`Failed to send to ${conn.id}:`, error);
          return { success: false };
        }
      };

      const result = safeSend(conn, message);

      expect(result.success).toBe(false);
    });

    it("應該跳過已關閉的連接", () => {
      const closedWs = {
        send: vi.fn(),
        readyState: 3, // CLOSED
      };

      const conn = {
        id: "conn-1",
        type: "customer" as const,
        roomId: "table-1",
        ws: closedWs,
      };

      const message: RealtimeMessage = {
        type: "test",
        roomType: "customer",
        roomId: "table-1",
        payload: {},
        timestamp: Date.now(),
      };

      const sendIfOpen = (conn: Connection, msg: RealtimeMessage) => {
        if (conn.ws.readyState === 1) {
          // OPEN
          conn.ws.send(JSON.stringify(msg));
          return true;
        }
        return false;
      };

      const sent = sendIfOpen(conn, message);

      expect(sent).toBe(false);
      expect(closedWs.send).not.toHaveBeenCalled();
    });

    it("應該清理失敗的連接", () => {
      const failingWs = {
        send: vi.fn(() => {
          throw new Error("Send failed");
        }),
        close: vi.fn(),
        readyState: 1,
      };

      const conn = {
        id: "conn-fail",
        type: "customer" as const,
        roomId: "table-1",
        ws: failingWs,
      };

      connections.set("conn-fail", conn);

      const message: RealtimeMessage = {
        type: "test",
        roomType: "customer",
        roomId: "table-1",
        payload: {},
        timestamp: Date.now(),
      };

      const dispatchWithCleanup = (msg: RealtimeMessage) => {
        const failedConnections: string[] = [];

        connections.forEach((conn) => {
          if (conn.roomId === msg.roomId && conn.type === msg.roomType) {
            try {
              conn.ws.send(JSON.stringify(msg));
            } catch (error) {
              failedConnections.push(conn.id);
              conn.ws.close();
            }
          }
        });

        failedConnections.forEach((id) => connections.delete(id));

        return failedConnections.length;
      };

      const failedCount = dispatchWithCleanup(message);

      expect(failedCount).toBe(1);
      expect(connections.has("conn-fail")).toBe(false);
      expect(failingWs.close).toHaveBeenCalled();
    });
  });

  describe("訊息統計", () => {
    it("應該統計發送的訊息數量", () => {
      const stats = {
        messagesSent: 0,
        messagesDropped: 0,
      };

      const conn = {
        id: "conn-1",
        type: "customer" as const,
        roomId: "table-1",
        ws: createMockWebSocket(),
      };

      connections.set("conn-1", conn);

      const message: RealtimeMessage = {
        type: "test",
        roomType: "customer",
        roomId: "table-1",
        payload: {},
        timestamp: Date.now(),
      };

      const dispatchWithStats = (msg: RealtimeMessage) => {
        connections.forEach((conn) => {
          if (conn.roomId === msg.roomId && conn.type === msg.roomType) {
            try {
              conn.ws.send(JSON.stringify(msg));
              stats.messagesSent++;
            } catch (error) {
              stats.messagesDropped++;
            }
          }
        });
      };

      dispatchWithStats(message);

      expect(stats.messagesSent).toBe(1);
      expect(stats.messagesDropped).toBe(0);
    });
  });
});
