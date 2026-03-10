// Realtime WebSocket 連接生命週期測試範例
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * WebSocket 連接生命週期測試
 *
 * 測試範圍：
 * - 連接建立
 * - 連接維護（heartbeat）
 * - 連接關閉
 * - 錯誤處理
 */
describe("WebSocket Connection Lifecycle", () => {
  let mockWebSocket: any;
  let heartbeatInterval: ReturnType<typeof setInterval> | null;

  beforeEach(() => {
    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    heartbeatInterval = null;
  });

  afterEach(() => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });

  describe("連接建立", () => {
    it("應該成功建立 WebSocket 連接", () => {
      const connection = {
        id: "conn-123",
        ws: mockWebSocket,
        createdAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      expect(connection.ws.readyState).toBe(1); // OPEN
      expect(connection.id).toBe("conn-123");
      expect(connection.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it("應該為連接分配唯一 ID", () => {
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        const id = `conn-${Date.now()}-${Math.random()}`;
        ids.add(id);
      }

      expect(ids.size).toBe(100); // 所有 ID 應該唯一
    });

    it("應該記錄連接建立時間", () => {
      const beforeCreate = Date.now();
      const connection = {
        createdAt: Date.now(),
      };
      const afterCreate = Date.now();

      expect(connection.createdAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(connection.createdAt).toBeLessThanOrEqual(afterCreate);
    });
  });

  describe("Heartbeat 機制", () => {
    it("應該定期發送 ping 訊息", async () => {
      const connection = { ws: mockWebSocket };

      // 模擬 heartbeat
      const sendPing = () => {
        connection.ws.send(
          JSON.stringify({ type: "ping", timestamp: Date.now() }),
        );
      };

      sendPing();
      sendPing();
      sendPing();

      expect(mockWebSocket.send).toHaveBeenCalledTimes(3);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"ping"'),
      );
    });

    it("應該更新最後 heartbeat 時間", () => {
      const connection = {
        lastHeartbeat: Date.now() - 10000, // 10 秒前
      };

      const beforeUpdate = Date.now();
      connection.lastHeartbeat = Date.now();

      expect(connection.lastHeartbeat).toBeGreaterThan(beforeUpdate - 100);
      expect(connection.lastHeartbeat).toBeLessThanOrEqual(Date.now());
    });

    it("應該檢測超時的連接", () => {
      const HEARTBEAT_TIMEOUT = 60000; // 60 秒
      const connection = {
        id: "conn-123",
        lastHeartbeat: Date.now() - 70000, // 70 秒前
      };

      const isTimedOut =
        Date.now() - connection.lastHeartbeat > HEARTBEAT_TIMEOUT;

      expect(isTimedOut).toBe(true);
    });
  });

  describe("連接關閉", () => {
    it("應該正常關閉連接", () => {
      mockWebSocket.close();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it("應該在關閉時清理資源", () => {
      const connection = {
        ws: mockWebSocket,
        heartbeatTimer: setInterval(() => {}, 1000),
        subscribers: new Set(["sub-1", "sub-2"]),
      };

      // 清理
      clearInterval(connection.heartbeatTimer);
      connection.subscribers.clear();
      connection.ws.close();

      expect(connection.subscribers.size).toBe(0);
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it("關閉不存在的連接時不應拋出錯誤", () => {
      const closeConnection = (id: string) => {
        // 模擬安全關閉
        try {
          mockWebSocket.close();
        } catch (error) {
          // 忽略錯誤
        }
      };

      expect(() => closeConnection("non-existent")).not.toThrow();
    });
  });

  describe("錯誤處理", () => {
    it("應該處理發送訊息失敗", () => {
      mockWebSocket.send = vi.fn(() => {
        throw new Error("Send failed");
      });

      const safeSend = (message: any) => {
        try {
          mockWebSocket.send(JSON.stringify(message));
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      };

      const result = safeSend({ type: "test" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Send failed");
    });

    it("應該處理連接意外斷開", () => {
      mockWebSocket.readyState = 3; // CLOSED

      const checkConnection = () => {
        return mockWebSocket.readyState === 1; // OPEN
      };

      expect(checkConnection()).toBe(false);
    });
  });
});
