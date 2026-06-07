import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdvancedRealtimeSession } from "./advanced-realtime-session";
import type { Env } from "./types";

function createState() {
  const values = new Map<string, unknown>();

  return {
    storage: {
      list: vi.fn(async ({ prefix }: { prefix?: string } = {}) => {
        return new Map(
          Array.from(values.entries()).filter(([key]) =>
            prefix ? key.startsWith(prefix) : true,
          ),
        );
      }),
      put: vi.fn(async (key: string, value: unknown) => {
        values.set(key, value);
      }),
      get: vi.fn(async (key: string) => values.get(key)),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    },
    blockConcurrencyWhile: vi.fn((callback: () => Promise<void>) => callback()),
  } as unknown as DurableObjectState;
}

function createEnv(): Env {
  return {
    REALTIME_SESSION: {
      idFromName: vi.fn((name: string) => ({ name })),
      get: vi.fn(() => ({
        fetch: vi.fn(async () => new Response("OK")),
      })),
    } as unknown as DurableObjectNamespace,
  };
}

describe("AdvancedRealtimeSession HTTP endpoints", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("reports health for an empty session", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());

    const response = await session.fetch(new Request("https://do.test/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      healthy: true,
      connections: 0,
      orders: 0,
      uptime: 0,
    });
  });

  it("returns state counters without exposing socket details", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());

    const response = await session.fetch(new Request("https://do.test/state"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      activeConnections: 0,
      orderStates: 0,
      lastActivity: Date.now(),
    });
  });

  it("accepts cross-object broadcast calls", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());

    const response = await session.fetch(
      new Request("https://do.test/broadcast", {
        method: "POST",
        body: JSON.stringify({ type: "order_state_change" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("OK");
  });

  it("hibernates inactive sessions and persists hibernation metadata", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());

    const response = await session.fetch(
      new Request("https://do.test/hibernate", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      hibernated: true,
      timestamp: Date.now(),
    });
    expect(state.storage.put).toHaveBeenCalledWith(
      "hibernation_state",
      expect.objectContaining({
        hibernatedAt: Date.now(),
        activeConnectionsCount: 0,
        orderStatesCount: 0,
        totalMessages: 0,
      }),
    );
  });

  it("rejects hibernation requests that are not POST", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());

    const response = await session.fetch(
      new Request("https://do.test/hibernate"),
    );

    expect(response.status).toBe(405);
    await expect(response.text()).resolves.toBe("Method not allowed");
  });

  it("returns 404 for unknown advanced session endpoints", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());

    const response = await session.fetch(new Request("https://do.test/nope"));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not Found");
  });
});
