/**
 * Reconnection Strategy Tests
 * 測試重新連線策略和自動重連機制
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  RealtimeEvent,
  RealtimeAuthPayload,
} from "@makanmakan/shared-types";
import { RealtimeEventType } from "@makanmakan/shared-types";

// Connection states
enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

// Reconnection configuration
interface ReconnectionConfig {
  maxRetries: number; // Maximum reconnection attempts
  initialDelay: number; // Initial delay before first retry (ms)
  maxDelay: number; // Maximum delay between retries (ms)
  backoffMultiplier: number; // Exponential backoff multiplier
  jitterFactor: number; // Random jitter factor (0-1)
}

const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  maxRetries: 5,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.2,
};

// Reconnection state
interface ReconnectionState {
  state: ConnectionState;
  attempt: number;
  lastAttemptTime: number;
  nextRetryDelay: number;
  failureReason?: string;
  eventsSinceDisconnect: RealtimeEvent[];
  lastEventId?: string;
}

// Helper function to calculate next retry delay with exponential backoff
function calculateRetryDelay(
  attempt: number,
  config: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG,
): number {
  // Base delay with exponential backoff
  const baseDelay =
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt);

  // Cap at maximum delay
  const cappedDelay = Math.min(baseDelay, config.maxDelay);

  // Add jitter to prevent thundering herd
  const jitterRange = cappedDelay * config.jitterFactor;
  const jitter = Math.random() * jitterRange - jitterRange / 2;

  return Math.max(0, cappedDelay + jitter);
}

// Helper function to check if should retry
function shouldRetry(
  state: ReconnectionState,
  config: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG,
): boolean {
  return state.attempt < config.maxRetries;
}

// Helper function to create initial reconnection state
function createReconnectionState(): ReconnectionState {
  return {
    state: ConnectionState.DISCONNECTED,
    attempt: 0,
    lastAttemptTime: 0,
    nextRetryDelay: DEFAULT_RECONNECTION_CONFIG.initialDelay,
    eventsSinceDisconnect: [],
  };
}

// Helper function to handle reconnection attempt
function handleReconnectionAttempt(
  state: ReconnectionState,
  config: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG,
): ReconnectionState {
  const newAttempt = state.attempt + 1;

  return {
    ...state,
    state: ConnectionState.RECONNECTING,
    attempt: newAttempt,
    lastAttemptTime: Date.now(),
    nextRetryDelay: calculateRetryDelay(newAttempt, config),
  };
}

// Helper function to handle successful reconnection
function handleReconnectionSuccess(
  state: ReconnectionState,
): ReconnectionState {
  return {
    ...state,
    state: ConnectionState.CONNECTED,
    attempt: 0,
    nextRetryDelay: DEFAULT_RECONNECTION_CONFIG.initialDelay,
    failureReason: undefined,
  };
}

// Helper function to handle failed reconnection
function handleReconnectionFailure(
  state: ReconnectionState,
  reason: string,
  config: ReconnectionConfig = DEFAULT_RECONNECTION_CONFIG,
): ReconnectionState {
  if (!shouldRetry(state, config)) {
    return {
      ...state,
      state: ConnectionState.FAILED,
      failureReason: reason,
    };
  }

  return {
    ...state,
    state: ConnectionState.DISCONNECTED,
    failureReason: reason,
  };
}

// Helper function to queue missed event
function queueMissedEvent(
  state: ReconnectionState,
  event: RealtimeEvent,
): ReconnectionState {
  return {
    ...state,
    eventsSinceDisconnect: [...state.eventsSinceDisconnect, event],
    lastEventId: event.eventId,
  };
}

// Helper function to sync missed events on reconnection
function syncMissedEvents(
  state: ReconnectionState,
  availableEvents: RealtimeEvent[],
): { synced: RealtimeEvent[]; state: ReconnectionState } {
  if (!state.lastEventId) {
    // No previous events, sync all available
    return {
      synced: availableEvents,
      state: {
        ...state,
        eventsSinceDisconnect: [],
      },
    };
  }

  // Find events after last received event
  const lastIndex = availableEvents.findIndex(
    (e) => e.eventId === state.lastEventId,
  );
  const newEvents =
    lastIndex >= 0 ? availableEvents.slice(lastIndex + 1) : availableEvents;

  return {
    synced: newEvents,
    state: {
      ...state,
      eventsSinceDisconnect: [],
      lastEventId:
        newEvents[newEvents.length - 1]?.eventId || state.lastEventId,
    },
  };
}

describe("Reconnection Strategy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Exponential Backoff", () => {
    it("should calculate delay with exponential backoff", () => {
      const delays: number[] = [];

      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = calculateRetryDelay(attempt, {
          ...DEFAULT_RECONNECTION_CONFIG,
          jitterFactor: 0, // No jitter for predictable testing
        });
        delays.push(delay);
      }

      // Delays should increase exponentially
      expect(delays[0]).toBe(1000); // 1s * 2^0 = 1s
      expect(delays[1]).toBe(2000); // 1s * 2^1 = 2s
      expect(delays[2]).toBe(4000); // 1s * 2^2 = 4s
      expect(delays[3]).toBe(8000); // 1s * 2^3 = 8s
      expect(delays[4]).toBe(16000); // 1s * 2^4 = 16s
    });

    it("should cap delay at maximum", () => {
      const delay = calculateRetryDelay(10, {
        ...DEFAULT_RECONNECTION_CONFIG,
        maxDelay: 30000,
        jitterFactor: 0,
      });

      expect(delay).toBe(30000);
    });

    it("should add jitter to delay", () => {
      const delays: number[] = [];

      for (let i = 0; i < 10; i++) {
        const delay = calculateRetryDelay(0, {
          ...DEFAULT_RECONNECTION_CONFIG,
          jitterFactor: 0.2,
        });
        delays.push(delay);
      }

      // Delays should vary due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be within jitter range
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThan(800); // 1000 - 20%
        expect(delay).toBeLessThan(1200); // 1000 + 20%
      });
    });

    it("should handle custom backoff multiplier", () => {
      const delay = calculateRetryDelay(3, {
        ...DEFAULT_RECONNECTION_CONFIG,
        initialDelay: 1000,
        backoffMultiplier: 3,
        jitterFactor: 0,
      });

      // 1000 * 3^3 = 27000
      expect(delay).toBe(27000);
    });
  });

  describe("Retry Logic", () => {
    it("should allow retries within limit", () => {
      const state = createReconnectionState();

      for (let i = 0; i < 5; i++) {
        expect(shouldRetry({ ...state, attempt: i })).toBe(true);
      }

      expect(shouldRetry({ ...state, attempt: 5 })).toBe(false);
    });

    it("should track retry attempts", () => {
      let state = createReconnectionState();

      for (let i = 0; i < 3; i++) {
        state = handleReconnectionAttempt(state);
        expect(state.attempt).toBe(i + 1);
        expect(state.state).toBe(ConnectionState.RECONNECTING);
      }
    });

    it("should reset attempts on successful reconnection", () => {
      let state = createReconnectionState();

      // Make 3 attempts
      for (let i = 0; i < 3; i++) {
        state = handleReconnectionAttempt(state);
      }

      expect(state.attempt).toBe(3);

      // Successful reconnection
      state = handleReconnectionSuccess(state);

      expect(state.attempt).toBe(0);
      expect(state.state).toBe(ConnectionState.CONNECTED);
    });

    it("should handle max retries exceeded", () => {
      let state = createReconnectionState();

      // Exceed max retries
      for (let i = 0; i < 6; i++) {
        if (shouldRetry(state)) {
          state = handleReconnectionAttempt(state);
          state = handleReconnectionFailure(state, "Connection failed");
        }
      }

      expect(state.state).toBe(ConnectionState.FAILED);
      expect(state.failureReason).toBe("Connection failed");
    });
  });

  describe("Connection State Management", () => {
    it("should transition through connection states", () => {
      let state = createReconnectionState();
      expect(state.state).toBe(ConnectionState.DISCONNECTED);

      // Start reconnecting
      state = handleReconnectionAttempt(state);
      expect(state.state).toBe(ConnectionState.RECONNECTING);

      // Success
      state = handleReconnectionSuccess(state);
      expect(state.state).toBe(ConnectionState.CONNECTED);
    });

    it("should handle connection failure", () => {
      let state = createReconnectionState();

      state = handleReconnectionAttempt(state);
      state = handleReconnectionFailure(state, "Network error");

      expect(state.state).toBe(ConnectionState.DISCONNECTED);
      expect(state.failureReason).toBe("Network error");
    });

    it("should track last attempt time", () => {
      const state = createReconnectionState();
      const startTime = Date.now();

      vi.advanceTimersByTime(5000);

      const newState = handleReconnectionAttempt(state);

      expect(newState.lastAttemptTime).toBeGreaterThan(startTime);
    });

    it("should update next retry delay", () => {
      let state = createReconnectionState();

      const delays: number[] = [];

      for (let i = 0; i < 3; i++) {
        state = handleReconnectionAttempt(state);
        delays.push(state.nextRetryDelay);
      }

      // Each delay should be larger than previous (with jitter variation)
      const averageDelay1 = delays[0];
      const averageDelay2 = delays[1];
      const averageDelay3 = delays[2];

      // General trend should be increasing
      expect(averageDelay2).toBeGreaterThan(averageDelay1 * 0.8);
      expect(averageDelay3).toBeGreaterThan(averageDelay2 * 0.8);
    });
  });

  describe("Event Synchronization", () => {
    it("should queue events during disconnection", () => {
      let state = createReconnectionState();

      const events: RealtimeEvent[] = [
        {
          type: RealtimeEventType.NEW_ORDER,
          eventId: "event-001",
          timestamp: Date.now(),
          restaurantId: "restaurant-123",
          data: {} as any,
        },
        {
          type: RealtimeEventType.ORDER_STATUS_UPDATE,
          eventId: "event-002",
          timestamp: Date.now(),
          restaurantId: "restaurant-123",
          data: {} as any,
        },
      ];

      events.forEach((event) => {
        state = queueMissedEvent(state, event);
      });

      expect(state.eventsSinceDisconnect).toHaveLength(2);
      expect(state.lastEventId).toBe("event-002");
    });

    it("should sync events on reconnection", () => {
      const state = createReconnectionState();

      // Set last received event
      state.lastEventId = "event-005";

      // Available events on server
      const serverEvents: RealtimeEvent[] = [
        {
          eventId: "event-003",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
        {
          eventId: "event-004",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
        {
          eventId: "event-005",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
        {
          eventId: "event-006",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
        {
          eventId: "event-007",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
      ];

      const { synced, state: newState } = syncMissedEvents(state, serverEvents);

      // Should sync events after event-005
      expect(synced).toHaveLength(2);
      expect(synced[0].eventId).toBe("event-006");
      expect(synced[1].eventId).toBe("event-007");
      expect(newState.lastEventId).toBe("event-007");
    });

    it("should sync all events if no lastEventId", () => {
      const state = createReconnectionState();

      const serverEvents: RealtimeEvent[] = [
        {
          eventId: "event-001",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
        {
          eventId: "event-002",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
      ];

      const { synced } = syncMissedEvents(state, serverEvents);

      expect(synced).toHaveLength(2);
    });

    it("should clear queued events after sync", () => {
      let state = createReconnectionState();

      // Queue some events
      state = queueMissedEvent(state, {
        eventId: "event-001",
        type: RealtimeEventType.NEW_ORDER,
        timestamp: Date.now(),
        restaurantId: "r1",
        data: {} as any,
      });

      expect(state.eventsSinceDisconnect).toHaveLength(1);

      // Sync events
      const { state: newState } = syncMissedEvents(state, []);

      expect(newState.eventsSinceDisconnect).toHaveLength(0);
    });

    it("should handle missing events on server", () => {
      const state = createReconnectionState();
      state.lastEventId = "event-010";

      // Server only has newer events (event-010 not found)
      const serverEvents: RealtimeEvent[] = [
        {
          eventId: "event-015",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
        {
          eventId: "event-016",
          type: RealtimeEventType.NEW_ORDER,
          timestamp: Date.now(),
          restaurantId: "r1",
          data: {} as any,
        },
      ];

      const { synced } = syncMissedEvents(state, serverEvents);

      // Should sync all available events
      expect(synced).toHaveLength(2);
    });
  });

  describe("Reconnection Scenarios", () => {
    it("should handle network interruption", () => {
      let state = createReconnectionState();

      // Connection lost
      state = { ...state, state: ConnectionState.DISCONNECTED };

      // First retry
      state = handleReconnectionAttempt(state);
      expect(state.state).toBe(ConnectionState.RECONNECTING);

      // Retry fails
      state = handleReconnectionFailure(state, "Network unavailable");

      // Should be ready for next retry
      expect(state.state).toBe(ConnectionState.DISCONNECTED);
      expect(shouldRetry(state)).toBe(true);
    });

    it("should handle server unavailable", () => {
      let state = createReconnectionState();

      // Multiple failed attempts
      for (let i = 0; i < 3; i++) {
        state = handleReconnectionAttempt(state);
        state = handleReconnectionFailure(state, "Server unavailable");
      }

      expect(state.attempt).toBe(3);
      expect(shouldRetry(state)).toBe(true);
    });

    it("should handle immediate reconnection success", () => {
      let state = createReconnectionState();

      state = handleReconnectionAttempt(state);
      state = handleReconnectionSuccess(state);

      expect(state.state).toBe(ConnectionState.CONNECTED);
      expect(state.attempt).toBe(0);
    });

    it("should handle reconnection after multiple failures", () => {
      let state = createReconnectionState();

      // Fail 4 times
      for (let i = 0; i < 4; i++) {
        state = handleReconnectionAttempt(state);
        state = handleReconnectionFailure(state, "Connection timeout");
      }

      expect(state.attempt).toBe(4);

      // Success on 5th attempt
      state = handleReconnectionAttempt(state);
      state = handleReconnectionSuccess(state);

      expect(state.state).toBe(ConnectionState.CONNECTED);
      expect(state.attempt).toBe(0);
    });

    it("should handle complete reconnection failure", () => {
      let state = createReconnectionState();
      const maxRetries = 5;

      // Fail all retries
      for (let i = 0; i <= maxRetries; i++) {
        if (shouldRetry(state)) {
          state = handleReconnectionAttempt(state);
        }
        state = handleReconnectionFailure(state, "Persistent failure");
      }

      expect(state.state).toBe(ConnectionState.FAILED);
      expect(shouldRetry(state)).toBe(false);
    });
  });

  describe("Timing and Delays", () => {
    it("should respect retry delay", async () => {
      const state = createReconnectionState();
      const newState = handleReconnectionAttempt(state);

      const delay = newState.nextRetryDelay;

      // Should wait before next retry
      expect(delay).toBeGreaterThan(0);
    });

    it("should schedule retries with increasing delays", () => {
      let state = createReconnectionState();
      const delays: number[] = [];

      for (let i = 0; i < 5; i++) {
        state = handleReconnectionAttempt(state);
        delays.push(state.nextRetryDelay);
      }

      // Delays should generally increase (accounting for jitter)
      for (let i = 1; i < delays.length; i++) {
        // Each delay should be at least 50% of expected exponential growth
        const expectedGrowth = delays[i - 1] * 1.5;
        expect(delays[i]).toBeGreaterThan(expectedGrowth * 0.5);
      }
    });

    it("should track time between attempts", () => {
      let state = createReconnectionState();

      const times: number[] = [];

      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(1000 * (i + 1)); // Different delays
        state = handleReconnectionAttempt(state);
        times.push(state.lastAttemptTime);
      }

      // Times should be increasing
      expect(times[1]).toBeGreaterThan(times[0]);
      expect(times[2]).toBeGreaterThan(times[1]);
    });
  });

  describe("Custom Configuration", () => {
    it("should support custom max retries", () => {
      const customConfig: ReconnectionConfig = {
        ...DEFAULT_RECONNECTION_CONFIG,
        maxRetries: 3,
      };

      let state = createReconnectionState();

      // Should allow 3 retries
      for (let i = 0; i < 3; i++) {
        expect(shouldRetry(state, customConfig)).toBe(true);
        state = { ...state, attempt: i + 1 };
      }

      expect(shouldRetry(state, customConfig)).toBe(false);
    });

    it("should support custom initial delay", () => {
      const customConfig: ReconnectionConfig = {
        ...DEFAULT_RECONNECTION_CONFIG,
        initialDelay: 5000,
        jitterFactor: 0,
      };

      const delay = calculateRetryDelay(0, customConfig);

      expect(delay).toBe(5000);
    });

    it("should support custom backoff multiplier", () => {
      const customConfig: ReconnectionConfig = {
        ...DEFAULT_RECONNECTION_CONFIG,
        initialDelay: 1000,
        backoffMultiplier: 3,
        jitterFactor: 0,
      };

      const delays = [
        calculateRetryDelay(0, customConfig), // 1000 * 3^0 = 1000
        calculateRetryDelay(1, customConfig), // 1000 * 3^1 = 3000
        calculateRetryDelay(2, customConfig), // 1000 * 3^2 = 9000
      ];

      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(3000);
      expect(delays[2]).toBe(9000);
    });

    it("should validate configuration values", () => {
      const validateConfig = (config: ReconnectionConfig): boolean => {
        return (
          config.maxRetries > 0 &&
          config.initialDelay > 0 &&
          config.maxDelay > config.initialDelay &&
          config.backoffMultiplier > 1 &&
          config.jitterFactor >= 0 &&
          config.jitterFactor <= 1
        );
      };

      const validConfig: ReconnectionConfig = {
        maxRetries: 5,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitterFactor: 0.2,
      };

      const invalidConfig: ReconnectionConfig = {
        maxRetries: 0, // Invalid!
        initialDelay: 1000,
        maxDelay: 500, // Invalid! Less than initial
        backoffMultiplier: 0.5, // Invalid! Should be > 1
        jitterFactor: 1.5, // Invalid! Should be 0-1
      };

      expect(validateConfig(validConfig)).toBe(true);
      expect(validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle reconnection with zero delay", () => {
      const config: ReconnectionConfig = {
        ...DEFAULT_RECONNECTION_CONFIG,
        initialDelay: 0,
        jitterFactor: 0,
      };

      const delay = calculateRetryDelay(0, config);

      expect(delay).toBe(0);
    });

    it("should handle very large attempt numbers", () => {
      const delay = calculateRetryDelay(100, {
        ...DEFAULT_RECONNECTION_CONFIG,
        maxDelay: 60000,
        jitterFactor: 0,
      });

      // Should be capped at maxDelay
      expect(delay).toBe(60000);
    });

    it("should handle empty event sync", () => {
      const state = createReconnectionState();
      const { synced } = syncMissedEvents(state, []);

      expect(synced).toHaveLength(0);
    });

    it("should handle rapid connect/disconnect cycles", () => {
      let state = createReconnectionState();

      // Simulate rapid cycles
      for (let i = 0; i < 10; i++) {
        state = handleReconnectionAttempt(state);

        if (i % 2 === 0) {
          state = handleReconnectionSuccess(state);
        } else {
          state = handleReconnectionFailure(state, "Temporary failure");
        }
      }

      // State should still be valid
      expect([
        ConnectionState.CONNECTED,
        ConnectionState.DISCONNECTED,
        ConnectionState.FAILED,
      ]).toContain(state.state);
    });
  });
});
