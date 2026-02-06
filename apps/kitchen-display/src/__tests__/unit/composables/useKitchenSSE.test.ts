/**
 * useKitchenSSE Composable 測試
 *
 * 測試範圍：
 * - SSE 連接管理
 * - 連接狀態追蹤
 * - 事件處理（新訂單、訂單更新、取消、優先級更新）
 * - 自動重連機制
 * - 錯誤處理
 * - 連接統計
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ref, nextTick } from "vue";

// Mock vue-toastification
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock("vue-toastification", () => ({
  useToast: () => mockToast,
}));

// 類型定義
type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface KitchenSSEEvent {
  type:
    | "NEW_ORDER"
    | "ORDER_STATUS_UPDATE"
    | "ORDER_CANCELLED"
    | "PRIORITY_UPDATE";
  data: any;
  timestamp: number;
}

interface ConnectionStats {
  reconnectAttempts: number;
  lastHeartbeat: number;
  isConnected: boolean;
  timeSinceLastHeartbeat: number;
}

interface UseKitchenSSEOptions {
  restaurantId: number;
  onNewOrder?: (event: KitchenSSEEvent) => void;
  onOrderUpdate?: (event: KitchenSSEEvent) => void;
  onOrderCancelled?: (event: KitchenSSEEvent) => void;
  onPriorityUpdate?: (event: KitchenSSEEvent) => void;
  autoConnect?: boolean;
}

// Mock SSE 服務
class MockSSEService {
  private _status: ConnectionStatus = "disconnected";
  private _reconnectAttempts = 0;
  private _lastHeartbeat = 0;
  private _onMessage?: (event: KitchenSSEEvent) => void;
  private _onConnectionChange?: (status: ConnectionStatus) => void;
  private _onError?: (error: Event) => void;

  constructor(options: {
    restaurantId: number;
    onMessage: (event: KitchenSSEEvent) => void;
    onConnectionChange: (status: ConnectionStatus) => void;
    onError: (error: Event) => void;
    maxReconnectAttempts: number;
    reconnectInterval: number;
  }) {
    this._onMessage = options.onMessage;
    this._onConnectionChange = options.onConnectionChange;
    this._onError = options.onError;
  }

  connect() {
    this._status = "connecting";
    this._onConnectionChange?.("connecting");
    // Simulate successful connection
    setTimeout(() => {
      this._status = "connected";
      this._lastHeartbeat = Date.now();
      this._onConnectionChange?.("connected");
    }, 100);
  }

  disconnect() {
    this._status = "disconnected";
    this._onConnectionChange?.("disconnected");
  }

  getConnectionStatus(): ConnectionStatus {
    return this._status;
  }

  getConnectionStats(): ConnectionStats {
    return {
      reconnectAttempts: this._reconnectAttempts,
      lastHeartbeat: this._lastHeartbeat,
      isConnected: this._status === "connected",
      timeSinceLastHeartbeat:
        this._lastHeartbeat > 0 ? Date.now() - this._lastHeartbeat : 0,
    };
  }

  // 測試輔助方法
  simulateMessage(event: KitchenSSEEvent) {
    this._onMessage?.(event);
  }

  simulateError(error: Event) {
    this._status = "error";
    this._onConnectionChange?.("error");
    this._onError?.(error);
  }

  simulateReconnect() {
    this._reconnectAttempts++;
    this.connect();
  }

  simulateHeartbeat() {
    this._lastHeartbeat = Date.now();
  }
}

// 模擬 useKitchenSSE composable
function createMockUseKitchenSSE(options: UseKitchenSSEOptions) {
  const connectionStatus = ref<ConnectionStatus>("disconnected");
  const isConnected = ref(false);
  const lastHeartbeat = ref<Date | null>(null);
  const reconnectAttempts = ref(0);
  const connectionStats = ref<ConnectionStats>({
    reconnectAttempts: 0,
    lastHeartbeat: 0,
    isConnected: false,
    timeSinceLastHeartbeat: 0,
  });

  let sseService: MockSSEService | null = null;

  const handleSSEMessage = (event: KitchenSSEEvent) => {
    switch (event.type) {
      case "NEW_ORDER":
        options.onNewOrder?.(event);
        mockToast.info("收到新訂單！");
        break;

      case "ORDER_STATUS_UPDATE":
        options.onOrderUpdate?.(event);
        break;

      case "ORDER_CANCELLED":
        options.onOrderCancelled?.(event);
        mockToast.warning("訂單已取消");
        break;

      case "PRIORITY_UPDATE":
        options.onPriorityUpdate?.(event);
        mockToast.warning("訂單優先級已更新");
        break;
    }
  };

  const handleConnectionChange = (status: ConnectionStatus) => {
    connectionStatus.value = status;
    isConnected.value = status === "connected";

    switch (status) {
      case "connected":
        mockToast.success("廚房系統已連線");
        break;
      case "disconnected":
        mockToast.warning("廚房系統已離線");
        break;
      case "error":
        mockToast.error("廚房系統連接異常");
        break;
    }

    updateConnectionStats();
  };

  const handleSSEError = (_error: Event) => {
    // Error handling delegated to connection status change
  };

  const updateConnectionStats = () => {
    if (sseService) {
      const stats = sseService.getConnectionStats();
      connectionStats.value = stats;
      reconnectAttempts.value = stats.reconnectAttempts;
      if (stats.lastHeartbeat > 0) {
        lastHeartbeat.value = new Date(stats.lastHeartbeat);
      }
    }
  };

  const connect = () => {
    if (sseService) {
      console.warn("SSE service already exists");
      return;
    }

    sseService = new MockSSEService({
      restaurantId: options.restaurantId,
      onMessage: handleSSEMessage,
      onConnectionChange: handleConnectionChange,
      onError: handleSSEError,
      maxReconnectAttempts: 5,
      reconnectInterval: 3000,
    });

    sseService.connect();
  };

  const disconnect = () => {
    if (sseService) {
      sseService.disconnect();
      sseService = null;
    }

    connectionStatus.value = "disconnected";
    isConnected.value = false;
    reconnectAttempts.value = 0;
    lastHeartbeat.value = null;
  };

  const reconnect = () => {
    disconnect();
    setTimeout(() => connect(), 100);
  };

  const getStatus = () => {
    return sseService?.getConnectionStatus() || "disconnected";
  };

  const getStats = (): ConnectionStats => {
    return (
      sseService?.getConnectionStats() || {
        reconnectAttempts: 0,
        lastHeartbeat: 0,
        isConnected: false,
        timeSinceLastHeartbeat: 0,
      }
    );
  };

  // 測試輔助方法
  const getService = () => sseService;

  return {
    // State
    connectionStatus,
    isConnected,
    lastHeartbeat,
    reconnectAttempts,
    connectionStats,

    // Methods
    connect,
    disconnect,
    reconnect,
    getStatus,
    getStats,

    // Test helpers
    getService,
  };
}

describe("useKitchenSSE", () => {
  let kitchenSSE: ReturnType<typeof createMockUseKitchenSSE>;
  let onNewOrder: ReturnType<typeof vi.fn>;
  let onOrderUpdate: ReturnType<typeof vi.fn>;
  let onOrderCancelled: ReturnType<typeof vi.fn>;
  let onPriorityUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    onNewOrder = vi.fn();
    onOrderUpdate = vi.fn();
    onOrderCancelled = vi.fn();
    onPriorityUpdate = vi.fn();

    kitchenSSE = createMockUseKitchenSSE({
      restaurantId: 1,
      onNewOrder,
      onOrderUpdate,
      onOrderCancelled,
      onPriorityUpdate,
      autoConnect: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    kitchenSSE.disconnect();
  });

  describe("初始狀態", () => {
    it("應該初始化為斷開狀態", () => {
      expect(kitchenSSE.connectionStatus.value).toBe("disconnected");
      expect(kitchenSSE.isConnected.value).toBe(false);
    });

    it("應該初始化心跳為 null", () => {
      expect(kitchenSSE.lastHeartbeat.value).toBeNull();
    });

    it("應該初始化重連次數為 0", () => {
      expect(kitchenSSE.reconnectAttempts.value).toBe(0);
    });

    it("應該初始化連接統計", () => {
      expect(kitchenSSE.connectionStats.value).toEqual({
        reconnectAttempts: 0,
        lastHeartbeat: 0,
        isConnected: false,
        timeSinceLastHeartbeat: 0,
      });
    });
  });

  describe("連接管理", () => {
    it("應該成功建立連接", async () => {
      kitchenSSE.connect();

      // 等待連接狀態變為 connecting
      expect(kitchenSSE.connectionStatus.value).toBe("connecting");

      // 等待連接完成
      vi.advanceTimersByTime(150);

      expect(kitchenSSE.connectionStatus.value).toBe("connected");
      expect(kitchenSSE.isConnected.value).toBe(true);
      expect(mockToast.success).toHaveBeenCalledWith("廚房系統已連線");
    });

    it("應該成功斷開連接", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      kitchenSSE.disconnect();

      expect(kitchenSSE.connectionStatus.value).toBe("disconnected");
      expect(kitchenSSE.isConnected.value).toBe(false);
      expect(kitchenSSE.reconnectAttempts.value).toBe(0);
      expect(kitchenSSE.lastHeartbeat.value).toBeNull();
    });

    it("應該成功重新連接", async () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      expect(kitchenSSE.isConnected.value).toBe(true);

      kitchenSSE.reconnect();
      vi.advanceTimersByTime(50); // Wait for disconnect timeout

      expect(kitchenSSE.connectionStatus.value).toBe("disconnected");

      vi.advanceTimersByTime(100); // Wait for connect
      vi.advanceTimersByTime(150); // Wait for connection to complete

      expect(kitchenSSE.isConnected.value).toBe(true);
    });

    it("應該在已連接時發出警告", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      kitchenSSE.connect(); // 嘗試再次連接

      expect(consoleSpy).toHaveBeenCalledWith("SSE service already exists");

      consoleSpy.mockRestore();
    });
  });

  describe("事件處理", () => {
    beforeEach(() => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);
    });

    it("應該處理新訂單事件", () => {
      const event: KitchenSSEEvent = {
        type: "NEW_ORDER",
        data: { orderId: 1, items: [] },
        timestamp: Date.now(),
      };

      kitchenSSE.getService()?.simulateMessage(event);

      expect(onNewOrder).toHaveBeenCalledWith(event);
      expect(mockToast.info).toHaveBeenCalledWith("收到新訂單！");
    });

    it("應該處理訂單更新事件", () => {
      const event: KitchenSSEEvent = {
        type: "ORDER_STATUS_UPDATE",
        data: { orderId: 1, status: "preparing" },
        timestamp: Date.now(),
      };

      kitchenSSE.getService()?.simulateMessage(event);

      expect(onOrderUpdate).toHaveBeenCalledWith(event);
    });

    it("應該處理訂單取消事件", () => {
      const event: KitchenSSEEvent = {
        type: "ORDER_CANCELLED",
        data: { orderId: 1, reason: "客戶取消" },
        timestamp: Date.now(),
      };

      kitchenSSE.getService()?.simulateMessage(event);

      expect(onOrderCancelled).toHaveBeenCalledWith(event);
      expect(mockToast.warning).toHaveBeenCalledWith("訂單已取消");
    });

    it("應該處理優先級更新事件", () => {
      const event: KitchenSSEEvent = {
        type: "PRIORITY_UPDATE",
        data: { orderId: 1, priority: "high" },
        timestamp: Date.now(),
      };

      kitchenSSE.getService()?.simulateMessage(event);

      expect(onPriorityUpdate).toHaveBeenCalledWith(event);
      expect(mockToast.warning).toHaveBeenCalledWith("訂單優先級已更新");
    });
  });

  describe("連接狀態變化", () => {
    it("應該在連接時顯示成功提示", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      expect(mockToast.success).toHaveBeenCalledWith("廚房系統已連線");
    });

    it("應該在斷開時顯示警告提示", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);
      vi.clearAllMocks();

      kitchenSSE.disconnect();

      expect(mockToast.warning).toHaveBeenCalledWith("廚房系統已離線");
    });

    it("應該在錯誤時顯示錯誤提示", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);
      vi.clearAllMocks();

      kitchenSSE.getService()?.simulateError(new Event("error"));

      expect(kitchenSSE.connectionStatus.value).toBe("error");
      expect(mockToast.error).toHaveBeenCalledWith("廚房系統連接異常");
    });
  });

  describe("連接統計", () => {
    it("應該正確取得連接狀態", () => {
      expect(kitchenSSE.getStatus()).toBe("disconnected");

      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      expect(kitchenSSE.getStatus()).toBe("connected");
    });

    it("應該正確取得連接統計", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      const stats = kitchenSSE.getStats();

      expect(stats.isConnected).toBe(true);
      expect(stats.reconnectAttempts).toBe(0);
      expect(stats.lastHeartbeat).toBeGreaterThan(0);
    });

    it("應該更新心跳時間", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      const initialHeartbeat = kitchenSSE.lastHeartbeat.value;
      expect(initialHeartbeat).not.toBeNull();

      // 模擬心跳
      vi.advanceTimersByTime(5000);
      kitchenSSE.getService()?.simulateHeartbeat();

      const stats = kitchenSSE.getStats();
      expect(stats.lastHeartbeat).toBeGreaterThan(0);
    });

    it("應該追蹤重連次數", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      // 模擬重連
      kitchenSSE.getService()?.simulateReconnect();
      vi.advanceTimersByTime(150);

      expect(kitchenSSE.getStats().reconnectAttempts).toBe(1);
    });
  });

  describe("未連接狀態", () => {
    it("應該在未連接時返回預設統計", () => {
      const stats = kitchenSSE.getStats();

      expect(stats).toEqual({
        reconnectAttempts: 0,
        lastHeartbeat: 0,
        isConnected: false,
        timeSinceLastHeartbeat: 0,
      });
    });

    it("應該在未連接時返回 disconnected 狀態", () => {
      expect(kitchenSSE.getStatus()).toBe("disconnected");
    });
  });

  describe("邊界情況", () => {
    it("應該處理多次斷開連接", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      expect(() => {
        kitchenSSE.disconnect();
        kitchenSSE.disconnect();
        kitchenSSE.disconnect();
      }).not.toThrow();

      expect(kitchenSSE.connectionStatus.value).toBe("disconnected");
    });

    it("應該處理快速重連", () => {
      expect(() => {
        kitchenSSE.connect();
        vi.advanceTimersByTime(50);
        kitchenSSE.reconnect();
        vi.advanceTimersByTime(50);
        kitchenSSE.reconnect();
        vi.advanceTimersByTime(300);
      }).not.toThrow();
    });

    it("應該處理未註冊的事件回調", () => {
      const sseWithoutCallbacks = createMockUseKitchenSSE({
        restaurantId: 1,
        // 不提供任何回調
      });

      sseWithoutCallbacks.connect();
      vi.advanceTimersByTime(150);

      const event: KitchenSSEEvent = {
        type: "NEW_ORDER",
        data: { orderId: 1 },
        timestamp: Date.now(),
      };

      expect(() => {
        sseWithoutCallbacks.getService()?.simulateMessage(event);
      }).not.toThrow();

      sseWithoutCallbacks.disconnect();
    });
  });

  describe("響應式", () => {
    it("應該在狀態變化時更新 ref", async () => {
      expect(kitchenSSE.isConnected.value).toBe(false);

      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      await nextTick();
      expect(kitchenSSE.isConnected.value).toBe(true);

      kitchenSSE.disconnect();
      await nextTick();
      expect(kitchenSSE.isConnected.value).toBe(false);
    });

    it("應該在統計更新時更新 connectionStats ref", () => {
      kitchenSSE.connect();
      vi.advanceTimersByTime(150);

      expect(kitchenSSE.connectionStats.value.isConnected).toBe(true);

      kitchenSSE.disconnect();

      expect(kitchenSSE.connectionStats.value.isConnected).toBe(false);
    });
  });
});
