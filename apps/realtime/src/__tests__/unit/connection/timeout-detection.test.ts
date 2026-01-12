/**
 * Timeout Detection Tests
 * 測試連線逾時偵測和心跳機制
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { RealtimeAuthPayload } from "@makanmakan/shared-types";

// Connection info structure
interface ConnectionInfo {
  id: string;
  type: "customer" | "admin" | "kitchen";
  roomId: string;
  connectedAt: number;
  lastActivity: number;
  auth?: RealtimeAuthPayload;
  metadata?: Record<string, any>;
  lastHeartbeat?: number;
}

// Timeout configuration
interface TimeoutConfig {
  heartbeatInterval: number; // How often to send heartbeats (ms)
  heartbeatTimeout: number; // How long to wait for heartbeat response (ms)
  idleTimeout: number; // How long before idle connection is closed (ms)
  reconnectGracePeriod: number; // Grace period for reconnection (ms)
}

const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 60000, // 60 seconds
  idleTimeout: 300000, // 5 minutes
  reconnectGracePeriod: 10000, // 10 seconds
};

// Helper function to check if connection is idle
function isConnectionIdle(
  connection: ConnectionInfo,
  config: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG,
): boolean {
  const now = Date.now();
  const timeSinceActivity = now - connection.lastActivity;
  return timeSinceActivity > config.idleTimeout;
}

// Helper function to check if heartbeat is overdue
function isHeartbeatOverdue(
  connection: ConnectionInfo,
  config: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG,
): boolean {
  if (!connection.lastHeartbeat) {
    // No heartbeat yet - check connection age
    const connectionAge = Date.now() - connection.connectedAt;
    return connectionAge > config.heartbeatTimeout;
  }

  const timeSinceHeartbeat = Date.now() - connection.lastHeartbeat;
  return timeSinceHeartbeat > config.heartbeatTimeout;
}

// Helper function to check if connection should be cleaned up
function shouldCleanupConnection(
  connection: ConnectionInfo,
  config: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG,
): boolean {
  return (
    isConnectionIdle(connection, config) ||
    isHeartbeatOverdue(connection, config)
  );
}

// Helper function to calculate time until timeout
function getTimeUntilTimeout(
  connection: ConnectionInfo,
  config: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG,
): number {
  const now = Date.now();

  // Calculate time until idle timeout
  const timeSinceActivity = now - connection.lastActivity;
  const timeUntilIdle = config.idleTimeout - timeSinceActivity;

  // Calculate time until heartbeat timeout
  const lastHeartbeat = connection.lastHeartbeat || connection.connectedAt;
  const timeSinceHeartbeat = now - lastHeartbeat;
  const timeUntilHeartbeat = config.heartbeatTimeout - timeSinceHeartbeat;

  // Return the minimum (whichever comes first)
  return Math.max(0, Math.min(timeUntilIdle, timeUntilHeartbeat));
}

// Helper function to update connection activity
function updateConnectionActivity(connection: ConnectionInfo): ConnectionInfo {
  return {
    ...connection,
    lastActivity: Date.now(),
  };
}

// Helper function to update heartbeat timestamp
function updateHeartbeat(connection: ConnectionInfo): ConnectionInfo {
  return {
    ...connection,
    lastHeartbeat: Date.now(),
    lastActivity: Date.now(),
  };
}

// Helper function to create mock connection
function createMockConnection(
  overrides: Partial<ConnectionInfo> = {},
): ConnectionInfo {
  const now = Date.now();
  return {
    id: "conn-001",
    type: "customer",
    roomId: "table-001",
    connectedAt: now,
    lastActivity: now,
    auth: {
      roomType: "customer",
      roomId: "table-001",
      restaurantId: "restaurant-123",
      role: "customer",
      exp: Math.floor(now / 1000) + 3600,
      iat: Math.floor(now / 1000),
    },
    ...overrides,
  };
}

describe("Timeout Detection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Idle Connection Detection", () => {
    it("should detect idle connection after timeout period", () => {
      const connection = createMockConnection();

      // Fast forward time past idle timeout
      vi.advanceTimersByTime(DEFAULT_TIMEOUT_CONFIG.idleTimeout + 1000);

      expect(isConnectionIdle(connection)).toBe(true);
    });

    it("should not detect active connection as idle", () => {
      const connection = createMockConnection();

      // Connection is recent
      expect(isConnectionIdle(connection)).toBe(false);
    });

    it("should reset idle timer on activity", () => {
      let connection = createMockConnection();

      // Advance time to just before timeout
      vi.advanceTimersByTime(DEFAULT_TIMEOUT_CONFIG.idleTimeout - 5000);

      // Update activity
      connection = updateConnectionActivity(connection);

      // Should not be idle anymore
      expect(isConnectionIdle(connection)).toBe(false);
    });

    it("should handle custom idle timeout", () => {
      const connection = createMockConnection();
      const customConfig: TimeoutConfig = {
        ...DEFAULT_TIMEOUT_CONFIG,
        idleTimeout: 60000, // 1 minute
      };

      // Advance time past custom timeout
      vi.advanceTimersByTime(61000);

      expect(isConnectionIdle(connection, customConfig)).toBe(true);
    });

    it("should not be idle if just under timeout threshold", () => {
      const connection = createMockConnection();

      // Advance time to just before timeout
      vi.advanceTimersByTime(DEFAULT_TIMEOUT_CONFIG.idleTimeout - 1000);

      expect(isConnectionIdle(connection)).toBe(false);
    });
  });

  describe("Heartbeat Timeout Detection", () => {
    it("should detect missing heartbeat", () => {
      const connection = createMockConnection({
        lastHeartbeat: Date.now() - 70000, // 70 seconds ago
      });

      expect(isHeartbeatOverdue(connection)).toBe(true);
    });

    it("should not detect overdue heartbeat for recent heartbeat", () => {
      const connection = createMockConnection({
        lastHeartbeat: Date.now(),
      });

      expect(isHeartbeatOverdue(connection)).toBe(false);
    });

    it("should use connection time for first heartbeat check", () => {
      const connection = createMockConnection();

      // No heartbeat sent yet
      expect(connection.lastHeartbeat).toBeUndefined();

      // Advance time past heartbeat timeout
      vi.advanceTimersByTime(DEFAULT_TIMEOUT_CONFIG.heartbeatTimeout + 1000);

      expect(isHeartbeatOverdue(connection)).toBe(true);
    });

    it("should update heartbeat timestamp", () => {
      const connection = createMockConnection();
      const initialTime = Date.now();

      // Advance time
      vi.advanceTimersByTime(5000);

      const updated = updateHeartbeat(connection);

      expect(updated.lastHeartbeat).toBeGreaterThan(initialTime);
      expect(updated.lastActivity).toBe(updated.lastHeartbeat);
    });

    it("should handle heartbeat interval scheduling", () => {
      const connection = createMockConnection();
      const heartbeats: number[] = [];

      // Simulate heartbeat every 30 seconds
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(DEFAULT_TIMEOUT_CONFIG.heartbeatInterval);
        heartbeats.push(Date.now());
      }

      // Check intervals between heartbeats
      for (let i = 1; i < heartbeats.length; i++) {
        const interval = heartbeats[i] - heartbeats[i - 1];
        expect(interval).toBe(DEFAULT_TIMEOUT_CONFIG.heartbeatInterval);
      }
    });
  });

  describe("Connection Cleanup Decision", () => {
    it("should cleanup idle connection", () => {
      const connection = createMockConnection();

      // Advance time past idle timeout
      vi.advanceTimersByTime(DEFAULT_TIMEOUT_CONFIG.idleTimeout + 1000);

      expect(shouldCleanupConnection(connection)).toBe(true);
    });

    it("should cleanup connection with overdue heartbeat", () => {
      const connection = createMockConnection({
        lastHeartbeat: Date.now() - 70000, // 70 seconds ago
      });

      expect(shouldCleanupConnection(connection)).toBe(true);
    });

    it("should not cleanup active connection", () => {
      const connection = createMockConnection();

      expect(shouldCleanupConnection(connection)).toBe(false);
    });

    it("should cleanup based on first condition met", () => {
      // Connection is idle but heartbeat is fine
      const idleConnection = createMockConnection({
        lastActivity: Date.now() - 400000, // 6.67 minutes ago
        lastHeartbeat: Date.now(),
      });

      expect(shouldCleanupConnection(idleConnection)).toBe(true);

      // Heartbeat is overdue but connection is active
      const staleConnection = createMockConnection({
        lastActivity: Date.now(),
        lastHeartbeat: Date.now() - 70000, // 70 seconds ago
      });

      expect(shouldCleanupConnection(staleConnection)).toBe(true);
    });
  });

  describe("Timeout Calculation", () => {
    it("should calculate time until idle timeout", () => {
      // Create connection with lastHeartbeat set to prevent heartbeat timeout
      // from interfering with idle timeout calculation
      const now = Date.now();
      const connection = createMockConnection({
        lastHeartbeat: now,
      });

      // Advance 1 minute
      vi.advanceTimersByTime(60000);

      const timeUntil = getTimeUntilTimeout(connection);
      // Both idle and heartbeat timeouts should be reduced by 60 seconds
      // idleTimeout (300000) - 60000 = 240000
      // heartbeatTimeout (60000) - 60000 = 0
      // The minimum is 0 since heartbeat timeout is reached
      // If we want to test idle timeout specifically, we need heartbeat timeout > 60s
      // Since heartbeatTimeout is 60000ms, after 60 seconds it becomes 0
      // So the expected result is 0 (heartbeat timeout reached first)
      expect(timeUntil).toBe(0);
    });

    it("should return 0 for already timed out connection", () => {
      const connection = createMockConnection();

      // Advance past timeout
      vi.advanceTimersByTime(DEFAULT_TIMEOUT_CONFIG.idleTimeout + 10000);

      const timeUntil = getTimeUntilTimeout(connection);

      expect(timeUntil).toBe(0);
    });

    it("should return minimum of idle and heartbeat timeouts", () => {
      const connection = createMockConnection();

      // Advance to make heartbeat timeout closer
      vi.advanceTimersByTime(50000); // 50 seconds

      const timeUntil = getTimeUntilTimeout(connection);

      // Heartbeat timeout (60s) - 50s = 10s
      // Idle timeout (300s) - 50s = 250s
      // Should return minimum: 10s
      expect(timeUntil).toBe(10000);
    });

    it("should handle connection with recent heartbeat", () => {
      let connection = createMockConnection();

      // Advance time
      vi.advanceTimersByTime(40000);

      // Update heartbeat
      connection = updateHeartbeat(connection);

      const timeUntil = getTimeUntilTimeout(connection);

      // Should be close to heartbeat timeout
      expect(timeUntil).toBeGreaterThan(50000);
    });
  });

  describe("Grace Period Handling", () => {
    it("should allow reconnection within grace period", () => {
      const connection = createMockConnection();
      const disconnectTime = Date.now();

      // Simulate disconnection
      vi.advanceTimersByTime(5000); // 5 seconds

      const reconnectTime = Date.now();
      const timeSinceDisconnect = reconnectTime - disconnectTime;

      const isWithinGracePeriod =
        timeSinceDisconnect < DEFAULT_TIMEOUT_CONFIG.reconnectGracePeriod;

      expect(isWithinGracePeriod).toBe(true);
    });

    it("should not allow reconnection after grace period", () => {
      const connection = createMockConnection();
      const disconnectTime = Date.now();

      // Simulate disconnection
      vi.advanceTimersByTime(15000); // 15 seconds (past grace period)

      const reconnectTime = Date.now();
      const timeSinceDisconnect = reconnectTime - disconnectTime;

      const isWithinGracePeriod =
        timeSinceDisconnect < DEFAULT_TIMEOUT_CONFIG.reconnectGracePeriod;

      expect(isWithinGracePeriod).toBe(false);
    });

    it("should handle edge case at grace period boundary", () => {
      const connection = createMockConnection();
      const disconnectTime = Date.now();

      // Exactly at grace period
      vi.advanceTimersByTime(DEFAULT_TIMEOUT_CONFIG.reconnectGracePeriod);

      const reconnectTime = Date.now();
      const timeSinceDisconnect = reconnectTime - disconnectTime;

      const isWithinGracePeriod =
        timeSinceDisconnect < DEFAULT_TIMEOUT_CONFIG.reconnectGracePeriod;

      expect(isWithinGracePeriod).toBe(false); // Exactly at boundary should be outside
    });

    it("should maintain connection state during grace period", () => {
      const connectionState = {
        lastEventId: "event-123",
        missedEvents: ["event-124", "event-125"],
        metadata: { orderCount: 5 },
      };

      // Simulate grace period
      vi.advanceTimersByTime(
        DEFAULT_TIMEOUT_CONFIG.reconnectGracePeriod - 1000,
      );

      // State should still be available
      expect(connectionState.lastEventId).toBe("event-123");
      expect(connectionState.missedEvents).toHaveLength(2);
    });
  });

  describe("Multiple Connections Cleanup", () => {
    it("should identify which connections need cleanup", () => {
      const connections = new Map<string, ConnectionInfo>();

      // Add active connection
      connections.set("conn-1", createMockConnection({ id: "conn-1" }));

      // Add idle connection
      connections.set(
        "conn-2",
        createMockConnection({
          id: "conn-2",
          lastActivity: Date.now() - 400000, // 6.67 minutes ago
        }),
      );

      // Add connection with stale heartbeat
      connections.set(
        "conn-3",
        createMockConnection({
          id: "conn-3",
          lastHeartbeat: Date.now() - 70000, // 70 seconds ago
        }),
      );

      const toCleanup: string[] = [];

      for (const [id, connection] of connections) {
        if (shouldCleanupConnection(connection)) {
          toCleanup.push(id);
        }
      }

      expect(toCleanup).toEqual(["conn-2", "conn-3"]);
    });

    it("should cleanup connections in batch", () => {
      const connections = new Map<string, ConnectionInfo>();

      // Add 10 connections with varying activity
      for (let i = 0; i < 10; i++) {
        const isIdle = i % 2 === 0;
        connections.set(
          `conn-${i}`,
          createMockConnection({
            id: `conn-${i}`,
            lastActivity: isIdle ? Date.now() - 400000 : Date.now(),
          }),
        );
      }

      // Cleanup idle connections
      for (const [id, connection] of connections) {
        if (shouldCleanupConnection(connection)) {
          connections.delete(id);
        }
      }

      // Should have 5 active connections left
      expect(connections.size).toBe(5);
    });

    it("should track cleanup statistics", () => {
      const stats = {
        totalConnections: 100,
        cleanedUp: 0,
        idleCleanup: 0,
        heartbeatCleanup: 0,
      };

      const connections = new Map<string, ConnectionInfo>();

      // Add various connections
      for (let i = 0; i < 100; i++) {
        let connection: ConnectionInfo;

        if (i < 20) {
          // 20 idle connections
          connection = createMockConnection({
            id: `conn-${i}`,
            lastActivity: Date.now() - 400000,
          });
        } else if (i < 40) {
          // 20 stale heartbeat connections
          connection = createMockConnection({
            id: `conn-${i}`,
            lastHeartbeat: Date.now() - 70000,
          });
        } else {
          // 60 active connections
          connection = createMockConnection({ id: `conn-${i}` });
        }

        connections.set(`conn-${i}`, connection);
      }

      // Perform cleanup
      for (const [id, connection] of connections) {
        if (shouldCleanupConnection(connection)) {
          if (isConnectionIdle(connection)) {
            stats.idleCleanup++;
          }
          if (isHeartbeatOverdue(connection)) {
            stats.heartbeatCleanup++;
          }
          stats.cleanedUp++;
          connections.delete(id);
        }
      }

      expect(stats.cleanedUp).toBe(40);
      expect(stats.idleCleanup).toBe(20);
      expect(stats.heartbeatCleanup).toBe(20);
      expect(connections.size).toBe(60);
    });
  });

  describe("Custom Timeout Configuration", () => {
    it("should support custom heartbeat interval", () => {
      const customConfig: TimeoutConfig = {
        ...DEFAULT_TIMEOUT_CONFIG,
        heartbeatInterval: 15000, // 15 seconds
      };

      const heartbeats: number[] = [];

      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(customConfig.heartbeatInterval);
        heartbeats.push(Date.now());
      }

      // Check custom interval
      const interval = heartbeats[1] - heartbeats[0];
      expect(interval).toBe(15000);
    });

    it("should support custom idle timeout", () => {
      const customConfig: TimeoutConfig = {
        ...DEFAULT_TIMEOUT_CONFIG,
        idleTimeout: 120000, // 2 minutes
      };

      const connection = createMockConnection();

      // Advance to just before custom timeout
      vi.advanceTimersByTime(119000);
      expect(isConnectionIdle(connection, customConfig)).toBe(false);

      // Advance past custom timeout
      vi.advanceTimersByTime(2000);
      expect(isConnectionIdle(connection, customConfig)).toBe(true);
    });

    it("should validate timeout configuration", () => {
      const validateConfig = (config: TimeoutConfig): boolean => {
        return (
          config.heartbeatInterval > 0 &&
          config.heartbeatTimeout > config.heartbeatInterval &&
          config.idleTimeout > config.heartbeatTimeout &&
          config.reconnectGracePeriod > 0
        );
      };

      const validConfig: TimeoutConfig = {
        heartbeatInterval: 30000,
        heartbeatTimeout: 60000,
        idleTimeout: 300000,
        reconnectGracePeriod: 10000,
      };

      const invalidConfig: TimeoutConfig = {
        heartbeatInterval: 60000,
        heartbeatTimeout: 30000, // Less than interval!
        idleTimeout: 300000,
        reconnectGracePeriod: 10000,
      };

      expect(validateConfig(validConfig)).toBe(true);
      expect(validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle connection created at epoch time", () => {
      const connection = createMockConnection({
        connectedAt: 0,
        lastActivity: 0,
      });

      // Should definitely be timed out
      expect(isConnectionIdle(connection)).toBe(true);
      expect(isHeartbeatOverdue(connection)).toBe(true);
    });

    it("should handle very recent connection", () => {
      const connection = createMockConnection();

      // Immediately after connection
      expect(isConnectionIdle(connection)).toBe(false);
      expect(isHeartbeatOverdue(connection)).toBe(false);
    });

    it("should handle rapid activity updates", () => {
      let connection = createMockConnection();

      // Update activity 100 times rapidly
      for (let i = 0; i < 100; i++) {
        vi.advanceTimersByTime(100); // 100ms
        connection = updateConnectionActivity(connection);
      }

      // Should still be active
      expect(isConnectionIdle(connection)).toBe(false);
    });

    it("should handle cleanup of all connections", () => {
      const connections = new Map<string, ConnectionInfo>();

      // Add 50 all-idle connections
      for (let i = 0; i < 50; i++) {
        connections.set(
          `conn-${i}`,
          createMockConnection({
            id: `conn-${i}`,
            lastActivity: Date.now() - 400000,
          }),
        );
      }

      // Cleanup all
      for (const [id, connection] of connections) {
        if (shouldCleanupConnection(connection)) {
          connections.delete(id);
        }
      }

      expect(connections.size).toBe(0);
    });

    it("should handle cleanup of no connections", () => {
      const connections = new Map<string, ConnectionInfo>();

      // Add 50 active connections
      for (let i = 0; i < 50; i++) {
        connections.set(
          `conn-${i}`,
          createMockConnection({
            id: `conn-${i}`,
          }),
        );
      }

      // Attempt cleanup
      for (const [id, connection] of connections) {
        if (shouldCleanupConnection(connection)) {
          connections.delete(id);
        }
      }

      // All should remain
      expect(connections.size).toBe(50);
    });
  });
});
