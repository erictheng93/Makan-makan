import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdvancedRealtimeSession } from "./advanced-realtime-session";
import type { Env } from "./types";

function createState(initialValues: Array<[string, unknown]> = []) {
  const values = new Map<string, unknown>(initialValues);

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
    DB: {} as D1Database,
    JWT_SECRET: "test-jwt-secret",
  };
}

function createFakeSocket() {
  const listeners = new Map<string, (event: any) => void | Promise<void>>();
  return {
    socket: {
      readyState: WebSocket.OPEN,
      accept: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(
        (event: string, handler: (event: any) => void) => {
          listeners.set(event, handler);
        },
      ),
    },
    listeners,
  };
}

function createConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: "connection-1",
    socket: {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
    },
    userId: 1,
    restaurantId: 10,
    role: 1,
    lastActivity: Date.now(),
    subscriptions: new Set<string>(),
    metadata: {
      country: "TW",
      city: "Taipei",
      deviceType: "desktop",
      sessionId: "session-1",
    },
    ...overrides,
  } as any;
}

function createGroupOrder(overrides: Record<string, unknown> = {}) {
  const host = {
    id: "1",
    sessionId: "connection-1",
    name: "Host",
    role: "creator",
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    isOnline: true,
    totalAmount: 0,
    itemCount: 0,
    paymentStatus: "unpaid",
  };

  return {
    id: "group-1",
    shareCode: "SHARE1",
    status: "active",
    restaurantId: 10,
    members: new Map([["1", host]]),
    cart: new Map(),
    splitBills: new Map(),
    host,
    settings: {
      maxMembers: 8,
      allowEditOthers: false,
      splitType: "equal",
    },
    totalAmount: 0,
    lastActivity: Date.now(),
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    ...overrides,
  } as any;
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

describe("AdvancedRealtimeSession order state behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
    vi.mocked(console.error).mockRestore();
    vi.unstubAllGlobals();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("persists and broadcasts valid order state transitions", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const subscribedConnection = createConnection({
      id: "connection-2",
      subscriptions: new Set(["order:order-1"]),
    });
    (session as any).sessionState.activeConnections.set(
      subscribedConnection.id,
      subscribedConnection,
    );

    await session.handleOrderStateChange(createConnection(), {
      orderId: "order-1",
      newState: "confirmed",
      estimatedTimes: { preparation: 10 },
      metadata: { source: "unit-test" },
    });

    expect(state.storage.put).toHaveBeenCalledWith(
      "order:order-1",
      expect.objectContaining({
        currentState: "confirmed",
        previousState: "pending",
        estimatedTimes: expect.objectContaining({ preparation: 10 }),
      }),
    );
    expect(subscribedConnection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"order_state_changed"'),
    );
  });

  it("rejects invalid order state transitions with valid options", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const connection = createConnection();
    (session as any).sessionState.orderStates.set("order-1", {
      id: "order-1",
      currentState: "paid",
      restaurantId: 10,
      transitions: [],
      estimatedTimes: { preparation: 0, ready: 0, completion: 0 },
      priority: "normal",
      metadata: {},
    });

    await session.handleOrderStateChange(connection, {
      orderId: "order-1",
      newState: "confirmed",
    });

    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining(
        "Invalid state transition from paid to confirmed",
      ),
    );
  });
});

describe("AdvancedRealtimeSession group order behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
    vi.mocked(console.error).mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("joins active group orders and subscribes the connection", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const groupOrder = createGroupOrder({
      settings: {
        maxMembers: 8,
        allowEditOthers: true,
        splitType: "equal",
      },
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );
    const connection = createConnection();

    await session.handleJoinGroupOrder(connection, {
      shareCode: "SHARE1",
      memberName: "Guest",
      phone: "+886912345678",
    });

    expect(groupOrder.members.size).toBe(2);
    expect(connection.subscriptions.has("group_order:group-1")).toBe(true);
    expect(state.storage.put).toHaveBeenCalledWith(
      "group_order:group-1",
      expect.objectContaining({
        members: expect.any(Object),
      }),
    );
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"group_order_joined"'),
    );
  });

  it("adds and updates cart items while recalculating item totals", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const groupOrder = createGroupOrder();
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );
    const connection = createConnection();

    await session.handleAddCartItem(connection, {
      groupOrderId: "group-1",
      memberId: "1",
      menuItemId: 7,
      menuItemName: "Nasi Lemak",
      quantity: 2,
      unitPrice: 120,
    });

    const cartEntry = Array.from(groupOrder.cart.entries())[0];
    expect(cartEntry).toBeDefined();
    const [itemId, item] = cartEntry as [string, unknown];
    expect(item).toMatchObject({ totalPrice: 240, version: 1 });
    expect(groupOrder.totalAmount).toBe(240);

    await session.handleUpdateCartItem(connection, {
      groupOrderId: "group-1",
      itemId,
      quantity: 3,
      specialInstructions: "Less spicy",
    });

    expect(groupOrder.cart.get(itemId)).toMatchObject({
      totalPrice: 360,
      specialInstructions: "Less spicy",
      version: 2,
    });

    expect(state.storage.put).toHaveBeenCalledTimes(2);
  });

  it("denies cart updates for other members when editing others is disabled", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const groupOrder = createGroupOrder({
      cart: new Map([
        [
          "item-1",
          {
            id: "item-1",
            memberId: "other-member",
            menuItemId: 7,
            menuItemName: "Nasi Lemak",
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
            customizations: {},
            addedAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
        ],
      ]),
      members: new Map([
        [
          "other-member",
          {
            id: "other-member",
            sessionId: "other-connection",
            name: "Other",
            role: "member",
            joinedAt: Date.now(),
            lastActiveAt: Date.now(),
            isOnline: true,
            totalAmount: 120,
            itemCount: 1,
            paymentStatus: "unpaid",
          },
        ],
      ]),
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );
    const connection = createConnection({ userId: 1 });

    await session.handleUpdateCartItem(connection, {
      groupOrderId: "group-1",
      itemId: "item-1",
      quantity: 2,
    });

    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Permission denied to edit this item"),
    );
  });

  it("initiates equal split bills for group creators", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const groupOrder = createGroupOrder({
      members: new Map([
        [
          "1",
          {
            ...createGroupOrder().host,
            totalAmount: 100,
          },
        ],
        [
          "2",
          {
            id: "2",
            sessionId: "connection-2",
            name: "Guest",
            role: "member",
            joinedAt: Date.now(),
            lastActiveAt: Date.now(),
            isOnline: true,
            totalAmount: 200,
            itemCount: 1,
            paymentStatus: "unpaid",
          },
        ],
      ]),
      totalAmount: 300,
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );

    await session.handleInitiateSplitBill(createConnection(), {
      groupOrderId: "group-1",
      splitType: "equal",
    });

    expect(groupOrder.status).toBe("checkout");
    expect(groupOrder.splitBills.size).toBe(2);
    expect(Array.from(groupOrder.splitBills.values())[0]).toMatchObject({
      subtotal: 150,
      paymentStatus: "pending",
    });
    expect(state.storage.put).toHaveBeenCalledWith(
      "group_order:group-1",
      expect.objectContaining({ status: "checkout" }),
    );
  });

  it("processes the final group payment and completes the order", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const member = createGroupOrder().host;
    const groupOrder = createGroupOrder({
      status: "checkout",
      members: new Map([["1", member]]),
      splitBills: new Map([
        [
          "1",
          {
            id: "split-1",
            memberId: "1",
            subtotal: 100,
            taxAmount: 6,
            serviceCharge: 10,
            totalAmount: 116,
            items: [],
            paymentStatus: "pending",
          },
        ],
      ]),
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );
    const connection = createConnection();

    await session.handleProcessPayment(connection, {
      groupOrderId: "group-1",
      memberId: "1",
      paymentMethod: "cash",
      amount: 116,
    });

    expect(groupOrder.status).toBe("completed");
    expect(groupOrder.members.get("1")?.paymentStatus).toBe("paid");
    expect(groupOrder.splitBills.get("1")).toMatchObject({
      paymentStatus: "paid",
      paymentMethod: "cash",
      paidAt: Date.now(),
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"payment_processed"'),
    );
  });

  it("serializes group orders and cleans up expired persisted state", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const expiredGroup = createGroupOrder({ expiresAt: Date.now() - 1 });
    const oldOrder = {
      id: "order-1",
      currentState: "paid",
      restaurantId: 10,
      transitions: [{ timestamp: Date.now() - 90_000_000 }],
      estimatedTimes: { preparation: 0, ready: 0, completion: 0 },
      priority: "normal",
      metadata: {},
    };
    (session as any).sessionState.groupOrderStates.set("group-1", expiredGroup);
    (session as any).sessionState.orderStates.set("order-1", oldOrder);

    expect(
      (session as any).serializeGroupOrderForClient(expiredGroup),
    ).toMatchObject({
      id: "group-1",
      members: expect.any(Array),
      cart: expect.any(Array),
      splitBills: expect.any(Array),
    });

    await (session as any).cleanupOldData();

    expect((session as any).sessionState.groupOrderStates.size).toBe(0);
    expect((session as any).sessionState.orderStates.size).toBe(0);
    expect(state.storage.delete).toHaveBeenCalledWith("group_order:group-1");
    expect(state.storage.delete).toHaveBeenCalledWith("order:order-1");
  });
});

describe("AdvancedRealtimeSession advanced coverage paths", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
    vi.mocked(console.error).mockRestore();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("dispatches websocket messages, records analytics, and reports malformed payloads", async () => {
    const analytics = { writeDataPoint: vi.fn() };
    const env = { ...createEnv(), ANALYTICS_ENGINE: analytics } as Env;
    const session = new AdvancedRealtimeSession(createState(), env);
    const fake = createFakeSocket();
    const connection = createConnection({ socket: fake.socket });

    (session as any).setupWebSocketHandlers(connection);

    await fake.listeners.get("message")?.({
      data: JSON.stringify({ type: "heartbeat" }),
    });
    await fake.listeners.get("message")?.({
      data: JSON.stringify({ type: "add_cart_item", data: {} }),
    });
    await fake.listeners.get("message")?.({ data: "not-json" });

    expect(fake.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"heartbeat_ack"'),
    );
    expect(fake.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"error":"Invalid message payload"'),
    );
    expect(fake.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"error":"Message processing failed"'),
    );
    expect((session as any).sessionState.totalMessages).toBe(3);
    expect((session as any).sessionState.errors).toHaveLength(2);
    expect(analytics.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["websocket_message", "heartbeat"]),
      }),
    );
  });

  it("handles websocket close and error events with connection cleanup", async () => {
    const analytics = { writeDataPoint: vi.fn() };
    const env = { ...createEnv(), ANALYTICS_ENGINE: analytics } as Env;
    const session = new AdvancedRealtimeSession(createState(), env);
    const fake = createFakeSocket();
    const connection = createConnection({ socket: fake.socket });
    (session as any).sessionState.activeConnections.set(
      connection.id,
      connection,
    );
    (session as any).setupWebSocketHandlers(connection);

    await fake.listeners.get("close")?.({});
    expect((session as any).sessionState.activeConnections.size).toBe(0);
    expect(analytics.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["disconnect"]),
      }),
    );

    (session as any).sessionState.activeConnections.set(
      connection.id,
      connection,
    );
    await fake.listeners.get("error")?.(new Error("socket broke"));

    expect((session as any).sessionState.activeConnections.size).toBe(0);
    expect((session as any).sessionState.errors.at(-1)).toMatchObject({
      error: "socket broke",
      context: { connectionId: "connection-1" },
    });
  });

  it("keeps active recent sessions awake and hibernates active stale sessions", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const active = createConnection();
    (session as any).sessionState.activeConnections.set(active.id, active);
    (session as any).sessionState.lastActivity = Date.now();

    const awake = await session.fetch(
      new Request("https://do.test/hibernate", { method: "POST" }),
    );
    await expect(awake.json()).resolves.toMatchObject({
      hibernated: false,
      activeConnections: 1,
      lastActivity: Date.now(),
    });

    (session as any).sessionState.lastActivity = Date.now() - 31 * 60 * 1000;
    const hibernated = await session.fetch(
      new Request("https://do.test/hibernate", { method: "POST" }),
    );

    await expect(hibernated.json()).resolves.toMatchObject({
      hibernated: true,
      timestamp: Date.now(),
    });
    expect(active.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"hibernating"'),
    );
    expect(active.socket.close).toHaveBeenCalledWith(
      1000,
      "Session hibernating",
    );
    expect((session as any).sessionState.activeConnections.size).toBe(0);
  });

  it("restores persisted orders, live group orders, metrics, and deletes expired groups", async () => {
    const liveGroup = createGroupOrder({
      id: "live-group",
      expiresAt: Date.now() + 60_000,
    });
    const expiredGroup = createGroupOrder({
      id: "expired-group",
      expiresAt: Date.now() - 1,
    });
    const state = createState([
      [
        "order:order-1",
        {
          id: "order-1",
          currentState: "confirmed",
          restaurantId: 10,
          transitions: [],
          estimatedTimes: { preparation: 5, ready: 0, completion: 0 },
          priority: "normal",
          metadata: {},
        },
      ],
      [
        "group_order:live-group",
        (AdvancedRealtimeSession.prototype as any).serializeGroupOrder.call(
          { sessionState: {} },
          liveGroup,
        ),
      ],
      [
        "group_order:expired-group",
        (AdvancedRealtimeSession.prototype as any).serializeGroupOrder.call(
          { sessionState: {} },
          expiredGroup,
        ),
      ],
      ["metrics:10", { activeOrders: 4 }],
      ["hibernation_state", { hibernatedAt: Date.now() - 1000 }],
    ]);

    const session = new AdvancedRealtimeSession(state, createEnv());
    await (session as any).loadPersistedState();

    expect((session as any).sessionState.orderStates.has("order-1")).toBe(true);
    expect(
      (session as any).sessionState.groupOrderStates.has("live-group"),
    ).toBe(true);
    expect(
      (session as any).sessionState.groupOrderStates.has("expired-group"),
    ).toBe(false);
    expect((session as any).sessionState.restaurantMetrics.get(10)).toEqual({
      activeOrders: 4,
    });
    expect(state.storage.delete).toHaveBeenCalledWith(
      "group_order:expired-group",
    );
  });

  it("leaves group orders and removes the member cart items", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const host = createGroupOrder().host;
    const guest = {
      id: "2",
      sessionId: "connection-2",
      name: "Guest",
      role: "member",
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      isOnline: true,
      totalAmount: 120,
      itemCount: 1,
      paymentStatus: "unpaid",
    };
    const groupOrder = createGroupOrder({
      members: new Map([
        ["1", host],
        ["2", guest],
      ]),
      cart: new Map([
        [
          "item-2",
          {
            id: "item-2",
            memberId: "2",
            menuItemId: 8,
            menuItemName: "Satay",
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
            customizations: {},
            addedAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
        ],
      ]),
      totalAmount: 120,
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );
    const connection = createConnection({
      id: "connection-2",
      subscriptions: new Set(["group_order:group-1"]),
    });

    await session.handleLeaveGroupOrder(connection, {
      groupOrderId: "group-1",
      memberId: "2",
    });

    expect(groupOrder.members.has("2")).toBe(false);
    expect(groupOrder.cart.size).toBe(0);
    expect(groupOrder.totalAmount).toBe(0);
    expect(connection.subscriptions.has("group_order:group-1")).toBe(false);
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"group_order_left"'),
    );
    expect(state.storage.put).toHaveBeenCalledWith(
      "group_order:group-1",
      expect.objectContaining({
        members: expect.not.objectContaining({ 2: expect.any(Object) }),
        cart: {},
      }),
    );
  });

  it("removes cart items when editing others is allowed", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const otherMember = {
      id: "2",
      sessionId: "connection-2",
      name: "Guest",
      role: "member",
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      isOnline: true,
      totalAmount: 120,
      itemCount: 1,
      paymentStatus: "unpaid",
    };
    const groupOrder = createGroupOrder({
      settings: {
        maxMembers: 8,
        allowEditOthers: true,
        splitType: "equal",
      },
      members: new Map([["2", otherMember]]),
      cart: new Map([
        [
          "item-2",
          {
            id: "item-2",
            memberId: "2",
            menuItemId: 8,
            menuItemName: "Satay",
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
            customizations: {},
            addedAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
        ],
      ]),
      totalAmount: 120,
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );

    await session.handleRemoveCartItem(createConnection(), {
      groupOrderId: "group-1",
      itemId: "item-2",
    });

    expect(groupOrder.cart.size).toBe(0);
    expect(otherMember).toMatchObject({ totalAmount: 0, itemCount: 0 });
    expect(state.storage.put).toHaveBeenCalledWith(
      "group_order:group-1",
      expect.objectContaining({ cart: {} }),
    );
  });

  it("creates proportional and custom split bills", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const host = createGroupOrder().host;
    const guest = {
      id: "2",
      sessionId: "connection-2",
      name: "Guest",
      role: "member",
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      isOnline: true,
      totalAmount: 200,
      itemCount: 1,
      paymentStatus: "unpaid",
    };
    const groupOrder = createGroupOrder({
      members: new Map([
        ["1", { ...host, totalAmount: 100 }],
        ["2", guest],
      ]),
      cart: new Map([
        [
          "item-1",
          {
            id: "item-1",
            memberId: "1",
            menuItemId: 7,
            menuItemName: "Nasi Lemak",
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
            customizations: {},
            addedAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
        ],
        [
          "item-2",
          {
            id: "item-2",
            memberId: "2",
            menuItemId: 8,
            menuItemName: "Satay",
            quantity: 1,
            unitPrice: 200,
            totalPrice: 200,
            customizations: {},
            addedAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
        ],
      ]),
      totalAmount: 300,
    });

    const proportional = (session as any).calculateSplitBills(
      groupOrder,
      "proportional",
    );
    const custom = (session as any).calculateSplitBills(groupOrder, "custom", [
      { memberId: "1", amount: 80, items: ["item-1"] },
      { memberId: "2", amount: 220, items: ["item-2"] },
    ]);

    expect(proportional).toEqual([
      expect.objectContaining({
        memberId: "1",
        subtotal: 100,
        serviceCharge: 10,
        taxAmount: 6,
        totalAmount: 116,
        items: ["item-1"],
      }),
      expect.objectContaining({
        memberId: "2",
        subtotal: 200,
        serviceCharge: 20,
        taxAmount: 12,
        totalAmount: 232,
        items: ["item-2"],
      }),
    ]);
    expect(custom).toEqual([
      expect.objectContaining({
        memberId: "1",
        subtotal: 80,
        totalAmount: 92.8,
        items: ["item-1"],
      }),
      expect.objectContaining({
        memberId: "2",
        subtotal: 220,
        totalAmount: 255.2,
        items: ["item-2"],
      }),
    ]);
  });

  it("rejects mismatched payment amounts without mutating payment state", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const member = createGroupOrder().host;
    const groupOrder = createGroupOrder({
      status: "checkout",
      members: new Map([["1", member]]),
      splitBills: new Map([
        [
          "1",
          {
            id: "split-1",
            memberId: "1",
            subtotal: 100,
            taxAmount: 6,
            serviceCharge: 10,
            totalAmount: 116,
            items: [],
            paymentStatus: "pending",
          },
        ],
      ]),
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );
    const connection = createConnection();

    await session.handleProcessPayment(connection, {
      groupOrderId: "group-1",
      memberId: "1",
      paymentMethod: "cash",
      amount: 115,
    });

    expect(groupOrder.status).toBe("checkout");
    expect(member.paymentStatus).toBe("unpaid");
    expect(groupOrder.splitBills.get("1")?.paymentStatus).toBe("pending");
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining(
        "Payment amount does not match split bill amount",
      ),
    );
  });

  it("records analytics errors without interrupting order transitions", async () => {
    const env = {
      ...createEnv(),
      ANALYTICS_ENGINE: {
        writeDataPoint: vi.fn(() => {
          throw new Error("analytics unavailable");
        }),
      },
    } as Env;
    const state = createState();
    const session = new AdvancedRealtimeSession(state, env);

    await session.handleOrderStateChange(createConnection(), {
      orderId: "order-analytics",
      newState: "confirmed",
    });

    expect(state.storage.put).toHaveBeenCalledWith(
      "order:order-analytics",
      expect.objectContaining({ currentState: "confirmed" }),
    );
    expect(console.error).toHaveBeenCalledWith(
      "Analytics error:",
      expect.any(Error),
    );
  });

  it("rejects non-websocket upgrade requests before allocating a WebSocket pair", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());

    const response = await session.fetch(
      new Request("https://do.test/websocket?userId=1&restaurantId=10"),
    );

    expect(response.status).toBe(426);
    await expect(response.text()).resolves.toBe("Expected Upgrade: websocket");
  });

  it("reports fetch handler failures and records the failed path", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    (session as any).handleHealthCheck = vi.fn(() => {
      throw new Error("health failed");
    });

    const response = await session.fetch(new Request("https://do.test/health"));

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Internal Server Error");
    expect((session as any).sessionState.errors.at(-1)).toMatchObject({
      error: "health failed",
      context: { path: "/health" },
    });
  });

  it("handles group join rejection states", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const connection = createConnection();

    await session.handleJoinGroupOrder(connection, {
      shareCode: "MISSING",
      memberName: "Guest",
    });

    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order not found or expired"),
    );

    const fullGroup = createGroupOrder({
      settings: {
        maxMembers: 1,
        allowEditOthers: false,
        splitType: "equal",
      },
    });
    (session as any).sessionState.groupOrderStates.set(fullGroup.id, fullGroup);

    await session.handleJoinGroupOrder(connection, {
      shareCode: "SHARE1",
      memberName: "Guest",
    });

    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order is not accepting new members"),
    );

    fullGroup.settings.maxMembers = 8;
    fullGroup.status = "checkout";
    await session.handleJoinGroupOrder(connection, {
      shareCode: "SHARE1",
      memberName: "Guest",
    });

    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order is not accepting new members"),
    );
  });

  it("reports leave, add, update, remove, split, and payment validation errors", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const connection = createConnection();

    await session.handleLeaveGroupOrder(connection, {
      groupOrderId: "missing",
      memberId: "1",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order not found"),
    );

    const groupOrder = createGroupOrder({
      status: "checkout",
      cart: new Map([
        [
          "item-1",
          {
            id: "item-1",
            memberId: "missing-member",
            menuItemId: 7,
            menuItemName: "Nasi Lemak",
            quantity: 1,
            unitPrice: 120,
            totalPrice: 120,
            customizations: {},
            addedAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
        ],
      ]),
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );

    await session.handleLeaveGroupOrder(connection, {
      groupOrderId: "group-1",
      memberId: "missing-member",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Member not found in group order"),
    );

    await session.handleAddCartItem(connection, {
      groupOrderId: "missing",
      memberId: "1",
      menuItemId: 7,
      menuItemName: "Nasi Lemak",
      quantity: 1,
      unitPrice: 120,
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order not found"),
    );

    await session.handleAddCartItem(connection, {
      groupOrderId: "group-1",
      memberId: "1",
      menuItemId: 7,
      menuItemName: "Nasi Lemak",
      quantity: 1,
      unitPrice: 120,
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order is not accepting new items"),
    );

    groupOrder.status = "active";
    await session.handleAddCartItem(connection, {
      groupOrderId: "group-1",
      memberId: "missing-member",
      menuItemId: 7,
      menuItemName: "Nasi Lemak",
      quantity: 1,
      unitPrice: 120,
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Member not found in group order"),
    );

    await session.handleUpdateCartItem(connection, {
      groupOrderId: "missing",
      itemId: "item-1",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order not found"),
    );

    await session.handleUpdateCartItem(connection, {
      groupOrderId: "group-1",
      itemId: "missing-item",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Cart item not found"),
    );

    await session.handleUpdateCartItem(connection, {
      groupOrderId: "group-1",
      itemId: "item-1",
      quantity: 2,
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Member not found"),
    );

    await session.handleRemoveCartItem(connection, {
      groupOrderId: "missing",
      itemId: "item-1",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order not found"),
    );

    await session.handleRemoveCartItem(connection, {
      groupOrderId: "group-1",
      itemId: "missing-item",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Cart item not found"),
    );

    await session.handleRemoveCartItem(connection, {
      groupOrderId: "group-1",
      itemId: "item-1",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Member not found"),
    );

    await session.handleInitiateSplitBill(connection, {
      groupOrderId: "missing",
      splitType: "equal",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order not found"),
    );

    groupOrder.members.set("1", {
      ...createGroupOrder().host,
      sessionId: "other-connection",
    });
    groupOrder.members.set("2", {
      id: "2",
      sessionId: "connection-1",
      name: "Guest",
      role: "member",
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      isOnline: true,
      totalAmount: 0,
      itemCount: 0,
      paymentStatus: "unpaid",
    });

    await session.handleInitiateSplitBill(connection, {
      groupOrderId: "group-1",
      splitType: "equal",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Permission denied to initiate split bill"),
    );

    await session.handleProcessPayment(connection, {
      groupOrderId: "missing",
      memberId: "1",
      paymentMethod: "cash",
      amount: 100,
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order not found"),
    );

    await session.handleProcessPayment(connection, {
      groupOrderId: "group-1",
      memberId: "missing-member",
      paymentMethod: "cash",
      amount: 100,
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Member not found"),
    );
  });

  it("reports split bill state and missing split bill payment errors", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const host = {
      ...createGroupOrder().host,
      sessionId: "connection-1",
    };
    const groupOrder = createGroupOrder({
      status: "checkout",
      members: new Map([["1", host]]),
      splitBills: new Map(),
    });
    (session as any).sessionState.groupOrderStates.set(
      groupOrder.id,
      groupOrder,
    );
    const connection = createConnection();

    await session.handleInitiateSplitBill(connection, {
      groupOrderId: "group-1",
      splitType: "equal",
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Group order is not in active state"),
    );

    await session.handleProcessPayment(connection, {
      groupOrderId: "group-1",
      memberId: "1",
      paymentMethod: "cash",
      amount: 100,
    });
    expect(connection.socket.send).toHaveBeenCalledWith(
      expect.stringContaining("Split bill not found for member"),
    );
  });

  it("does not send to closed sockets and logs send failures", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const closed = createConnection({
      socket: { readyState: WebSocket.CLOSED, send: vi.fn(), close: vi.fn() },
    });
    await (session as any).sendMessage(closed, { type: "noop" });
    expect(closed.socket.send).not.toHaveBeenCalled();

    const failing = createConnection({
      socket: {
        readyState: WebSocket.OPEN,
        send: vi.fn(() => {
          throw new Error("send failed");
        }),
        close: vi.fn(),
      },
    });
    await (session as any).sendMessage(failing, { type: "noop" });

    expect(console.error).toHaveBeenCalledWith(
      "Failed to send message:",
      expect.any(Error),
    );
  });

  it("attempts websocket upgrades and stores connection metadata", async () => {
    const client = createFakeSocket();
    const server = createFakeSocket();
    const analytics = { writeDataPoint: vi.fn() };
    const env = {
      ...createEnv(),
      ANALYTICS_ENGINE: analytics,
    } as Env;
    vi.stubGlobal("WebSocketPair", function WebSocketPair() {
      return { 0: client.socket, 1: server.socket };
    });
    const session = new AdvancedRealtimeSession(createState(), env);

    await expect(
      session.fetch(
        new Request(
          "https://do.test/websocket?userId=7&restaurantId=10&role=2&sessionId=session-7",
          {
            headers: {
              Upgrade: "websocket",
              "CF-IPCountry": "TW",
              "CF-IPCity": "Taipei",
              "User-Agent": "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
            },
          },
        ),
      ),
    ).rejects.toThrow('init["status"] must be in the range');

    expect(server.socket.accept).toHaveBeenCalled();
    expect(server.socket.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
    expect((session as any).sessionState.activeConnections.size).toBe(1);
    expect(
      Array.from((session as any).sessionState.activeConnections.values())[0],
    ).toMatchObject({
      userId: 7,
      restaurantId: 10,
      role: 2,
      metadata: {
        country: "TW",
        city: "Taipei",
        deviceType: "mobile",
        sessionId: "session-7",
      },
    });
    expect(analytics.writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["connect", "7", "10"]),
      }),
    );
  });

  it("routes validated websocket messages to every advanced handler", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const fake = createFakeSocket();
    const connection = createConnection({ socket: fake.socket });
    const handlers = {
      handleSubscription: vi.fn(),
      handleOrderStateChange: vi.fn(),
      handleBroadcastMessage: vi.fn(),
      handleStateSyncRequest: vi.fn(),
      handleJoinGroupOrder: vi.fn(),
      handleLeaveGroupOrder: vi.fn(),
      handleAddCartItem: vi.fn(),
      handleUpdateCartItem: vi.fn(),
      handleRemoveCartItem: vi.fn(),
      handleInitiateSplitBill: vi.fn(),
      handleProcessPayment: vi.fn(),
    };
    Object.assign(session as any, handlers);
    (session as any).setupWebSocketHandlers(connection);
    const dispatch = async (message: Record<string, unknown>) => {
      await fake.listeners.get("message")?.({ data: JSON.stringify(message) });
    };

    await dispatch({ type: "subscribe", data: { channel: "orders" } });
    await dispatch({
      type: "order_state_change",
      data: { orderId: "order-1", newState: "confirmed" },
    });
    await dispatch({ type: "broadcast", data: { text: "hello" } });
    await dispatch({ type: "request_state_sync", data: { scope: "all" } });
    await dispatch({
      type: "join_group_order",
      data: { shareCode: "SHARE1", memberName: "Guest" },
    });
    await dispatch({
      type: "leave_group_order",
      data: { groupOrderId: "group-1", memberId: "1" },
    });
    await dispatch({
      type: "add_cart_item",
      data: {
        groupOrderId: "group-1",
        memberId: "1",
        menuItemId: 7,
        menuItemName: "Nasi Lemak",
        quantity: 1,
        unitPrice: 120,
      },
    });
    await dispatch({
      type: "update_cart_item",
      data: {
        groupOrderId: "group-1",
        itemId: "item-1",
        customizations: { spice: "low" },
        specialInstructions: "No peanuts",
      },
    });
    await dispatch({
      type: "remove_cart_item",
      data: { groupOrderId: "group-1", itemId: "item-1" },
    });
    await dispatch({
      type: "initiate_split_bill",
      data: { groupOrderId: "group-1", splitType: "equal" },
    });
    await dispatch({
      type: "process_payment",
      data: {
        groupOrderId: "group-1",
        memberId: "1",
        paymentMethod: "cash",
        amount: 100,
      },
    });

    for (const handler of Object.values(handlers)) {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining(connection),
        expect.any(Object),
      );
    }
    expect((session as any).sessionState.totalMessages).toBe(11);
  });

  it("records cross-object notification and persistence failures", async () => {
    const failingFetch = vi.fn(
      async () => new Response("nope", { status: 503 }),
    );
    const env = {
      REALTIME_SESSION: {
        idFromName: vi.fn((name: string) => ({ name })),
        get: vi.fn(() => ({ fetch: failingFetch })),
      },
    } as unknown as Env;
    const session = new AdvancedRealtimeSession(createState(), env);
    const orderState = {
      id: "order-1",
      currentState: "confirmed",
      restaurantId: 10,
      transitions: [],
      estimatedTimes: { preparation: 0, ready: 0, completion: 0 },
      priority: "normal",
      metadata: {},
    };

    await session.notifyOtherRestaurantSessions(
      orderState as any,
      {
        from: "pending",
        to: "confirmed",
        timestamp: Date.now(),
        triggeredBy: 1,
      } as any,
    );

    expect(failingFetch).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to notify session admin:10:",
      expect.any(Error),
    );

    (session as any).env.REALTIME_SESSION.idFromName = vi.fn(() => {
      throw new Error("namespace unavailable");
    });
    await session.notifyOtherRestaurantSessions(
      orderState as any,
      {
        from: "confirmed",
        to: "preparing",
        timestamp: Date.now(),
        triggeredBy: 1,
      } as any,
    );
    expect(console.error).toHaveBeenCalledWith(
      "Failed to notify session admin:10:",
      expect.any(Error),
    );
  });

  it("handles hibernation, persisted state, and timer failure paths", async () => {
    const state = createState();
    const session = new AdvancedRealtimeSession(state, createEnv());
    const connection = createConnection({
      socket: {
        readyState: WebSocket.OPEN,
        send: vi.fn(() => {
          throw new Error("cannot send hibernation notice");
        }),
        close: vi.fn(() => {
          throw new Error("cannot close");
        }),
      },
    });
    (session as any).sessionState.activeConnections.set(
      connection.id,
      connection,
    );

    await (session as any).hibernateSession();

    expect(console.error).toHaveBeenCalledWith(
      "Failed to send message:",
      expect.any(Error),
    );
    expect(connection.socket.close).toHaveBeenCalledWith(
      1000,
      "Session hibernating",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Failed to close connection connection-1:",
      expect.any(Error),
    );
    expect((session as any).sessionState.hibernated).toBe(true);

    vi.mocked(state.storage.put).mockRejectedValueOnce(
      new Error("storage unavailable"),
    );
    await (session as any).hibernateSession();
    expect(console.error).toHaveBeenCalledWith(
      "Hibernation failed:",
      expect.any(Error),
    );

    vi.mocked(state.storage.list).mockRejectedValueOnce(
      new Error("list unavailable"),
    );
    await (session as any).loadPersistedState();
    expect((session as any).sessionState.errors.at(-1)).toMatchObject({
      error: "list unavailable",
      context: { operation: "load_state" },
    });
  });

  it("runs maintenance timers and broadcasts group events to subscribers", async () => {
    const session = new AdvancedRealtimeSession(createState(), createEnv());
    const hibernateSession = vi
      .spyOn(session as any, "hibernateSession")
      .mockResolvedValue(undefined);
    const collectAndSendMetrics = vi
      .spyOn(session as any, "collectAndSendMetrics")
      .mockResolvedValue(undefined);
    const cleanupOldData = vi
      .spyOn(session as any, "cleanupOldData")
      .mockResolvedValue(undefined);

    (session as any).sessionState.lastActivity = Date.now() - 31 * 60 * 1000;

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(hibernateSession).toHaveBeenCalled();
    expect(collectAndSendMetrics).toHaveBeenCalledTimes(5);

    await vi.advanceTimersByTimeAsync(55 * 60 * 1000);
    expect(cleanupOldData).toHaveBeenCalled();

    const subscribed = createConnection({
      id: "connection-2",
      subscriptions: new Set(["group_order:group-1"]),
    });
    const unsubscribed = createConnection({
      id: "connection-3",
      subscriptions: new Set(["group_order:other"]),
    });
    (session as any).sessionState.activeConnections.set(
      subscribed.id,
      subscribed,
    );
    (session as any).sessionState.activeConnections.set(
      unsubscribed.id,
      unsubscribed,
    );

    await (session as any).broadcastGroupOrderEvent(createGroupOrder(), {
      type: "cart_item_updated",
    });

    expect(subscribed.socket.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"group_order_event"'),
    );
    expect(unsubscribed.socket.send).not.toHaveBeenCalled();
  });
});
