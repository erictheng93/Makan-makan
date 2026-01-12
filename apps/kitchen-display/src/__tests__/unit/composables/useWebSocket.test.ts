// Kitchen Display - useWebSocket Composable 測試
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref } from "vue";

/**
 * useWebSocket Composable 測試
 *
 * 測試範圍：
 * - WebSocket 連接管理
 * - 自動重連機制
 * - 消息接收和發送
 * - 連接狀態追蹤
 * - 錯誤處理
 */

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnecting"
  | "disconnected"
  | "error";

// 模擬 useWebSocket composable
function useWebSocket(url: string) {
  const status = ref<ConnectionStatus>("disconnected");
  const error = ref<Error | null>(null);
  const messages = ref<WebSocketMessage[]>([]);
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = 5;

  let ws: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;

  const connect = () => {
    if (status.value === "connected" || status.value === "connecting") {
      return;
    }

    status.value = "connecting";
    error.value = null;

    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        status.value = "connected";
        reconnectAttempts.value = 0;
        error.value = null;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          messages.value.push(message);
        } catch (e) {
          console.error("Failed to parse message:", e);
        }
      };

      ws.onerror = (event) => {
        status.value = "error";
        error.value = new Error("WebSocket error occurred");
      };

      ws.onclose = () => {
        status.value = "disconnected";
        ws = null;

        // Auto-reconnect
        if (reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++;
          reconnectTimer = setTimeout(
            () => {
              connect();
            },
            Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30000),
          );
        }
      };
    } catch (e: any) {
      status.value = "error";
      error.value = e;
    }
  };

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      status.value = "disconnecting";
      ws.close();
    }

    status.value = "disconnected";
    ws = null;
  };

  const send = (message: WebSocketMessage) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    ws.send(JSON.stringify(message));
  };

  const clearMessages = () => {
    messages.value = [];
  };

  return {
    status,
    error,
    messages,
    reconnectAttempts,
    connect,
    disconnect,
    send,
    clearMessages,
  };
}

// WebSocket state constants (use numeric values for reliable testing)
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const WS_CLOSED = 3;

describe("useWebSocket Composable", () => {
  let composable: ReturnType<typeof useWebSocket>;
  const mockUrl = "ws://localhost:8080";

  // Mock WebSocket instance reference (shared across tests)
  let mockWsInstance: any;
  let wsConstructorCalls: string[] = []; // Track constructor calls
  let onOpenCallback: (() => void) | null = null;
  let onMessageCallback: ((event: any) => void) | null = null;
  let onErrorCallback: ((event: any) => void) | null = null;
  let onCloseCallback: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset state
    wsConstructorCalls = [];
    onOpenCallback = null;
    onMessageCallback = null;
    onErrorCallback = null;
    onCloseCallback = null;

    // Create a mock WebSocket class (vitest 4 compatible)
    class MockWebSocket {
      static CONNECTING = WS_CONNECTING;
      static OPEN = WS_OPEN;
      static CLOSING = WS_CLOSING;
      static CLOSED = WS_CLOSED;

      readyState = WS_CONNECTING;
      send = vi.fn();
      close = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();

      private _onopen: (() => void) | null = null;
      private _onmessage: ((event: any) => void) | null = null;
      private _onerror: ((event: any) => void) | null = null;
      private _onclose: (() => void) | null = null;

      constructor(url: string) {
        // Track constructor calls for testing
        wsConstructorCalls.push(url);
        // Store instance for test access
        mockWsInstance = this;
      }

      set onopen(callback: () => void) {
        this._onopen = callback;
        onOpenCallback = callback;
      }
      get onopen() {
        return this._onopen;
      }

      set onmessage(callback: (event: any) => void) {
        this._onmessage = callback;
        onMessageCallback = callback;
      }
      get onmessage() {
        return this._onmessage;
      }

      set onerror(callback: (event: any) => void) {
        this._onerror = callback;
        onErrorCallback = callback;
      }
      get onerror() {
        return this._onerror;
      }

      set onclose(callback: () => void) {
        this._onclose = callback;
        onCloseCallback = callback;
      }
      get onclose() {
        return this._onclose;
      }
    }

    // Replace global WebSocket with our mock class
    global.WebSocket = MockWebSocket as any;

    composable = useWebSocket(mockUrl);
  });

  afterEach(() => {
    vi.useRealTimers();
    onOpenCallback = null;
    onMessageCallback = null;
    onErrorCallback = null;
    onCloseCallback = null;
  });

  describe("初始狀態", () => {
    it("應該初始化為 disconnected 狀態", () => {
      expect(composable.status.value).toBe("disconnected");
    });

    it("應該初始化空的消息列表", () => {
      expect(composable.messages.value).toEqual([]);
    });

    it("應該初始化 error 為 null", () => {
      expect(composable.error.value).toBeNull();
    });

    it("應該初始化 reconnectAttempts 為 0", () => {
      expect(composable.reconnectAttempts.value).toBe(0);
    });
  });

  describe("連接管理", () => {
    it("應該成功連接到 WebSocket", () => {
      composable.connect();

      expect(composable.status.value).toBe("connecting");
      expect(wsConstructorCalls).toContain(mockUrl);

      // Simulate successful connection
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      expect(composable.status.value).toBe("connected");
      expect(composable.error.value).toBeNull();
    });

    it("應該防止重複連接", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      const callCount = wsConstructorCalls.length;

      composable.connect();

      expect(wsConstructorCalls.length).toBe(callCount);
    });

    it("應該成功斷開連接", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      composable.disconnect();

      expect(composable.status.value).toBe("disconnected");
      expect(mockWsInstance.close).toHaveBeenCalled();
    });

    it("應該在斷開時清理重連計時器", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      // Simulate close and auto-reconnect
      onCloseCallback?.();

      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      composable.disconnect();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("消息處理", () => {
    beforeEach(() => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();
    });

    it("應該接收並解析 WebSocket 消息", () => {
      const message: WebSocketMessage = {
        type: "order.created",
        payload: { orderId: "order-123" },
        timestamp: Date.now(),
      };

      onMessageCallback?.({
        data: JSON.stringify(message),
      });

      expect(composable.messages.value).toHaveLength(1);
      expect(composable.messages.value[0]).toEqual(message);
    });

    it("應該處理多個消息", () => {
      const messages: WebSocketMessage[] = [
        {
          type: "order.created",
          payload: { orderId: "1" },
          timestamp: Date.now(),
        },
        {
          type: "order.updated",
          payload: { orderId: "2" },
          timestamp: Date.now(),
        },
        {
          type: "order.completed",
          payload: { orderId: "3" },
          timestamp: Date.now(),
        },
      ];

      messages.forEach((msg) => {
        onMessageCallback?.({
          data: JSON.stringify(msg),
        });
      });

      expect(composable.messages.value).toHaveLength(3);
    });

    it("應該忽略無效的 JSON 消息", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      onMessageCallback?.({
        data: "invalid json {",
      });

      expect(composable.messages.value).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("應該成功發送消息", () => {
      const message: WebSocketMessage = {
        type: "order.confirm",
        payload: { orderId: "order-123" },
        timestamp: Date.now(),
      };

      composable.send(message);

      expect(mockWsInstance.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it("未連接時發送消息應該拋出錯誤", () => {
      composable.disconnect();

      const message: WebSocketMessage = {
        type: "test",
        payload: {},
        timestamp: Date.now(),
      };

      expect(() => composable.send(message)).toThrow(
        "WebSocket is not connected",
      );
    });

    it("應該清空消息列表", () => {
      const message: WebSocketMessage = {
        type: "test",
        payload: {},
        timestamp: Date.now(),
      };

      onMessageCallback?.({
        data: JSON.stringify(message),
      });

      expect(composable.messages.value).toHaveLength(1);

      composable.clearMessages();

      expect(composable.messages.value).toHaveLength(0);
    });
  });

  describe("錯誤處理", () => {
    it("應該處理連接錯誤", () => {
      composable.connect();

      onErrorCallback?.({});

      expect(composable.status.value).toBe("error");
      expect(composable.error.value).toBeInstanceOf(Error);
    });

    it("應該處理連接異常", () => {
      global.WebSocket = vi.fn(() => {
        throw new Error("Connection failed");
      }) as any;

      const newComposable = useWebSocket(mockUrl);
      newComposable.connect();

      expect(newComposable.status.value).toBe("error");
      expect(newComposable.error.value).toBeInstanceOf(Error);
    });
  });

  describe("自動重連", () => {
    it("應該在連接關閉後自動重連", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      const initialCallCount = wsConstructorCalls.length;

      // Simulate connection close
      onCloseCallback?.();

      expect(composable.reconnectAttempts.value).toBe(1);

      // Advance timers to trigger reconnect
      vi.advanceTimersByTime(2000);

      expect(wsConstructorCalls.length).toBeGreaterThan(initialCallCount);
    });

    it("應該使用指數退避策略", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      // First reconnect: 2^1 * 1000 = 2000ms
      onCloseCallback?.();
      expect(composable.reconnectAttempts.value).toBe(1);

      vi.advanceTimersByTime(2000);

      // Second reconnect: 2^2 * 1000 = 4000ms
      onCloseCallback?.();
      expect(composable.reconnectAttempts.value).toBe(2);

      vi.advanceTimersByTime(4000);

      // Third reconnect: 2^3 * 1000 = 8000ms
      onCloseCallback?.();
      expect(composable.reconnectAttempts.value).toBe(3);
    });

    it("應該在達到最大重連次數後停止", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      const initialCallCount = wsConstructorCalls.length;

      // Simulate 5 failed reconnect attempts
      for (let i = 0; i < 5; i++) {
        onCloseCallback?.();
        vi.advanceTimersByTime(30000);
      }

      expect(composable.reconnectAttempts.value).toBe(5);

      // 6th close should not trigger reconnect
      onCloseCallback?.();
      vi.advanceTimersByTime(30000);

      const finalCallCount = wsConstructorCalls.length;
      expect(finalCallCount - initialCallCount).toBe(5);
    });

    it("成功連接後應該重置重連計數", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      // Simulate failed connection
      onCloseCallback?.();
      expect(composable.reconnectAttempts.value).toBe(1);

      // Advance timers and simulate successful reconnect
      vi.advanceTimersByTime(2000);
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      expect(composable.reconnectAttempts.value).toBe(0);
    });
  });

  describe("響應式", () => {
    it("status 應該是響應式的", () => {
      expect(composable.status.value).toBe("disconnected");

      composable.connect();
      expect(composable.status.value).toBe("connecting");

      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();
      expect(composable.status.value).toBe("connected");
    });

    it("messages 應該是響應式的", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      expect(composable.messages.value).toHaveLength(0);

      const message: WebSocketMessage = {
        type: "test",
        payload: {},
        timestamp: Date.now(),
      };

      onMessageCallback?.({
        data: JSON.stringify(message),
      });

      expect(composable.messages.value).toHaveLength(1);
    });

    it("error 應該是響應式的", () => {
      expect(composable.error.value).toBeNull();

      composable.connect();
      onErrorCallback?.({});

      expect(composable.error.value).toBeInstanceOf(Error);
    });
  });

  describe("邊界情況", () => {
    it("應該處理空消息", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      onMessageCallback?.({
        data: "",
      });

      expect(composable.messages.value).toHaveLength(0);
    });

    it("應該處理特殊字符的消息", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      const message: WebSocketMessage = {
        type: "test",
        payload: { text: "特殊字符 🍕 emoji" },
        timestamp: Date.now(),
      };

      onMessageCallback?.({
        data: JSON.stringify(message),
      });

      expect(composable.messages.value).toHaveLength(1);
      expect(composable.messages.value[0].payload.text).toBe(
        "特殊字符 🍕 emoji",
      );
    });

    it("應該處理大消息", () => {
      composable.connect();
      mockWsInstance.readyState = WS_OPEN;
      onOpenCallback?.();

      const largePayload = {
        items: Array(1000).fill({ id: "item", name: "Test Item" }),
      };

      const message: WebSocketMessage = {
        type: "large.message",
        payload: largePayload,
        timestamp: Date.now(),
      };

      onMessageCallback?.({
        data: JSON.stringify(message),
      });

      expect(composable.messages.value).toHaveLength(1);
      expect(composable.messages.value[0].payload.items).toHaveLength(1000);
    });
  });
});
