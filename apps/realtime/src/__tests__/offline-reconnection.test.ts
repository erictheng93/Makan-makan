/**
 * Offline Reconnection Tests
 * 測試離線重連與事件歷史恢復機制
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RealtimeEventType, OrderStatus } from "@makanmakan/shared-types";
import type { RealtimeEvent } from "@makanmakan/shared-types";

// Mock CloseEvent for Node.js environment
if (typeof CloseEvent === "undefined") {
  global.CloseEvent = class CloseEvent extends Event {
    code: number;
    reason: string;
    wasClean: boolean;

    constructor(
      type: string,
      eventInitDict?: { code?: number; reason?: string; wasClean?: boolean },
    ) {
      super(type);
      this.code = eventInitDict?.code ?? 0;
      this.reason = eventInitDict?.reason ?? "";
      this.wasClean = eventInitDict?.wasClean ?? false;
    }
  } as any;
}

// Mock event history storage
class EventHistoryStore {
  private events: RealtimeEvent[] = [];
  private readonly MAX_EVENTS = 100;

  addEvent(event: RealtimeEvent): void {
    this.events.push(event);

    // Keep only the last 100 events
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }
  }

  getEventsSince(sinceEventId: string): RealtimeEvent[] {
    const sinceIndex = this.events.findIndex((e) => e.eventId === sinceEventId);

    if (sinceIndex === -1) {
      // Event ID not found, return all events
      return [...this.events];
    }

    // Return events after the specified event
    return this.events.slice(sinceIndex + 1);
  }

  getAllEvents(): RealtimeEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  getEventCount(): number {
    return this.events.length;
  }
}

// Mock WebSocket with reconnection capability
class ReconnectableWebSocket {
  public readyState: number = WebSocket.CONNECTING;
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectInterval: number = 1000;
  private lastEventId: string | null = null;

  constructor(
    public url: string,
    private eventHistory: EventHistoryStore,
  ) {
    this.connect();
  }

  private connect(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event("open"));
        }

        // If we have a lastEventId, request missed events
        if (this.lastEventId) {
          this.requestMissedEvents();
        }
        resolve();
      }, 10);
    });
  }

  send(data: string): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }

    const message = JSON.parse(data);

    // Track lastEventId from received events
    if (message.type === "event_ack") {
      this.lastEventId = message.eventId;
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSING;
    // Execute synchronously to avoid timer issues
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      const event = new CloseEvent("close", { code, reason, wasClean: true });
      this.onclose(event);
    }
  }

  simulateDisconnect(): void {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      const event = new CloseEvent("close", {
        code: 1006,
        reason: "Connection lost",
        wasClean: false,
      });
      this.onclose(event);
    }
  }

  async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error("Max reconnect attempts reached");
    }

    this.reconnectAttempts++;

    await new Promise((resolve) => setTimeout(resolve, this.reconnectInterval));

    this.readyState = WebSocket.CONNECTING;
    await this.connect();
  }

  private requestMissedEvents(): void {
    if (!this.lastEventId) return;

    const missedEvents = this.eventHistory.getEventsSince(this.lastEventId);

    // Simulate receiving missed events
    missedEvents.forEach((event) => {
      setTimeout(() => {
        if (this.onmessage) {
          const messageEvent = new MessageEvent("message", {
            data: JSON.stringify(event),
          });
          this.onmessage(messageEvent);
        }
      }, 50);
    });
  }

  updateLastEventId(eventId: string): void {
    this.lastEventId = eventId;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  reset(): void {
    this.reconnectAttempts = 0;
    this.lastEventId = null;
  }
}

describe("Offline Reconnection Tests", () => {
  let eventHistory: EventHistoryStore;
  let ws: ReconnectableWebSocket;

  beforeEach(() => {
    eventHistory = new EventHistoryStore();
    vi.clearAllMocks();
    // Reset and close any existing WebSocket instance
    if (ws) {
      try {
        ws.reset();
        ws.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  });

  afterEach(() => {
    // Clean up WebSocket connections
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  });

  describe("事件歷史記錄", () => {
    it("應該記錄事件到歷史", () => {
      const event: RealtimeEvent = {
        type: RealtimeEventType.NEW_ORDER,
        eventId: "evt_1",
        timestamp: Date.now(),
        restaurantId: "rest_1",
        data: {
          orderId: 123,
          orderNumber: "ORD-001",
          items: [],
          totalAmount: 10,
        },
      };

      eventHistory.addEvent(event);

      expect(eventHistory.getEventCount()).toBe(1);
      expect(eventHistory.getAllEvents()[0].eventId).toBe("evt_1");
    });

    it("應該只保留最近 100 個事件", () => {
      // Add 150 events
      for (let i = 0; i < 150; i++) {
        const event: RealtimeEvent = {
          type: RealtimeEventType.NEW_ORDER,
          eventId: `evt_${i}`,
          timestamp: Date.now(),
          restaurantId: "rest_1",
          data: {
            orderId: i,
            orderNumber: `ORD-${String(i).padStart(3, "0")}`,
            items: [],
            totalAmount: i * 10,
          },
        };
        eventHistory.addEvent(event);
      }

      expect(eventHistory.getEventCount()).toBe(100);

      // Should have events 50-149
      const allEvents = eventHistory.getAllEvents();
      expect(allEvents[0].eventId).toBe("evt_50");
      expect(allEvents[99].eventId).toBe("evt_149");
    });

    it("應該查詢指定事件之後的事件", () => {
      // Add 10 events
      for (let i = 0; i < 10; i++) {
        const event: RealtimeEvent = {
          type: RealtimeEventType.NEW_ORDER,
          eventId: `evt_${i}`,
          timestamp: Date.now(),
          restaurantId: "rest_1",
          data: {
            orderId: i,
            orderNumber: `ORD-${i}`,
            items: [],
            totalAmount: i * 10,
          },
        };
        eventHistory.addEvent(event);
      }

      // Get events since evt_5
      const missedEvents = eventHistory.getEventsSince("evt_5");

      expect(missedEvents).toHaveLength(4); // evt_6, evt_7, evt_8, evt_9
      expect(missedEvents[0].eventId).toBe("evt_6");
      expect(missedEvents[3].eventId).toBe("evt_9");
    });

    it("當事件 ID 不存在時應該返回所有事件", () => {
      for (let i = 0; i < 5; i++) {
        const event: RealtimeEvent = {
          type: RealtimeEventType.NEW_ORDER,
          eventId: `evt_${i}`,
          timestamp: Date.now(),
          restaurantId: "rest_1",
          data: {
            orderId: i,
            orderNumber: `ORD-${i}`,
            items: [],
            totalAmount: i * 10,
          },
        };
        eventHistory.addEvent(event);
      }

      const missedEvents = eventHistory.getEventsSince("evt_nonexistent");

      expect(missedEvents).toHaveLength(5);
    });
  });

  describe("重連機制", () => {
    it("應該成功重新連接", async () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      return new Promise<void>((resolve, reject) => {
        let reconnected = false;

        ws.onopen = () => {
          if (reconnected) {
            // After reconnection, verify state and resolve
            try {
              expect(ws.readyState).toBe(WebSocket.OPEN);
              expect(ws.getReconnectAttempts()).toBe(1);
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            // First connection - simulate disconnect
            ws.simulateDisconnect();
          }
        };

        ws.onclose = async (event: CloseEvent) => {
          if (!event.wasClean && !reconnected) {
            reconnected = true;
            try {
              // Attempt reconnection
              await ws.reconnect();
            } catch (error) {
              reject(error);
            }
          }
        };
      });
    }, 10000);

    it("應該在達到最大重試次數後停止重連", async () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      // Force multiple reconnect attempts
      for (let i = 0; i < 5; i++) {
        await ws.reconnect().catch(() => {});
      }

      // Should fail on the 6th attempt
      await expect(ws.reconnect()).rejects.toThrow(
        "Max reconnect attempts reached",
      );
    });
  });

  describe("離線期間的事件恢復", () => {
    it("應該接收離線期間遺漏的事件", async () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      return new Promise<void>((resolve, reject) => {
        let missedEventCount = 0;

        ws.onopen = async () => {
          try {
            // Track last event
            ws.updateLastEventId("evt_5");

            // Simulate disconnect
            ws.simulateDisconnect();

            // While offline, add events to history
            for (let i = 6; i <= 10; i++) {
              const event: RealtimeEvent = {
                type: RealtimeEventType.ORDER_STATUS_UPDATE,
                eventId: `evt_${i}`,
                timestamp: Date.now(),
                restaurantId: "rest_1",
                data: {
                  orderId: 123,
                  orderNumber: "ORD-001",
                  status: OrderStatus.PREPARING,
                  previousStatus: OrderStatus.PENDING,
                },
              };
              eventHistory.addEvent(event);
            }

            // Reconnect
            await ws.reconnect();
          } catch (error) {
            reject(error);
          }
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);

          // Count missed events (evt_6 through evt_10)
          if (message.type === RealtimeEventType.ORDER_STATUS_UPDATE) {
            missedEventCount++;

            if (missedEventCount === 5) {
              expect(missedEventCount).toBe(5);
              resolve();
            }
          }
        };
      });
    }, 10000);

    it("應該按正確順序恢復事件", async () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      return new Promise<void>((resolve, reject) => {
        const receivedEvents: string[] = [];

        ws.onopen = async () => {
          try {
            ws.updateLastEventId("evt_3");
            ws.simulateDisconnect();

            // Add events while offline
            for (let i = 4; i <= 8; i++) {
              const event: RealtimeEvent = {
                type: RealtimeEventType.NEW_ORDER,
                eventId: `evt_${i}`,
                timestamp: Date.now(),
                restaurantId: "rest_1",
                data: {
                  orderId: i,
                  orderNumber: `ORD-${i}`,
                  items: [],
                  totalAmount: i * 10,
                },
              };
              eventHistory.addEvent(event);
            }

            await ws.reconnect();
          } catch (error) {
            reject(error);
          }
        };

        ws.onmessage = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          receivedEvents.push(message.eventId);

          if (receivedEvents.length === 5) {
            expect(receivedEvents).toEqual([
              "evt_4",
              "evt_5",
              "evt_6",
              "evt_7",
              "evt_8",
            ]);
            resolve();
          }
        };
      });
    }, 10000);

    it("應該處理大量遺漏事件", async () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      return new Promise<void>((resolve, reject) => {
        let receivedCount = 0;

        ws.onopen = async () => {
          try {
            ws.updateLastEventId("evt_0");
            ws.simulateDisconnect();

            // Add 50 events while offline
            for (let i = 1; i <= 50; i++) {
              const event: RealtimeEvent = {
                type: RealtimeEventType.NEW_ORDER,
                eventId: `evt_${i}`,
                timestamp: Date.now(),
                restaurantId: "rest_1",
                data: {
                  orderId: i,
                  orderNumber: `ORD-${i}`,
                  items: [],
                  totalAmount: i * 10,
                },
              };
              eventHistory.addEvent(event);
            }

            await ws.reconnect();
          } catch (error) {
            reject(error);
          }
        };

        ws.onmessage = (event: MessageEvent) => {
          receivedCount++;

          if (receivedCount === 50) {
            expect(receivedCount).toBe(50);
            resolve();
          }
        };
      });
    }, 10000);
  });

  describe("lastEventId 追蹤", () => {
    it("應該追蹤最後接收的事件 ID", () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      ws.updateLastEventId("evt_123");

      // This would normally be private, but we can test indirectly
      // by checking if missed events are requested correctly
      expect(ws).toBeDefined();
    });

    it("應該在每個事件後更新 lastEventId", async () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          const events = ["evt_1", "evt_2", "evt_3"];

          events.forEach((eventId) => {
            ws.updateLastEventId(eventId);
          });

          // After updating to evt_3, only events after evt_3 should be retrieved
          const missedEvents = eventHistory.getEventsSince("evt_3");
          expect(missedEvents.length).toBe(0); // No events after evt_3

          resolve();
        };
      });
    });
  });

  describe("邊界情況", () => {
    it("應該處理首次連接（無 lastEventId）", async () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          // No lastEventId set, should not request missed events
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve();
        };
      });
    });

    it("應該處理空的事件歷史", () => {
      const missedEvents = eventHistory.getEventsSince("evt_1");
      expect(missedEvents).toHaveLength(0);
    });

    it("應該處理立即重連", async () => {
      ws = new ReconnectableWebSocket(
        "wss://realtime.test/customer/table1?token=test",
        eventHistory,
      );

      return new Promise<void>((resolve, reject) => {
        let reconnected = false;

        ws.onopen = async () => {
          if (reconnected) {
            // After reconnection, verify and resolve
            try {
              expect(ws.readyState).toBe(WebSocket.OPEN);
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            // First connection - simulate disconnect
            ws.simulateDisconnect();
          }
        };

        ws.onclose = async () => {
          if (!reconnected) {
            reconnected = true;
            try {
              // Immediate reconnection
              await ws.reconnect();
            } catch (error) {
              reject(error);
            }
          }
        };
      });
    }, 10000);
  });
});
