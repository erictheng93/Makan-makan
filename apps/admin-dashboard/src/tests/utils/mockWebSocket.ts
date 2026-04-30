/**
 * WebSocket Mock 工具
 * 用於測試實時功能
 */

import { vi } from "vitest";

type DynamicEventHandlers = Record<
  string,
  ((event: Event) => void) | null | undefined
>;

export class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING;
  public url: string;
  public protocol: string;

  private listeners: { [key: string]: Function[] } = {};
  private sentMessages: any[] = [];
  public connectionAttempts: number = 0;

  // WebSocket 常量
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  constructor(url: string, protocol?: string) {
    this.url = url;
    this.protocol = protocol || "";
    this.connectionAttempts++;

    // 模擬異步連接
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    }, 10);
  }

  // 發送消息
  send(data: string | ArrayBuffer): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }

    try {
      const message = typeof data === "string" ? JSON.parse(data) : data;
      this.sentMessages.push(message);

      // 模擬服務器響應
      this.handleMockResponse(message);
    } catch (error) {
      console.error("Mock WebSocket send error:", error);
    }
  }

  // 關閉連接
  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSING;

    setTimeout(() => {
      this.readyState = WebSocket.CLOSED;
      this.dispatchEvent(
        new CloseEvent("close", { code: code || 1000, reason }),
      );
    }, 10);
  }

  // 添加事件監聽器
  addEventListener(type: string, listener: Function): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  // 移除事件監聽器
  removeEventListener(type: string, listener: Function): void {
    if (this.listeners[type]) {
      const index = this.listeners[type].indexOf(listener);
      if (index !== -1) {
        this.listeners[type].splice(index, 1);
      }
    }
  }

  // 分發事件
  private dispatchEvent(event: Event): void {
    const type = event.type;
    if (this.listeners[type]) {
      this.listeners[type].forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error("Mock WebSocket event listener error:", error);
        }
      });
    }

    // 調用 on* 處理器
    const handlerName = `on${type}`;
    const handler = (this as unknown as DynamicEventHandlers)[handlerName];
    if (typeof handler === "function") {
      handler(event);
    }
  }

  // 事件處理器屬性
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  // 測試工具方法

  // 模擬接收消息
  mockReceiveMessage(data: any): void {
    if (this.readyState === WebSocket.OPEN) {
      const messageEvent = new MessageEvent("message", {
        data: typeof data === "string" ? data : JSON.stringify(data),
      });
      this.dispatchEvent(messageEvent);
    }
  }

  // 模擬連接錯誤
  mockError(error?: any): void {
    const errorEvent = new Event("error");
    if (error) {
      (errorEvent as Event & { error?: unknown }).error = error;
    }
    this.dispatchEvent(errorEvent);
  }

  // 模擬服務器響應
  mockResponse(response: any): void {
    setTimeout(() => {
      this.mockReceiveMessage(response);
    }, 5);
  }

  // 強制打開連接（測試用）
  open(): void {
    if (
      this.readyState === WebSocket.CLOSED ||
      this.readyState === WebSocket.CLOSING
    ) {
      this.readyState = WebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    }
  }

  // 獲取發送的消息
  getSentMessages(): any[] {
    return [...this.sentMessages];
  }

  // 獲取最後發送的消息
  getLastSentMessage(): any {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  // 清空發送記錄
  clearSentMessages(): void {
    this.sentMessages = [];
  }

  // 重置mock狀態
  reset(): void {
    this.sentMessages = [];
    this.connectionAttempts = 0;
    this.readyState = WebSocket.CLOSED;
    this.listeners = {};
  }

  // 處理模擬響應邏輯
  private handleMockResponse(message: any): void {
    // 根據消息類型自動生成響應
    switch (message.type) {
      case "join_group_order":
        this.mockResponse({
          type: "group_order_joined",
          success: true,
          groupOrder: {
            id: message.data.shareCode,
            shareCode: message.data.shareCode,
            status: "active",
            members: [
              {
                id: "mock-member-id",
                name: message.data.memberName,
                isOnline: true,
              },
            ],
          },
          memberId: "mock-member-id",
        });
        break;

      case "add_cart_item":
        this.mockResponse({
          type: "cart_item_added",
          success: true,
          item: {
            id: "mock-item-id",
            ...message.data,
          },
        });
        break;

      case "heartbeat":
        this.mockResponse({
          type: "heartbeat_ack",
          timestamp: Date.now(),
        });
        break;
    }
  }
}

// 創建WebSocket mock工廠
export function createMockWebSocket(): MockWebSocket & {
  constructor: typeof MockWebSocket;
} {
  const mockInstance = new MockWebSocket("ws://localhost:8787/websocket");

  // 創建構造函數mock
  const MockWebSocketConstructor = vi
    .fn()
    .mockImplementation((url: string, protocol?: string) => {
      return new MockWebSocket(url, protocol);
    }) as unknown as typeof MockWebSocket;

  // 添加WebSocket常量
  MockWebSocketConstructor.CONNECTING = WebSocket.CONNECTING;
  MockWebSocketConstructor.OPEN = WebSocket.OPEN;
  MockWebSocketConstructor.CLOSING = WebSocket.CLOSING;
  MockWebSocketConstructor.CLOSED = WebSocket.CLOSED;

  return Object.assign(mockInstance, { constructor: MockWebSocketConstructor });
}

// 模擬SSE EventSource
export class MockEventSource {
  public readyState: number = 0;
  public url: string;

  private listeners: { [key: string]: Function[] } = {};

  // EventSource 常量
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(url: string) {
    this.url = url;

    // 模擬連接
    setTimeout(() => {
      this.readyState = 1;
      this.dispatchEvent(new Event("open"));
    }, 10);
  }

  close(): void {
    this.readyState = 2;
    this.dispatchEvent(new Event("close"));
  }

  addEventListener(type: string, listener: Function): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: Function): void {
    if (this.listeners[type]) {
      const index = this.listeners[type].indexOf(listener);
      if (index !== -1) {
        this.listeners[type].splice(index, 1);
      }
    }
  }

  private dispatchEvent(event: Event): void {
    const type = event.type;
    if (this.listeners[type]) {
      this.listeners[type].forEach((listener) => listener(event));
    }

    // 調用 on* 處理器
    const handlerName = `on${type}`;
    const handler = (this as unknown as DynamicEventHandlers)[handlerName];
    if (typeof handler === "function") {
      handler(event);
    }
  }

  // 事件處理器
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  // 測試工具方法
  mockMessage(data: any, eventType?: string): void {
    const messageEvent = new MessageEvent(eventType || "message", {
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
    this.dispatchEvent(messageEvent);
  }
}

// 全局WebSocket mock設置
export function setupGlobalWebSocketMock(): () => void {
  const originalWebSocket = global.WebSocket;
  const originalEventSource = global.EventSource;

  const mockWS = createMockWebSocket();
  global.WebSocket = mockWS.constructor as unknown as typeof WebSocket;
  global.EventSource = MockEventSource as unknown as typeof EventSource;

  // 返回清理函數
  return () => {
    global.WebSocket = originalWebSocket;
    global.EventSource = originalEventSource;
  };
}
