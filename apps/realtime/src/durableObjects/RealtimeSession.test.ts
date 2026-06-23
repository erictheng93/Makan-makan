import { describe, expect, it, vi } from "vitest";
import { sign } from "jsonwebtoken";
import { RealtimeEventType } from "@makanmakan/shared-types";
import { RealtimeSession } from "./RealtimeSession";
import type { Env } from "../types/env";

const jwtSecret = "0123456789abcdefghijklmnopqrstuvwxyz";

function createEnv(): Env {
  return {
    ENVIRONMENT: "test",
    API_VERSION: "1",
    JWT_SECRET: "secret",
    REALTIME_JWT_SECRET: jwtSecret,
    RATE_LIMIT_ENABLED: "false",
    REALTIME_SESSION: {} as DurableObjectNamespace,
    RATE_LIMIT_KV: {} as KVNamespace,
    CACHE_KV: {} as KVNamespace,
    TOKEN_BLACKLIST: {} as KVNamespace,
    DB: {} as D1Database,
  };
}

function createState(): DurableObjectState {
  return {} as DurableObjectState;
}

function createSession(env: Env = createEnv()): RealtimeSession {
  return new RealtimeSession(createState(), env);
}

function createAuthEnv(overrides: Partial<Env> = {}): Env {
  return {
    ...createEnv(),
    JWT_SECRET: jwtSecret,
    REALTIME_JWT_SECRET: jwtSecret,
    TOKEN_BLACKLIST: undefined as unknown as KVNamespace,
    ...overrides,
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

function tokenFor(payload: Record<string, unknown>) {
  return sign(
    {
      roomType: "admin",
      roomId: "restaurant-1",
      restaurantId: "restaurant-1",
      role: "admin",
      ...payload,
    },
    jwtSecret,
    { expiresIn: "1h" },
  );
}

describe("RealtimeSession HTTP endpoints", () => {
  it("returns 404 for unknown HTTP endpoints", async () => {
    const session = createSession(createEnv());

    const response = await session.fetch(new Request("https://do.test/nope"));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not found");
  });

  it("rejects malformed broadcast events", async () => {
    const session = createSession(createEnv());
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
    const session = createSession(createEnv());

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
    const session = createSession(createEnv());
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
    const session = createSession(createEnv());
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
    const session = createSession(createEnv());
    const socket = createSocket();
    const info = connection();

    await (session as any).handleMessage(
      socket,
      JSON.stringify({ type: "ping", timestamp: Date.now() }),
      info,
    );
    await (session as any).handleMessage(
      socket,
      JSON.stringify({ type: "subscribe", channel: "orders" }),
      info,
    );
    await (session as any).handleMessage(
      socket,
      JSON.stringify({ type: "unsubscribe", channel: "orders" }),
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

  it("rejects websocket upgrades with missing room parameters or tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const session = createSession(createAuthEnv());

      const missingRoom = await session.fetch(
        new Request("https://do.test/admin", {
          headers: { Upgrade: "websocket" },
        }),
      );
      expect(missingRoom.status).toBe(400);
      await expect(missingRoom.text()).resolves.toBe("Invalid room parameters");

      const missingToken = await session.fetch(
        new Request("https://do.test/admin/restaurant-1", {
          headers: { Upgrade: "websocket" },
        }),
      );
      expect(missingToken.status).toBe(401);
      await expect(missingToken.text()).resolves.toBe(
        "Unauthorized: Token required",
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects websocket upgrades for invalid token and room claims", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const invalidToken = await createSession(createAuthEnv()).fetch(
        new Request("https://do.test/admin/restaurant-1?token=not-a-jwt", {
          headers: { Upgrade: "websocket" },
        }),
      );
      expect(invalidToken.status).toBe(401);
      await expect(invalidToken.text()).resolves.toBe(
        "Unauthorized: Invalid token format",
      );

      const roomMismatch = await createSession(createAuthEnv()).fetch(
        new Request(
          `https://do.test/admin/restaurant-1?token=${tokenFor({
            roomId: "restaurant-2",
          })}`,
          { headers: { Upgrade: "websocket" } },
        ),
      );
      expect(roomMismatch.status).toBe(403);
      await expect(roomMismatch.text()).resolves.toBe(
        "Forbidden: Room ID does not match token",
      );

      const typeMismatch = await createSession(createAuthEnv()).fetch(
        new Request(
          `https://do.test/admin/restaurant-1?token=${tokenFor({
            roomType: "kitchen",
          })}`,
          { headers: { Upgrade: "websocket" } },
        ),
      );
      expect(typeMismatch.status).toBe(403);
      await expect(typeMismatch.text()).resolves.toBe(
        "Forbidden: Room type does not match token",
      );

      const roleRoomMismatch = await createSession(createAuthEnv()).fetch(
        new Request(
          `https://do.test/admin/restaurant-1?token=${tokenFor({
            role: "staff",
          })}`,
          { headers: { Upgrade: "websocket" } },
        ),
      );
      expect(roleRoomMismatch.status).toBe(403);
      await expect(roleRoomMismatch.text()).resolves.toContain(
        'Role "staff" is not authorized',
      );
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it("rejects websocket upgrades when restaurant or table access fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const staffDb = createDb([{ restaurant_id: "restaurant-2", role: 2 }]);
      const staffDenied = await createSession(
        createAuthEnv({ DB: staffDb.DB }),
      ).fetch(
        new Request(
          `https://do.test/kitchen/restaurant-1?token=${tokenFor({
            roomType: "kitchen",
            role: "staff",
            userId: "10",
          })}`,
          { headers: { Upgrade: "websocket" } },
        ),
      );
      expect(staffDenied.status).toBe(403);
      await expect(staffDenied.text()).resolves.toBe(
        "Forbidden: User does not belong to this restaurant",
      );

      const tableDb = createDb([{ id: 7, restaurant_id: "restaurant-2" }]);
      const tableDenied = await createSession(
        createAuthEnv({ DB: tableDb.DB }),
      ).fetch(
        new Request(
          `https://do.test/customer/table-7?token=${tokenFor({
            roomType: "customer",
            roomId: "table-7",
            role: "customer",
            tableId: 7,
          })}`,
          { headers: { Upgrade: "websocket" } },
        ),
      );
      expect(tableDenied.status).toBe(403);
      await expect(tableDenied.text()).resolves.toBe(
        "Forbidden: Table does not belong to this restaurant",
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("sets up authenticated websocket connections before 101 responses fail in node", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = createSocket();
    const server = createSocket({
      accept: vi.fn(),
      addEventListener: vi.fn(),
    });
    vi.stubGlobal("WebSocketPair", function WebSocketPair() {
      return { 0: client, 1: server };
    });
    try {
      const db = createDb([{ restaurant_id: null, role: 0 }]);
      const session = createSession(createAuthEnv({ DB: db.DB }));

      await expect(
        session.fetch(
          new Request(
            `https://do.test/admin/restaurant-1?token=${tokenFor({
              userId: "1",
            })}`,
            { headers: { Upgrade: "websocket" } },
          ),
        ),
      ).rejects.toThrow('init["status"] must be in the range');

      expect(server.accept).toHaveBeenCalled();
      expect(server.addEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function),
      );
      expect((session as any).roomInfo).toEqual({
        type: "admin",
        id: "restaurant-1",
      });
      expect((session as any).connections.get(server)).toMatchObject({
        type: "admin",
        roomId: "restaurant-1",
        auth: expect.objectContaining({
          userId: "1",
          role: "admin",
        }),
      });
      expect(server.send).toHaveBeenCalledWith(
        expect.stringContaining(RealtimeEventType.CONNECTION_ACK),
      );
    } finally {
      warn.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("sets guest websocket room metadata and preserves existing room info", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const pairs = [
      [
        createSocket(),
        createSocket({ accept: vi.fn(), addEventListener: vi.fn() }),
      ],
      [
        createSocket(),
        createSocket({ accept: vi.fn(), addEventListener: vi.fn() }),
      ],
    ];
    vi.stubGlobal("WebSocketPair", function WebSocketPair() {
      const [client, server] = pairs.shift()!;
      return { 0: client, 1: server };
    });
    try {
      const db = createDb([
        { id: 7, restaurant_id: "restaurant-1" },
        { id: 7, restaurant_id: "restaurant-1" },
      ]);
      const session = createSession(
        createAuthEnv({
          DB: db.DB,
          REALTIME_JWT_SECRET: jwtSecret,
        }),
      );
      const guestToken = tokenFor({
        roomType: "customer",
        roomId: "customer:7",
        role: "customer",
        guestFlag: true,
        tableId: 7,
      });

      await expect(
        session.fetch(
          new Request(`https://do.test/customer/7?token=${guestToken}`, {
            headers: { Upgrade: "websocket" },
          }),
        ),
      ).rejects.toThrow('init["status"] must be in the range');
      await expect(
        session.fetch(
          new Request(`https://do.test/customer/7?token=${guestToken}`, {
            headers: { Upgrade: "websocket" },
          }),
        ),
      ).rejects.toThrow('init["status"] must be in the range');

      expect((session as any).roomInfo).toEqual({
        type: "customer",
        id: "7",
      });
      expect((session as any).connections.size).toBe(2);
      expect((session as any).connections.get(pairs[0]?.[1])).toBeUndefined();
    } finally {
      warn.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("accepts scoped guest order websocket rooms with public order ids", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const publicId = "018f0000-0000-7000-8000-000000000042";
    const client = createSocket();
    const server = createSocket({
      accept: vi.fn(),
      addEventListener: vi.fn(),
    });
    vi.stubGlobal("WebSocketPair", function WebSocketPair() {
      return { 0: client, 1: server };
    });
    try {
      const session = createSession(createAuthEnv());
      const guestToken = tokenFor({
        roomType: "customer",
        roomId: `order:${publicId}`,
        role: "customer",
        guestFlag: true,
        scope: "guest-realtime",
        orderId: publicId,
      });

      await expect(
        session.fetch(
          new Request(
            `https://do.test/customer/order:${publicId}?token=${guestToken}`,
            { headers: { Upgrade: "websocket" } },
          ),
        ),
      ).rejects.toThrow('init["status"] must be in the range');

      expect((session as any).roomInfo).toEqual({
        type: "customer",
        id: `order:${publicId}`,
      });
      expect((session as any).connections.get(server)).toMatchObject({
        type: "customer",
        roomId: `order:${publicId}`,
        auth: expect.objectContaining({
          scope: "guest-realtime",
          orderId: publicId,
        }),
      });
    } finally {
      warn.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("covers event routing decisions for roles and event families", () => {
    const session = createSession(createEnv());
    const customer = connection();
    const staff = connection({
      auth: {
        role: "staff",
        restaurantId: "restaurant-1",
        roomType: "kitchen",
        roomId: "restaurant-1",
      },
    });
    const admin = connection({
      auth: {
        role: "admin",
        restaurantId: "restaurant-1",
        roomType: "admin",
        roomId: "restaurant-1",
      },
    });
    const unauthenticated = connection({ auth: undefined });
    const statusEvent = event("status") as any;
    statusEvent.type = RealtimeEventType.ORDER_STATUS_UPDATE;
    const itemStatusEvent = event("item-status") as any;
    itemStatusEvent.type = RealtimeEventType.ORDER_ITEM_STATUS_UPDATE;
    const kitchenItemEvent = event("kitchen-item") as any;
    kitchenItemEvent.type = RealtimeEventType.KITCHEN_ITEM_STATUS;
    const tableStatusEvent = event("table-status") as any;
    tableStatusEvent.type = RealtimeEventType.TABLE_STATUS_UPDATE;
    const tableServiceEvent = event("table-service") as any;
    tableServiceEvent.type = RealtimeEventType.TABLE_CALL_SERVICE;
    const menuEvent = event("menu") as any;
    menuEvent.type = RealtimeEventType.MENU_ITEM_UPDATE;
    const menuAvailabilityEvent = event("menu-availability") as any;
    menuAvailabilityEvent.type = RealtimeEventType.MENU_AVAILABILITY_UPDATE;
    const systemEvent = event("system") as any;
    systemEvent.type = RealtimeEventType.SYSTEM_NOTIFICATION;
    const restaurantEvent = event("restaurant") as any;
    restaurantEvent.type = RealtimeEventType.RESTAURANT_STATUS_UPDATE;
    const unknownEvent = event("unknown") as any;
    unknownEvent.type = "unknown-event";

    expect(
      (session as any).shouldSendEventToConnection(statusEvent, customer),
    ).toBe(true);
    expect(
      (session as any).shouldSendEventToConnection(itemStatusEvent, staff),
    ).toBe(true);
    expect(
      (session as any).shouldSendEventToConnection(itemStatusEvent, admin),
    ).toBe(true);
    expect(
      (session as any).shouldSendEventToConnection(kitchenItemEvent, customer),
    ).toBe(false);
    for (const candidate of [
      tableStatusEvent,
      tableServiceEvent,
      menuEvent,
      menuAvailabilityEvent,
      systemEvent,
      restaurantEvent,
    ]) {
      expect(
        (session as any).shouldSendEventToConnection(candidate, customer),
      ).toBe(true);
    }
    expect(
      (session as any).shouldSendEventToConnection(unknownEvent, admin),
    ).toBe(true);
    expect(
      (session as any).shouldSendEventToConnection(unknownEvent, customer),
    ).toBe(false);
    expect(
      (session as any).shouldSendEventToConnection(
        statusEvent,
        unauthenticated,
      ),
    ).toBe(false);
  });

  it("handles send failures and unauthenticated error responses", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      const session = createSession(createEnv());
      const failingSocket = createSocket({
        send: vi.fn(() => {
          throw new Error("send failed");
        }),
      });

      (session as any).sendEvent(failingSocket, event("send-failed"));
      expect(console.error).toHaveBeenCalledWith(
        "Failed to send event:",
        expect.any(Error),
      );

      const socket = createSocket();
      (session as any).sendErrorEvent(
        socket,
        connection({ auth: undefined }),
        "NO_AUTH",
        "Missing auth",
      );
      expect(JSON.parse(socket.send.mock.calls[0][0])).toMatchObject({
        restaurantId: "",
        data: { code: "NO_AUTH", message: "Missing auth" },
      });
    } finally {
      error.mockRestore();
    }
  });

  it("routes broadcast events by restaurant, role, event type, and socket readiness", async () => {
    const session = createSession(createEnv());
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
    const session = createSession(createEnv());
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
    const session = createSession(createEnv());
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
    const session = createSession(createEnv());
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
    (session as any).connections.set(
      createSocket(),
      connection({
        id: "anonymous",
        auth: undefined,
      }),
    );

    const response = await session.fetch(new Request("https://do.test/stats"));

    await expect(response.json()).resolves.toMatchObject({
      roomInfo: { type: "kitchen", id: "restaurant-1" },
      connectionCount: 2,
      connections: [
        {
          id: "staff-1",
          type: "kitchen",
          role: "staff",
          connectedAt: "2026-06-07T00:00:00.000Z",
          lastActivity: "2026-06-07T00:01:00.000Z",
          lastEventId: "evt-1",
        },
        {
          id: "anonymous",
        },
      ],
      eventHistorySize: 0,
    });
  });

  it("validates role-room access rules", () => {
    const session = createSession(createEnv());

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
    expect(
      (session as any).validateRoleRoomAccess("manager", "customer"),
    ).toEqual({
      valid: false,
      error: 'Role "manager" is not authorized to access "customer" rooms',
    });
  });

  it("validates restaurant access for active users, platform admins, and failures", async () => {
    const regularDb = createDb([{ restaurant_id: "restaurant-1", role: 2 }]);
    const regularSession = createSession({
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
    const mismatchSession = createSession({
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
    const adminSession = createSession({
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

    const missingSession = createSession(createEnv());
    await expect(
      (missingSession as any).validateRestaurantAccess({
        restaurantId: "restaurant-1",
        role: "staff",
      }),
    ).resolves.toEqual({
      valid: false,
      error: "User ID is required for staff/admin access",
    });

    const inactiveDb = createDb([]);
    const inactiveSession = createSession({
      ...createEnv(),
      DB: inactiveDb.DB,
    });
    await expect(
      (inactiveSession as any).validateRestaurantAccess({
        userId: "11",
        restaurantId: "restaurant-1",
        role: "staff",
      }),
    ).resolves.toEqual({
      valid: false,
      error: "User not found or inactive",
    });
  });

  it("validates table and seat access including mismatch and DB error paths", async () => {
    const noTableSession = createSession(createEnv());
    await expect(
      (noTableSession as any).validateTableAccess({
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual({ valid: true });

    const tableMissingDb = createDb([]);
    const tableMissingSession = createSession({
      ...createEnv(),
      DB: tableMissingDb.DB,
    });
    await expect(
      (tableMissingSession as any).validateTableAccess({
        restaurantId: "restaurant-1",
        tableId: 7,
      }),
    ).resolves.toEqual({
      valid: false,
      error: "Table not found or inactive",
    });

    const validTableOnlyDb = createDb([
      { id: 7, restaurant_id: "restaurant-1" },
    ]);
    const validTableOnlySession = createSession({
      ...createEnv(),
      DB: validTableOnlyDb.DB,
    });
    await expect(
      (validTableOnlySession as any).validateTableAccess({
        restaurantId: "restaurant-1",
        tableId: 7,
      }),
    ).resolves.toEqual({ valid: true });

    const seatMissingDb = createDb([{ id: 7, restaurant_id: "restaurant-1" }]);
    const seatMissingSession = createSession({
      ...createEnv(),
      DB: seatMissingDb.DB,
    });
    await expect(
      (seatMissingSession as any).validateTableAccess({
        restaurantId: "restaurant-1",
        tableId: 7,
        seatId: 3,
      }),
    ).resolves.toEqual({
      valid: false,
      error: "Seat not found or inactive",
    });

    const okDb = createDb([
      { id: 7, restaurant_id: "restaurant-1" },
      { id: 3, table_id: 7 },
    ]);
    const okSession = createSession({ ...createEnv(), DB: okDb.DB });
    await expect(
      (okSession as any).validateTableAccess({
        restaurantId: "restaurant-1",
        tableId: 7,
        seatId: 3,
      }),
    ).resolves.toEqual({ valid: true });

    const mismatchDb = createDb([{ id: 7, restaurant_id: "restaurant-2" }]);
    const mismatchSession = createSession({
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
    const seatMismatchSession = createSession({
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
    const errorSession = createSession({
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
    const session = createSession(createEnv());
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

    const freshOnlySession = createSession(createEnv());
    (freshOnlySession as any).eventHistory = [event("still-fresh", now)];

    await freshOnlySession.alarm();

    expect(
      (freshOnlySession as any).eventHistory.map((item: any) => item.eventId),
    ).toEqual(["still-fresh"]);
  });
});
