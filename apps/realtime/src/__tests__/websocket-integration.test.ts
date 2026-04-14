/**
 * LEGACY: Unit test with mocked services, NOT a real integration test.
 *
 * This file uses vi.mock() on service/DB boundaries. It verifies component/
 * route JS logic but does NOT verify Drizzle SQL, D1 parity, or auth middleware
 * end-to-end. A real pass here does not guarantee a real pass in production.
 *
 * For real integration testing, see:
 *   docs/superpowers/specs/2026-04-13-real-integration-test-foundation-design.md
 *   apps/api/src/__tests__/integration/*.real.integration.test.ts
 *
 * ---
 * Original: WebSocket Integration Tests / 測試完整的 WebSocket 連接流程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RealtimeEventType } from "@makanmakan/shared-types";
import type {
  RealtimeEvent,
  RealtimeAuthPayload,
} from "@makanmakan/shared-types";

// Mock WebSocket
class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  private messageQueue: any[] = [];

  constructor(public url: string) {
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 10);
  }

  send(data: string): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.messageQueue.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      if (this.onclose) {
        const event = new CloseEvent("close", { code, reason, wasClean: true });
        this.onclose(event);
      }
    }, 10);
  }

  // Test helper: simulate receiving a message
  simulateMessage(data: any): void {
    if (this.onmessage) {
      const event = new MessageEvent("message", {
        data: JSON.stringify(data),
      });
      this.onmessage(event);
    }
  }

  // Test helper: get sent messages
  getSentMessages(): any[] {
    return this.messageQueue.map((msg) => JSON.parse(msg));
  }

  // Test helper: clear message queue
  clearMessages(): void {
    this.messageQueue = [];
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

describe("WebSocket Integration Tests", () => {
  let ws: MockWebSocket;

  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
  });

  describe("連接建立流程", () => {
    it("應該成功建立 WebSocket 連接", async () => {
      const token = "test-jwt-token";
      const url = `wss://realtime.test/customer/table1?token=${token}`;

      ws = new MockWebSocket(url);

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          expect(ws.url).toContain("customer/table1");
          expect(ws.url).toContain(`token=${token}`);
          resolve();
        };
      });
    });

    it("應該接收連接確認事件", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          // Simulate server sending connection ACK
          ws.simulateMessage({
            type: RealtimeEventType.CONNECTION_ACK,
            eventId: "evt_ack_1",
            timestamp: Date.now(),
            restaurantId: "rest_1",
            data: {
              connectionId: "conn_123",
              roomType: "customer",
              roomId: "table1",
              connectedAt: Date.now(),
              activeConnections: 1,
            },
          });
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          expect(message.type).toBe(RealtimeEventType.CONNECTION_ACK);
          expect(message.data.connectionId).toBeDefined();
          expect(message.data.roomType).toBe("customer");
          resolve();
        };
      });
    });

    it("應該在連接失敗時觸發錯誤", async () => {
      ws = new MockWebSocket("wss://realtime.test/invalid");

      return new Promise<void>((resolve) => {
        ws.onerror = (error) => {
          expect(error).toBeDefined();
          resolve();
        };

        // Simulate error
        setTimeout(() => {
          if (ws.onerror) {
            ws.onerror(new Event("error"));
          }
        }, 50);
      });
    });
  });

  describe("心跳機制", () => {
    it("應該發送心跳 ping 訊息", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          // Send ping
          ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));

          const sentMessages = ws.getSentMessages();
          expect(sentMessages.length).toBeGreaterThan(0);
          expect(sentMessages[0].type).toBe("ping");
          resolve();
        };
      });
    });

    it("應該接收心跳 pong 響應", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));

          // Simulate server pong response
          ws.simulateMessage({
            type: RealtimeEventType.HEARTBEAT,
            eventId: "evt_heartbeat_1",
            timestamp: Date.now(),
            restaurantId: "rest_1",
            data: {
              serverTime: Date.now(),
            },
          });
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === RealtimeEventType.HEARTBEAT) {
            expect(message.data.serverTime).toBeDefined();
            resolve();
          }
        };
      });
    });
  });

  describe("訂單事件接收", () => {
    it("應該接收新訂單事件", async () => {
      ws = new MockWebSocket("wss://realtime.test/kitchen/rest_1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          // Simulate new order event
          const newOrderEvent: RealtimeEvent = {
            type: RealtimeEventType.NEW_ORDER,
            eventId: "evt_order_1",
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

          ws.simulateMessage(newOrderEvent);
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data) as RealtimeEvent;
          if (message.type === RealtimeEventType.NEW_ORDER) {
            expect(message.data.orderId).toBe(123);
            expect(message.data.orderNumber).toBe("ORD-001");
            expect(message.data.items).toHaveLength(1);
            expect(message.data.totalAmount).toBe(17.0);
            resolve();
          }
        };
      });
    });

    it("應該接收訂單狀態更新事件", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.simulateMessage({
            type: RealtimeEventType.ORDER_STATUS_UPDATE,
            eventId: "evt_status_1",
            timestamp: Date.now(),
            restaurantId: "rest_1",
            data: {
              orderId: 123,
              orderNumber: "ORD-001",
              status: "preparing",
              previousStatus: "pending",
              estimatedTime: 15,
              message: "您的訂單正在準備中",
            },
          });
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === RealtimeEventType.ORDER_STATUS_UPDATE) {
            expect(message.data.status).toBe("preparing");
            expect(message.data.previousStatus).toBe("pending");
            expect(message.data.estimatedTime).toBe(15);
            resolve();
          }
        };
      });
    });

    it("應該接收訂單項目狀態更新", async () => {
      ws = new MockWebSocket("wss://realtime.test/kitchen/rest_1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.simulateMessage({
            type: RealtimeEventType.ORDER_ITEM_STATUS_UPDATE,
            eventId: "evt_item_1",
            timestamp: Date.now(),
            restaurantId: "rest_1",
            data: {
              orderId: 123,
              orderItemId: 1,
              menuItemId: 10,
              menuItemName: "Chicken Rice",
              status: "cooking",
              previousStatus: "pending",
              updatedAt: Date.now(),
            },
          });
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === RealtimeEventType.ORDER_ITEM_STATUS_UPDATE) {
            expect(message.data.status).toBe("cooking");
            expect(message.data.menuItemName).toBe("Chicken Rice");
            resolve();
          }
        };
      });
    });
  });

  describe("菜單事件接收", () => {
    it("應該接收菜單可用性更新", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.simulateMessage({
            type: RealtimeEventType.MENU_AVAILABILITY_UPDATE,
            eventId: "evt_menu_1",
            timestamp: Date.now(),
            restaurantId: "rest_1",
            data: {
              menuItemId: 10,
              menuItemName: "Chicken Rice",
              isAvailable: false,
              reason: "材料用完",
            },
          });
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === RealtimeEventType.MENU_AVAILABILITY_UPDATE) {
            expect(message.data.isAvailable).toBe(false);
            expect(message.data.menuItemName).toBe("Chicken Rice");
            expect(message.data.reason).toBe("材料用完");
            resolve();
          }
        };
      });
    });
  });

  describe("系統通知", () => {
    it("應該接收系統通知事件", async () => {
      ws = new MockWebSocket("wss://realtime.test/admin/rest_1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.simulateMessage({
            type: RealtimeEventType.SYSTEM_NOTIFICATION,
            eventId: "evt_notif_1",
            timestamp: Date.now(),
            restaurantId: "rest_1",
            data: {
              notificationId: "notif_123",
              level: "warning",
              title: "庫存預警",
              message: "Chicken Rice 庫存不足",
              persistUntilRead: true,
            },
          });
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === RealtimeEventType.SYSTEM_NOTIFICATION) {
            expect(message.data.level).toBe("warning");
            expect(message.data.title).toBe("庫存預警");
            resolve();
          }
        };
      });
    });
  });

  describe("連接關閉", () => {
    it("應該優雅地關閉連接", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.close(1000, "Normal closure");
        };

        ws.onclose = (event: CloseEvent) => {
          expect(event.code).toBe(1000);
          expect(event.reason).toBe("Normal closure");
          expect(event.wasClean).toBe(true);
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          resolve();
        };
      });
    });

    it("應該處理異常斷開", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          // Simulate abnormal closure
          ws.readyState = WebSocket.CLOSED;
          if (ws.onclose) {
            const event = new CloseEvent("close", {
              code: 1006,
              reason: "Abnormal Closure",
              wasClean: false,
            });
            ws.onclose(event);
          }
        };

        ws.onclose = (event: CloseEvent) => {
          expect(event.code).toBe(1006);
          expect(event.wasClean).toBe(false);
          resolve();
        };
      });
    });
  });

  describe("錯誤處理", () => {
    it("應該接收錯誤事件", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.simulateMessage({
            type: RealtimeEventType.ERROR,
            eventId: "evt_error_1",
            timestamp: Date.now(),
            restaurantId: "rest_1",
            data: {
              code: "INVALID_MESSAGE",
              message: "Invalid message format",
              details: {},
            },
          });
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.type === RealtimeEventType.ERROR) {
            expect(message.data.code).toBe("INVALID_MESSAGE");
            expect(message.data.message).toBeDefined();
            resolve();
          }
        };
      });
    });
  });

  describe("訂閱機制", () => {
    it("應該發送訂閱請求", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "subscribe",
              timestamp: Date.now(),
              data: {
                channels: ["order:123", "table:table1"],
              },
            }),
          );

          const sentMessages = ws.getSentMessages();
          const subscribeMsg = sentMessages.find(
            (msg) => msg.type === "subscribe",
          );

          expect(subscribeMsg).toBeDefined();
          expect(subscribeMsg.data.channels).toContain("order:123");
          expect(subscribeMsg.data.channels).toContain("table:table1");
          resolve();
        };
      });
    });

    it("應該發送取消訂閱請求", async () => {
      ws = new MockWebSocket("wss://realtime.test/customer/table1?token=test");

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: "unsubscribe",
              timestamp: Date.now(),
              data: {
                channels: ["order:123"],
              },
            }),
          );

          const sentMessages = ws.getSentMessages();
          const unsubscribeMsg = sentMessages.find(
            (msg) => msg.type === "unsubscribe",
          );

          expect(unsubscribeMsg).toBeDefined();
          expect(unsubscribeMsg.data.channels).toContain("order:123");
          resolve();
        };
      });
    });
  });
});
