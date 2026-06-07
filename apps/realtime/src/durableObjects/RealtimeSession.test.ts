import { describe, expect, it } from "vitest";
import { RealtimeEventType } from "@makanmakan/shared-types";
import { RealtimeSession } from "./RealtimeSession";
import type { Env } from "../types/env";

function createEnv(): Env {
  return {
    ENVIRONMENT: "test",
    API_VERSION: "1",
    JWT_SECRET: "secret",
    RATE_LIMIT_ENABLED: "false",
    REALTIME_SESSION: {} as DurableObjectNamespace,
    RATE_LIMIT_KV: {} as KVNamespace,
    CACHE_KV: {} as KVNamespace,
    TOKEN_BLACKLIST: {} as KVNamespace,
    DB: {} as D1Database,
  };
}

function event(id: string, timestamp = Date.now()) {
  return {
    type: RealtimeEventType.NEW_ORDER,
    eventId: id,
    timestamp,
    restaurantId: "restaurant-1",
    data: {
      orderId: 1001,
    },
  };
}

describe("RealtimeSession HTTP endpoints", () => {
  it("rejects malformed broadcast events", async () => {
    const session = new RealtimeSession(createEnv());
    const response = await session.fetch(
      new Request("https://do.test/broadcast", {
        method: "POST",
        body: JSON.stringify({ type: RealtimeEventType.NEW_ORDER }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Invalid event format",
    });
  });

  it("records valid broadcast events and exposes history", async () => {
    const session = new RealtimeSession(createEnv());

    const broadcast = await session.fetch(
      new Request("https://do.test/broadcast", {
        method: "POST",
        body: JSON.stringify(event("evt-1")),
      }),
    );
    expect(broadcast.status).toBe(200);
    await expect(broadcast.json()).resolves.toMatchObject({
      success: true,
      eventId: "evt-1",
      recipientCount: 0,
    });

    const history = await session.fetch(new Request("https://do.test/history"));
    expect(history.status).toBe(200);
    await expect(history.json()).resolves.toMatchObject({
      success: true,
      count: 1,
      events: [expect.objectContaining({ eventId: "evt-1" })],
    });
  });

  it("returns only missed events when a history cursor is known", async () => {
    const session = new RealtimeSession(createEnv());
    for (const id of ["evt-1", "evt-2", "evt-3"]) {
      await session.fetch(
        new Request("https://do.test/broadcast", {
          method: "POST",
          body: JSON.stringify(event(id)),
        }),
      );
    }

    const response = await session.fetch(
      new Request("https://do.test/history?since=evt-1"),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      events: Array<{ eventId: string }>;
    };
    expect(body.events.map((item) => item.eventId)).toEqual(["evt-2", "evt-3"]);
  });

  it("reports stats for rooms without active websocket connections", async () => {
    const session = new RealtimeSession(createEnv());
    await session.fetch(
      new Request("https://do.test/broadcast", {
        method: "POST",
        body: JSON.stringify(event("evt-1")),
      }),
    );

    const response = await session.fetch(new Request("https://do.test/stats"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      roomInfo: null,
      connectionCount: 0,
      connections: [],
      eventHistorySize: 1,
    });
  });
});
