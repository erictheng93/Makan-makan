import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

/**
 * `/lock` proves the caller holds the host's memberToken before it turns a
 * cart into a real order. Three sibling routes that are just as consequential
 * prove nothing at all.
 *
 * The groupOrderId is a UUID, so this is not about outsiders — it is shared
 * with everyone at the table by design. The exposure is member-to-member: any
 * member holding the id can act on any other member.
 *
 * These tests pin who may do what. The rule differs per route, so they assert
 * the outcome rather than naming a service method:
 *
 *   /split           host only — it locks the group and creates the bills
 *   /payment/:id     host only — it marks money as received
 *   /leave/:id       that member, or the host removing someone
 */
const groupServiceMocks = vi.hoisted(() => ({
  splitBill: vi.fn(),
  processPayment: vi.fn(),
  leaveGroup: vi.fn(),
  isHostSession: vi.fn(),
  isMemberSession: vi.fn(),
  getGroupOrder: vi.fn(),
}));

vi.mock("../services/GroupOrdersService", () => ({
  GroupOrdersService: vi.fn(function GroupOrdersService() {
    return groupServiceMocks;
  }),
}));

vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makanmakan/database")>();
  return {
    ...actual,
    RealtimeBroadcastService: vi.fn(function RealtimeBroadcastService() {
      return {
        generateEventId: () => "evt-1",
        broadcastEvent: vi.fn(async () => undefined),
      };
    }),
  };
});

import groupOrdersRoutes from "./index";

const GROUP_ORDER_ID = "018ffb9a-7b8a-7c3d-9f23-123456789abc";
const HOST_MEMBER_ID = "018ffb9a-7b8a-7c3d-9f23-1234567890a1";
const OTHER_MEMBER_ID = "018ffb9a-7b8a-7c3d-9f23-1234567890a2";
const HOST_TOKEN = "host-session-token";
const OTHER_TOKEN = "other-session-token";
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

async function call(method: string, path: string, body?: unknown) {
  const response = await buildApp().fetch(
    new Request(`https://test${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "https://test",
        host: "test",
        "x-csrf-token": CSRF,
        cookie: `csrf_token=${CSRF}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
  return { status: response.status };
}

/** Only the host's token is genuine in these tests. */
function onlyHostTokenIsValid() {
  groupServiceMocks.isHostSession.mockImplementation(
    async (_groupOrderId: string, token: string) => token === HOST_TOKEN,
  );
  groupServiceMocks.isMemberSession.mockImplementation(
    async (_groupOrderId: string, memberId: string, token: string) =>
      (memberId === HOST_MEMBER_ID && token === HOST_TOKEN) ||
      (memberId === OTHER_MEMBER_ID && token === OTHER_TOKEN),
  );
}

describe("group order mutations require proof of who is calling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onlyHostTokenIsValid();
    groupServiceMocks.splitBill.mockResolvedValue({ success: true, data: [] });
    groupServiceMocks.processPayment.mockResolvedValue({
      success: true,
      data: {},
    });
    groupServiceMocks.leaveGroup.mockResolvedValue({ success: true });
    groupServiceMocks.getGroupOrder.mockResolvedValue({
      groupOrder: { id: GROUP_ORDER_ID, restaurantId: "rest-1" },
    });
  });

  describe("POST /:groupOrderId/split", () => {
    it("refuses a caller with no token", async () => {
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/split`,
        { splitType: "equal" },
      );

      expect(status).toBe(403);
      expect(groupServiceMocks.splitBill).not.toHaveBeenCalled();
    });

    it("refuses a member who is not the host", async () => {
      // Splitting locks the cart for everyone. One member should not be able
      // to end ordering for the table.
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/split`,
        { splitType: "equal", memberToken: OTHER_TOKEN },
      );

      expect(status).toBe(403);
      expect(groupServiceMocks.splitBill).not.toHaveBeenCalled();
    });

    it("allows the host", async () => {
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/split`,
        { splitType: "equal", memberToken: HOST_TOKEN },
      );

      expect(status).toBe(200);
      expect(groupServiceMocks.splitBill).toHaveBeenCalledOnce();
    });
  });

  describe("POST /:groupOrderId/payment/:memberId", () => {
    it("refuses a caller with no token", async () => {
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/payment/${OTHER_MEMBER_ID}`,
        { paymentMethod: "cash" },
      );

      expect(status).toBe(403);
      expect(groupServiceMocks.processPayment).not.toHaveBeenCalled();
    });

    it("refuses a member marking their own bill paid", async () => {
      // This records money as received. Self-service settlement means anyone
      // can walk out having declared themselves paid.
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/payment/${OTHER_MEMBER_ID}`,
        { paymentMethod: "cash", memberToken: OTHER_TOKEN },
      );

      expect(status).toBe(403);
      expect(groupServiceMocks.processPayment).not.toHaveBeenCalled();
    });

    it("allows the host to settle a member's bill", async () => {
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/payment/${OTHER_MEMBER_ID}`,
        { paymentMethod: "cash", memberToken: HOST_TOKEN },
      );

      expect(status).toBe(200);
      expect(groupServiceMocks.processPayment).toHaveBeenCalledOnce();
    });
  });

  describe("POST /:groupOrderId/leave/:memberId", () => {
    it("refuses a caller with no token", async () => {
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/leave/${OTHER_MEMBER_ID}`,
      );

      expect(status).toBe(403);
      expect(groupServiceMocks.leaveGroup).not.toHaveBeenCalled();
    });

    it("lets a member leave using their own token", async () => {
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/leave/${OTHER_MEMBER_ID}`,
        { memberToken: OTHER_TOKEN },
      );

      expect(status).toBe(200);
      expect(groupServiceMocks.leaveGroup).toHaveBeenCalledOnce();
    });

    it("refuses one member removing another", async () => {
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/leave/${HOST_MEMBER_ID}`,
        { memberToken: OTHER_TOKEN },
      );

      expect(status).toBe(403);
      expect(groupServiceMocks.leaveGroup).not.toHaveBeenCalled();
    });

    it("lets the host remove someone", async () => {
      const { status } = await call(
        "POST",
        `/orders/group/${GROUP_ORDER_ID}/leave/${OTHER_MEMBER_ID}`,
        { memberToken: HOST_TOKEN },
      );

      expect(status).toBe(200);
      expect(groupServiceMocks.leaveGroup).toHaveBeenCalledOnce();
    });
  });

  it("does not tell an unauthorised caller whether the group order exists", async () => {
    groupServiceMocks.isHostSession.mockResolvedValue(false);
    groupServiceMocks.isMemberSession.mockResolvedValue(false);

    const known = await call("POST", `/orders/group/${GROUP_ORDER_ID}/split`, {
      splitType: "equal",
      memberToken: "wrong",
    });
    const unknown = await call(
      "POST",
      "/orders/group/018ffb9a-7b8a-7c3d-9f23-999999999999/split",
      { splitType: "equal", memberToken: "wrong" },
    );

    expect(known.status).toBe(unknown.status);
  });
});
