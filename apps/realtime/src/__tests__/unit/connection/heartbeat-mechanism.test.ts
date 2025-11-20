// Realtime - Heartbeat Mechanism 測試
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Heartbeat Mechanism 測試
 *
 * 測試範圍：
 * - Ping/Pong 訊息發送
 * - 心跳間隔控制
 * - 超時檢測
 * - 連接保活機制
 */

describe('Heartbeat Mechanism', () => {
  let mockWebSocket: any;
  let heartbeatInterval: ReturnType<typeof setInterval> | null;
  let timeouts: ReturnType<typeof setTimeout>[];

  beforeEach(() => {
    vi.useFakeTimers();
    heartbeatInterval = null;
    timeouts = [];

    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    timeouts.forEach(timeout => clearTimeout(timeout));
    vi.useRealTimers();
  });

  describe('Ping 訊息發送', () => {
    it('應該定期發送 ping 訊息', () => {
      const HEARTBEAT_INTERVAL = 30000; // 30 seconds
      const connection = { ws: mockWebSocket, lastHeartbeat: Date.now() };

      // 模擬心跳機制
      const sendPing = () => {
        connection.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
        connection.lastHeartbeat = Date.now();
      };

      heartbeatInterval = setInterval(sendPing, HEARTBEAT_INTERVAL);

      // 初始狀態：沒有發送
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1);
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"ping"')
      );

      // Fast-forward another 30 seconds
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);

      // Fast-forward another 30 seconds
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
      expect(mockWebSocket.send).toHaveBeenCalledTimes(3);
    });

    it('ping 訊息應該包含時間戳', () => {
      const now = 1700000000000; // Fixed timestamp
      vi.setSystemTime(now);

      const sendPing = () => {
        mockWebSocket.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
      };

      sendPing();

      const sentMessage = mockWebSocket.send.mock.calls[0][0];
      const parsedMessage = JSON.parse(sentMessage);

      expect(parsedMessage.type).toBe('ping');
      expect(parsedMessage.timestamp).toBe(now);
    });

    it('應該在連接打開時才發送 ping', () => {
      const sendPing = () => {
        if (mockWebSocket.readyState === 1) { // OPEN
          mockWebSocket.send(JSON.stringify({ type: 'ping' }));
          return true;
        }
        return false;
      };

      // WebSocket 打開
      mockWebSocket.readyState = 1;
      expect(sendPing()).toBe(true);
      expect(mockWebSocket.send).toHaveBeenCalled();

      mockWebSocket.send.mockClear();

      // WebSocket 關閉
      mockWebSocket.readyState = 3; // CLOSED
      expect(sendPing()).toBe(false);
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('應該處理 ping 發送失敗', () => {
      mockWebSocket.send = vi.fn(() => {
        throw new Error('Send failed');
      });

      const safeSendPing = () => {
        try {
          mockWebSocket.send(JSON.stringify({ type: 'ping' }));
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      };

      const result = safeSendPing();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Send failed');
    });
  });

  describe('Pong 訊息處理', () => {
    it('應該正確處理收到的 pong 訊息', () => {
      const connection = {
        lastHeartbeat: Date.now() - 10000, // 10 seconds ago
      };

      const handlePong = () => {
        connection.lastHeartbeat = Date.now();
      };

      const beforeUpdate = connection.lastHeartbeat;
      handlePong();

      expect(connection.lastHeartbeat).toBeGreaterThan(beforeUpdate);
    });

    it('應該記錄 pong 的時間戳', () => {
      const connection = {
        lastHeartbeat: 0,
        pongHistory: [] as number[],
      };

      const handlePong = (timestamp: number) => {
        connection.lastHeartbeat = timestamp;
        connection.pongHistory.push(timestamp);
      };

      const timestamps = [1000, 2000, 3000];
      timestamps.forEach(ts => handlePong(ts));

      expect(connection.pongHistory).toEqual([1000, 2000, 3000]);
      expect(connection.lastHeartbeat).toBe(3000);
    });

    it('應該驗證 pong 訊息格式', () => {
      const validatePongMessage = (message: any): boolean => {
        return (
          message &&
          message.type === 'pong' &&
          typeof message.timestamp === 'number'
        );
      };

      expect(validatePongMessage({ type: 'pong', timestamp: 1000 })).toBe(true);
      expect(validatePongMessage({ type: 'ping', timestamp: 1000 })).toBe(false);
      expect(validatePongMessage({ type: 'pong' })).toBe(false);
      expect(validatePongMessage(null)).toBe(false);
    });
  });

  describe('心跳間隔控制', () => {
    it('應該使用正確的心跳間隔（30 秒）', () => {
      const HEARTBEAT_INTERVAL = 30000;
      let pingCount = 0;

      const sendPing = () => {
        pingCount++;
      };

      heartbeatInterval = setInterval(sendPing, HEARTBEAT_INTERVAL);

      // 0 秒：沒有 ping
      expect(pingCount).toBe(0);

      // 30 秒：第一個 ping
      vi.advanceTimersByTime(30000);
      expect(pingCount).toBe(1);

      // 60 秒：第二個 ping
      vi.advanceTimersByTime(30000);
      expect(pingCount).toBe(2);

      // 120 秒：第四個 ping
      vi.advanceTimersByTime(60000);
      expect(pingCount).toBe(4);
    });

    it('應該允許動態調整心跳間隔', () => {
      let pingCount = 0;
      let currentInterval = 30000;

      const sendPing = () => {
        pingCount++;
      };

      const updateInterval = (newInterval: number) => {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        currentInterval = newInterval;
        heartbeatInterval = setInterval(sendPing, newInterval);
      };

      // 初始間隔 30 秒
      updateInterval(30000);
      vi.advanceTimersByTime(30000);
      expect(pingCount).toBe(1);

      // 更改為 10 秒
      updateInterval(10000);
      vi.advanceTimersByTime(10000);
      expect(pingCount).toBe(2);

      vi.advanceTimersByTime(10000);
      expect(pingCount).toBe(3);
    });

    it('應該在連接關閉時停止心跳', () => {
      let pingCount = 0;

      const sendPing = () => {
        pingCount++;
      };

      heartbeatInterval = setInterval(sendPing, 30000);

      vi.advanceTimersByTime(30000);
      expect(pingCount).toBe(1);

      // 模擬連接關閉
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      vi.advanceTimersByTime(60000);
      // ping count 應該保持不變
      expect(pingCount).toBe(1);
    });
  });

  describe('超時檢測', () => {
    it('應該檢測超時的連接（60 秒無響應）', () => {
      const HEARTBEAT_TIMEOUT = 60000; // 60 seconds
      const connection = {
        id: 'conn-123',
        lastHeartbeat: Date.now() - 70000, // 70 seconds ago
      };

      const isTimedOut = (Date.now() - connection.lastHeartbeat) > HEARTBEAT_TIMEOUT;

      expect(isTimedOut).toBe(true);
    });

    it('應該識別健康的連接', () => {
      const HEARTBEAT_TIMEOUT = 60000;
      const connection = {
        id: 'conn-456',
        lastHeartbeat: Date.now() - 30000, // 30 seconds ago
      };

      const isTimedOut = (Date.now() - connection.lastHeartbeat) > HEARTBEAT_TIMEOUT;

      expect(isTimedOut).toBe(false);
    });

    it('應該正確處理邊界情況（恰好 60 秒）', () => {
      const HEARTBEAT_TIMEOUT = 60000;
      const now = 1000000;
      vi.setSystemTime(now);

      const connection = {
        lastHeartbeat: now - 60000, // Exactly 60 seconds ago
      };

      const isTimedOut = (Date.now() - connection.lastHeartbeat) > HEARTBEAT_TIMEOUT;

      expect(isTimedOut).toBe(false); // Exactly at threshold, not over
    });

    it('應該在超時後關閉連接', () => {
      const HEARTBEAT_TIMEOUT = 60000;
      const connection = {
        ws: mockWebSocket,
        lastHeartbeat: Date.now() - 70000, // Timed out
      };

      const checkAndCloseIfTimedOut = () => {
        const isTimedOut = (Date.now() - connection.lastHeartbeat) > HEARTBEAT_TIMEOUT;
        if (isTimedOut) {
          connection.ws.close(1000, 'Heartbeat timeout');
          return true;
        }
        return false;
      };

      expect(checkAndCloseIfTimedOut()).toBe(true);
      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Heartbeat timeout');
    });
  });

  describe('連接保活機制', () => {
    it('應該定期檢查所有連接的心跳狀態', () => {
      const HEARTBEAT_CHECK_INTERVAL = 30000;
      const connections = new Map([
        ['conn-1', { ws: mockWebSocket, lastHeartbeat: Date.now() - 70000 }], // Timed out
        ['conn-2', { ws: mockWebSocket, lastHeartbeat: Date.now() - 30000 }], // Healthy
        ['conn-3', { ws: mockWebSocket, lastHeartbeat: Date.now() - 10000 }], // Healthy
      ]);

      const checkAllConnections = () => {
        const TIMEOUT = 60000;
        const timedOutConnections: string[] = [];

        connections.forEach((conn, id) => {
          if (Date.now() - conn.lastHeartbeat > TIMEOUT) {
            timedOutConnections.push(id);
            conn.ws.close(1000, 'Heartbeat timeout');
          }
        });

        return timedOutConnections;
      };

      const timedOut = checkAllConnections();

      expect(timedOut).toEqual(['conn-1']);
      expect(mockWebSocket.close).toHaveBeenCalledTimes(1);
    });

    it('應該清理超時的連接', () => {
      const connections = new Map([
        ['conn-1', { ws: mockWebSocket, lastHeartbeat: Date.now() - 70000 }],
      ]);

      const cleanupTimedOutConnections = () => {
        const TIMEOUT = 60000;
        const toRemove: string[] = [];

        connections.forEach((conn, id) => {
          if (Date.now() - conn.lastHeartbeat > TIMEOUT) {
            conn.ws.close();
            toRemove.push(id);
          }
        });

        toRemove.forEach(id => connections.delete(id));

        return toRemove.length;
      };

      const removedCount = cleanupTimedOutConnections();

      expect(removedCount).toBe(1);
      expect(connections.size).toBe(0);
    });

    it('應該在收到 pong 後更新心跳時間', () => {
      const connection = {
        lastHeartbeat: Date.now() - 30000, // 30 seconds ago
        ws: mockWebSocket,
      };

      const oldHeartbeat = connection.lastHeartbeat;

      // 模擬收到 pong
      vi.advanceTimersByTime(5000); // 5 seconds later
      connection.lastHeartbeat = Date.now();

      expect(connection.lastHeartbeat).toBeGreaterThan(oldHeartbeat);
    });

    it('應該記錄心跳統計信息', () => {
      const stats = {
        totalPingsSent: 0,
        totalPongsReceived: 0,
        missedPongs: 0,
      };

      const sendPing = () => {
        stats.totalPingsSent++;
      };

      const receivePong = () => {
        stats.totalPongsReceived++;
      };

      const calculateMissedPongs = () => {
        stats.missedPongs = stats.totalPingsSent - stats.totalPongsReceived;
      };

      sendPing();
      sendPing();
      sendPing();
      receivePong();
      receivePong();
      calculateMissedPongs();

      expect(stats.totalPingsSent).toBe(3);
      expect(stats.totalPongsReceived).toBe(2);
      expect(stats.missedPongs).toBe(1);
    });
  });

  describe('錯誤恢復', () => {
    it('應該在 ping 失敗後重試', async () => {
      let failCount = 0;
      mockWebSocket.send = vi.fn(() => {
        if (failCount < 2) {
          failCount++;
          throw new Error('Network error');
        }
      });

      const sendPingWithRetry = async (maxRetries: number = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            mockWebSocket.send(JSON.stringify({ type: 'ping' }));
            return { success: true, attempts: i + 1 };
          } catch (error) {
            if (i === maxRetries - 1) {
              return { success: false, attempts: i + 1 };
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        return { success: false, attempts: maxRetries };
      };

      const result = await sendPingWithRetry();

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3); // Failed 2 times, succeeded on 3rd
    });

    it('應該在多次失敗後放棄', async () => {
      mockWebSocket.send = vi.fn(() => {
        throw new Error('Permanent failure');
      });

      const sendPingWithRetry = async (maxRetries: number = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            mockWebSocket.send(JSON.stringify({ type: 'ping' }));
            return { success: true };
          } catch (error) {
            if (i === maxRetries - 1) {
              return { success: false, error: (error as Error).message };
            }
          }
        }
        return { success: false };
      };

      const result = await sendPingWithRetry();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permanent failure');
    });
  });
});
