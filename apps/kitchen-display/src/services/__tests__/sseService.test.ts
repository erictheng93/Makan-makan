import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ConnectionStatus, KitchenSSEEvent } from "@/types";

type MessageMock = ReturnType<typeof vi.fn> &
  ((event: KitchenSSEEvent) => void);
type ConnectionChangeMock = ReturnType<typeof vi.fn> &
  ((status: ConnectionStatus) => void);
type ErrorMock = ReturnType<typeof vi.fn> & ((error: Event) => void);

// Mock @makanmakan/utils so isTokenExpired always returns false
// (the test token "test-token-abc" is not a real JWT, so without this mock
//  the service treats it as expired and never creates an EventSource)
vi.mock("@makanmakan/utils", () => ({
  isTokenExpired: vi.fn(() => false),
}));

// ─── MockEventSource ────────────────────────────────────────────────────────

class MockEventSource {
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSED = 2 as const;

  readonly CONNECTING = 0 as const;
  readonly OPEN = 1 as const;
  readonly CLOSED = 2 as const;

  readyState: number = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  url: string;
  withCredentials: boolean;

  private listeners: Record<string, ((...args: any[]) => void)[]> = {};

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (...args: any[]) => void): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (...args: any[]) => void): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }

  // ── Test helpers ──────────────────────────────────────────────

  simulateOpen(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.({} as Event);
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError(): void {
    this.onerror?.({} as Event);
  }

  simulateEvent(type: string, data: unknown): void {
    this.listeners[type]?.forEach((fn) =>
      fn({ data: JSON.stringify(data) } as MessageEvent),
    );
  }

  // Track all instances created during a test
  static instances: MockEventSource[] = [];
  static reset(): void {
    MockEventSource.instances = [];
  }
  static get latest(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe("KitchenSSEService", () => {
  let KitchenSSEService: typeof import("@/services/sseService").KitchenSSEService;
  let createKitchenSSE: typeof import("@/services/sseService").createKitchenSSE;

  let onMessage: MessageMock;
  let onConnectionChange: ConnectionChangeMock;
  let onError: ErrorMock;
  let originalEventSource: typeof globalThis.EventSource;

  beforeEach(async () => {
    vi.useFakeTimers();
    MockEventSource.reset();

    onMessage = vi.fn() as MessageMock;
    onConnectionChange = vi.fn() as ConnectionChangeMock;
    onError = vi.fn() as ErrorMock;

    // Save and replace global EventSource with our mock
    originalEventSource = global.EventSource;
    global.EventSource = MockEventSource as unknown as typeof EventSource;

    // Set up auth token in the global localStorage mock (from tests/setup.ts)
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => {
        if (key === "kitchen_auth_token") return "test-token-abc";
        return null;
      },
    );

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Dynamic import to pick up the mocked global EventSource each time
    // Reset module cache to ensure fresh import with our mock
    vi.resetModules();
    const mod = await import("@/services/sseService");
    KitchenSSEService = mod.KitchenSSEService;
    createKitchenSSE = mod.createKitchenSSE;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.EventSource = originalEventSource;
    vi.restoreAllMocks();
  });

  // Helper to create a service with sensible defaults
  function createService(
    overrides: Partial<import("@/services/sseService").SSEOptions> = {},
  ) {
    return new KitchenSSEService({
      restaurantId: 42,
      onMessage,
      onConnectionChange,
      onError,
      ...overrides,
    });
  }

  // ─── 1. Constructor defaults ────────────────────────────────────────────

  describe("constructor", () => {
    it("should merge user options with defaults", () => {
      const service = new KitchenSSEService({ restaurantId: 99 });
      // The service is created without error; default callbacks are no-ops
      expect(service).toBeInstanceOf(KitchenSSEService);
    });

    it("should accept all optional callbacks and config", () => {
      const service = createService({
        maxReconnectAttempts: 10,
        reconnectInterval: 5000,
      });
      expect(service).toBeInstanceOf(KitchenSSEService);
    });
  });

  // ─── 2-4. connect() ────────────────────────────────────────────────────

  describe("connect()", () => {
    it("should create an EventSource with the correct URL and credentials", () => {
      const service = createService();
      service.connect();

      const es = MockEventSource.latest!;
      expect(es).toBeDefined();
      expect(es.url).toContain("/api/v1/kitchen/42/events");
      expect(es.url).toContain("token=test-token-abc");
      // EventSource is created without explicit options — withCredentials defaults to false
      expect(es.withCredentials).toBe(false);
    });

    it("should call onConnectionChange with 'connecting' immediately", () => {
      const service = createService();
      service.connect();

      expect(onConnectionChange).toHaveBeenCalledWith("connecting");
    });

    it("should warn and return when already connected", () => {
      const service = createService();
      service.connect();

      const es = MockEventSource.latest!;
      es.simulateOpen();

      onConnectionChange.mockClear();
      service.connect(); // second call

      expect(console.warn).toHaveBeenCalledWith(
        "SSE connection already exists",
      );
      // Should NOT have created a second EventSource
      expect(MockEventSource.instances).toHaveLength(1);
    });

    it("should call onError and schedule reconnect when no auth token exists", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const service = createService();
      service.connect();

      // onError should have been called with the thrown error
      expect(onError).toHaveBeenCalled();
      const errorArg = onError.mock.calls[0][0];
      expect(errorArg).toBeInstanceOf(Error);
      expect((errorArg as Error).message).toBe("No authentication token found");
    });

    it("should schedule a reconnect when no auth token exists", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const service = createService({ reconnectInterval: 1000 });
      service.connect();

      // First call: "connecting" from initial connect()
      // scheduleReconnect also calls "connecting"
      expect(onConnectionChange).toHaveBeenCalledWith("connecting");
    });
  });

  // ─── 5. disconnect() ──────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("should close the EventSource and notify disconnected status", () => {
      const service = createService();
      service.connect();
      const es = MockEventSource.latest!;
      es.simulateOpen();

      service.disconnect();

      expect(es.readyState).toBe(MockEventSource.CLOSED);
      expect(onConnectionChange).toHaveBeenCalledWith("disconnected");
    });

    it("should prevent reconnect after disconnect", () => {
      const service = createService({ reconnectInterval: 1000 });
      service.connect();
      const es = MockEventSource.latest!;
      es.simulateOpen();

      service.disconnect();
      onConnectionChange.mockClear();

      // Advance past any potential reconnect timer
      vi.advanceTimersByTime(60000);

      // Should NOT have attempted any reconnect
      expect(MockEventSource.instances).toHaveLength(1);
    });
  });

  // ─── 6-7. getConnectionStatus() ───────────────────────────────────────

  describe("getConnectionStatus()", () => {
    it("should return 'disconnected' when no eventSource exists", () => {
      const service = createService();
      expect(service.getConnectionStatus()).toBe("disconnected");
    });

    it("should return 'connecting' when readyState is CONNECTING", () => {
      const service = createService();
      service.connect();
      // readyState defaults to CONNECTING (0)
      expect(service.getConnectionStatus()).toBe("connecting");
    });

    it("should return 'connected' when readyState is OPEN", () => {
      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();
      expect(service.getConnectionStatus()).toBe("connected");
    });

    it("should return 'disconnected' when readyState is CLOSED", () => {
      const service = createService();
      service.connect();
      MockEventSource.latest!.close();
      expect(service.getConnectionStatus()).toBe("disconnected");
    });
  });

  // ─── 8. onopen event ─────────────────────────────────────────────────

  describe("onopen handler", () => {
    it("should reset reconnectAttempts and update status to connected", () => {
      const service = createService();
      service.connect();
      const es = MockEventSource.latest!;

      es.simulateOpen();

      expect(onConnectionChange).toHaveBeenCalledWith("connected");
      // After open, stats should show 0 reconnect attempts
      const stats = service.getConnectionStats();
      expect(stats.reconnectAttempts).toBe(0);
    });

    it("should update lastHeartbeat on open", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      const stats = service.getConnectionStats();
      expect(stats.lastHeartbeat).toBe(now);
    });
  });

  // ─── 9-11. onmessage handler ──────────────────────────────────────────

  describe("handleMessage (via onmessage)", () => {
    it("should parse JSON and forward non-heartbeat events to onMessage", () => {
      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      const event: KitchenSSEEvent = {
        type: "NEW_ORDER",
        orderId: 1,
        timestamp: "2026-01-01T00:00:00Z",
        restaurantId: 42,
      };

      MockEventSource.latest!.simulateMessage(event);

      expect(onMessage).toHaveBeenCalledWith(event);
    });

    it("should skip HEARTBEAT events and not call onMessage", () => {
      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      const heartbeat: KitchenSSEEvent = {
        type: "HEARTBEAT",
        timestamp: "2026-01-01T00:00:00Z",
        restaurantId: 42,
      };

      MockEventSource.latest!.simulateMessage(heartbeat);

      expect(onMessage).not.toHaveBeenCalled();
    });

    it("should update lastHeartbeat even for HEARTBEAT messages", () => {
      const now = 1700000050000;
      vi.setSystemTime(now);

      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      vi.setSystemTime(now + 5000);

      const heartbeat: KitchenSSEEvent = {
        type: "HEARTBEAT",
        timestamp: "2026-01-01T00:00:00Z",
        restaurantId: 42,
      };
      MockEventSource.latest!.simulateMessage(heartbeat);

      const stats = service.getConnectionStats();
      expect(stats.lastHeartbeat).toBe(now + 5000);
    });

    it("should handle invalid JSON gracefully without throwing", () => {
      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      // Send raw invalid JSON through onmessage
      const es = MockEventSource.latest!;
      es.onmessage?.({ data: "not-json{{{" } as MessageEvent);

      expect(console.error).toHaveBeenCalledWith(
        "Failed to parse SSE message:",
        "not-json{{{",
        expect.any(Error),
      );
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  // ─── 12-13. onerror handler ───────────────────────────────────────────

  describe("onerror handler", () => {
    it("should call onError and trigger reconnect when not manual close", () => {
      const service = createService({ reconnectInterval: 1000 });
      service.connect();
      MockEventSource.latest!.simulateOpen();
      onConnectionChange.mockClear();

      MockEventSource.latest!.simulateError();

      expect(onError).toHaveBeenCalled();
      expect(onConnectionChange).toHaveBeenCalledWith("error");
      // scheduleReconnect calls "connecting"
      expect(onConnectionChange).toHaveBeenCalledWith("connecting");
    });

    it("should not trigger reconnect after manual disconnect", () => {
      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      service.disconnect();

      const instanceCount = MockEventSource.instances.length;
      // Advance past any potential reconnect timer
      vi.advanceTimersByTime(60000);
      expect(MockEventSource.instances).toHaveLength(instanceCount);
    });
  });

  // ─── 14. "heartbeat" named event ─────────────────────────────────────

  describe('"heartbeat" named event', () => {
    it("should update lastHeartbeat when heartbeat event is received", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      vi.setSystemTime(now + 30000);
      MockEventSource.latest!.simulateEvent("heartbeat", {
        timestamp: "2026-01-01T00:00:30Z",
      });

      const stats = service.getConnectionStats();
      expect(stats.lastHeartbeat).toBe(now + 30000);
    });
  });

  // ─── 15. "order-update" named event ──────────────────────────────────

  describe('"order-update" named event', () => {
    it("should parse data and forward to onMessage", () => {
      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      const orderData = {
        type: "ORDER_STATUS_UPDATE",
        orderId: 7,
        payload: { status: "preparing" },
        timestamp: "2026-01-01T00:01:00Z",
        restaurantId: 42,
      };

      MockEventSource.latest!.simulateEvent("order-update", orderData);

      expect(onMessage).toHaveBeenCalledWith(orderData);
    });
  });

  // ─── 16. "test-event" named event ────────────────────────────────────

  describe('"test-event" named event', () => {
    it("should parse data and forward to onMessage", () => {
      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      const testData = {
        type: "NEW_ORDER",
        orderId: 99,
        timestamp: "2026-01-01T00:02:00Z",
        restaurantId: 42,
      };

      MockEventSource.latest!.simulateEvent("test-event", testData);

      expect(onMessage).toHaveBeenCalledWith(testData);
    });
  });

  // ─── 17-18. Heartbeat monitor ────────────────────────────────────────

  describe("heartbeat monitor", () => {
    it("should NOT trigger reconnect when heartbeat is within 90s", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const service = createService({ reconnectInterval: 1000 });
      service.connect();
      MockEventSource.latest!.simulateOpen();
      onConnectionChange.mockClear();

      // Advance 30s - the heartbeat check fires but 30s < 90s threshold
      vi.setSystemTime(now + 30000);
      vi.advanceTimersByTime(30000);

      // No new EventSource should have been created
      expect(MockEventSource.instances).toHaveLength(1);
    });

    it("should trigger reconnect when no heartbeat for >90s", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const service = createService({ reconnectInterval: 1000 });
      service.connect();
      MockEventSource.latest!.simulateOpen();
      onConnectionChange.mockClear();

      // First check at 30s - ok (30s < 90s)
      vi.setSystemTime(now + 30000);
      vi.advanceTimersByTime(30000);
      expect(MockEventSource.instances).toHaveLength(1);

      // Second check at 60s - ok (60s < 90s)
      vi.setSystemTime(now + 60000);
      vi.advanceTimersByTime(30000);
      expect(MockEventSource.instances).toHaveLength(1);

      // Third check at 91s - should trigger reconnect (91s > 90s)
      vi.setSystemTime(now + 91000);
      vi.advanceTimersByTime(30000);

      expect(onConnectionChange).toHaveBeenCalledWith("connecting");
    });
  });

  // ─── 19-22. scheduleReconnect ────────────────────────────────────────

  describe("scheduleReconnect (reconnection logic)", () => {
    it("should use exponential backoff for reconnect delays", () => {
      const service = createService({
        reconnectInterval: 1000,
        maxReconnectAttempts: 5,
      });

      // First connect fails (no token)
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      service.connect();
      onConnectionChange.mockClear();

      // First reconnect: delay = 1000 * 2^0 = 1000ms
      // Restore token so reconnect succeeds in creating EventSource
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        "test-token",
      );
      vi.advanceTimersByTime(999);
      expect(MockEventSource.instances).toHaveLength(0); // Not yet
      vi.advanceTimersByTime(1);
      expect(MockEventSource.instances).toHaveLength(1); // Now connected

      // Trigger another error for second reconnect
      MockEventSource.latest!.simulateError();

      // Second reconnect: delay = 1000 * 2^1 = 2000ms
      const instancesBefore = MockEventSource.instances.length;
      vi.advanceTimersByTime(1999);
      expect(MockEventSource.instances).toHaveLength(instancesBefore);
      vi.advanceTimersByTime(1);
      expect(MockEventSource.instances).toHaveLength(instancesBefore + 1);
    });

    it("should cap reconnect delay at 30000ms", () => {
      const service = createService({
        reconnectInterval: 10000,
        maxReconnectAttempts: 10,
      });

      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      service.connect();

      // First attempt: 10000 * 2^0 = 10000ms
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        "test-token",
      );
      vi.advanceTimersByTime(10000);
      expect(MockEventSource.instances).toHaveLength(1);

      // Second attempt: trigger error -> 10000 * 2^1 = 20000ms
      MockEventSource.latest!.simulateError();
      vi.advanceTimersByTime(20000);
      expect(MockEventSource.instances).toHaveLength(2);

      // Third attempt: trigger error -> 10000 * 2^2 = 40000ms, capped to 30000ms
      MockEventSource.latest!.simulateError();
      const instancesBefore = MockEventSource.instances.length;
      vi.advanceTimersByTime(29999);
      expect(MockEventSource.instances).toHaveLength(instancesBefore);
      vi.advanceTimersByTime(1);
      expect(MockEventSource.instances).toHaveLength(instancesBefore + 1);
    });

    it("should stop reconnecting after max attempts and set error status", () => {
      const service = createService({
        reconnectInterval: 100,
        maxReconnectAttempts: 2,
      });

      // Make connect always fail (no token)
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      service.connect();
      // connect() fails -> scheduleReconnect() -> attempts=1, delay=100ms

      // Attempt 1 fires: connect() fails -> scheduleReconnect() -> attempts=2, delay=200ms
      vi.advanceTimersByTime(100);

      // Attempt 2 fires: connect() fails -> scheduleReconnect() -> attempts=2 >= max=2 -> error
      vi.advanceTimersByTime(200);

      // onConnectionChange should have been called with "error" at some point
      expect(onConnectionChange).toHaveBeenCalledWith("error");

      // Verify no more reconnect attempts happen even with plenty of time
      const instanceCount = MockEventSource.instances.length;
      vi.advanceTimersByTime(60000);
      expect(MockEventSource.instances).toHaveLength(instanceCount);
    });

    it("should not reconnect when disconnect was called manually", () => {
      const service = createService({ reconnectInterval: 100 });
      service.connect();
      MockEventSource.latest!.simulateOpen();

      service.disconnect();

      const instanceCount = MockEventSource.instances.length;
      vi.advanceTimersByTime(60000);

      expect(MockEventSource.instances).toHaveLength(instanceCount);
    });

    it("should reset reconnectAttempts on successful reconnection", () => {
      const service = createService({
        reconnectInterval: 100,
        maxReconnectAttempts: 5,
      });

      service.connect();
      MockEventSource.latest!.simulateOpen();

      // Trigger an error to start reconnect cycle
      MockEventSource.latest!.simulateError();

      // Stats should show 1 reconnect attempt
      expect(service.getConnectionStats().reconnectAttempts).toBe(1);

      // Wait for reconnect timer: delay = 100 * 2^0 = 100ms
      vi.advanceTimersByTime(100);

      // New EventSource is created; simulate successful open
      MockEventSource.latest!.simulateOpen();

      // Attempts should be reset to 0
      expect(service.getConnectionStats().reconnectAttempts).toBe(0);
    });
  });

  // ─── 23. "connected" named event ─────────────────────────────────────

  describe('"connected" named event', () => {
    it("should update lastHeartbeat when connected event is received", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      vi.setSystemTime(now + 10000);
      MockEventSource.latest!.simulateEvent("connected", {
        connectionId: "abc-123",
      });

      const stats = service.getConnectionStats();
      expect(stats.lastHeartbeat).toBe(now + 10000);
    });
  });

  // ─── 24. getConnectionStats() ────────────────────────────────────────

  describe("getConnectionStats()", () => {
    it("should return correct stats when not connected", () => {
      vi.setSystemTime(1700000000000);

      const service = createService();
      const stats = service.getConnectionStats();

      expect(stats).toEqual({
        reconnectAttempts: 0,
        lastHeartbeat: 0,
        isConnected: false,
        timeSinceLastHeartbeat: 1700000000000,
      });
    });

    it("should return correct stats when connected", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const service = createService();
      service.connect();
      MockEventSource.latest!.simulateOpen();

      vi.setSystemTime(now + 5000);

      const stats = service.getConnectionStats();
      expect(stats.reconnectAttempts).toBe(0);
      expect(stats.lastHeartbeat).toBe(now);
      expect(stats.isConnected).toBe(true);
      expect(stats.timeSinceLastHeartbeat).toBe(5000);
    });

    it("should reflect reconnect attempts in stats", () => {
      const service = createService({
        reconnectInterval: 100,
        maxReconnectAttempts: 5,
      });
      service.connect();
      MockEventSource.latest!.simulateOpen();

      // Trigger an error to increment reconnect counter
      MockEventSource.latest!.simulateError();

      expect(service.getConnectionStats().reconnectAttempts).toBe(1);
    });
  });

  // ─── 25. createKitchenSSE factory ────────────────────────────────────

  describe("createKitchenSSE()", () => {
    it("should return an instance of KitchenSSEService", () => {
      const service = createKitchenSSE({
        restaurantId: 7,
        onMessage,
        onConnectionChange,
        onError,
      });

      expect(service).toBeInstanceOf(KitchenSSEService);
    });

    it("should create a functional service that can connect", () => {
      const service = createKitchenSSE({ restaurantId: 7 });
      service.connect();

      const es = MockEventSource.latest!;
      expect(es.url).toContain("/api/v1/kitchen/7/events");
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle connect being called in CONNECTING state (not closed)", () => {
      const service = createService();
      service.connect();

      // EventSource is in CONNECTING state (default) - not CLOSED
      service.connect();

      expect(console.warn).toHaveBeenCalledWith(
        "SSE connection already exists",
      );
      expect(MockEventSource.instances).toHaveLength(1);
    });

    it("should clean up previous heartbeat monitor on new connect", () => {
      const now = 1700000000000;
      vi.setSystemTime(now);

      const service = createService({ reconnectInterval: 100 });
      service.connect();
      MockEventSource.latest!.simulateOpen();

      // Trigger error to reconnect
      MockEventSource.latest!.simulateError();
      vi.advanceTimersByTime(100);

      // New connection opens; old heartbeat monitor should be cleaned up
      MockEventSource.latest!.simulateOpen();

      // The heartbeat monitor should be fresh - no stale timers
      vi.setSystemTime(now + 30000);
      vi.advanceTimersByTime(30000);

      // timeSinceLastHeartbeat from the new connection should be ~30s, not > 90s
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);
    });

    it("should close eventSource during cleanup", () => {
      const service = createService();
      service.connect();
      const es = MockEventSource.latest!;
      es.simulateOpen();

      expect(es.readyState).toBe(MockEventSource.OPEN);

      service.disconnect();

      expect(es.readyState).toBe(MockEventSource.CLOSED);
    });
  });
});
