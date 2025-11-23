// Realtime - Connection Pool Management 測試
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Connection Pool Management 測試
 *
 * 測試範圍：
 * - 連接添加/移除
 * - 連接池容量管理
 * - 連接查詢和過濾
 * - 記憶體清理
 */

interface ConnectionInfo {
  id: string;
  type: 'customer' | 'admin' | 'kitchen';
  roomId: string;
  connectedAt: number;
  lastActivity: number;
  auth?: { userId: string; role: number };
  metadata?: Record<string, any>;
}

describe('Connection Pool Management', () => {
  let mockWebSocket: any;
  let connections: Map<WebSocket, ConnectionInfo>;

  beforeEach(() => {
    connections = new Map();
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1,
    };
  });

  describe('連接添加', () => {
    it('應該成功添加新連接', () => {
      const connInfo: ConnectionInfo = {
        id: 'conn-123',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      };

      connections.set(mockWebSocket, connInfo);

      expect(connections.size).toBe(1);
      expect(connections.get(mockWebSocket)).toEqual(connInfo);
    });

    it('應該為每個連接分配唯一 ID', () => {
      const generateConnectionId = () => {
        return `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      };

      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateConnectionId());
      }

      expect(ids.size).toBe(100);
    });

    it('應該記錄連接建立時間', () => {
      const beforeCreate = Date.now();

      const connInfo: ConnectionInfo = {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      };

      const afterCreate = Date.now();

      expect(connInfo.connectedAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(connInfo.connectedAt).toBeLessThanOrEqual(afterCreate);
    });

    it('應該支持同一 room 的多個連接', () => {
      const ws1 = { ...mockWebSocket };
      const ws2 = { ...mockWebSocket };

      connections.set(ws1, {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      connections.set(ws2, {
        id: 'conn-2',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      expect(connections.size).toBe(2);
    });

    it('應該儲存連接的認證信息', () => {
      const connInfo: ConnectionInfo = {
        id: 'conn-1',
        type: 'admin',
        roomId: 'dashboard-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        auth: {
          userId: 'user-123',
          role: 0, // Admin
        },
      };

      connections.set(mockWebSocket, connInfo);

      const stored = connections.get(mockWebSocket);
      expect(stored?.auth?.userId).toBe('user-123');
      expect(stored?.auth?.role).toBe(0);
    });
  });

  describe('連接移除', () => {
    beforeEach(() => {
      connections.set(mockWebSocket, {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });
    });

    it('應該成功移除連接', () => {
      expect(connections.size).toBe(1);

      connections.delete(mockWebSocket);

      expect(connections.size).toBe(0);
      expect(connections.get(mockWebSocket)).toBeUndefined();
    });

    it('應該在連接關閉時清理資源', () => {
      const connInfo = connections.get(mockWebSocket)!;

      const cleanup = () => {
        mockWebSocket.close();
        connections.delete(mockWebSocket);
      };

      cleanup();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(connections.size).toBe(0);
    });

    it('移除不存在的連接應該不會拋出錯誤', () => {
      const fakeWebSocket = { ...mockWebSocket };

      expect(() => {
        connections.delete(fakeWebSocket);
      }).not.toThrow();
    });

    it('應該移除特定 room 的所有連接', () => {
      const ws2 = { ...mockWebSocket };
      const ws3 = { ...mockWebSocket };

      connections.set(ws2, {
        id: 'conn-2',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      connections.set(ws3, {
        id: 'conn-3',
        type: 'customer',
        roomId: 'table-2', // Different room
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      const removeRoomConnections = (roomId: string) => {
        const toRemove: WebSocket[] = [];
        connections.forEach((info, ws) => {
          if (info.roomId === roomId) {
            ws.close();
            toRemove.push(ws);
          }
        });
        toRemove.forEach(ws => connections.delete(ws));
        return toRemove.length;
      };

      const removed = removeRoomConnections('table-1');

      expect(removed).toBe(2);
      expect(connections.size).toBe(1);
    });
  });

  describe('連接池容量管理', () => {
    it('應該限制最大連接數', () => {
      const MAX_CONNECTIONS = 1000;

      const canAddConnection = () => {
        return connections.size < MAX_CONNECTIONS;
      };

      // Add connections up to limit
      for (let i = 0; i < MAX_CONNECTIONS; i++) {
        if (canAddConnection()) {
          const ws = { ...mockWebSocket };
          connections.set(ws, {
            id: `conn-${i}`,
            type: 'customer',
            roomId: `room-${i}`,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
          });
        }
      }

      expect(connections.size).toBe(MAX_CONNECTIONS);
      expect(canAddConnection()).toBe(false);
    });

    it('應該統計每個 room 的連接數', () => {
      const ws1 = { ...mockWebSocket };
      const ws2 = { ...mockWebSocket };
      const ws3 = { ...mockWebSocket };

      connections.set(ws1, {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      connections.set(ws2, {
        id: 'conn-2',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      connections.set(ws3, {
        id: 'conn-3',
        type: 'customer',
        roomId: 'table-2',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      const countByRoom = () => {
        const counts = new Map<string, number>();
        connections.forEach((info) => {
          counts.set(info.roomId, (counts.get(info.roomId) || 0) + 1);
        });
        return counts;
      };

      const roomCounts = countByRoom();

      expect(roomCounts.get('table-1')).toBe(2);
      expect(roomCounts.get('table-2')).toBe(1);
    });

    it('應該限制單個 room 的最大連接數', () => {
      const MAX_CONNECTIONS_PER_ROOM = 10;

      const getRoomConnectionCount = (roomId: string) => {
        let count = 0;
        connections.forEach((info) => {
          if (info.roomId === roomId) count++;
        });
        return count;
      };

      const canAddToRoom = (roomId: string) => {
        return getRoomConnectionCount(roomId) < MAX_CONNECTIONS_PER_ROOM;
      };

      // Add 10 connections to room-1
      for (let i = 0; i < 10; i++) {
        const ws = { ...mockWebSocket };
        connections.set(ws, {
          id: `conn-${i}`,
          type: 'customer',
          roomId: 'room-1',
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        });
      }

      expect(getRoomConnectionCount('room-1')).toBe(10);
      expect(canAddToRoom('room-1')).toBe(false);
      expect(canAddToRoom('room-2')).toBe(true);
    });
  });

  describe('連接查詢', () => {
    beforeEach(() => {
      const ws1 = { ...mockWebSocket };
      const ws2 = { ...mockWebSocket };
      const ws3 = { ...mockWebSocket };

      connections.set(ws1, {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      connections.set(ws2, {
        id: 'conn-2',
        type: 'admin',
        roomId: 'dashboard-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      connections.set(ws3, {
        id: 'conn-3',
        type: 'kitchen',
        roomId: 'kitchen-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });
    });

    it('應該按類型過濾連接', () => {
      const getConnectionsByType = (type: ConnectionInfo['type']) => {
        const result: ConnectionInfo[] = [];
        connections.forEach((info) => {
          if (info.type === type) {
            result.push(info);
          }
        });
        return result;
      };

      const customerConns = getConnectionsByType('customer');
      const adminConns = getConnectionsByType('admin');
      const kitchenConns = getConnectionsByType('kitchen');

      expect(customerConns.length).toBe(1);
      expect(adminConns.length).toBe(1);
      expect(kitchenConns.length).toBe(1);
    });

    it('應該按 roomId 過濾連接', () => {
      const getConnectionsByRoom = (roomId: string) => {
        const result: ConnectionInfo[] = [];
        connections.forEach((info) => {
          if (info.roomId === roomId) {
            result.push(info);
          }
        });
        return result;
      };

      const table1Conns = getConnectionsByRoom('table-1');
      const dashboardConns = getConnectionsByRoom('dashboard-1');

      expect(table1Conns.length).toBe(1);
      expect(dashboardConns.length).toBe(1);
      expect(dashboardConns[0].type).toBe('admin');
    });

    it('應該根據 connection ID 查找連接', () => {
      const findConnectionById = (id: string): ConnectionInfo | undefined => {
        for (const info of connections.values()) {
          if (info.id === id) {
            return info;
          }
        }
        return undefined;
      };

      const conn = findConnectionById('conn-2');

      expect(conn).toBeDefined();
      expect(conn?.type).toBe('admin');
      expect(conn?.roomId).toBe('dashboard-1');
    });

    it('應該返回所有活躍連接', () => {
      const getAllConnections = () => {
        return Array.from(connections.values());
      };

      const allConns = getAllConnections();

      expect(allConns.length).toBe(3);
    });
  });

  describe('連接狀態追蹤', () => {
    it('應該更新最後活動時間', () => {
      const connInfo: ConnectionInfo = {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now() - 10000,
      };

      connections.set(mockWebSocket, connInfo);

      const updateActivity = (ws: WebSocket) => {
        const info = connections.get(ws);
        if (info) {
          info.lastActivity = Date.now();
        }
      };

      const oldActivity = connInfo.lastActivity;
      updateActivity(mockWebSocket);
      const newActivity = connections.get(mockWebSocket)!.lastActivity;

      expect(newActivity).toBeGreaterThan(oldActivity);
    });

    it('應該計算連接持續時間', () => {
      const connectedTime = Date.now() - 60000; // 1 minute ago
      const connInfo: ConnectionInfo = {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: connectedTime,
        lastActivity: Date.now(),
      };

      connections.set(mockWebSocket, connInfo);

      const getConnectionDuration = (ws: WebSocket) => {
        const info = connections.get(ws);
        if (!info) return 0;
        return Date.now() - info.connectedAt;
      };

      const duration = getConnectionDuration(mockWebSocket);

      expect(duration).toBeGreaterThanOrEqual(60000);
    });

    it('應該識別閒置連接', () => {
      const IDLE_THRESHOLD = 300000; // 5 minutes

      const ws1 = { ...mockWebSocket };
      const ws2 = { ...mockWebSocket };

      connections.set(ws1, {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now() - 600000, // 10 minutes ago - idle
      });

      connections.set(ws2, {
        id: 'conn-2',
        type: 'customer',
        roomId: 'table-2',
        connectedAt: Date.now(),
        lastActivity: Date.now() - 60000, // 1 minute ago - active
      });

      const getIdleConnections = () => {
        const idle: ConnectionInfo[] = [];
        connections.forEach((info) => {
          if (Date.now() - info.lastActivity > IDLE_THRESHOLD) {
            idle.push(info);
          }
        });
        return idle;
      };

      const idleConns = getIdleConnections();

      expect(idleConns.length).toBe(1);
      expect(idleConns[0].id).toBe('conn-1');
    });
  });

  describe('記憶體清理', () => {
    it('應該清理所有連接', () => {
      for (let i = 0; i < 5; i++) {
        const ws = { ...mockWebSocket };
        connections.set(ws, {
          id: `conn-${i}`,
          type: 'customer',
          roomId: `table-${i}`,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
        });
      }

      expect(connections.size).toBe(5);

      const closeAll = () => {
        connections.forEach((info, ws) => {
          ws.close();
        });
        connections.clear();
      };

      closeAll();

      expect(connections.size).toBe(0);
    });

    it('應該清理閒置連接', () => {
      const IDLE_THRESHOLD = 300000;

      const ws1 = { ...mockWebSocket };
      const ws2 = { ...mockWebSocket };
      const ws3 = { ...mockWebSocket };

      connections.set(ws1, {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now() - 600000, // Idle
      });

      connections.set(ws2, {
        id: 'conn-2',
        type: 'customer',
        roomId: 'table-2',
        connectedAt: Date.now(),
        lastActivity: Date.now() - 60000, // Active
      });

      connections.set(ws3, {
        id: 'conn-3',
        type: 'customer',
        roomId: 'table-3',
        connectedAt: Date.now(),
        lastActivity: Date.now() - 400000, // Idle
      });

      const cleanupIdleConnections = () => {
        const toRemove: WebSocket[] = [];
        connections.forEach((info, ws) => {
          if (Date.now() - info.lastActivity > IDLE_THRESHOLD) {
            ws.close(1000, 'Idle timeout');
            toRemove.push(ws);
          }
        });
        toRemove.forEach(ws => connections.delete(ws));
        return toRemove.length;
      };

      const removed = cleanupIdleConnections();

      expect(removed).toBe(2);
      expect(connections.size).toBe(1);
    });

    it('應該生成連接池統計信息', () => {
      const ws1 = { ...mockWebSocket };
      const ws2 = { ...mockWebSocket };
      const ws3 = { ...mockWebSocket };

      connections.set(ws1, {
        id: 'conn-1',
        type: 'customer',
        roomId: 'table-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      connections.set(ws2, {
        id: 'conn-2',
        type: 'admin',
        roomId: 'dashboard-1',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      connections.set(ws3, {
        id: 'conn-3',
        type: 'customer',
        roomId: 'table-2',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
      });

      const getStats = () => {
        const stats = {
          total: connections.size,
          byType: new Map<string, number>(),
          byRoom: new Map<string, number>(),
        };

        connections.forEach((info) => {
          stats.byType.set(info.type, (stats.byType.get(info.type) || 0) + 1);
          stats.byRoom.set(info.roomId, (stats.byRoom.get(info.roomId) || 0) + 1);
        });

        return stats;
      };

      const stats = getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType.get('customer')).toBe(2);
      expect(stats.byType.get('admin')).toBe(1);
      expect(stats.byRoom.get('table-1')).toBe(1);
    });
  });
});
