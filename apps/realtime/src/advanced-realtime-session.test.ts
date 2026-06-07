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
  };
}

function createFakeSocket() {
  const listeners = new Map<string, (event: any) => void | Promise<void>>();
  return {
    socket: {
      readyState: WebSocket.OPEN,
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

    const [itemId, item] = Array.from(groupOrder.cart.entries())[0];
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
});
