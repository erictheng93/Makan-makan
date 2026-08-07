import { describe, expect, it, vi, beforeEach } from "vitest";

const ws = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
  connectionStatus: { value: "disconnected" },
  /**
   * useWebSocket takes its handlers as construction options rather than
   * exposing an `onMessage(handler)` method, so the mock has to capture the
   * options object to be able to deliver a server push.
   */
  options: null as { onMessage?: (data: unknown) => void } | null,
}));

vi.mock("./useWebSocket", () => ({
  useWebSocket: (options?: { onMessage?: (data: unknown) => void }) => {
    ws.options = options ?? null;
    return ws;
  },
}));

/** Deliver a message exactly as the socket would: already parsed. */
function pushFromServer(type: string, data: unknown) {
  if (!ws.options?.onMessage) {
    throw new Error(
      "useGroupOrder did not register an onMessage handler with useWebSocket",
    );
  }
  ws.options.onMessage({ type, data });
}

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "@/services/api";
import {
  readHostCredentials,
  saveHostCredentials,
} from "@/utils/groupOrderSession";
import { useGroupOrder } from "./useGroupOrder";

/**
 * `apiClient` already unwraps the `{ success, data }` envelope and resolves to
 * the inner payload, so mocks resolve with the payload directly.
 */
function createResponse() {
  return {
    groupOrderId: "go-1",
    shareCode: "ABC12345",
    expiresAt: new Date("2026-06-07T00:45:00.000Z").toISOString(),
    host: {
      id: "m-1",
      memberId: "m-1",
      memberName: "Alex",
      isHost: true,
      joinedAt: new Date("2026-06-07T00:00:00.000Z").toISOString(),
    },
    memberToken: "session-1",
    recoveryCode: "recovery-1",
  };
}

function summaryResponse() {
  return {
    groupOrder: {
      id: "go-1",
      restaurantId: "rest-1",
      shareCode: "ABC12345",
      status: "active",
      splitType: "by_item",
      expiresAt: new Date("2026-06-07T00:45:00.000Z").toISOString(),
      createdBy: null,
    },
    members: [
      {
        id: "m-1",
        memberName: "Alex",
        isHost: true,
        joinedAt: new Date("2026-06-07T00:00:00.000Z").toISOString(),
      },
    ],
    cartItems: [],
    activities: [],
  };
}

async function createHostedGroup() {
  const group = useGroupOrder({ restaurantId: "rest-1" });
  vi.mocked(apiClient.post).mockResolvedValueOnce(createResponse());
  vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
  await group.createGroupOrder({ hostName: "Alex" });
  return group;
}

describe("useGroupOrder — data layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a group order against the real endpoint and keeps the host credentials", async () => {
    const group = await createHostedGroup();

    expect(apiClient.post).toHaveBeenCalledWith(
      "/orders/group/create",
      expect.objectContaining({ restaurantId: "rest-1", hostName: "Alex" }),
    );
    expect(group.groupOrder.value?.id).toBe("go-1");
    expect(group.groupOrder.value?.shareCode).toBe("ABC12345");
    // Phase A returns the recovery code exactly once, here. Dropping it makes
    // host recovery impossible for the rest of the group order's life.
    expect(group.recoveryCode.value).toBe("recovery-1");
  });

  it("adds to cart via /orders/group/:id/cart, never the /group-orders prefix", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      id: "item-1",
      memberId: "m-1",
      menuItemId: 42,
      quantity: 2,
      unitPrice: 10,
      totalPrice: 20,
      customizations: {},
    });

    await group.addToCart({
      menuItemId: "42",
      menuItemName: "Fried Rice",
      menuItemPrice: 10,
      quantity: 2,
    });

    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/orders/group/go-1/cart",
      expect.objectContaining({ menuItemId: 42, quantity: 2 }),
    );
    const calledPaths = vi
      .mocked(apiClient.post)
      .mock.calls.map(([url]) => String(url));
    expect(calledPaths.some((url) => url.startsWith("/group-orders"))).toBe(
      false,
    );
  });

  it("does not push cart mutations over the socket itself", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      id: "item-1",
      memberId: "m-1",
      menuItemId: 1,
      quantity: 1,
      unitPrice: 5,
      totalPrice: 5,
      customizations: {},
    });
    await group.addToCart({
      menuItemId: "1",
      menuItemName: "Tea",
      menuItemPrice: 5,
      quantity: 1,
    });

    // The server broadcasts GROUP_CART_ITEM_ADDED after the REST call succeeds.
    // A client that also pushes its own copy makes every other member apply the
    // item twice, and makes the sender the only one who cannot be corrected by
    // the server's version.
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("updates and removes cart items through the real endpoints", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.put).mockResolvedValueOnce({
      id: "item-1",
      memberId: "m-1",
      menuItemId: 1,
      quantity: 3,
      unitPrice: 5,
      totalPrice: 15,
      customizations: {},
    });
    await group.updateCartItem("item-1", { quantity: 3 });
    expect(apiClient.put).toHaveBeenCalledWith(
      "/orders/group/go-1/cart/item-1",
      expect.objectContaining({ quantity: 3 }),
    );

    vi.mocked(apiClient.delete).mockResolvedValueOnce({});
    await group.removeFromCart("item-1");
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/orders/group/go-1/cart/item-1",
    );
  });

  it("maps the GroupOrderSummary shape rather than treating it as a GroupOrder", async () => {
    const group = await createHostedGroup();

    expect(group.groupOrder.value?.members).toHaveLength(1);
    expect(group.groupOrder.value?.members[0]).toMatchObject({
      id: "m-1",
      name: "Alex",
      isHost: true,
    });
    expect(group.groupOrder.value?.restaurantId).toBe("rest-1");
  });

  it("exports a pure REST loader for views that must not connect realtime", async () => {
    const group = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      ...summaryResponse(),
      groupOrder: {
        ...summaryResponse().groupOrder,
        splitType: "equal",
      },
    });

    await group.loadGroupOrder("go-1");

    expect(apiClient.get).toHaveBeenCalledWith("/orders/group/go-1");
    expect(group.groupOrder.value?.id).toBe("go-1");
    expect(group.groupOrder.value?.splitBillConfig).toEqual({
      mode: "equal",
    });
    expect(ws.connect).not.toHaveBeenCalled();
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("carries the backend status vocabulary through unchanged", async () => {
    const group = await createHostedGroup();

    // Shared union, no translation layer: a status the frontend has not seen
    // must not be silently rendered as an editable cart.
    expect(group.groupOrder.value?.status).toBe("active");
  });

  it("builds a share link the join route can actually match", async () => {
    const group = await createHostedGroup();

    // The join route is /group/:shareCode. A link built from the group order id
    // resolves to a share code that does not exist, so every shared link 404s.
    expect(group.getShareLink()).toContain("/group/ABC12345");
    expect(group.getShareLink()).not.toContain("go-1");
  });

  it("submits through the lock endpoint and never the removed submit route", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      masterOrderId: "order-1",
      status: "completed",
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      ...summaryResponse(),
      groupOrder: {
        ...summaryResponse().groupOrder,
        status: "completed",
      },
    });

    await group.submitOrder();

    const calledPaths = vi
      .mocked(apiClient.post)
      .mock.calls.map(([url]) => String(url));
    expect(calledPaths).toContain("/orders/group/go-1/lock");
    expect(calledPaths.some((url) => url.includes("/submit"))).toBe(false);
  });

  it("leaves through the real endpoint with the current member id", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.post).mockResolvedValueOnce({});
    await group.leaveGroupOrder();

    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/orders/group/go-1/leave/m-1",
      { memberToken: "session-1" },
    );
    expect(group.groupOrder.value).toBeNull();
    expect(ws.disconnect).toHaveBeenCalled();
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("fails loudly on split bill mutations until the split endpoint is wired", async () => {
    const group = await createHostedGroup();

    await expect(group.setSplitBillMode("equal")).rejects.toThrow(
      /not yet available/i,
    );
    await expect(group.setCustomShares({ "m-1": 100 })).rejects.toThrow(
      /not yet available/i,
    );
    expect(group.groupOrder.value?.splitBillConfig).toEqual({
      mode: "by_item",
    });
    const calledPaths = vi
      .mocked(apiClient.post)
      .mock.calls.map(([url]) => String(url));
    expect(calledPaths.some((url) => url.includes("/split"))).toBe(false);
    expect(ws.send).not.toHaveBeenCalled();
  });
});

describe("useGroupOrder — server-pushed realtime events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ws.options = null;
  });

  function serverCartItem(overrides: Record<string, unknown> = {}) {
    return {
      id: "item-9",
      memberId: "m-2",
      menuItemId: 7,
      quantity: 2,
      unitPrice: 3,
      totalPrice: 6,
      customizations: {},
      addedAt: new Date("2026-06-07T00:10:00.000Z").toISOString(),
      ...overrides,
    };
  }

  it("applies a cart item another member added", async () => {
    const group = await createHostedGroup();

    pushFromServer("group_cart_item_added", {
      groupOrderId: "go-1",
      item: serverCartItem(),
    });

    expect(group.groupOrder.value?.cartItems).toHaveLength(1);
    expect(group.groupOrder.value?.cartItems[0]).toMatchObject({
      id: "item-9",
      quantity: 2,
      addedBy: "m-2",
    });
  });

  it("applies an update and a removal pushed by the server", async () => {
    const group = await createHostedGroup();

    pushFromServer("group_cart_item_added", {
      groupOrderId: "go-1",
      item: serverCartItem(),
    });
    pushFromServer("group_cart_item_updated", {
      groupOrderId: "go-1",
      item: serverCartItem({ quantity: 5, totalPrice: 15 }),
    });
    expect(group.groupOrder.value?.cartItems[0]).toMatchObject({ quantity: 5 });

    pushFromServer("group_cart_item_removed", {
      groupOrderId: "go-1",
      itemId: "item-9",
    });
    expect(group.groupOrder.value?.cartItems).toHaveLength(0);
  });

  it("applies a member who joined", async () => {
    const group = await createHostedGroup();

    pushFromServer("group_member_joined", {
      groupOrderId: "go-1",
      member: {
        id: "m-2",
        memberId: "m-2",
        memberName: "Sam",
        isHost: false,
        joinedAt: new Date("2026-06-07T00:05:00.000Z").toISOString(),
      },
    });

    expect(group.groupOrder.value?.members).toHaveLength(2);
    expect(group.groupOrder.value?.members[1]).toMatchObject({
      id: "m-2",
      name: "Sam",
      isHost: false,
    });
  });

  it("ignores events addressed to a different group order", async () => {
    const group = await createHostedGroup();

    // One socket can carry more than one room's traffic, and applying another
    // table's cart item would put food nobody ordered on this bill.
    pushFromServer("group_cart_item_added", {
      groupOrderId: "someone-elses-group",
      item: serverCartItem(),
    });

    expect(group.groupOrder.value?.cartItems).toHaveLength(0);
  });

  it("keeps a dish name the server no longer sends", async () => {
    const group = await createHostedGroup();

    pushFromServer("group_cart_item_added", {
      groupOrderId: "go-1",
      item: {
        ...serverCartItem(),
        menuItem: { id: 7, name: "Laksa", price: 3 },
      },
    });
    expect(group.groupOrder.value?.cartItems[0].menuItemName).toBe("Laksa");

    // updateCartItem drops menuItem when the menu row is gone, so an update
    // can arrive without it. Replacing a correct name with an empty one is
    // worse than the gap it came from: the row silently loses its dish.
    pushFromServer("group_cart_item_updated", {
      groupOrderId: "go-1",
      item: serverCartItem({ quantity: 9, totalPrice: 27 }),
    });

    expect(group.groupOrder.value?.cartItems[0]).toMatchObject({
      quantity: 9,
      menuItemName: "Laksa",
    });
  });

  it("never answers a server push with a push of its own", async () => {
    const group = await createHostedGroup();

    pushFromServer("group_cart_item_added", {
      groupOrderId: "go-1",
      item: serverCartItem(),
    });

    // Echoing an applied event back is how two clients talk each other into an
    // infinite loop.
    expect(ws.send).not.toHaveBeenCalled();
    expect(group.groupOrder.value?.cartItems).toHaveLength(1);
  });

  it("survives an event shape it does not recognise", async () => {
    const group = await createHostedGroup();

    expect(() =>
      pushFromServer("group_order_created", { groupOrderId: "go-1" }),
    ).not.toThrow();
    expect(() => pushFromServer("something_new", {})).not.toThrow();
    expect(group.groupOrder.value?.cartItems).toHaveLength(0);
  });

  it("closes the socket on disconnectRealtime", async () => {
    const group = await createHostedGroup();

    group.disconnectRealtime();

    expect(ws.disconnect).toHaveBeenCalled();
    expect(group.isConnected.value).toBe(false);
  });
});

describe("useGroupOrder — host credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ws.options = null;
    localStorage.clear();
    vi.stubEnv("VITE_REALTIME_URL", "wss://realtime.example.test");
  });

  it("persists both credentials when the group is created", async () => {
    await createHostedGroup();

    expect(readHostCredentials("go-1")).toMatchObject({
      memberToken: "session-1",
      recoveryCode: "recovery-1",
    });
  });

  it("restores the host session from storage without needing the recovery code", async () => {
    saveHostCredentials({
      groupOrderId: "go-1",
      memberToken: "stored-token",
      recoveryCode: "recovery-1",
    });

    const group = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await group.loadGroupOrder("go-1");

    vi.mocked(apiClient.post).mockResolvedValueOnce({ token: "rt-1" });
    await group.connectToGroupOrder("go-1");

    // Refreshing the page is the common case; recovery is for losing the
    // device. If a refresh needed the recovery code, the code would be doing
    // persistence's job.
    expect(apiClient.post).toHaveBeenCalledWith(
      "/realtime/auth/group-token",
      expect.objectContaining({ memberToken: "stored-token" }),
    );
  });

  it("keeps the host member id after a page reload", async () => {
    await createHostedGroup();

    vi.resetModules();
    const { useGroupOrder: useFreshGroupOrder } =
      await import("./useGroupOrder");

    const group = useFreshGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await group.loadGroupOrder("go-1");

    expect(group.currentMemberId.value).toBe("m-1");
    expect(group.isHost.value).toBe(true);
  });

  it("recovers the host session and keeps the recovery code", async () => {
    saveHostCredentials({
      groupOrderId: "go-1",
      memberToken: "dead-token",
      recoveryCode: "recovery-1",
    });

    const group = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      memberToken: "new-token",
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    vi.mocked(apiClient.post).mockResolvedValueOnce({ token: "rt-1" });

    await group.recoverHost("go-1", "recovery-1");

    expect(apiClient.post).toHaveBeenCalledWith(
      "/orders/group/go-1/recover",
      expect.objectContaining({ recoveryCode: "recovery-1" }),
    );
    expect(readHostCredentials("go-1")).toMatchObject({
      memberToken: "new-token",
      recoveryCode: "recovery-1",
    });
  });

  it("normalises a pasted recovery code before spending an attempt", async () => {
    const group = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      memberToken: "new-token",
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    vi.mocked(apiClient.post).mockResolvedValueOnce({ token: "rt-1" });

    await group.recoverHost("go-1", "  RECOVERY-1  ");

    // randomUUID() emits lowercase hex and the backend compares exactly, so an
    // autocapitalising keyboard would otherwise burn one of only five attempts
    // per fifteen minutes on a code that is actually correct.
    expect(apiClient.post).toHaveBeenCalledWith(
      "/orders/group/go-1/recover",
      expect.objectContaining({ recoveryCode: "recovery-1" }),
    );
  });

  it("never puts the recovery code in the shareable link", async () => {
    const group = await createHostedGroup();

    expect(group.getShareLink()).not.toContain("recovery-1");
    expect(group.getShareLink()).not.toMatch(/recovery/i);
  });

  it("clears stored credentials when the member leaves", async () => {
    const group = await createHostedGroup();
    vi.mocked(apiClient.post).mockResolvedValueOnce({});

    await group.leaveGroupOrder();

    expect(readHostCredentials("go-1")).toBeNull();
  });
});

describe("useGroupOrder — submitting the order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ws.options = null;
    localStorage.clear();
  });

  function apiError(status: number, message = `HTTP ${status}`) {
    return Object.assign(new Error(message), { status });
  }

  function finalizedSummary(status: string, masterOrderId: string | null) {
    const base = summaryResponse();
    return {
      ...base,
      groupOrder: { ...base.groupOrder, status, masterOrderId },
    };
  }

  it("locks the group order through the real endpoint with the host token", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      masterOrderId: "order-1",
      status: "completed",
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce(
      finalizedSummary("completed", "order-1"),
    );

    await group.submitOrder();

    // /lock authenticates the host by memberToken, not a JWT. Phase A hosts
    // may have no account at all.
    expect(apiClient.post).toHaveBeenCalledWith(
      "/orders/group/go-1/lock",
      expect.objectContaining({ memberToken: "session-1" }),
    );
    const calledPaths = vi
      .mocked(apiClient.post)
      .mock.calls.map(([url]) => String(url));
    expect(calledPaths.some((url) => url.includes("/submit"))).toBe(false);
  });

  it("reloads the group order so the view stops accepting edits", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      masterOrderId: "order-1",
      status: "completed",
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce(
      finalizedSummary("completed", "order-1"),
    );

    await group.submitOrder();

    expect(group.groupOrder.value?.status).toBe("completed");
  });

  it("submits with credentials restored from storage after a refresh", async () => {
    saveHostCredentials({
      groupOrderId: "go-1",
      memberToken: "stored-token",
      recoveryCode: "recovery-1",
    });

    const group = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await group.loadGroupOrder("go-1");

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      masterOrderId: "order-1",
      status: "completed",
    });
    vi.mocked(apiClient.get).mockResolvedValueOnce(
      finalizedSummary("completed", "order-1"),
    );

    await group.submitOrder();

    expect(apiClient.post).toHaveBeenCalledWith(
      "/orders/group/go-1/lock",
      expect.objectContaining({ memberToken: "stored-token" }),
    );
  });

  it("refuses to submit at all when no host credential is available", async () => {
    const group = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await group.loadGroupOrder("go-1");

    await expect(group.submitOrder()).rejects.toThrow();

    // Without a token the request can only ever be rejected, and spending it
    // burns one of the host's rate-limited attempts for nothing.
    const calledPaths = vi
      .mocked(apiClient.post)
      .mock.calls.map(([url]) => String(url));
    expect(calledPaths.some((url) => url.includes("/lock"))).toBe(false);
  });

  it("says who may submit when the caller is not the host", async () => {
    const group = await createHostedGroup();
    vi.mocked(apiClient.post).mockRejectedValueOnce(apiError(403));

    await expect(group.submitOrder()).rejects.toMatchObject({
      isHostOnly: true,
    });
  });

  it("does not tell the host nothing happened when the order was already placed", async () => {
    const group = await createHostedGroup();

    // finalizeGroupOrder creates the real order first and splits the bill
    // second. A 400 from the split leaves the restaurant holding an order the
    // customer was just told had failed. They would re-submit, or walk away
    // while the kitchen cooks it.
    vi.mocked(apiClient.post).mockRejectedValueOnce(
      apiError(400, "Split total does not match order total"),
    );
    vi.mocked(apiClient.get).mockResolvedValueOnce(
      finalizedSummary("finalizing_failed", "order-1"),
    );

    await expect(group.submitOrder()).rejects.toMatchObject({
      orderAlreadyPlaced: true,
    });
    expect(group.groupOrder.value?.status).toBe("finalizing_failed");
  });

  it("treats an ordinary failure as an ordinary failure", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.post).mockRejectedValueOnce(
      apiError(400, "Cannot finalize an empty group order"),
    );
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());

    await expect(group.submitOrder()).rejects.not.toMatchObject({
      orderAlreadyPlaced: true,
    });
    expect(group.groupOrder.value?.status).toBe("active");
  });
});

/**
 * Every ref in useGroupOrder is created inside the function, so each caller
 * gets its own state. GroupOrderJoinView joins on one instance and then routes
 * to GroupOrderView, which calls useGroupOrder again and starts from nothing —
 * a member who has just joined is immediately "not a member of this group
 * order" and never reaches realtime.
 *
 * These tests therefore always join on one instance and connect on another.
 * They assert what has to be true for the member rather than where the
 * credential is kept, so the storage choice stays open.
 */
describe("useGroupOrder — a member's session outlives the instance", () => {
  beforeEach(() => {
    // clearAllMocks leaves queued mockResolvedValueOnce values in place, so an
    // unconsumed queue from one test gets eaten by the next one's first call.
    // Reset drains the queues as well.
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.put).mockReset();
    vi.mocked(apiClient.delete).mockReset();
    ws.connect.mockClear();
    ws.disconnect.mockClear();
    ws.send.mockClear();
    ws.options = null;
    localStorage.clear();
  });

  function joinResponse() {
    return {
      member: { id: "m-2", memberId: "m-2", memberName: "Sam" },
      groupOrder: { id: "go-1", restaurantId: "rest-1" },
      memberToken: "member-session-1",
    };
  }

  async function joinOnOneInstance() {
    const joining = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.post).mockResolvedValueOnce(joinResponse());
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    const ok = await joining.joinGroupOrder("ABC12345", "Sam");
    expect(ok).toBe(true);
    return joining;
  }

  it("connects from a fresh instance after joining on another one", async () => {
    await joinOnOneInstance();

    // Stands in for the route change from the join view to the cart view.
    const viewing = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await viewing.loadGroupOrder("go-1");

    vi.mocked(apiClient.post).mockResolvedValueOnce({ token: "rt-1" });
    await expect(viewing.connectToGroupOrder("go-1")).resolves.toBeUndefined();

    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/realtime/auth/group-token",
      expect.objectContaining({
        groupOrderId: "go-1",
        memberToken: "member-session-1",
      }),
    );
  });

  it("keeps the joining member's own id, not the host's", async () => {
    await joinOnOneInstance();

    const viewing = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await viewing.loadGroupOrder("go-1");

    // Cart writes are attributed by memberId. Falling back to the host would
    // put this member's food on someone else's split bill.
    expect(viewing.currentMemberId.value).toBe("m-2");
    expect(viewing.isHost.value).toBe(false);
  });

  it("restores the member after a page reload", async () => {
    await joinOnOneInstance();

    vi.resetModules();
    const { useGroupOrder: useFreshGroupOrder } =
      await import("./useGroupOrder");

    const viewing = useFreshGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await viewing.loadGroupOrder("go-1");

    vi.mocked(apiClient.post).mockResolvedValueOnce({ token: "rt-1" });
    await viewing.connectToGroupOrder("go-1");

    expect(viewing.currentMemberId.value).toBe("m-2");
    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/realtime/auth/group-token",
      expect.objectContaining({ memberToken: "member-session-1" }),
    );
  });

  it("does not lend a member's session to a different group order", async () => {
    await joinOnOneInstance();

    const other = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      ...summaryResponse(),
      groupOrder: { ...summaryResponse().groupOrder, id: "go-2" },
    });
    await other.loadGroupOrder("go-2");

    await expect(other.connectToGroupOrder("go-2")).rejects.toThrow();
  });

  it("forgets the member once they leave", async () => {
    const joining = await joinOnOneInstance();
    vi.mocked(apiClient.post).mockResolvedValueOnce({});
    await joining.leaveGroupOrder();

    const returning = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await returning.loadGroupOrder("go-1");

    await expect(returning.connectToGroupOrder("go-1")).rejects.toThrow();
  });

  it("still restores a host across instances", async () => {
    // Regression guard: the host path already worked through
    // hydrateHostCredentials and must keep working.
    await createHostedGroup();

    const viewing = useGroupOrder({ restaurantId: "rest-1" });
    vi.mocked(apiClient.get).mockResolvedValueOnce(summaryResponse());
    await viewing.loadGroupOrder("go-1");

    vi.mocked(apiClient.post).mockResolvedValueOnce({ token: "rt-1" });
    await viewing.connectToGroupOrder("go-1");

    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/realtime/auth/group-token",
      expect.objectContaining({ memberToken: "session-1" }),
    );
  });
});
