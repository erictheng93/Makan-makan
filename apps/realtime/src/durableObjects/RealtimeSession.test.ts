import { describe, expect, it, vi } from "vitest";
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

function createDb(results: unknown[] = []) {
  const first = vi.fn(async () => results.shift() ?? null);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    DB: { prepare } as unknown as D1Database,
    prepare,
    bind,
    first,
  };
}

function createSocket(overrides: Record<string, unknown> = {}) {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    ...overrides,
  } as unknown as WebSocket & {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: "conn-1",
    type: "customer",
    roomId: "table-1",
    connectedAt: Date.now(),
    lastActivity: Date.now(),
    auth: {
      role: "customer",
      roomType: "customer",
      roomId: "table-1",
      restaurantId: "restaurant-1",
      tableId: 7,
    },
    ...overrides,
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

describe("RealtimeSession message, routing, and validation behavior", () => {
  it("responds to ping messages and reports invalid or malformed client messages", async () => {
    const session = new RealtimeSession(createEnv());
    const socket = createSocket();
    const info = connection();

    await (session as any).handleMessage(
      socket,
      JSON.stringify({ type: "ping", timestamp: Date.now() }),
      info,
    );
    await (session as any).handleMessage(
      socket,
      JSON.stringify({ type: "subscribe", channel: "" }),
      info,
    );
    await (session as any).handleMessage(socket, "not-json", info);

    const sent = socket.send.mock.calls.map(([payload]) => JSON.parse(payload));
    expect(sent[0]).toMatchObject({
      type: RealtimeEventType.HEARTBEAT,
      restaurantId: "restaurant-1",
      data: { serverTime: expect.any(Number) },
    });
    expect(sent[1]).toMatchObject({
      type: RealtimeEventType.ERROR,
      data: {
        code: "INVALID_MESSAGE",
        message: expect.stringContaining("channel"),
      },
    });
    expect(sent[2]).toMatchObject({
      type: RealtimeEventType.ERROR,
      data: {
        code: "MESSAGE_PARSE_ERROR",
        message: "Failed to parse message",
      },
    });
    expect(info.lastActivity).toEqual(expect.any(Number));
  });

  it("routes broadcast events by restaurant, role, event type, and socket readiness", async () => {
    const session = new RealtimeSession(createEnv());
    const customer = createSocket();
    const staff = createSocket();
    const admin = createSocket();
    const closed = createSocket({ readyState: WebSocket.CLOSED });
    const otherRestaurant = createSocket();

    (session as any).connections.set(customer, connection());
    (session as any).connections.set(
      staff,
      connection({
        id: "staff-1",
        type: "kitchen",
        auth: {
          role: "staff",
          restaurantId: "restaurant-1",
          roomType: "kitchen",
          roomId: "restaurant-1",
        },
      }),
    );
    (session as any).connections.set(
      admin,
      connection({
        id: "admin-1",
        type: "admin",
        auth: {
          role: "admin",
          restaurantId: "restaurant-1",
          roomType: "admin",
          roomId: "restaurant-1",
        },
      }),
    );
    (session as any).connections.set(closed, connection({ id: "closed-1" }));
    (session as any).connections.set(
      otherRestaurant,
      connection({
        id: "other-1",
        auth: { role: "admin", restaurantId: "restaurant-2" },
      }),
    );

    const kitchenEvent = event("kitchen-1") as any;
    kitchenEvent.type = RealtimeEventType.KITCHEN_QUEUE_UPDATE;
    const kitchenCount = (session as any).routeEvent(kitchenEvent);

    expect(kitchenCount).toBe(2);
    expect(customer.send).not.toHaveBeenCalled();
    expect(staff.send).toHaveBeenCalledWith(JSON.stringify(kitchenEvent));
    expect(admin.send).toHaveBeenCalledWith(JSON.stringify(kitchenEvent));
    expect(closed.send).not.toHaveBeenCalled();
    expect(otherRestaurant.send).not.toHaveBeenCalled();
    expect((session as any).connections.get(staff).lastEventId).toBe(
      "kitchen-1",
    );

    const heartbeat = event("heartbeat-1") as any;
    heartbeat.type = RealtimeEventType.HEARTBEAT;
    expect((session as any).routeEvent(heartbeat)).toBe(0);
  });

  it("keeps event history bounded and returns all events when a cursor is unknown", async () => {
    const session = new RealtimeSession(createEnv());
    const now = Date.now();

    for (let index = 0; index < 105; index++) {
      (session as any).addToEventHistory(event(`evt-${index}`, now));
    }
    (session as any).addToEventHistory(event("too-old", now - 90_000_000));

    expect((session as any).eventHistory).toHaveLength(99);
    expect((session as any).eventHistory[0].eventId).toBe("evt-6");
    expect(
      (session as any).eventHistory.some(
        (item: { eventId: string }) => item.eventId === "too-old",
      ),
    ).toBe(false);

    const response = await session.fetch(
      new Request("https://do.test/history?since=missing"),
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      count: 99,
      note: "Event ID not found, returning all available events",
    });
  });

  it("handles malformed broadcast request bodies as failed broadcasts", async () => {
    const session = new RealtimeSession(createEnv());
    const response = await session.fetch(
      new Request("https://do.test/broadcast", {
        method: "POST",
        body: "{bad-json",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Failed to broadcast event",
    });
  });

  it("reports active connection stats with ISO timestamps and last event IDs", async () => {
    const session = new RealtimeSession(createEnv());
    const socket = createSocket();
    (session as any).roomInfo = { type: "kitchen", id: "restaurant-1" };
    (session as any).connections.set(
      socket,
      connection({
        id: "staff-1",
        type: "kitchen",
        connectedAt: Date.parse("2026-06-07T00:00:00.000Z"),
        lastActivity: Date.parse("2026-06-07T00:01:00.000Z"),
        lastEventId: "evt-1",
        auth: {
          role: "staff",
          restaurantId: "restaurant-1",
          roomType: "kitchen",
          roomId: "restaurant-1",
        },
      }),
    );

    const response = await session.fetch(new Request("https://do.test/stats"));

    await expect(response.json()).resolves.toMatchObject({
      roomInfo: { type: "kitchen", id: "restaurant-1" },
      connectionCount: 1,
      connections: [
        {
          id: "staff-1",
          type: "kitchen",
          role: "staff",
          connectedAt: "2026-06-07T00:00:00.000Z",
          lastActivity: "2026-06-07T00:01:00.000Z",
          lastEventId: "evt-1",
        },
      ],
      eventHistorySize: 0,
    });
  });

  it("validates role-room access rules", () => {
    const session = new RealtimeSession(createEnv());

    expect(
      (session as any).validateRoleRoomAccess("customer", "customer"),
    ).toEqual({ valid: true });
    expect((session as any).validateRoleRoomAccess("staff", "admin")).toEqual({
      valid: false,
      error: 'Role "staff" is not authorized to access "admin" rooms',
    });
    expect(
      (session as any).validateRoleRoomAccess("admin", "restaurant"),
    ).toEqual({ valid: true });
  });

  it("validates restaurant access for active users, platform admins, and failures", async () => {
    const regularDb = createDb([{ restaurant_id: "restaurant-1", role: 2 }]);
    const regularSession = new RealtimeSession({
      ...createEnv(),
      DB: regularDb.DB,
    });
    await expect(
      (regularSession as any).validateRestaurantAccess({
        userId: "10",
        restaurantId: "restaurant-1",
        role: "staff",
      }),
    ).resolves.toEqual({ valid: true });

    const mismatchDb = createDb([{ restaurant_id: "restaurant-2", role: 2 }]);
    const mismatchSession = new RealtimeSession({
      ...createEnv(),
      DB: mismatchDb.DB,
    });
    await expect(
      (mismatchSession as any).validateRestaurantAccess({
        userId: "10",
        restaurantId: "restaurant-1",
        role: "staff",
      }),
    ).resolves.toEqual({
      valid: false,
      error: "User does not belong to this restaurant",
    });

    const adminDb = createDb([{ restaurant_id: null, role: 0 }]);
    const adminSession = new RealtimeSession({
      ...createEnv(),
      DB: adminDb.DB,
    });
    await expect(
      (adminSession as any).validateRestaurantAccess({
        userId: "1",
        restaurantId: "restaurant-any",
        role: "admin",
      }),
    ).resolves.toEqual({ valid: true });

    const missingSession = new RealtimeSession(createEnv());
    await expect(
      (missingSession as any).validateRestaurantAccess({
        restaurantId: "restaurant-1",
        role: "staff",
      }),
    ).resolves.toEqual({
      valid: false,
      error: "User ID is required for staff/admin access",
    });
  });

  it("validates table and seat access including mismatch and DB error paths", async () => {
    const okDb = createDb([
      { id: 7, restaurant_id: "restaurant-1" },
      { id: 3, table_id: 7 },
    ]);
    const okSession = new RealtimeSession({ ...createEnv(), DB: okDb.DB });
    await expect(
      (okSession as any).validateTableAccess({
        restaurantId: "restaurant-1",
        tableId: 7,
        seatId: 3,
      }),
    ).resolves.toEqual({ valid: true });

    const mismatchDb = createDb([{ id: 7, restaurant_id: "restaurant-2" }]);
    const mismatchSession = new RealtimeSession({
      ...createEnv(),
      DB: mismatchDb.DB,
    });
    await expect(
      (mismatchSession as any).validateTableAccess({
        restaurantId: "restaurant-1",
        tableId: 7,
      }),
    ).resolves.toEqual({
      valid: false,
      error: "Table does not belong to this restaurant",
    });

    const seatMismatchDb = createDb([
      { id: 7, restaurant_id: "restaurant-1" },
      { id: 3, table_id: 8 },
    ]);
    const seatMismatchSession = new RealtimeSession({
      ...createEnv(),
      DB: seatMismatchDb.DB,
    });
    await expect(
      (seatMismatchSession as any).validateTableAccess({
        restaurantId: "restaurant-1",
        tableId: 7,
        seatId: 3,
      }),
    ).resolves.toEqual({
      valid: false,
      error: "Seat does not belong to this table",
    });

    const errorDb = {
      prepare: vi.fn(() => {
        throw new Error("d1 offline");
      }),
    };
    const errorSession = new RealtimeSession({
      ...createEnv(),
      DB: errorDb as unknown as D1Database,
    });
    await expect(
      (errorSession as any).validateTableAccess({
        restaurantId: "restaurant-1",
        tableId: 7,
      }),
    ).resolves.toEqual({
      valid: false,
      error: "Failed to validate table access",
    });
  });

  it("cleans up inactive connections and expired history through alarm", async () => {
    const session = new RealtimeSession(createEnv());
    const staleSocket = createSocket();
    const activeSocket = createSocket();
    const now = Date.now();
    (session as any).connections.set(
      staleSocket,
      connection({ id: "stale", lastActivity: now - 31 * 60 * 1000 }),
    );
    (session as any).connections.set(
      activeSocket,
      connection({ id: "active", lastActivity: now }),
    );
    (session as any).eventHistory = [
      event("fresh", now),
      event("old", now - 90_000_000),
    ];

    await session.alarm();

    expect(staleSocket.close).toHaveBeenCalled();
    expect((session as any).connections.has(staleSocket)).toBe(false);
    expect((session as any).connections.has(activeSocket)).toBe(true);
    expect(
      (session as any).eventHistory.map((item: any) => item.eventId),
    ).toEqual(["fresh"]);
  });
});
