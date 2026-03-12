/**
 * Tests for SSEConnectionPool
 * Tests connection management, stats, and cleanup logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SSEConnectionPool } from "../services/sseConnectionPool";

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  withCredentials: boolean;

  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);

    // Simulate async connection open
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 0);
  }

  addEventListener(type: string, listener: (...args: unknown[]) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (...args: unknown[]) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = 2;
  }

  // Test helper: trigger error
  triggerError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  // Test helper: trigger message
  triggerMessage(data: string, type = "message") {
    const event = new MessageEvent(type, { data });
    if (type === "message" && this.onmessage) {
      this.onmessage(event);
    }
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach((fn) => fn(event));
    }
  }
}

// Stub globals
vi.stubGlobal("EventSource", MockEventSource);

describe("SSEConnectionPool", () => {
  let pool: SSEConnectionPool;

  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    pool = new SSEConnectionPool(5, {
      heartbeat: { enabled: false },
      autoReconnect: false,
    });
  });

  afterEach(() => {
    pool.dispose();
    vi.useRealTimers();
  });

  describe("connect", () => {
    it("creates a new connection", async () => {
      const connectPromise = pool.connect("test-1", {
        url: "http://localhost:8787/api/v1/sse/test",
      });

      // Flush the setTimeout in MockEventSource constructor
      vi.advanceTimersByTime(1);

      const connection = await connectPromise;
      expect(connection.id).toBe("test-1");
      expect(connection.status).toBe("connected");
      expect(MockEventSource.instances).toHaveLength(1);
    });

    it("throws when connection id already exists", async () => {
      const p = pool.connect("dup", {
        url: "http://localhost:8787/sse/1",
      });
      vi.advanceTimersByTime(1);
      await p;

      await expect(
        pool.connect("dup", { url: "http://localhost:8787/sse/2" }),
      ).rejects.toThrow('Connection with id "dup" already exists');
    });

    it("throws when max connections reached", async () => {
      // Create 5 connections (the max)
      for (let i = 0; i < 5; i++) {
        const p = pool.connect(`conn-${i}`, {
          url: `http://localhost:8787/sse/${i}`,
        });
        vi.advanceTimersByTime(1);
        await p;
      }

      await expect(
        pool.connect("conn-6", { url: "http://localhost:8787/sse/6" }),
      ).rejects.toThrow("Maximum connections limit (5) reached");
    });
  });

  describe("disconnect", () => {
    it("disconnects and removes a connection", async () => {
      const p = pool.connect("to-remove", {
        url: "http://localhost:8787/sse/1",
      });
      vi.advanceTimersByTime(1);
      await p;

      pool.disconnect("to-remove");

      expect(pool.getConnection("to-remove")).toBeNull();
    });

    it("silently handles disconnecting non-existent connection", () => {
      expect(() => pool.disconnect("nonexistent")).not.toThrow();
    });
  });

  describe("disconnectAll", () => {
    it("disconnects all connections", async () => {
      const p1 = pool.connect("a", {
        url: "http://localhost:8787/sse/a",
      });
      vi.advanceTimersByTime(1);
      await p1;

      const p2 = pool.connect("b", {
        url: "http://localhost:8787/sse/b",
      });
      vi.advanceTimersByTime(1);
      await p2;

      pool.disconnectAll();

      expect(pool.getAllConnections()).toHaveLength(0);
    });
  });

  describe("getConnection", () => {
    it("returns connection by id", async () => {
      const p = pool.connect("findme", {
        url: "http://localhost:8787/sse/find",
      });
      vi.advanceTimersByTime(1);
      await p;

      const conn = pool.getConnection("findme");
      expect(conn).not.toBeNull();
      expect(conn!.id).toBe("findme");
    });

    it("returns null for unknown id", () => {
      expect(pool.getConnection("unknown")).toBeNull();
    });
  });

  describe("getAllConnections", () => {
    it("returns all active connections", async () => {
      const p1 = pool.connect("x", {
        url: "http://localhost:8787/sse/x",
      });
      vi.advanceTimersByTime(1);
      await p1;

      const p2 = pool.connect("y", {
        url: "http://localhost:8787/sse/y",
      });
      vi.advanceTimersByTime(1);
      await p2;

      const all = pool.getAllConnections();
      expect(all).toHaveLength(2);
    });
  });

  describe("addEventListener / removeEventListener", () => {
    it("adds event listener to connection", async () => {
      const p = pool.connect("events", {
        url: "http://localhost:8787/sse/events",
      });
      vi.advanceTimersByTime(1);
      await p;

      const listener = vi.fn();
      pool.addEventListener("events", "message", listener);

      // Verify listener was added (no throw)
      expect(() =>
        pool.removeEventListener("events", "message", listener),
      ).not.toThrow();
    });

    it("throws when adding listener to non-existent connection", () => {
      expect(() => pool.addEventListener("ghost", "message", vi.fn())).toThrow(
        'Connection "ghost" not found',
      );
    });

    it("silently handles removing listener from non-existent connection", () => {
      expect(() =>
        pool.removeEventListener("ghost", "message", vi.fn()),
      ).not.toThrow();
    });
  });

  describe("getStats", () => {
    it("returns pool statistics", async () => {
      const stats = pool.getStats();
      expect(stats).toHaveProperty("totalConnections");
      expect(stats).toHaveProperty("activeConnections");
      expect(stats).toHaveProperty("failedConnections");
      expect(stats).toHaveProperty("totalMessagesReceived");
      expect(stats).toHaveProperty("uptime");
    });

    it("tracks total connections", async () => {
      const p = pool.connect("stats-test", {
        url: "http://localhost:8787/sse/stats",
      });
      vi.advanceTimersByTime(1);
      await p;

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
    });
  });

  describe("on / off (event bus)", () => {
    it("subscribes and unsubscribes from pool events", () => {
      const listener = vi.fn();
      pool.on("connection", listener);
      pool.off("connection", listener);
      // No throw means it works
    });
  });

  describe("buildUrl (via connect)", () => {
    it("passes authorization header as token query param", async () => {
      const p = pool.connect("auth", {
        url: "http://localhost:8787/sse/auth",
        headers: { Authorization: "Bearer my-jwt-token" },
      });
      vi.advanceTimersByTime(1);
      await p;

      const eventSource = MockEventSource.instances.find((es) =>
        es.url.includes("auth"),
      );
      expect(eventSource).toBeDefined();
      expect(eventSource!.url).toContain("token=my-jwt-token");
    });
  });
});
