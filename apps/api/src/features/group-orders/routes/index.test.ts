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
const isMemberSession = vi.hoisted(() => vi.fn());
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
    isMemberSession = isMemberSession;
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
    isMemberSession.mockReset();
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
    getGroupOrder.mockResolvedValue({
      groupOrder: { id: groupOrderId, restaurantId: "restaurant-1" },
    });
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
    isHostSession.mockResolvedValue(true);
    isMemberSession.mockResolvedValue(true);
    const env = createEnv();

    const addResponse = await routes.fetch(
      new Request(`https://test/${groupOrderId}/cart`, {
        method: "POST",
        body: JSON.stringify({
          memberId,
          memberToken: "member-session",
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
        body: JSON.stringify({
          quantity: 3,
          memberId,
          memberToken: "member-session",
        }),
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
        body: JSON.stringify({ memberId, memberToken: "member-session" }),
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
        body: JSON.stringify({
          splitType: "equal",
          memberToken: "host-session",
        }),
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
          memberToken: "host-session",
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
        body: JSON.stringify({ memberToken: "member-session" }),
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
    expect(isHostSession).toHaveBeenCalledWith(groupOrderId, "host-session");
    // The trust level comes from who authenticated, not from the body: every
    // caller this route accepts is someone at the table.
    expect(processPayment).toHaveBeenCalledWith(
      groupOrderId,
      memberId,
      expect.objectContaining({ paymentMethod: "cash", amount: 120 }),
      "self",
    );
    expect(isMemberSession).toHaveBeenCalledWith(
      groupOrderId,
      memberId,
      "member-session",
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

  it("keeps successful cart writes successful when realtime delivery fails", async () => {
    getGroupOrder.mockResolvedValue({
      groupOrder: { id: groupOrderId, restaurantId: "restaurant-1" },
    });
    addCartItem.mockResolvedValue({
      success: true,
      data: { id: itemId, menuItemId: 101, quantity: 2 },
    });
    broadcastEvent.mockRejectedValueOnce(new Error("realtime unavailable"));
    isMemberSession.mockResolvedValue(true);

    const response = await routes.fetch(
      new Request(`https://test/${groupOrderId}/cart`, {
        method: "POST",
        body: JSON.stringify({
          memberId,
          memberToken: "member-session",
          menuItemId: 101,
          quantity: 2,
        }),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: itemId, quantity: 2 },
    });
    expect(addCartItem).toHaveBeenCalledWith(
      groupOrderId,
      expect.objectContaining({ memberId, menuItemId: 101, quantity: 2 }),
    );
    expect(broadcastEvent).toHaveBeenCalledOnce();
  });

  /**
   * The list route resolves its tenant as `restaurantId || user.restaurantId`,
   * so it is always scoped. The statistics route passes the query parameter
   * straight through, and the schema turns a missing one into `undefined` —
   * which `getStatistics` reads as "no restaurant filter", i.e. every
   * restaurant on the platform.
   *
   * The owner guard does not catch this: it reads
   * `user.role === 1 && restaurantId && ...`, so omitting the parameter
   * short-circuits it. An owner who simply leaves it out is handed
   * platform-wide order counts, group sizes, and average order value.
   *
   * These pin the rule: the route resolves a tenant for every caller, exactly
   * as the list route does, so no request reaches `getStatistics` without one.
   * The unscoped view has no caller — the only consumer is the admin
   * dashboard, which always asks about one restaurant — so nothing is left
   * able to request it.
   */
  describe("GET /statistics tenant scoping", () => {
    it("scopes an owner to their own restaurant when the query omits one", async () => {
      currentUser.value = { id: 10, role: 1, restaurantId: "restaurant-1" };
      getStatistics.mockResolvedValue({ totalGroupOrders: 0 });

      const response = await routes.fetch(
        new Request("https://test/statistics?timeRange=week"),
        createEnv() as never,
      );

      expect(response.status).toBe(200);
      expect(getStatistics).toHaveBeenCalledWith("restaurant-1", "week");
    });

    it("still refuses an owner who names someone else's restaurant", async () => {
      currentUser.value = { id: 10, role: 1, restaurantId: "restaurant-1" };
      getStatistics.mockResolvedValue({ totalGroupOrders: 0 });

      const response = await withSilencedRouteError(() =>
        routes.fetch(
          new Request("https://test/statistics?restaurantId=restaurant-2"),
          createEnv() as never,
        ),
      );

      // This harness mounts the router without the app's ApiError handler, so
      // a forbidden throw surfaces as 500 here (same as the /lock case above).
      // The assertion that matters is that the service was never reached.
      expect(response.status).toBe(500);
      expect(getStatistics).not.toHaveBeenCalled();
    });

    it("scopes a platform admin to the restaurant they asked about", async () => {
      currentUser.value = { id: 1, role: 0, restaurantId: "admin" };
      getStatistics.mockResolvedValue({ totalGroupOrders: 12 });

      const response = await routes.fetch(
        new Request("https://test/statistics?restaurantId=restaurant-2"),
        createEnv() as never,
      );

      expect(response.status).toBe(200);
      expect(getStatistics).toHaveBeenCalledWith("restaurant-2", "month");
    });

    it("never asks the service for every restaurant at once", async () => {
      // Role 0 has no restaurant of its own to fall back to, so this is the
      // caller most likely to slip through as an unscoped query.
      currentUser.value = { id: 1, role: 0, restaurantId: "admin" };
      getStatistics.mockResolvedValue({ totalGroupOrders: 0 });

      await routes.fetch(
        new Request("https://test/statistics?timeRange=week"),
        createEnv() as never,
      );

      expect(getStatistics).toHaveBeenCalledOnce();
      expect(getStatistics.mock.calls[0][0]).toBeTruthy();
    });
  });
  // The column exists to say whose word a settlement is. If a diner could set
  // it, it would say nothing: anyone could label their own claim as a
  // restaurant confirmation and have it counted as takings later.
  it("ignores a settledBy claimed in the request body", async () => {
    const groupOrderId = "018ffb9a-7b8a-7c3d-9f23-000000000001";
    const memberId = "018ffb9a-7b8a-7c3d-9f23-000000000002";
    isMemberSession.mockResolvedValue(true);
    isHostSession.mockResolvedValue(false);
    processPayment.mockResolvedValue({ success: true, data: {} });
    const env = createEnv();

    const response = await routes.fetch(
      new Request(`https://test/${groupOrderId}/payment/${memberId}`, {
        method: "POST",
        body: JSON.stringify({
          memberToken: "member-session",
          paymentMethod: "cash",
          settledBy: "staff",
        }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(processPayment).toHaveBeenCalledWith(
      groupOrderId,
      memberId,
      expect.not.objectContaining({ settledBy: "staff" }),
      "self",
    );
  });
});
