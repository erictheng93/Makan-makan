import { describe, expect, it, vi, beforeEach } from "vitest";

const ws = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
  connectionStatus: { value: "disconnected" },
}));

vi.mock("./useWebSocket", () => ({
  useWebSocket: () => ws,
}));

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "@/services/api";
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

  it("fails loudly on submitOrder until the finalize endpoint is wired", async () => {
    const group = await createHostedGroup();

    await expect(group.submitOrder()).rejects.toThrow(/not yet available/i);
    const calledPaths = vi
      .mocked(apiClient.post)
      .mock.calls.map(([url]) => String(url));
    expect(calledPaths.some((url) => url.includes("/submit"))).toBe(false);
  });

  it("leaves through the real endpoint with the current member id", async () => {
    const group = await createHostedGroup();

    vi.mocked(apiClient.post).mockResolvedValueOnce({});
    await group.leaveGroupOrder();

    expect(apiClient.post).toHaveBeenLastCalledWith(
      "/orders/group/go-1/leave/m-1",
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
