import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";
import { RealtimeEventType } from "@makanmakan/shared-types";

const currentUser = vi.hoisted(() => ({
  value: { id: 10, role: 1, restaurantId: "restaurant-1" },
}));
const listGroupOrders = vi.hoisted(() => vi.fn());
const createGroupOrder = vi.hoisted(() => vi.fn());
const joinGroup = vi.hoisted(() => vi.fn());
const previewGroupByShareCode = vi.hoisted(() => vi.fn());
const recoverHost = vi.hoisted(() => vi.fn());
const getStatistics = vi.hoisted(() => vi.fn());
const getGroupOrder = vi.hoisted(() => vi.fn());
const addCartItem = vi.hoisted(() => vi.fn());
const updateCartItem = vi.hoisted(() => vi.fn());
const removeCartItem = vi.hoisted(() => vi.fn());
const splitBill = vi.hoisted(() => vi.fn());
const processPayment = vi.hoisted(() => vi.fn());
const leaveGroup = vi.hoisted(() => vi.fn());
const getActivities = vi.hoisted(() => vi.fn());
const cleanupExpiredGroups = vi.hoisted(() => vi.fn());
const isHostSession = vi.hoisted(() => vi.fn());
const finalizeGroupOrder = vi.hoisted(() => vi.fn());
const meterEmit = vi.hoisted(() => vi.fn());
const broadcastEvent = vi.hoisted(() => vi.fn());
const generateEventId = vi.hoisted(() => vi.fn());

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", currentUser.value);
    await next();
  }),
  optionalAuth: vi.fn(async (c, next) => {
    c.set("user", currentUser.value);
    await next();
  }),
  requireRole: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("../../../middleware/quotaGate", () => ({
  quotaGate: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("../../../shared/utils/meter", () => ({
  meterEmit,
}));

vi.mock("../services/GroupOrdersService", () => ({
  GroupOrdersService: class {
    listGroupOrders = listGroupOrders;
    createGroupOrder = createGroupOrder;
    previewGroupByShareCode = previewGroupByShareCode;
    joinGroup = joinGroup;
    recoverHost = recoverHost;
    getStatistics = getStatistics;
    getGroupOrder = getGroupOrder;
    addCartItem = addCartItem;
    updateCartItem = updateCartItem;
    removeCartItem = removeCartItem;
    splitBill = splitBill;
    processPayment = processPayment;
    leaveGroup = leaveGroup;
    getActivities = getActivities;
    cleanupExpiredGroups = cleanupExpiredGroups;
    isHostSession = isHostSession;
    finalizeGroupOrder = finalizeGroupOrder;
  },
}));

vi.mock("@makanmakan/database", () => ({
  RealtimeBroadcastService: class {
    generateEventId = generateEventId;
    broadcastEvent = broadcastEvent;
  },
}));

const groupOrderId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";

function createEnv() {
  return {
    DB: {},
    CACHE_KV: {},
  };
}

function createRateLimitEnv() {
  const kv = new Map<string, string>();
  return {
    DB: {},
    CACHE_KV: {
      get: vi.fn(async (key: string) => kv.get(key) ?? null),
      put: vi.fn(
        async (
          key: string,
          value: string,
          _options?: { expirationTtl?: number },
        ) => {
          kv.set(key, value);
        },
      ),
      delete: vi.fn(async (key: string) => {
        kv.delete(key);
      }),
    },
  };
}

async function withSilencedRouteError<T>(action: () => Promise<T>): Promise<T> {
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  try {
    return await action();
  } finally {
    consoleError.mockRestore();
  }
}

describe("group orders routes", () => {
  beforeEach(() => {
    currentUser.value = { id: 10, role: 1, restaurantId: "restaurant-1" };
    listGroupOrders.mockReset();
    createGroupOrder.mockReset();
    joinGroup.mockReset();
    previewGroupByShareCode.mockReset();
    recoverHost.mockReset();
    getStatistics.mockReset();
    getGroupOrder.mockReset();
    addCartItem.mockReset();
    updateCartItem.mockReset();
    removeCartItem.mockReset();
    splitBill.mockReset();
    processPayment.mockReset();
    leaveGroup.mockReset();
    getActivities.mockReset();
    cleanupExpiredGroups.mockReset();
    isHostSession.mockReset();
    finalizeGroupOrder.mockReset();
    meterEmit.mockReset();
    meterEmit.mockResolvedValue(undefined);
    broadcastEvent.mockReset();
    broadcastEvent.mockResolvedValue(undefined);
    generateEventId.mockReset();
    generateEventId.mockReturnValue("evt-group-1");
  });

  it("lists and exports group orders for the owner restaurant", async () => {
    listGroupOrders.mockResolvedValue([
      {
        id: groupOrderId,
        shareCode: "ABC123",
        status: "active",
        hostName: "Ada",
        memberCount: 3,
        itemCount: 5,
        totalAmount: 880,
        createdAt: "2026-06-07T01:00:00.000Z",
      },
    ]);
    const env = createEnv();

    const listResponse = await routes.fetch(
      new Request("https://test/?status=active"),
      env as never,
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      success: true,
      data: [{ id: groupOrderId, shareCode: "ABC123" }],
    });
    expect(listGroupOrders).toHaveBeenCalledWith("restaurant-1", "active");

    const exportResponse = await routes.fetch(
      new Request("https://test/export?restaurantId=restaurant-1"),
      env as never,
    );

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("Content-Type")).toBe("text/csv");
    await expect(exportResponse.text()).resolves.toContain(
      `${groupOrderId},ABC123,active,Ada,3,5,880`,
    );
  });

  it("blocks owners from listing another restaurant's group orders", async () => {
    const response = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://test/?restaurantId=restaurant-2"),
        createEnv() as never,
      ),
    );

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Internal Server Error");
    expect(listGroupOrders).not.toHaveBeenCalled();
  });

  it("generates share codes and creates group orders with metering and realtime events", async () => {
    createGroupOrder
      .mockResolvedValueOnce({
        success: true,
        data: {
          groupOrderId,
          shareCode: "ABC123",
          expiresAt: "2026-06-08T01:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          groupOrderId,
          shareCode: "CREATE1",
          expiresAt: "2026-06-08T01:00:00.000Z",
        },
      });
    const env = createEnv();

    const generateResponse = await routes.fetch(
      new Request("https://test/generate-code", {
        method: "POST",
        body: JSON.stringify({ restaurantId: "restaurant-1" }),
      }),
      env as never,
    );

    expect(generateResponse.status).toBe(200);
    await expect(generateResponse.json()).resolves.toMatchObject({
      data: {
        shareCode: "ABC123",
        shareUrl: "/group/ABC123",
      },
    });
    expect(meterEmit).toHaveBeenCalledWith(
      expect.anything(),
      "orders.created",
      expect.objectContaining({
        restaurantId: "restaurant-1",
        metadata: expect.objectContaining({ source: "group-generate-code" }),
      }),
    );

    const createResponse = await routes.fetch(
      new Request("https://test/create", {
        method: "POST",
        body: JSON.stringify({
          restaurantId: "restaurant-1",
          tableId: 7,
          hostName: "Ada",
        }),
      }),
      env as never,
    );

    expect(createResponse.status).toBe(200);
    await expect(createResponse.json()).resolves.toMatchObject({
      data: { groupOrderId, shareCode: "CREATE1" },
    });
    expect(createGroupOrder).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        restaurantId: "restaurant-1",
        tableId: 7,
        hostName: "Ada",
      }),
      10,
    );
    expect(broadcastEvent).toHaveBeenCalledWith(
      "customer",
      groupOrderId,
      expect.objectContaining({
        type: RealtimeEventType.GROUP_ORDER_CREATED,
        eventId: "evt-group-1",
      }),
    );
  });

  it("joins a group and broadcasts the joined member", async () => {
    joinGroup.mockResolvedValue({
      success: true,
      data: {
        groupOrder: { groupOrderId, restaurantId: "restaurant-1" },
        member: { id: memberId, memberName: "Ben" },
      },
    });

    const response = await routes.fetch(
      new Request("https://test/join/ABC123", {
        method: "POST",
        body: JSON.stringify({
          memberName: "Ben",
          phone: "+886912345678",
        }),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { member: { id: memberId, memberName: "Ben" } },
    });
    expect(joinGroup).toHaveBeenCalledWith("ABC123", {
      memberName: "Ben",
      phone: "+886912345678",
    });
    expect(broadcastEvent).toHaveBeenCalledWith(
      "customer",
      groupOrderId,
      expect.objectContaining({
        type: RealtimeEventType.GROUP_MEMBER_JOINED,
      }),
    );
  });

  it("rate limits public join previews and strict host recovery", async () => {
    previewGroupByShareCode.mockResolvedValue({
      found: true,
      data: {
        groupOrderId,
        restaurantId: "restaurant-1",
        hostName: "Ada",
        memberCount: 1,
        fulfillmentType: "dine_in",
        expiresAt: "2026-06-08T01:00:00.000Z",
        status: "active",
      },
    });
    recoverHost.mockResolvedValue({
      success: true,
      data: { memberToken: "new-session" },
    });
    const env = createRateLimitEnv();

    const previewResponse = await routes.fetch(
      new Request("https://test/join/ABC12345", {
        headers: { "cf-connecting-ip": "203.0.113.10" },
      }),
      env as never,
    );

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers.get("X-RateLimit-Limit")).toBe("500");

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (
          await routes.fetch(
            new Request(`https://test/${groupOrderId}/recover`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "cf-connecting-ip": "203.0.113.11",
              },
              body: JSON.stringify({ recoveryCode: "correct-code" }),
            }),
            env as never,
          )
        ).status,
      );
    }

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("returns statistics, details, activities, and cleanup responses", async () => {
    currentUser.value = { id: 1, role: 0, restaurantId: "admin" };
    getStatistics.mockResolvedValue({ totalGroups: 4, activeGroups: 2 });
    getGroupOrder.mockResolvedValue({
      groupOrderId,
      restaurantId: "restaurant-1",
      shareCode: "ABC123",
    });
    getActivities.mockResolvedValue([{ id: "act-1", type: "group_created" }]);
    cleanupExpiredGroups.mockResolvedValue({ cleaned: 3, errors: [] });
    const env = createEnv();

    const statsResponse = await routes.fetch(
      new Request(
        "https://test/statistics?restaurantId=restaurant-2&timeRange=week",
      ),
      env as never,
    );
    expect(statsResponse.status).toBe(200);
    await expect(statsResponse.json()).resolves.toMatchObject({
      data: { totalGroups: 4, activeGroups: 2 },
    });
    expect(getStatistics).toHaveBeenCalledWith("restaurant-2", "week");

    const detailResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}`),
      env as never,
    );
    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toMatchObject({
      data: { groupOrderId, shareCode: "ABC123" },
    });

    const activitiesResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/activities?limit=10`),
      env as never,
    );
    expect(activitiesResponse.status).toBe(200);
    await expect(activitiesResponse.json()).resolves.toMatchObject({
      data: [{ id: "act-1", type: "group_created" }],
    });

    const cleanupResponse = await routes.fetch(
      new Request("https://test/cleanup/expired", { method: "POST" }),
      env as never,
    );
    expect(cleanupResponse.status).toBe(200);
    await expect(cleanupResponse.json()).resolves.toMatchObject({
      data: { cleaned: 3, errors: [] },
    });
  });

  it("locks group orders only for the creator member token", async () => {
    isHostSession.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    finalizeGroupOrder.mockResolvedValue({
      success: true,
      data: { masterOrderId: "order-1", status: "completed" },
    });
    const env = createRateLimitEnv();

    const lockResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/lock`, {
        method: "POST",
        body: JSON.stringify({ memberToken: "host-session" }),
      }),
      env as never,
    );

    expect(lockResponse.status).toBe(200);
    await expect(lockResponse.json()).resolves.toEqual({
      success: true,
      data: { masterOrderId: "order-1", status: "completed" },
    });
    expect(isHostSession).toHaveBeenCalledWith(groupOrderId, "host-session");
    expect(finalizeGroupOrder).toHaveBeenCalledWith(groupOrderId);

    const forbiddenResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request(`https://test/${groupOrderId}/lock`, {
          method: "POST",
          body: JSON.stringify({ memberToken: "member-session" }),
        }),
        env as never,
      ),
    );

    expect(forbiddenResponse.status).toBe(500);
    expect(finalizeGroupOrder).toHaveBeenCalledTimes(1);
  });

  it("runs cart, split, payment, and leave workflows", async () => {
    addCartItem.mockResolvedValue({
      success: true,
      data: { id: itemId, menuItemId: 101, quantity: 2 },
    });
    updateCartItem.mockResolvedValue({
      success: true,
      data: { id: itemId, quantity: 3 },
    });
    removeCartItem.mockResolvedValue({ success: true });
    splitBill.mockResolvedValue({
      success: true,
      data: { splitType: "equal", perMemberAmount: 120 },
    });
    processPayment.mockResolvedValue({
      success: true,
      data: { memberId, paymentStatus: "paid" },
    });
    leaveGroup.mockResolvedValue({ success: true });
    const env = createEnv();

    const addResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/cart`, {
        method: "POST",
        body: JSON.stringify({
          memberId,
          menuItemId: 101,
          quantity: 2,
          specialInstructions: "less ice",
        }),
      }),
      env as never,
    );
    expect(addResponse.status).toBe(200);
    await expect(addResponse.json()).resolves.toMatchObject({
      data: { id: itemId, quantity: 2 },
    });

    const updateResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/cart/${itemId}`, {
        method: "PUT",
        body: JSON.stringify({ quantity: 3 }),
      }),
      env as never,
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      data: { id: itemId, quantity: 3 },
    });

    const removeResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/cart/${itemId}`, {
        method: "DELETE",
        body: JSON.stringify({ memberId }),
      }),
      env as never,
    );
    expect(removeResponse.status).toBe(200);
    await expect(removeResponse.json()).resolves.toMatchObject({
      message: "Cart item removed successfully",
    });

    const splitResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/split`, {
        method: "POST",
        body: JSON.stringify({ splitType: "equal" }),
      }),
      env as never,
    );
    expect(splitResponse.status).toBe(200);
    await expect(splitResponse.json()).resolves.toMatchObject({
      data: { splitType: "equal", perMemberAmount: 120 },
    });

    const paymentResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/payment/${memberId}`, {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "cash",
          amount: 120,
          transactionId: "txn-1",
        }),
      }),
      env as never,
    );
    expect(paymentResponse.status).toBe(200);
    await expect(paymentResponse.json()).resolves.toMatchObject({
      data: { memberId, paymentStatus: "paid" },
    });

    const leaveResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/leave/${memberId}`, {
        method: "POST",
      }),
      env as never,
    );
    expect(leaveResponse.status).toBe(200);
    await expect(leaveResponse.json()).resolves.toMatchObject({
      message: "Left group successfully",
    });

    expect(addCartItem).toHaveBeenCalledWith(
      groupOrderId,
      expect.objectContaining({ memberId, menuItemId: 101, quantity: 2 }),
    );
    expect(updateCartItem).toHaveBeenCalledWith(groupOrderId, itemId, {
      quantity: 3,
    });
    expect(removeCartItem).toHaveBeenCalledWith(groupOrderId, itemId, memberId);
    expect(splitBill).toHaveBeenCalledWith(groupOrderId, {
      splitType: "equal",
      serviceChargeRate: 0,
      taxRate: 0,
    });
    expect(processPayment).toHaveBeenCalledWith(
      groupOrderId,
      memberId,
      expect.objectContaining({ paymentMethod: "cash", amount: 120 }),
    );
    expect(leaveGroup).toHaveBeenCalledWith(groupOrderId, memberId);
    expect(broadcastEvent).toHaveBeenCalledWith(
      "customer",
      groupOrderId,
      expect.objectContaining({
        type: RealtimeEventType.GROUP_CART_ITEM_ADDED,
      }),
    );
    expect(broadcastEvent).toHaveBeenCalledWith(
      "customer",
      groupOrderId,
      expect.objectContaining({
        type: RealtimeEventType.GROUP_CART_ITEM_UPDATED,
      }),
    );
    expect(broadcastEvent).toHaveBeenCalledWith(
      "customer",
      groupOrderId,
      expect.objectContaining({
        type: RealtimeEventType.GROUP_CART_ITEM_REMOVED,
      }),
    );
  });
});
