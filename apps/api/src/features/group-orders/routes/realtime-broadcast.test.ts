import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

/**
 * Every group order realtime event the API emits has to survive the realtime
 * worker's own validation. Both sides mock the other in their unit tests, so
 * the real event shape had never met the real rule — and three of the five
 * event types were being rejected in production with nothing to show for it.
 *
 * These tests capture what the routes actually hand the broadcaster and check
 * it against the shared predicate that `RealtimeSession.handleBroadcast` is
 * expected to use. One rule, one place, both sides.
 */
const broadcasts = vi.hoisted(
  () => [] as Array<{ roomType: string; roomId: string; event: unknown }>,
);

const groupServiceMocks = vi.hoisted(() => ({
  createGroupOrder: vi.fn(),
  joinGroup: vi.fn(),
  addCartItem: vi.fn(),
  updateCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  getGroupOrder: vi.fn(),
  isMemberSession: vi.fn(),
}));

vi.mock("../services/GroupOrdersService", () => ({
  GroupOrdersService: vi.fn(function GroupOrdersService() {
    return groupServiceMocks;
  }),
}));

vi.mock("@makanmasak/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makanmasak/database")>();
  return {
    ...actual,
    RealtimeBroadcastService: vi.fn(function RealtimeBroadcastService() {
      return {
        generateEventId: () => "evt-1",
        broadcastEvent: vi.fn(
          async (roomType: string, roomId: string, event: unknown) => {
            broadcasts.push({ roomType, roomId, event });
          },
        ),
      };
    }),
  };
});

import { isValidRealtimeEvent } from "@makanmasak/shared-types";
import groupOrdersRoutes from "./index";

const RESTAURANT_ID = "rest-1";
const GROUP_ORDER_ID = "018ffb9a-7b8a-7c3d-9f23-123456789abc";
const MEMBER_ID = "018ffb9a-7b8a-7c3d-9f23-1234567890a1";
const SECOND_MEMBER_ID = "018ffb9a-7b8a-7c3d-9f23-1234567890a2";
const CART_ITEM_ID = "018ffb9a-7b8a-7c3d-9f23-1234567890b1";
const MEMBER_TOKEN = "member-session-token";
const CSRF = "b".repeat(64);

function buildApp() {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 403 | 404,
      );
    }
    return c.json({ success: false, error: { message: String(err) } }, 500);
  });
  app.route("/orders/group", groupOrdersRoutes);
  return app;
}

const env = { DB: {}, CACHE_KV: {} } as never;

function request(method: string, path: string, body?: unknown) {
  return new Request(`https://test${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: "https://test",
      host: "test",
      "x-csrf-token": CSRF,
      cookie: `csrf_token=${CSRF}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const cartItem = {
  id: CART_ITEM_ID,
  itemId: CART_ITEM_ID,
  groupOrderId: GROUP_ORDER_ID,
  memberId: MEMBER_ID,
  menuItemId: 42,
  quantity: 1,
};

describe("isValidRealtimeEvent", () => {
  const valid = {
    type: "group_cart_item_added",
    eventId: "evt-1",
    timestamp: 1780790400000,
    restaurantId: RESTAURANT_ID,
    data: {},
  };

  it("accepts a complete event", () => {
    expect(isValidRealtimeEvent(valid)).toBe(true);
  });

  it.each(["type", "eventId", "timestamp", "restaurantId"])(
    "rejects an event missing %s",
    (field) => {
      const event = { ...valid, [field]: undefined };
      expect(isValidRealtimeEvent(event)).toBe(false);
    },
  );

  it("rejects an empty restaurantId", () => {
    // String(undefined ?? "") satisfies `restaurantId: string` at compile time
    // and is rejected at runtime. The type cannot express "non-empty", so the
    // predicate has to.
    expect(isValidRealtimeEvent({ ...valid, restaurantId: "" })).toBe(false);
  });
});

describe("group order realtime broadcasts survive validation", () => {
  beforeEach(() => {
    broadcasts.length = 0;
    vi.clearAllMocks();
    // Cart writes are authorised elsewhere; these tests are about the shape of
    // the event that follows a successful write.
    groupServiceMocks.isMemberSession.mockResolvedValue(true);
    groupServiceMocks.getGroupOrder.mockResolvedValue({
      success: true,
      data: { groupOrder: { id: GROUP_ORDER_ID, restaurantId: RESTAURANT_ID } },
    });
  });

  function expectEveryBroadcastValid() {
    expect(broadcasts.length).toBeGreaterThan(0);
    for (const { event } of broadcasts) {
      expect({
        type: (event as { type?: string }).type,
        valid: isValidRealtimeEvent(event),
      }).toEqual({
        type: (event as { type?: string }).type,
        valid: true,
      });
    }
  }

  it("emits a valid event when a cart item is added", async () => {
    groupServiceMocks.addCartItem.mockResolvedValue({
      success: true,
      data: cartItem,
    });

    const res = await buildApp().fetch(
      request("POST", `/orders/group/${GROUP_ORDER_ID}/cart`, {
        memberId: MEMBER_ID,
        memberToken: MEMBER_TOKEN,
        menuItemId: 42,
        quantity: 1,
      }),
      env,
    );

    expect(res.status).toBe(200);
    expectEveryBroadcastValid();
  });

  it("emits a valid event when a cart item is updated", async () => {
    groupServiceMocks.updateCartItem.mockResolvedValue({
      success: true,
      data: { ...cartItem, quantity: 3 },
    });

    const res = await buildApp().fetch(
      request("PUT", `/orders/group/${GROUP_ORDER_ID}/cart/${CART_ITEM_ID}`, {
        quantity: 3,
        memberId: MEMBER_ID,
        memberToken: MEMBER_TOKEN,
      }),
      env,
    );

    expect(res.status).toBe(200);
    expectEveryBroadcastValid();
  });

  it("emits a valid event when a cart item is removed", async () => {
    groupServiceMocks.removeCartItem.mockResolvedValue({ success: true });

    const res = await buildApp().fetch(
      request(
        "DELETE",
        `/orders/group/${GROUP_ORDER_ID}/cart/${CART_ITEM_ID}`,
        { memberId: MEMBER_ID, memberToken: MEMBER_TOKEN },
      ),
      env,
    );

    expect(res.status).toBe(200);
    expectEveryBroadcastValid();
  });

  it("emits a valid event when a member joins", async () => {
    groupServiceMocks.joinGroup.mockResolvedValue({
      success: true,
      data: {
        member: {
          id: SECOND_MEMBER_ID,
          memberId: SECOND_MEMBER_ID,
          memberName: "Sam",
        },
        groupOrder: {
          id: GROUP_ORDER_ID,
          groupOrderId: GROUP_ORDER_ID,
          restaurantId: RESTAURANT_ID,
        },
        memberToken: "session-2",
      },
    });

    const res = await buildApp().fetch(
      request("POST", "/orders/group/join/ABC12345", { memberName: "Sam" }),
      env,
    );

    expect(res.status).toBe(200);
    expectEveryBroadcastValid();
  });

  it("carries the fields a client needs to render the cart row", async () => {
    // The client renders from item.menuItem.name. An event that validates but
    // arrives without it still shows a price with no dish beside it, so the
    // route must pass the service's row through whole rather than thinning it.
    groupServiceMocks.addCartItem.mockResolvedValue({
      success: true,
      data: {
        ...cartItem,
        menuItem: { id: 42, name: "Laksa", price: 12.5, imageUrl: undefined },
      },
    });

    await buildApp().fetch(
      request("POST", `/orders/group/${GROUP_ORDER_ID}/cart`, {
        memberId: MEMBER_ID,
        memberToken: MEMBER_TOKEN,
        menuItemId: 42,
        quantity: 1,
      }),
      env,
    );

    expect(broadcasts.length).toBeGreaterThan(0);
    const event = broadcasts.at(-1)?.event as {
      data?: { item?: { menuItem?: { name?: string } } };
    };
    expect(event.data?.item?.menuItem?.name).toBe("Laksa");
  });

  it("never hands the broadcaster an event it will reject", async () => {
    // The helper coerces a missing restaurantId to "" and its catch only warns,
    // so an invalid event costs nothing at the call site and everything at the
    // socket. Whatever the fix, nothing invalid may reach the broadcaster.
    groupServiceMocks.addCartItem.mockResolvedValue({
      success: true,
      data: cartItem,
    });

    await buildApp().fetch(
      request("POST", `/orders/group/${GROUP_ORDER_ID}/cart`, {
        memberId: MEMBER_ID,
        memberToken: MEMBER_TOKEN,
        menuItemId: 42,
        quantity: 1,
      }),
      env,
    );

    // Guard against passing by producing nothing: a request that never
    // reached the handler emits no events, and an empty list trivially
    // contains nothing invalid.
    expect(broadcasts.length).toBeGreaterThan(0);
    const invalid = broadcasts.filter(
      ({ event }) => !isValidRealtimeEvent(event),
    );
    expect(invalid).toEqual([]);
  });
});
